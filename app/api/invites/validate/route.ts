import { NextRequest } from 'next/server'
import { InviteCodeService } from '@/server/services/invite-code-service'
import { db } from '@/server/db'

/**
 * POST /api/invites/validate
 * Validate invite code format and availability
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { code } = body

        if (!code) {
            return Response.json(
                { success: false, error: 'INVALID_REQUEST' },
                { status: 400 }
            )
        }

        const inviteService = new InviteCodeService(db)
        const validation = await inviteService.validateInviteCode(code)

        return Response.json({
            success: true,
            valid: validation.isValid,
            details: validation.isValid ? {
                maxUses: validation.inviteCode?.maxUses,
                currentUses: validation.inviteCode?.currentUses,
                remainingUses: validation.remainingUses,
                expiresAt: validation.inviteCode?.expiresAt
            } : undefined,
            error: validation.isValid ? undefined : validation.error
        })

    } catch (error) {
        console.error('Invite code validation error:', error)
        return Response.json(
            { success: false, error: 'INTERNAL_ERROR' },
            { status: 500 }
        )
    }
}
