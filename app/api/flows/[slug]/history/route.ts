import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return NextResponse.json({ error: "未授權" }, { status: 401 });
    const { slug } = await ctx.params;
    const runs = await db.query.flowRuns.findMany({
        where: (t, { eq, and }) => and(eq(t.userId, session.user.id), eq(t.slug, slug)),
        orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    // 查 steps
    const results = [] as Array<{ runId: string; createdAt: string; steps: Array<{ stepId: string; r2Key: string | null }> }>;
    for (const r of runs) {
        const steps = await db.query.flowRunSteps.findMany({ where: (t, { eq }) => eq(t.runId, r.runId) });
        results.push({ runId: r.runId, createdAt: r.createdAt.toISOString(), steps: steps.map(s => ({ stepId: s.stepId, r2Key: s.r2Key })) });
    }
    return NextResponse.json({ runs: results });
}
