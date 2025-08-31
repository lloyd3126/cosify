import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getFlowBySlug } from "@/server/flows";
import { db, schema } from "@/server/db";
import { r2Put } from "@/server/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string; stepId: string }> }) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return NextResponse.json({ error: "未授權" }, { status: 401 });
    const { slug, stepId } = await ctx.params;
    const flow = getFlowBySlug(slug);
    if (!flow) return NextResponse.json({ error: "找不到流程" }, { status: 404 });

    const form = await req.formData();
    const runId = form.get("runId");
    const file = form.get("file");
    if (typeof runId !== "string" || !(file instanceof File)) {
        return NextResponse.json({ error: "參數不正確" }, { status: 400 });
    }

    // 權限：runId 必須屬於此使用者，且 slug 一致
    const run = await db.query.flowRuns.findFirst({ where: (t, { eq, and }) => and(eq(t.runId, runId), eq(t.userId, session.user.id), eq(t.slug, slug)) });
    if (!run) return NextResponse.json({ error: "無法使用此 run" }, { status: 403 });

    const buf = Buffer.from(await file.arrayBuffer());
    const key = `flows/${slug}/${session.user.id}/${runId}/${stepId}.png`;
    await r2Put(key, buf, "image/png");

    await db.insert(schema.flowRunSteps).values({ runId, stepId, r2Key: key, createdAt: new Date() }).onConflictDoUpdate({ target: [schema.flowRunSteps.runId, schema.flowRunSteps.stepId], set: { r2Key: key } });

    return NextResponse.json({ key, runId, stepId });
}
