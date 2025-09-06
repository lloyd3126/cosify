import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db, schema } from "@/server/db";
import { and, eq, lt } from "drizzle-orm";
import { getFlowBySlug } from "@/server/flows";

export const runtime = "nodejs";
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

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return NextResponse.json({ error: "未授權" }, { status: 401 });
    const { slug } = await ctx.params;
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor"); // ISO date string or null
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10", 10), 50);
    const deleted = url.searchParams.get("deleted") === "true"; // 是否查詢已刪除的項目

    // 根據 deleted 參數決定要查詢的 status
    const statusFilter = deleted ? "deleted" : "active";

    // 先掃描並刪除空的 run（無任何 step 的 r2Key 且無任何資產）
    // 只處理 active 狀態的 run
    if (!deleted) {
        try {
            const all = await db.query.flowRuns.findMany({
                where: (t, ops) => and(ops.eq(t.userId, session.user.id), ops.eq(t.slug, slug), ops.eq(t.status, "active")),
                columns: { runId: true },
            });
            for (const r of all) {
                const hasAsset = await db.query.flowRunStepAssets.findFirst({ where: (t, { eq }) => eq(t.runId, r.runId), columns: { id: true } });
                if (hasAsset) continue;
                const steps = await db.query.flowRunSteps.findMany({ where: (t, { eq }) => eq(t.runId, r.runId), columns: { r2Key: true } });
                const hasKey = steps.some((s) => !!s.r2Key);
                if (!hasKey) {
                    await db.delete(schema.flowRunStepAssets).where(eq(schema.flowRunStepAssets.runId, r.runId));
                    await db.delete(schema.flowRunSteps).where(eq(schema.flowRunSteps.runId, r.runId));
                    await db.delete(schema.flowRuns).where(eq(schema.flowRuns.runId, r.runId));
                }
            }
        } catch { /* ignore cleanup errors */ }
    }

    const runs = await db.query.flowRuns.findMany({
        where: (t, ops) => and(
            ops.eq(t.userId, session.user.id),
            ops.eq(t.slug, slug),
            ops.eq(t.status, statusFilter),
            cursor ? ops.lt(t.createdAt, new Date(cursor)) : undefined
        ),
        orderBy: (t, { desc }) => [desc(t.createdAt)],
        limit: limit + 1,
    });
    // 查 steps
    const page = runs.slice(0, limit);
    const results = [] as Array<{
        runId: string;
        createdAt: string;
        itemsPreview: Array<{ r2Key: string; createdAt: string }>;
        itemsTotal: number;
    }>;
    for (const r of page) {
        // 查詢已選取的圖片和生成的資產
        const [steps, stepAssets] = await Promise.all([
            // 查詢已明確選取或自動選取的圖片
            db.query.flowRunSteps.findMany({
                where: (t, { eq, isNotNull, and }) => and(
                    eq(t.runId, r.runId),
                    isNotNull(t.r2Key)
                )
            }),
            // 查詢所有生成的資產（用於填補沒有選取的步驟）
            db.query.flowRunStepAssets.findMany({
                where: (t, { eq }) => eq(t.runId, r.runId),
                orderBy: (t, { desc }) => [desc(t.createdAt)] // 最新的排前面
            })
        ]);

        // 建立選取圖片 map
        const selectedMap = new Map<string, { r2Key: string; createdAt: Date }>();
        steps.forEach(step => {
            if (step.r2Key) {
                selectedMap.set(step.stepId, {
                    r2Key: step.r2Key,
                    createdAt: step.createdAt
                });
            }
        });

        // 建立資產 map（每個步驟的最新資產）
        const assetMap = new Map<string, { r2Key: string; createdAt: Date }>();
        stepAssets.forEach(asset => {
            // 只保留每個步驟的最新資產
            if (!assetMap.has(asset.stepId)) {
                assetMap.set(asset.stepId, {
                    r2Key: asset.r2Key,
                    createdAt: asset.createdAt
                });
            }
        });

        // 合併結果：優先使用選取的，其次使用最新資產
        const finalImages: Array<{ r2Key: string; createdAt: Date; stepId: string }> = [];

        // 收集所有涉及的步驟
        const allStepIds = new Set([
            ...Array.from(selectedMap.keys()),
            ...Array.from(assetMap.keys())
        ]);

        for (const stepId of allStepIds) {
            const selected = selectedMap.get(stepId);
            const asset = assetMap.get(stepId);

            // 優先使用已選取的，否則使用最新資產
            const image = selected || asset;
            if (image) {
                finalImages.push({
                    r2Key: image.r2Key,
                    createdAt: image.createdAt,
                    stepId: stepId
                });
            }
        }

        // 建立圖片清單並排序：按步驟順序，過濾掉無效步驟
        const items = filterAndSortItemsByStep(finalImages, slug);

        // 若完全沒有項目，安全起見直接跳過（理論上已在前面刪除）
        if (items.length === 0) continue;

        // 提供最多 20 張預覽（移除展開限制）
        const preview = items.slice(0, 20).map((x) => ({ r2Key: x.r2Key, createdAt: x.createdAt.toISOString() }));
        results.push({ runId: r.runId, createdAt: r.createdAt.toISOString(), itemsPreview: preview, itemsTotal: items.length });
    }
    const nextCursor = runs.length > limit ? runs[limit - 1]?.createdAt?.toISOString?.() : null;
    return NextResponse.json({ runs: results, nextCursor });
}
