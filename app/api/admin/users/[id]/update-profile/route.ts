// � TDD Refactor: 重構用戶個人資料更新 API
import { NextRequest } from 'next/server';
import { checkAdminAuth, createErrorResponse, createSuccessResponse } from '@/lib/admin-auth';
import { UserService } from '@/lib/user-service';

// POST /api/admin/users/[id]/update-profile - 更新用戶個人資料
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        // � Refactor: 使用提取的權限檢查中介軟體
        const authResult = checkAdminAuth(request);
        if (!authResult.success) {
            return createErrorResponse(authResult.error!, authResult.status!);
        }

        // 解析參數和請求體
        const params = await context.params;
        const userId = params.id;
        const body = await request.json();

        // 🔵 Refactor: 改進的輸入驗證
        if (!userId) {
            return createErrorResponse('User ID is required', 400);
        }

        if (!body.name || !body.email) {
            return createErrorResponse('INVALID_INPUT', 400);
        }

        // 驗證角色值
        if (body.role && !['super_admin', 'admin', 'free_user'].includes(body.role)) {
            return createErrorResponse('INVALID_ROLE', 400);
        }

        // 驗證每日限制
        if (body.dailyLimit !== undefined && (typeof body.dailyLimit !== 'number' || body.dailyLimit < 0)) {
            return createErrorResponse('INVALID_DAILY_LIMIT', 400);
        }

        // 🔵 Refactor: 使用服務層處理用戶操作
        const existingUser = await UserService.getUserById(userId);

        if (!existingUser) {
            // 創建新用戶
            await UserService.createUser({
                id: userId,
                name: body.name,
                email: body.email,
                role: body.role,
                dailyLimit: body.dailyLimit,
            });
        } else {
            // 更新現有用戶
            await UserService.updateUser(userId, {
                name: body.name,
                email: body.email,
                role: body.role,
                dailyLimit: body.dailyLimit,
            });
        }

        // 返回更新後的用戶資料
        const updatedUser = await UserService.getUserWithCredits(userId);

        if (!updatedUser) {
            return createErrorResponse('Failed to retrieve updated user', 500);
        }

        return createSuccessResponse({ user: updatedUser });

    } catch (error) {
        console.error('Error updating user:', error);
        return createErrorResponse('Failed to update user', 500);
    }
}
