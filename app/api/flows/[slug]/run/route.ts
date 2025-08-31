import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getFlowBySlug, validateFlow } from "@/server/flows";
import { db, schema } from "@/server/db";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "未授權" }, { status: 401 });
  const { slug } = await ctx.params;
  const flow = getFlowBySlug(slug);
  if (!flow) return NextResponse.json({ error: "找不到流程" }, { status: 404 });
  const errors = validateFlow(flow);
  if (errors.length > 0) return NextResponse.json({ error: "流程定義錯誤，無法開始" }, { status: 400 });

  const runId = randomUUID();
  await db.insert(schema.flowRuns).values({ runId, userId: session.user.id, slug, status: "active" });
  return NextResponse.json({ runId });
}
