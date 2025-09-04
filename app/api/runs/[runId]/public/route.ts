import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// 切換 run 公開狀態
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
    const { runId } = await ctx.params;
    // 權限檢查（此處僅示範，實際應驗證登入者是否有權限）
    // 取得 body 欲切換狀態
    const body = await req.json();
    const publicValue = typeof body?.public === "boolean" ? body.public : undefined;
    if (publicValue === undefined) {
        return NextResponse.json({ error: "Missing public value" }, { status: 400 });
    }
    // 更新 DB
    const result = await db.update(schema.flowRuns)
        .set({ public: publicValue })
        .where(eq(schema.flowRuns.runId, runId));
    return NextResponse.json({ success: true });
}
