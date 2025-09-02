import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ runId: string; stepId: string }> }) {
    const { runId, stepId } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

    const assets = await db.query.flowRunStepAssets.findMany({
        where: (t, { and, eq }) => and(eq(t.runId, runId), eq(t.stepId, stepId)),
        orderBy: (t, { desc }) => [desc(t.createdAt)],
        limit,
    });

    // adoptedKey 取自 flow_run_steps.r2_key（若已有值）
    const adopted = await db.query.flowRunSteps.findFirst({ where: (t, { and, eq }) => and(eq(t.runId, runId), eq(t.stepId, stepId)) });
    const adoptedKey = adopted?.r2Key || null;

    return NextResponse.json({ assets, adoptedKey });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ runId: string; stepId: string }> }) {
    // 建立資產：主要供內部或工具用。前端通常不直接呼叫此 API 建立（生成路由已寫庫）。
    const { runId, stepId } = await ctx.params;
    const body = await req.json().catch(() => null) as { r2Key: string; status?: string; temperature?: number; model?: string; prompt?: string; meta?: unknown } | null;
    if (!body || !body.r2Key) return NextResponse.json({ error: "缺少 r2Key" }, { status: 400 });
    try {
        const id = crypto.randomUUID();
        await db.insert(schema.flowRunStepAssets).values({
            id,
            runId,
            stepId,
            r2Key: body.r2Key,
            status: body.status ?? "done",
            temperature: body.temperature,
            model: body.model,
            prompt: body.prompt,
            meta: body.meta ? JSON.stringify(body.meta) : null as any,
            createdAt: new Date(),
        }).onConflictDoNothing();
        return NextResponse.json({ id });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "建立失敗" }, { status: 500 });
    }
}
