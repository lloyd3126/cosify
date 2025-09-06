import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/server/db";
import { eq } from "drizzle-orm";
import { auth } from "@/server/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

// 獲取 run 公開狀態
export async function GET(req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
    try {
        const { runId } = await ctx.params;
        const h = await headers();

        // 權限檢查：驗證登入者是否有權限
        const session = await auth.api.getSession({ headers: h });
        if (!session) {
            return NextResponse.json({ error: "未授權" }, { status: 401 });
        }

        // 檢查該 run 是否屬於當前用戶
        const run = await db.query.flowRuns.findFirst({
            where: (t, { eq }) => eq(t.runId, runId),
            columns: { userId: true, public: true }
        });

        if (!run) {
            return NextResponse.json({ error: "Run 不存在" }, { status: 404 });
        }

        if (run.userId !== session.user.id) {
            return NextResponse.json({ error: "無權限查看此 Run" }, { status: 403 });
        }

        return NextResponse.json({ public: run.public });
    } catch (error) {
        console.error("獲取 run 公開狀態時發生錯誤:", error);
        return NextResponse.json({ error: "內部伺服器錯誤" }, { status: 500 });
    }
}

// 切換 run 公開狀態
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
    try {
        const { runId } = await ctx.params;
        const h = await headers();

        // 權限檢查：驗證登入者是否有權限
        const session = await auth.api.getSession({ headers: h });
        if (!session) {
            return NextResponse.json({ error: "未授權" }, { status: 401 });
        }

        // 檢查該 run 是否屬於當前用戶
        const run = await db.query.flowRuns.findFirst({
            where: (t, { eq }) => eq(t.runId, runId),
            columns: { userId: true }
        });

        if (!run) {
            return NextResponse.json({ error: "Run 不存在" }, { status: 404 });
        }

        if (run.userId !== session.user.id) {
            return NextResponse.json({ error: "無權限修改此 Run" }, { status: 403 });
        }

        // 取得 body 欲切換狀態
        const body = await req.json();
        const publicValue = typeof body?.public === "boolean" ? body.public : undefined;
        if (publicValue === undefined) {
            return NextResponse.json({ error: "Missing public value" }, { status: 400 });
        }

        // 更新 DB
        await db.update(schema.flowRuns)
            .set({ public: publicValue })
            .where(eq(schema.flowRuns.runId, runId));

        return NextResponse.json({ success: true, public: publicValue });
    } catch (error) {
        console.error("更新 run 公開狀態時發生錯誤:", error);
        return NextResponse.json({ error: "內部伺服器錯誤" }, { status: 500 });
    }
}
