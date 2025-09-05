// 簡化的測試 API，用於驗證路由結構
import { NextRequest } from "next/server";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ runId: string }> }
) {
    try {
        const { runId } = await params;

        // 模擬未登入狀態 - 直接返回 401
        return Response.json(
            { error: "未授權" },
            { status: 401 }
        );

    } catch (error) {
        console.error("測試 API 錯誤:", error);
        return Response.json(
            { error: "內部伺服器錯誤" },
            { status: 500 }
        );
    }
}
