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

    // 查詢被選中的圖片 (只查詢 runSteps)
    const runSteps = validRunIds.length
        ? await db.query.flowRunSteps.findMany({
            where: (t, { inArray, isNotNull, and }) => and(
                inArray(t.runId, validRunIds),
                isNotNull(t.r2Key)
            ),
            columns: { runId: true, r2Key: true, createdAt: true, stepId: true },
        })
        : [];

    // 按 runId 分組處理
    const itemsByRun: Record<string, Array<{ r2Key: string; createdAt: string; stepId: string }>> = {};

    for (const runId of validRunIds) {
        const runImages = runSteps.filter(step => step.runId === runId);

        // 暫時按時間排序，未來會改為按步驟排序
        runImages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        itemsByRun[runId] = runImages.map(img => ({
            r2Key: img.r2Key!,  // 我們已經過濾了 null 值
            createdAt: img.createdAt.toISOString(),
            stepId: img.stepId
        }));
    }

    return NextResponse.json({ itemsByRun });
}
