import { NextRequest } from 'next/server'
import { auth } from '@/server/auth'
import { AuthService } from '@/server/services/auth-service'
import { InviteCodeService } from '@/server/services/invite-code-service'
import { db } from '@/server/db'
import { headers } from 'next/headers'

/**
 * POST /api/admin/invite-codes
 * Generate new invite codes (admin only)
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

    // Verify admin privileges
    const authService = new AuthService(db)
    const adminCheck = await authService.verifyAdminPrivileges(session.user.id)
    
    if (!adminCheck.success || !adminCheck.isAdmin) {
      return Response.json(
        { success: false, error: 'ADMIN_REQUIRED' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { creditAmount, maxUses = 1, description, expiresInDays = 30 } = body

    if (!creditAmount || creditAmount <= 0) {
      return Response.json(
        { success: false, error: 'INVALID_REQUEST' },
        { status: 400 }
      )
    }

    const inviteService = new InviteCodeService(db)
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    
    const result = await inviteService.generateInviteCode({
      createdBy: session.user.id,
      maxUses,
      expiresAt,
      metadata: { creditAmount, description }
    })

    if (result.success && result.inviteCode) {
      return Response.json({
        success: true,
        inviteCode: {
          code: result.inviteCode.code,
          maxUses: result.inviteCode.maxUses,
          expiresAt: result.inviteCode.expiresAt,
          metadata: result.inviteCode.metadata
        }
      }, { status: 201 })
    } else {
      return Response.json(
        { success: false, error: result.error || 'UNKNOWN_ERROR' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Admin invite code generation error:', error)
    return Response.json(
      { success: false, error: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
