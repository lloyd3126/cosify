import { NextRequest } from 'next/server'
import { auth } from '@/server/auth'
import { InviteCodeService } from '@/server/services/invite-code-service'
import { db } from '@/server/db'
import { headers } from 'next/headers'

/**
 * POST /api/invites/redeem
 * Redeem invite code for credits
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
        const { code } = body

        if (!code) {
            return Response.json(
                { success: false, error: 'INVALID_REQUEST' },
                { status: 400 }
            )
        }

        const inviteService = new InviteCodeService(db)
        const redemption = await inviteService.redeemInviteCode({
            code,
            userId: session.user.id
        })

        if (redemption.success) {
            return Response.json({
                success: true,
                redemption: {
                    id: redemption.redemption?.id,
                    userId: redemption.redemption?.userId,
                    codeId: redemption.redemption?.codeId,
                    redeemedAt: redemption.redemption?.redeemedAt
                }
            })
        } else {
            const statusCode = redemption.error === 'ALREADY_REDEEMED' ? 400 : 400
            return Response.json(
                { success: false, error: redemption.error },
                { status: statusCode }
            )
        }

    } catch (error) {
        console.error('Invite code redemption error:', error)
        return Response.json(
            { success: false, error: 'INTERNAL_ERROR' },
            { status: 500 }
        )
    }
}
