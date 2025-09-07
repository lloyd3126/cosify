import { NextRequest } from 'next/server'
import { auth } from '@/server/auth'
import { db } from '@/server/db'
import { inviteCodeRedemptions, inviteCodes } from '@/server/db/schema'
import { eq, desc } from 'drizzle-orm'
import { headers } from 'next/headers'

/**
 * GET /api/invites/my-redemptions
 * Get user's invite code redemption history
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

        // Get user's redemptions with invite code details
        const redemptions = await db.select({
            id: inviteCodeRedemptions.id,
            codeId: inviteCodeRedemptions.codeId,
            userId: inviteCodeRedemptions.userId,
            redeemedAt: inviteCodeRedemptions.redeemedAt,
            code: inviteCodes.code,
            metadata: inviteCodes.metadata
        })
            .from(inviteCodeRedemptions)
            .leftJoin(inviteCodes, eq(inviteCodeRedemptions.codeId, inviteCodes.code))
            .where(eq(inviteCodeRedemptions.userId, session.user.id))
            .orderBy(desc(inviteCodeRedemptions.redeemedAt))

        return Response.json({
            success: true,
            redemptions: redemptions.map(redemption => ({
                id: redemption.id,
                code: redemption.code,
                redeemedAt: redemption.redeemedAt,
                metadata: redemption.metadata
            }))
        })

    } catch (error) {
        console.error('User redemptions error:', error)
        return Response.json(
            { success: false, error: 'INTERNAL_ERROR' },
            { status: 500 }
        )
    }
}
