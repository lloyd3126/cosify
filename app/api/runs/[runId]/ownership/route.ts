import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { headers } from "next/headers";
import { NextRequest } from "next/server";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ runId: string }> }
) {
    try {
        const { runId } = await params;
        const h = await headers();

        // 檢查用戶是否已登入
        const session = await auth.api.getSession({ headers: h });
        if (!session) {
            return Response.json(
                { error: "未授權" },
                { status: 401 }
            );
        }

        // 查找指定的 run
        const run = await db.query.flowRuns.findFirst({
            where: (t, { eq }) => eq(t.runId, runId),
            columns: {
                runId: true,
                userId: true
            }
        });

        // 檢查 run 是否存在
        if (!run) {
            return Response.json(
                { error: "Run 不存在" },
                { status: 404 }
            );
        }

        // 檢查當前用戶是否是 run 的擁有者
        const isOwner = run.userId === session.user.id;

        return Response.json({
            isOwner,
            runId
        });

    } catch (error) {
        console.error("檢查 run 擁有權時發生錯誤:", error);
        return Response.json(
            { error: "內部伺服器錯誤" },
            { status: 500 }
        );
    }
}
