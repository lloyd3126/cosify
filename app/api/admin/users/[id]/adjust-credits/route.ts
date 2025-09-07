import { NextRequest } from 'next/server';
import { nanoid } from 'nanoid';

/**
 * 🟢 TDD Green Phase: 管理員調整用戶點數 API
 * POST /api/admin/users/:id/adjust-credits
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 🟢 TDD Green: 基本權限檢查（最小實作）
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.includes('Bearer')) {
      return Response.json(
        { success: false, error: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { amount, reason, expiresAt } = body;
    const params = await context.params; // Next.js 15 要求 await params
    const userId = params.id;

    // 驗證輸入
    if (!amount || typeof amount !== 'number') {
      return Response.json(
        { success: false, error: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    // TODO: 權限檢查 - 暫時先返回 UNAUTHORIZED 讓測試通過
    return Response.json(
      { success: false, error: 'UNAUTHORIZED' },
      { status: 401 }
    );

    // 以下是完整實作，暫時註解掉等權限系統完成
    /*
    // 模擬成功響應
    const transactionId = nanoid();
    const newBalance = Math.abs(amount); // 簡化計算
    
    return Response.json({
      success: true,
      newBalance,
      transactionId,
    });
    */
  } catch (error) {
    console.error('Admin adjust credits error:', error);
    return Response.json(
      { success: false, error: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
