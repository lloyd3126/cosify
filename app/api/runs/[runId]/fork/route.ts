import { auth } from "@/server/auth";
import { db, schema } from "@/server/db";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ runId: string }> }
) {
    try {
        const { runId: originalRunId } = await params;
        const h = await headers();

        // 檢查用戶是否已登入
        const session = await auth.api.getSession({ headers: h });
        if (!session) {
            return Response.json(
                { error: "未授權" },
                { status: 401 }
            );
        }

        // 查找原始 run
        const originalRun = await db.query.flowRuns.findFirst({
            where: (t, { eq }) => eq(t.runId, originalRunId),
            columns: {
                runId: true,
                userId: true,
                slug: true,
                status: true,
                public: true
            }
        });

        // 檢查原始 run 是否存在
        if (!originalRun) {
            return Response.json(
                { error: "原始 Run 不存在" },
                { status: 404 }
            );
        }

        // 檢查權限：只能 fork 公開的 run 或自己的 run
        const canFork = originalRun.public || originalRun.userId === session.user.id;
        if (!canFork) {
            return Response.json(
                { error: "無權限 fork 此 Run" },
                { status: 403 }
            );
        }

        // 生成新的 runId
        const newRunId = `run-${randomUUID()}`;

        // 開始事務處理
        await db.transaction(async (tx) => {
            // 1. 創建新的 flowRuns 記錄
            await tx.insert(schema.flowRuns).values({
                runId: newRunId,
                userId: session.user.id,  // 設為當前用戶
                slug: originalRun.slug,   // 保持相同的 slug
                status: "active",         // 重置狀態
                public: false,            // 預設為私人
                // createdAt 和 updatedAt 會自動設定
            });

            // 2. 複製所有 flowRunSteps
            const originalSteps = await tx.query.flowRunSteps.findMany({
                where: (t, { eq }) => eq(t.runId, originalRunId)
            });

            if (originalSteps.length > 0) {
                await tx.insert(schema.flowRunSteps).values(
                    originalSteps.map(step => ({
                        runId: newRunId,           // 新的 runId
                        stepId: step.stepId,       // 保持相同的 stepId
                        r2Key: step.r2Key,         // 保持相同的 r2Key（共享檔案）
                        durationMs: step.durationMs,
                        model: step.model,
                        prompt: step.prompt,
                        temperature: step.temperature,
                        error: step.error,
                        // createdAt 會自動設定為當前時間
                    }))
                );
            }

            // 3. 複製所有 flowRunStepAssets
            const originalAssets = await tx.query.flowRunStepAssets.findMany({
                where: (t, { eq }) => eq(t.runId, originalRunId)
            });

            if (originalAssets.length > 0) {
                await tx.insert(schema.flowRunStepAssets).values(
                    originalAssets.map(asset => ({
                        id: `asset-${randomUUID()}`,  // 生成新的 asset ID
                        runId: newRunId,           // 新的 runId
                        stepId: asset.stepId,      // 保持相同的 stepId
                        r2Key: asset.r2Key,        // 保持相同的 r2Key（共享檔案）
                        status: asset.status,
                        temperature: asset.temperature,
                        model: asset.model,
                        prompt: asset.prompt,
                        meta: asset.meta,
                        // createdAt 會自動設定為當前時間
                    }))
                );
            }
        });

        return Response.json(
            {
                success: true,
                newRunId,
                originalRunId,
                message: "副本創建成功"
            },
            { status: 201 }
        );

    } catch (error) {
        console.error("創建 run 副本時發生錯誤:", error);
        return Response.json(
            { error: "創建副本失敗" },
            { status: 500 }
        );
    }
}
