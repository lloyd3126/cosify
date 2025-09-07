import { NextRequest } from 'next/server'
import { CreditService } from '@/server/services/credit-service';
import { db } from '@/server/db';

/**
 * 🟢 TDD Green Phase: POST /api/credits/consume
 * 消費用戶積分
 */
export async function POST(request: NextRequest) {
    try {
        // Check authorization header (simple bearer token check)
        const authHeader = request.headers.get('Authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return Response.json(
                { success: false, error: 'UNAUTHORIZED' },
                { status: 401 }
            )
        }

        const body = await request.json()
        const { userId, amount, description } = body

        if (!userId || !amount || amount <= 0) {
            return Response.json(
                { success: false, error: 'INVALID_REQUEST' },
                { status: 400 }
            )
        }

        // 初始化 CreditService
        const creditService = new CreditService(db);

        // 檢查每日限制
        const dailyLimitCheck = await creditService.checkDailyLimit(userId, amount);
        if (!dailyLimitCheck.canConsume) {
            return Response.json(
                { success: false, error: 'DAILY_LIMIT_EXCEEDED' },
                { status: 429 }
            );
        }

        // 消費積分
        const result = await creditService.consumeCredits(userId, amount);

        if (!result.success) {
            if (result.error === 'Insufficient credits') {
                return Response.json(
                    { success: false, error: 'INSUFFICIENT_CREDITS' },
                    { status: 400 }
                );
            }
            return Response.json(
                { success: false, error: result.error || 'CONSUMPTION_FAILED' },
                { status: 400 }
            );
        }

        // 獲取剩餘積分
        const remainingCredits = await creditService.getValidCredits(userId);

        return Response.json({
            success: true,
            consumed: amount,
            remainingCredits,
            transactions: result.transactions || [],
            dailyUsed: result.dailyUsed || amount,
            dailyRemaining: dailyLimitCheck.dailyRemaining || 0
        })

    } catch (error) {
        console.error('Credit consume error:', error)

        if (error instanceof Error) {
            if (error.message.includes('User not found')) {
                return Response.json(
                    { success: false, error: 'USER_NOT_FOUND' },
                    { status: 404 }
                );
            }
        }

        return Response.json(
            { success: false, error: 'INTERNAL_ERROR' },
            { status: 500 }
        )
    }
}
