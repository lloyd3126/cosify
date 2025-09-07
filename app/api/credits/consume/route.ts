import { NextRequest } from 'next/server'
import { auth } from '@/server/auth'
import { CreditService } from '@/server/services/credit-service'
import { db } from '@/server/db'
import { headers } from 'next/headers'

/**
 * POST /api/credits/consume
 * Consume credits for a user action
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        })

        if (!session?.user?.id) {
            return Response.json(
                { success: false, error: 'UNAUTHORIZED' },
                { status: 401 }
            )
        }

        const body = await request.json()
        const { amount, type = 'api_usage', description } = body

        if (!amount || amount <= 0) {
            return Response.json(
                { success: false, error: 'INVALID_REQUEST' },
                { status: 400 }
            )
        }

        const creditService = new CreditService(db)

        const consumption = await creditService.consumeCredits(
            session.user.id,
            amount
        )

        if (consumption.success) {
            return Response.json({
                success: true,
                consumption: {
                    consumed: consumption.consumed,
                    available: consumption.available,
                    transactions: consumption.transactions,
                    dailyUsed: consumption.dailyUsed,
                    dailyRemaining: consumption.dailyRemaining
                }
            })
        } else {
            const statusCode = consumption.error === 'INSUFFICIENT_CREDITS' ||
                consumption.error === 'DAILY_LIMIT_EXCEEDED' ? 400 : 500

            return Response.json(
                { success: false, error: consumption.error },
                { status: statusCode }
            )
        }

    } catch (error) {
        console.error('Credit consume error:', error)
        return Response.json(
            { success: false, error: 'INTERNAL_ERROR' },
            { status: 500 }
        )
    }
}
