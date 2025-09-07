import { NextRequest } from 'next/server'
import { auth } from '@/server/auth'
import { db } from '@/server/db'
import { creditTransactions } from '@/server/db/schema'
import { eq, desc, count } from 'drizzle-orm'
import { headers } from 'next/headers'

/**
 * GET /api/credits/history
 * Get user's credit transaction history with pagination
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

        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
        const offset = (page - 1) * limit

        // Get transactions for this user
        const transactions = await db.select()
            .from(creditTransactions)
            .where(eq(creditTransactions.userId, session.user.id))
            .orderBy(desc(creditTransactions.createdAt))
            .limit(limit)
            .offset(offset)

        // Get total count for pagination
        const totalResult = await db.select({ count: count() })
            .from(creditTransactions)
            .where(eq(creditTransactions.userId, session.user.id))

        const total = totalResult[0]?.count || 0

        return Response.json({
            success: true,
            transactions: transactions.map(tx => ({
                id: tx.id,
                amount: tx.amount,
                type: tx.type,
                description: tx.description,
                createdAt: tx.createdAt,
                expiresAt: tx.expiresAt,
                consumedAt: tx.consumedAt
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        })

    } catch (error) {
        console.error('Credit history error:', error)
        return Response.json(
            { success: false, error: 'INTERNAL_ERROR' },
            { status: 500 }
        )
    }
}
