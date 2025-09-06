import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db, schema } from "@/server/db";
import { and, eq, lt } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return NextResponse.json({ error: "未授權" }, { status: 401 });
    const { slug } = await ctx.params;
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor"); // ISO date string or null
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10", 10), 50);

    // 先掃描並刪除空的 run（無任何 step 的 r2Key 且無任何資產）
    try {
        const all = await db.query.flowRuns.findMany({
            where: (t, ops) => and(ops.eq(t.userId, session.user.id), ops.eq(t.slug, slug)),
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
    const runs = await db.query.flowRuns.findMany({
        where: (t, ops) => and(
            ops.eq(t.userId, session.user.id),
            ops.eq(t.slug, slug),
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
        // 只查詢 runSteps 中有 r2Key 的記錄（被選中的圖片）
        const steps = await db.query.flowRunSteps.findMany({
            where: (t, { eq, isNotNull, and }) => and(
                eq(t.runId, r.runId),
                isNotNull(t.r2Key)
            )
        });

        // 建立圖片清單
        const items = steps.map(s => ({
            r2Key: s.r2Key!,
            createdAt: s.createdAt
        })).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        // 若完全沒有項目，安全起見直接跳過（理論上已在前面刪除）
        if (items.length === 0) continue;

        // 提供最多 20 張預覽（移除展開限制）
        const preview = items.slice(0, 20).map((x) => ({ r2Key: x.r2Key, createdAt: x.createdAt.toISOString() }));
        results.push({ runId: r.runId, createdAt: r.createdAt.toISOString(), itemsPreview: preview, itemsTotal: items.length });
    }
    const nextCursor = runs.length > limit ? runs[limit - 1]?.createdAt?.toISOString?.() : null;
    return NextResponse.json({ runs: results, nextCursor });
}
