import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

// 批量公開 runId items
export async function POST(req: NextRequest) {
    const body = await req.json();
    const runIds: string[] = Array.isArray(body?.runIds) ? body.runIds : [];
    if (!runIds.length) return NextResponse.json({ items: [] });
    // 查詢所有 public 且存在的 runId
    const runs = await db.query.flowRuns.findMany({
        where: (t, { eq, inArray }) => inArray(t.runId, runIds),
        columns: { runId: true, public: true },
    });
    const validRunIds = runs.filter(r => r.public).map(r => r.runId);
    // 查詢所有 items
    const allItems = validRunIds.length
        ? await db.query.flowRunStepAssets.findMany({
            where: (t, { inArray }) => inArray(t.runId, validRunIds),
            columns: { runId: true, r2Key: true, createdAt: true, stepId: true },
        })
        : [];
    // 分組
    const itemsByRun: Record<string, Array<{ r2Key: string; createdAt: string; stepId: string }>> = {};
    for (const item of allItems) {
        if (!itemsByRun[item.runId]) itemsByRun[item.runId] = [];
        itemsByRun[item.runId].push({ r2Key: item.r2Key, createdAt: item.createdAt?.toISOString?.() ?? String(item.createdAt), stepId: item.stepId });
    }
    return NextResponse.json({ itemsByRun });
}
