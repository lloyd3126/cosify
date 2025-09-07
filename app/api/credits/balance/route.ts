import { NextRequest } from 'next/server'
import { auth } from '@/server/auth'
import { CreditService } from '@/server/services/credit-service'
import { db } from '@/server/db'
import { headers } from 'next/headers'

/**
 * GET /api/credits/balance
 * Get user's current credit balance
 */
export async function GET(request: NextRequest) {
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

        const creditService = new CreditService(db)
        const balance = await creditService.getValidCredits(session.user.id)

        if (balance.success) {
            return Response.json({
                success: true,
                balance: balance.totalValid,
                expiringCredits: balance.expiringCredits
            })
        } else {
            return Response.json(
                { success: false, error: balance.error || 'UNKNOWN_ERROR' },
                { status: 500 }
            )
        }

    } catch (error) {
        console.error('Credit balance error:', error)
        return Response.json(
            { success: false, error: 'INTERNAL_ERROR' },
            { status: 500 }
        )
    }
}
