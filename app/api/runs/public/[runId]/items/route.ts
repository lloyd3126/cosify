import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/server/db";
import { eq, and, inArray, isNotNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

// 單一公開 runId items
export async function GET(req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
    const { runId } = await ctx.params;
    // 只允許 public 且存在的 runId
    const run = await db.query.flowRuns.findFirst({
        where: (t, { eq }) => eq(t.runId, runId),
        columns: { runId: true, public: true },
    });
    if (!run || !run.public) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // 取得此 run 的 steps 與 assets，組合成時間序列（與私有 API 邏輯一致）
    const [steps, assets] = await Promise.all([
        db.query.flowRunSteps.findMany({
            where: (t, { eq, isNotNull, and }) => and(eq(t.runId, runId), isNotNull(t.r2Key)),
            columns: { r2Key: true, createdAt: true, stepId: true }
        }),
        db.query.flowRunStepAssets.findMany({
            where: (t, { eq }) => eq(t.runId, runId),
            columns: { r2Key: true, createdAt: true, stepId: true }
        }),
    ]);

    // 使用 Map 去重，優先保留 assets 的記錄（與私有 API 邏輯一致）
    const map = new Map<string, { r2Key: string; createdAt: Date; stepId: string; kind: "upload" | "generate" }>();

    // 先加入 assets
    for (const a of assets) {
        map.set(a.r2Key, { r2Key: a.r2Key, createdAt: a.createdAt, stepId: a.stepId, kind: "generate" });
    }

    // 再加入 steps（如果 r2Key 已存在則不覆蓋）
    for (const s of steps) {
        if (s.r2Key && !map.has(s.r2Key)) {
            map.set(s.r2Key, { r2Key: s.r2Key, createdAt: s.createdAt, stepId: s.stepId, kind: "upload" });
        }
    }

    // 按時間排序（與私有 API 邏輯一致）
    const items = Array.from(map.values())
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((x) => ({
            r2Key: x.r2Key,
            createdAt: x.createdAt.toISOString(),
            stepId: x.stepId,
            kind: x.kind
        }));
    return NextResponse.json({ items });
}

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

    // 查詢所有 items（與私有 API 邏輯一致）
    const [runSteps, stepAssets] = await Promise.all([
        validRunIds.length
            ? db.query.flowRunSteps.findMany({
                where: (t, { inArray, isNotNull, and }) => and(
                    inArray(t.runId, validRunIds),
                    isNotNull(t.r2Key)
                ),
                columns: { runId: true, r2Key: true, createdAt: true, stepId: true },
            })
            : [],
        validRunIds.length
            ? db.query.flowRunStepAssets.findMany({
                where: (t, { inArray }) => inArray(t.runId, validRunIds),
                columns: { runId: true, r2Key: true, createdAt: true, stepId: true },
            })
            : [],
    ]);

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

        // 按時間排序（與私有 API 邏輯一致）
        const items = Array.from(map.values())
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
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
