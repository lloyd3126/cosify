import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db, schema } from "@/server/db";
import { eq } from "drizzle-orm";
import { r2 } from "@/server/r2";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ slug: string; runId: string }> }) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return NextResponse.json({ error: "未授權" }, { status: 401 });
    const { slug, runId } = await ctx.params;

    const run = await db.query.flowRuns.findFirst({ where: (t, { eq, and }) => and(eq(t.runId, runId), eq(t.userId, session.user.id), eq(t.slug, slug)) });
    if (!run) return NextResponse.json({ error: "找不到或無權限刪除此 run" }, { status: 404 });

    const steps = await db.query.flowRunSteps.findMany({ where: (t, { eq }) => eq(t.runId, runId) });

    // 刪除 R2 物件（逐一刪）
    for (const s of steps) {
        if (s.r2Key) {
            // 直接送 DeleteObject；bucket 從 r2 client 內設定
            try {
                const bucket = process.env.R2_BUCKET!;
                await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: s.r2Key }));
            } catch { /* 忽略個別刪除失敗 */ }
        }
    }

    // 刪 DB：先 steps 再 run
    await db.delete(schema.flowRunSteps).where(eq(schema.flowRunSteps.runId, runId));
    await db.delete(schema.flowRuns).where(eq(schema.flowRuns.runId, runId));

    return NextResponse.json({ ok: true });
}
