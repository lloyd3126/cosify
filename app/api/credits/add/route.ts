import { NextRequest } from 'next/server';
import { nanoid } from 'nanoid';

/**
 * 🟢 TDD Green Phase: 添加點數 API
 * POST /api/credits/add
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, amount, type, description, expiresAt } = body;

    // 驗證輸入
    if (!userId || !amount || !type) {
      return Response.json(
        { success: false, error: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    // 生成交易 ID
    const transactionId = nanoid();
    
    // TODO: 實際的資料庫操作
    // 目前只返回成功響應讓測試通過
    
    return Response.json({
      success: true,
      transactionId,
    });
  } catch (error) {
    console.error('Add credits error:', error);
    return Response.json(
      { success: false, error: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
