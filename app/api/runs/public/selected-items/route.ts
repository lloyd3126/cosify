import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { getFlowBySlug } from "@/server/flows";
import { inArray, isNotNull, and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const body = await req.json();
    const runIds: string[] = Array.isArray(body?.runIds) ? body.runIds : [];
    const slug: string = body?.slug;

    if (!runIds.length) return NextResponse.json({ itemsByRun: {} });
    if (!slug) return NextResponse.json({ error: "Slug required" }, { status: 400 });

    // 取得 flow 定義（用於未來的步驟排序）
    const flow = getFlowBySlug(slug);
    if (!flow) return NextResponse.json({ error: "Flow not found" }, { status: 404 });

    // 驗證 runIds 是否為公開 runs
    const validRunIds: string[] = [];
    const runs = await db.query.flowRuns.findMany({
        where: (t, { inArray, eq, and }) => and(
            inArray(t.runId, runIds),
            eq(t.public, true)
        ),
        columns: { runId: true },
    });
    validRunIds.push(...runs.map(r => r.runId));

    // 查詢已選取的圖片和生成的資產
    const [runSteps, stepAssets] = validRunIds.length ? await Promise.all([
        // 查詢已明確選取或自動選取的圖片
        db.query.flowRunSteps.findMany({
            where: (t, { inArray, isNotNull, and }) => and(
                inArray(t.runId, validRunIds),
                isNotNull(t.r2Key)
            ),
            columns: { runId: true, r2Key: true, createdAt: true, stepId: true },
        }),
        // 查詢所有生成的資產（用於填補沒有選取的步驟）
        db.query.flowRunStepAssets.findMany({
            where: (t, { inArray }) => inArray(t.runId, validRunIds),
            columns: { runId: true, r2Key: true, createdAt: true, stepId: true },
            orderBy: (t, { desc }) => [desc(t.createdAt)] // 最新的排前面
        })
    ]) : [[], []];

    // 按 runId 分組處理
    const itemsByRun: Record<string, Array<{ r2Key: string; createdAt: string; stepId: string }>> = {};

    for (const runId of validRunIds) {
        // 建立該 run 的選取圖片 map
        const selectedMap = new Map<string, { r2Key: string; createdAt: Date; stepId: string }>();
        runSteps
            .filter(step => step.runId === runId)
            .forEach(step => {
                if (step.r2Key) { // 確保 r2Key 不為 null
                    selectedMap.set(step.stepId, {
                        r2Key: step.r2Key,
                        createdAt: step.createdAt,
                        stepId: step.stepId
                    });
                }
            });

        // 建立該 run 的資產 map（每個步驟的最新資產）
        const assetMap = new Map<string, { r2Key: string; createdAt: Date; stepId: string }>();
        stepAssets
            .filter(asset => asset.runId === runId)
            .forEach(asset => {
                // 只保留每個步驟的最新資產（第一次遇到的，因為已按時間降序排列）
                if (!assetMap.has(asset.stepId)) {
                    assetMap.set(asset.stepId, {
                        r2Key: asset.r2Key,
                        createdAt: asset.createdAt,
                        stepId: asset.stepId
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
                finalImages.push(image);
            }
        }

        // 按時間排序，未來會改為按步驟排序
        finalImages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        itemsByRun[runId] = finalImages.map(img => ({
            r2Key: img.r2Key,
            createdAt: img.createdAt.toISOString(),
            stepId: img.stepId
        }));
    }

    return NextResponse.json({ itemsByRun });
}
