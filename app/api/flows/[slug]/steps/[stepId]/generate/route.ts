import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getFlowBySlug } from "@/server/flows";
import { db, schema } from "@/server/db";
import { r2Get, r2Put } from "@/server/r2";
import { ai } from "@/server/genai";
import { randomUUID } from "node:crypto";

type Part = { text?: string } | { inlineData?: { data?: string; mimeType?: string } };
function hasInline(p: Part): p is { inlineData: { data: string; mimeType?: string } } {
    return "inlineData" in p && !!p.inlineData && typeof p.inlineData.data === "string";
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GenPayload = {
    runId: string;
    model: string;
    prompt: string;
    temperature?: number;
    inputKeys?: string[]; // 來自 R2 的 key 陣列（按順序）
    asVariant?: boolean; // 若為 true，輸出存為變體，不覆蓋主檔，也不更新 DB 的 r2Key
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string; stepId: string }> }) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return NextResponse.json({ error: "未授權" }, { status: 401 });
    const { slug, stepId } = await ctx.params;
    const flow = getFlowBySlug(slug);
    if (!flow) return NextResponse.json({ error: "找不到流程" }, { status: 404 });

    const body = (await req.json().catch(() => null)) as GenPayload | null;
    if (!body || typeof body.runId !== "string" || typeof body.model !== "string" || typeof body.prompt !== "string") {
        return NextResponse.json({ error: "參數不正確" }, { status: 400 });
    }

    // 權限與 run 檢查
    const run = await db.query.flowRuns.findFirst({ where: (t, { eq, and }) => and(eq(t.runId, body.runId), eq(t.userId, session.user.id), eq(t.slug, slug)) });
    if (!run) return NextResponse.json({ error: "無法使用此 run" }, { status: 403 });

    const start = Date.now();
    try {
        // 準備 inputs：僅支援 R2 key（前端先把 uploader/前置步驟結果存 R2 再傳 key）
        const inputs = Array.isArray(body.inputKeys) ? body.inputKeys : [];
        const buffers: Buffer[] = [];
        for (const key of inputs) {
            const b = await r2Get(key);
            if (!b) return NextResponse.json({ error: `找不到輸入：${key}` }, { status: 422 });
            buffers.push(b);
        }

        // 呼叫 Gemini：完全使用 JSON 權威參數
        const contents: Part[] = [{ text: body.prompt }];
        for (const buf of buffers) contents.push({ inlineData: { data: buf.toString("base64"), mimeType: "image/png" } });
        const res = await ai.models.generateContent({ model: body.model, config: body.temperature !== undefined ? { temperature: body.temperature } : undefined, contents });

        const parts = (res.candidates?.[0]?.content?.parts ?? []) as Part[];
        const inline = parts.find(hasInline);
        const base64 = inline?.inlineData.data;
        if (!base64) return NextResponse.json({ error: "模型未產出影像" }, { status: 500 });
        const out = Buffer.from(base64, "base64");

        const baseDir = `flows/${slug}/${session.user.id}/${body.runId}/${stepId}`;
        const isVariant = !!body.asVariant;
        const key = isVariant
            ? `${baseDir}/variant-${Date.now()}-${randomUUID()}.png`
            : `${baseDir}.png`;

        await r2Put(key, out, "image/png");

        if (!isVariant) {
            await db
                .insert(schema.flowRunSteps)
                .values({
                    runId: body.runId,
                    stepId,
                    r2Key: key,
                    durationMs: Date.now() - start,
                    model: body.model,
                    prompt: body.prompt,
                    temperature: body.temperature,
                    createdAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: [schema.flowRunSteps.runId, schema.flowRunSteps.stepId],
                    set: {
                        r2Key: key,
                        durationMs: Date.now() - start,
                        model: body.model,
                        prompt: body.prompt,
                        temperature: body.temperature,
                    },
                });
        }

        return NextResponse.json({ key, runId: body.runId, stepId });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "生成失敗";
        await db.insert(schema.flowRunSteps).values({ runId: body.runId, stepId, error: msg, createdAt: new Date() }).onConflictDoUpdate({ target: [schema.flowRunSteps.runId, schema.flowRunSteps.stepId], set: { error: msg } });
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
