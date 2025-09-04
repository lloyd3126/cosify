import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/server/db";
import { eq, and } from "drizzle-orm";

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
    // 取 items（step assets）
    const items = await db.query.flowRunStepAssets.findMany({
        where: (t, { eq }) => eq(t.runId, runId),
        columns: { r2Key: true, createdAt: true, stepId: true },
    });
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
    // 查詢所有 items
    const allItems = validRunIds.length
        ? await db.query.flowRunStepAssets.findMany({
            where: (t, { inArray }) => inArray(t.runId, validRunIds),
            columns: { runId: true, r2Key: true, createdAt: true, stepId: true },
        })
        : [];
    // 分組
    const itemsByRun: Record<string, Array<{ r2Key: string; createdAt: string; stepId: string }>> = {};
    for (const item of allItems) {
        if (!itemsByRun[item.runId]) itemsByRun[item.runId] = [];
        itemsByRun[item.runId].push({ r2Key: item.r2Key, createdAt: item.createdAt?.toISOString?.() ?? String(item.createdAt), stepId: item.stepId });
    }
    return NextResponse.json({ itemsByRun });
}
