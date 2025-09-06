import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
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

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string; runId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "未授權" }, { status: 401 });
  const { slug, runId } = await ctx.params;

  const run = await db.query.flowRuns.findFirst({ where: (t, { and, eq }) => and(eq(t.runId, runId), eq(t.userId, session.user.id), eq(t.slug, slug)) });
  if (!run) return NextResponse.json({ error: "找不到 run" }, { status: 404 });

  const [steps, assets] = await Promise.all([
    db.query.flowRunSteps.findMany({
      where: (t, { eq }) => eq(t.runId, runId),
      columns: { r2Key: true, createdAt: true, stepId: true }
    }),
    db.query.flowRunStepAssets.findMany({
      where: (t, { eq }) => eq(t.runId, runId),
      columns: { r2Key: true, createdAt: true, stepId: true }
    }),
  ]);

  const map = new Map<string, { r2Key: string; createdAt: Date; stepId: string; kind: "upload" | "generate" }>();
  for (const a of assets) {
    map.set(a.r2Key, { r2Key: a.r2Key, createdAt: a.createdAt, stepId: a.stepId, kind: "generate" });
  }
  for (const s of steps) {
    if (s.r2Key && !map.has(s.r2Key)) {
      map.set(s.r2Key, { r2Key: s.r2Key, createdAt: s.createdAt, stepId: s.stepId, kind: "upload" });
    }
  }

  const items = filterAndSortItemsByStep(Array.from(map.values()), slug)
    .map((x) => ({ r2Key: x.r2Key, createdAt: x.createdAt.toISOString(), stepId: x.stepId, kind: x.kind }));

  return NextResponse.json({ items });
}
