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
    // 查詢所有 step assets (生成的圖片)
    const stepAssets = validRunIds.length
        ? await db.query.flowRunStepAssets.findMany({
            where: (t, { inArray }) => inArray(t.runId, validRunIds),
            columns: { runId: true, r2Key: true, createdAt: true, stepId: true },
        })
        : [];

    // 查詢所有 run steps (包含上傳的圖片)
    const runSteps = validRunIds.length
        ? await db.query.flowRunSteps.findMany({
            where: (t, { inArray, isNotNull, and }) => and(
                inArray(t.runId, validRunIds),
                isNotNull(t.r2Key)
            ),
            columns: { runId: true, r2Key: true, createdAt: true, stepId: true },
        })
        : [];

    // 合併所有 items (上傳的圖片 + 生成的圖片)
    const allItems = [...runSteps, ...stepAssets];

    // 分組
    const itemsByRun: Record<string, Array<{ r2Key: string; createdAt: string; stepId: string }>> = {};
    for (const item of allItems) {
        // 只處理有 r2Key 的項目
        if (!item.r2Key) continue;

        if (!itemsByRun[item.runId]) itemsByRun[item.runId] = [];
        itemsByRun[item.runId].push({
            r2Key: item.r2Key,
            createdAt: item.createdAt?.toISOString?.() ?? String(item.createdAt),
            stepId: item.stepId
        });
    }
    return NextResponse.json({ itemsByRun });
}
