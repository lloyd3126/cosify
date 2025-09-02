import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ runId: string; stepId: string }> }) {
    const { runId, stepId } = await ctx.params;
    const body = await req.json().catch(() => null) as { assetId: string } | null;
    if (!body?.assetId) return NextResponse.json({ error: "缺少 assetId" }, { status: 400 });

    // 確認 asset 屬於此 run+step
    const asset = await db.query.flowRunStepAssets.findFirst({ where: (t, { and, eq }) => and(eq(t.id, body.assetId), eq(t.runId, runId), eq(t.stepId, stepId)) });
    if (!asset) return NextResponse.json({ error: "找不到資產" }, { status: 404 });

    // 更新 flow_run_steps.r2_key 為採用中的 key
    await db
        .insert(schema.flowRunSteps)
        .values({ runId, stepId, r2Key: asset.r2Key, createdAt: new Date() })
        .onConflictDoUpdate({ target: [schema.flowRunSteps.runId, schema.flowRunSteps.stepId], set: { r2Key: asset.r2Key } });

    return NextResponse.json({ adoptedAssetId: asset.id, adoptedKey: asset.r2Key });
}
