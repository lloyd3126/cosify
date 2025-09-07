import { NextRequest } from 'next/server'
import { CreditService } from '@/server/services/credit-service';
import { db } from '@/server/db';

/**
 * 🟢 TDD Green Phase: GET /api/credits/balance
 * 獲取用戶積分餘額
 */
export async function GET(request: NextRequest) {
    try {
        // Check authorization header (simple bearer token check)
        const authHeader = request.headers.get('Authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return Response.json(
                { success: false, error: 'UNAUTHORIZED' },
                { status: 401 }
            )
        }

        // 從查詢參數中獲取 userId
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return Response.json(
                { success: false, error: 'Missing userId parameter' },
                { status: 400 }
            );
        }

        // 初始化 CreditService
        const creditService = new CreditService(db);

        // 獲取用戶積分餘額
        const balance = await creditService.getValidCredits(userId);

        return Response.json({
            success: true,
            balance,
            validCredits: [{
                amount: balance,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            }],
            expiredCredits: []
        })

    } catch (error) {
        console.error('Credit balance error:', error)

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
