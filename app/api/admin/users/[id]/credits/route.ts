import { NextRequest } from 'next/server'
import { auth } from '@/server/auth'
import { AuthService } from '@/server/services/auth-service'
import { CreditService } from '@/server/services/credit-service'
import { db } from '@/server/db'
import { headers } from 'next/headers'

/**
 * POST /api/admin/users/[id]/credits
 * Manage user credit balance (admin only)
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
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

        // Verify admin privileges
        const authService = new AuthService(db)
        const adminCheck = await authService.verifyAdminPrivileges(session.user.id)

        if (!adminCheck.success || !adminCheck.isAdmin) {
            return Response.json(
                { success: false, error: 'ADMIN_REQUIRED' },
                { status: 403 }
            )
        }

        const { id: userId } = params
        const body = await request.json()
        const { operation, amount, description } = body

        if (!operation || !amount || amount <= 0) {
            return Response.json(
                { success: false, error: 'INVALID_REQUEST' },
                { status: 400 }
            )
        }

        const creditService = new CreditService(db)

        if (operation === 'add') {
            const result = await creditService.addCredits(
                userId,
                amount,
                'admin_grant',
                description || `Admin credit grant by ${session.user.email}`
            )

            if (result.success) {
                return Response.json({
                    success: true,
                    transaction: {
                        id: result.transactionId,
                        operation: 'add',
                        amount: result.amount,
                        expiresAt: result.expiresAt
                    }
                })
            } else {
                return Response.json(
                    { success: false, error: result.error || 'UNKNOWN_ERROR' },
                    { status: 400 }
                )
            }
        } else {
            return Response.json(
                { success: false, error: 'UNSUPPORTED_OPERATION' },
                { status: 400 }
            )
        }

    } catch (error) {
        console.error('Admin credit management error:', error)
        return Response.json(
            { success: false, error: 'INTERNAL_ERROR' },
            { status: 500 }
        )
    }
}
