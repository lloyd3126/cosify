import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string; runId: string }> }) {
    const { runId } = await ctx.params;
    try {
        // 主要：每步的 r2Key（若已採用或為上傳步驟）
        const stepRows = await db.query.flowRunSteps.findMany({
            where: (t, { eq }) => eq(t.runId, runId),
            columns: { stepId: true, r2Key: true },
            orderBy: (t, { asc }) => [asc(t.createdAt)],
        });
        // 後援：若 r2Key 為空，回退到最新的資產（變體）作為可恢復顯示
        const assetRows = await db.query.flowRunStepAssets.findMany({
            where: (t, { eq }) => eq(t.runId, runId),
            columns: { stepId: true, r2Key: true, createdAt: true },
            orderBy: (t, { desc }) => [desc(t.createdAt)],
        });
        const latestAssetByStep = new Map<string, string>();
        for (const a of assetRows) {
            if (!latestAssetByStep.has(a.stepId) && a.r2Key) {
                latestAssetByStep.set(a.stepId, a.r2Key);
            }
        }
        // 合併：以 flow_run_steps.r2Key 為主，缺漏時用最新資產補上
        const seen = new Set<string>();
        const merged: Array<{ stepId: string; r2Key: string | null }> = [];
        for (const s of stepRows) {
            const key = s.r2Key ?? latestAssetByStep.get(s.stepId) ?? null;
            merged.push({ stepId: s.stepId, r2Key: key });
            seen.add(s.stepId);
        }
        for (const [sid, key] of latestAssetByStep.entries()) {
            if (!seen.has(sid)) merged.push({ stepId: sid, r2Key: key });
        }
        return NextResponse.json({ steps: merged });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "讀取失敗" }, { status: 500 });
    }
}
