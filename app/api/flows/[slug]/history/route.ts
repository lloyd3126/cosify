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
        // 取得此 run 的 steps 與 assets，組合成時間序列
        const [steps, assets] = await Promise.all([
            db.query.flowRunSteps.findMany({ where: (t, { eq }) => eq(t.runId, r.runId) }),
            db.query.flowRunStepAssets.findMany({ where: (t, { eq }) => eq(t.runId, r.runId) }),
        ]);
        const map = new Map<string, { r2Key: string; createdAt: Date }>();
        for (const a of assets) {
            map.set(a.r2Key, { r2Key: a.r2Key, createdAt: a.createdAt });
        }
        for (const s of steps) {
            if (s.r2Key && !map.has(s.r2Key)) {
                map.set(s.r2Key, { r2Key: s.r2Key, createdAt: s.createdAt });
            }
        }
        const items = Array.from(map.values()).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        // 若完全沒有項目，安全起見直接跳過（理論上已在前面刪除）
        if (items.length === 0) continue;
        // 提供最多 6 張預覽，對應前端在 lg 斷點一列 6 欄
        const preview = items.slice(0, 6).map((x) => ({ r2Key: x.r2Key, createdAt: x.createdAt.toISOString() }));
        results.push({ runId: r.runId, createdAt: r.createdAt.toISOString(), itemsPreview: preview, itemsTotal: items.length });
    }
    const nextCursor = runs.length > limit ? runs[limit - 1]?.createdAt?.toISOString?.() : null;
    return NextResponse.json({ runs: results, nextCursor });
}
