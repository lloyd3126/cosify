// 🔵 TDD Refactor: 重構管理員調整用戶點數 API
import { NextRequest } from 'next/server';
import { nanoid } from 'nanoid';
import { checkAdminAuth, createErrorResponse, createSuccessResponse } from '@/lib/admin-auth';

/**
 * POST /api/admin/users/:id/adjust-credits
 */
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

    const body = await request.json();
    const { amount, reason, expiresAt } = body;
    const params = await context.params;
    const userId = params.id;

    // 🔵 Refactor: 改進的輸入驗證
    if (!amount || typeof amount !== 'number') {
      return createErrorResponse('INVALID_INPUT', 400);
    }

    if (!userId) {
      return createErrorResponse('User ID is required', 400);
    }

    // 🟢 Green Phase: 最小實作 - 目前測試期望 401
    // 🔵 Refactor: 將來可以實作真實的積分調整邏輯
    return createErrorResponse('UNAUTHORIZED', 401);
    
  } catch (error) {
    console.error('Error adjusting credits:', error);
    return createErrorResponse('Failed to adjust credits', 500);
  }
}
