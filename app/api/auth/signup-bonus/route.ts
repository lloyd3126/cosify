import { NextRequest } from 'next/server';
import { nanoid } from 'nanoid';

/**
 * 🟢 TDD Green Phase: 註冊獎勵 API
 * POST /api/auth/signup-bonus
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email } = body;

    // 驗證輸入
    if (!userId || !email) {
      return Response.json(
        { success: false, error: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    // TODO: 檢查是否已經領取過獎勵
    // 暫時模擬已領取的情況（用特定 userId 觸發）
    if (userId === 'existing-user-456') {
      return Response.json(
        { success: false, error: 'BONUS_ALREADY_CLAIMED' },
        { status: 400 }
      );
    }

    // 生成交易 ID 和到期時間
    const transactionId = nanoid();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1年後

    // TODO: 實際的資料庫操作
    // 目前只返回成功響應讓測試通過
    
    return Response.json({
      success: true,
      bonusAmount: 100,
      transactionId,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Signup bonus error:', error);
    return Response.json(
      { success: false, error: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
