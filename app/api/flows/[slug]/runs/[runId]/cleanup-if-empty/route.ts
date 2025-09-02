import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db, schema } from "@/server/db";
import { getFlowBySlug } from "@/server/flows";
import { r2 } from "@/server/r2";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 以最小副作用在關閉頁面時呼叫：若該 run 沒有任何「生成圖片」（imgGenerator）成果，就自動清理 run 與其可能的上傳檔。
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string; runId: string }> }) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return NextResponse.json({ error: "未授權" }, { status: 401 });
    const { slug, runId } = await ctx.params;

    const run = await db.query.flowRuns.findFirst({ where: (t, { and, eq }) => and(eq(t.runId, runId), eq(t.userId, session.user.id), eq(t.slug, slug)) });
    if (!run) return NextResponse.json({ deleted: false, reason: "not-found-or-no-access" }, { status: 404 });

    const flow = getFlowBySlug(slug);
    if (!flow) return NextResponse.json({ deleted: false, reason: "flow-missing" }, { status: 404 });

    const genStepIds = flow.steps.filter(s => (s as any).type === "imgGenerator").map(s => s.id);

    // 若流程沒有任何 imgGenerator 步驟，視為不可刪除（避免誤刪）
    if (genStepIds.length === 0) return NextResponse.json({ deleted: false, reason: "no-generator-steps" });

    // 是否已有任何生成成果？查變體資產與已採用鍵
    const anyAsset = await db.query.flowRunStepAssets.findFirst({
        where: (t, { and, eq, inArray }) => and(eq(t.runId, runId), inArray(t.stepId, genStepIds)),
    });
    if (anyAsset) return NextResponse.json({ deleted: false, reason: "has-generated-assets" });

    const anyAdopted = await db.query.flowRunSteps.findFirst({
        where: (t, { and, eq, inArray, isNotNull }) => and(eq(t.runId, runId), inArray(t.stepId, genStepIds), isNotNull(t.r2Key)),
    });
    if (anyAdopted) return NextResponse.json({ deleted: false, reason: "has-generated-keys" });

    // 無任何生成成果：刪除本 run 相關資料與可能的上傳物件（如有）
    const steps = await db.query.flowRunSteps.findMany({ where: (t, { eq }) => eq(t.runId, runId) });
    for (const s of steps) {
        if (s.r2Key) {
            try {
                const bucket = process.env.R2_BUCKET!;
                await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: s.r2Key }));
            } catch {
                // 忽略個別刪除失敗
            }
        }
    }

    // DB 清除順序：assets -> steps -> run
    await db.delete(schema.flowRunStepAssets).where(eq(schema.flowRunStepAssets.runId, runId));
    await db.delete(schema.flowRunSteps).where(eq(schema.flowRunSteps.runId, runId));
    await db.delete(schema.flowRuns).where(eq(schema.flowRuns.runId, runId));

    return NextResponse.json({ deleted: true });
}
