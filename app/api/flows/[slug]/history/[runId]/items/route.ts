import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string; runId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "未授權" }, { status: 401 });
  const { slug, runId } = await ctx.params;

  const run = await db.query.flowRuns.findFirst({ where: (t, { and, eq }) => and(eq(t.runId, runId), eq(t.userId, session.user.id), eq(t.slug, slug)) });
  if (!run) return NextResponse.json({ error: "找不到 run" }, { status: 404 });

  const [steps, assets] = await Promise.all([
    db.query.flowRunSteps.findMany({ where: (t, { eq }) => eq(t.runId, runId) }),
    db.query.flowRunStepAssets.findMany({ where: (t, { eq }) => eq(t.runId, runId) }),
  ]);

  const map = new Map<string, { r2Key: string; createdAt: Date; kind: "upload" | "generate" }>();
  for (const a of assets) {
    map.set(a.r2Key, { r2Key: a.r2Key, createdAt: a.createdAt, kind: "generate" });
  }
  for (const s of steps) {
    if (s.r2Key && !map.has(s.r2Key)) {
      map.set(s.r2Key, { r2Key: s.r2Key, createdAt: s.createdAt, kind: "upload" });
    }
  }

  const items = Array.from(map.values())
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((x) => ({ r2Key: x.r2Key, createdAt: x.createdAt.toISOString(), kind: x.kind }));

  return NextResponse.json({ items });
}
