import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { inArray, isNotNull, and } from "drizzle-orm";
import { getFlowBySlug } from "@/server/flows";

export const dynamic = "force-dynamic";

// 輔助函數：取得步驟在流程中的順序索引，找不到返回 null
function getStepOrder(slug: string, stepId: string): number | null {
    const flow = getFlowBySlug(slug);
    if (!flow || !flow.steps) return null;

    const index = flow.steps.findIndex(step => step.id === stepId);
    return index === -1 ? null : index;
}

// 輔助函數：過濾並排序函數，只保留有效步驟並按步驟順序排序
function filterAndSortItemsByStep<T extends { stepId: string; createdAt: Date }>(items: T[], slug: string): T[] {
    // 先過濾出有效的步驟
    const validItems = items.filter(item => {
        const stepOrder = getStepOrder(slug, item.stepId);
        return stepOrder !== null;
    });

    // 按步驟順序排序
    return validItems.sort((a, b) => {
        const stepOrderA = getStepOrder(slug, a.stepId)!;
        const stepOrderB = getStepOrder(slug, b.stepId)!;

        return stepOrderA - stepOrderB;
    });
}

// 批量公開 runId items
export async function POST(req: NextRequest) {
    const body = await req.json();
    const runIds: string[] = Array.isArray(body?.runIds) ? body.runIds : [];
    if (!runIds.length) return NextResponse.json({ items: [] });
    // 查詢所有 public 且存在的 runId，包含 slug
    const runs = await db.query.flowRuns.findMany({
        where: (t, { eq, inArray }) => inArray(t.runId, runIds),
        columns: { runId: true, public: true, slug: true },
    });
    const validRuns = runs.filter(r => r.public);
    const validRunIds = validRuns.map(r => r.runId);
    const runSlugMap = Object.fromEntries(validRuns.map(r => [r.runId, r.slug]));
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

    // 使用與私有 API 相同的邏輯：按 runId 分組處理，去重並排序
    const itemsByRun: Record<string, Array<{ r2Key: string; createdAt: string; stepId: string }>> = {};

    for (const runId of validRunIds) {
        // 取得此 run 的 steps 與 assets，組合成時間序列
        const runStepsForRun = runSteps.filter(s => s.runId === runId);
        const assetsForRun = stepAssets.filter(a => a.runId === runId);

        // 使用 Map 去重，優先保留 assets 的記錄（與私有 API 邏輯一致）
        const map = new Map<string, { r2Key: string; createdAt: Date; stepId: string }>();

        // 先加入 assets
        for (const a of assetsForRun) {
            map.set(a.r2Key, { r2Key: a.r2Key, createdAt: a.createdAt, stepId: a.stepId });
        }

        // 再加入 steps（如果 r2Key 已存在則不覆蓋）
        for (const s of runStepsForRun) {
            if (s.r2Key && !map.has(s.r2Key)) {
                map.set(s.r2Key, { r2Key: s.r2Key, createdAt: s.createdAt, stepId: s.stepId });
            }
        }

        // 按步驟順序排序，過濾掉無效步驟
        const items = filterAndSortItemsByStep(Array.from(map.values()), runSlugMap[runId])
            .map((x) => ({
                r2Key: x.r2Key,
                createdAt: x.createdAt.toISOString(),
                stepId: x.stepId
            }));

        if (items.length > 0) {
            itemsByRun[runId] = items;
        }
    }
    return NextResponse.json({ itemsByRun });
}
