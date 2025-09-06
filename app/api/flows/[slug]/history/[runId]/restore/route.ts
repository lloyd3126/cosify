import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db, schema } from "@/server/db";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string; runId: string }> }) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return NextResponse.json({ error: "未授權" }, { status: 401 });
    const { slug, runId } = await ctx.params;

    const run = await db.query.flowRuns.findFirst({
        where: (t, { eq, and }) => and(
            eq(t.runId, runId),
            eq(t.userId, session.user.id),
            eq(t.slug, slug),
            eq(t.status, "deleted") // 只能還原已刪除的項目
        )
    });

    if (!run) return NextResponse.json({ error: "找不到或無權限還原此 run" }, { status: 404 });

    // 還原：更新 status 為 active
    await db.update(schema.flowRuns)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(schema.flowRuns.runId, runId));

    return NextResponse.json({ ok: true, restored: true });
}
