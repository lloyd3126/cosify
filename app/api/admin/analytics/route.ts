import { NextRequest } from 'next/server'
import { auth } from '@/server/auth'
import { AuthService } from '@/server/services/auth-service'
import { db } from '@/server/db'
import { users, creditTransactions, inviteCodes } from '@/server/db/schema'
import { count, gte } from 'drizzle-orm'
import { headers } from 'next/headers'

/**
 * GET /api/admin/analytics
 * Get system analytics (admin only)
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

    // Verify admin privileges
    const authService = new AuthService(db)
    const adminCheck = await authService.verifyAdminPrivileges(session.user.id)
    
    if (!adminCheck.success || !adminCheck.isAdmin) {
      return Response.json(
        { success: false, error: 'ADMIN_REQUIRED' },
        { status: 403 }
      )
    }

    // Get basic analytics manually
    const totalUsersResult = await db.select({ count: count() }).from(users)
    const totalUsers = totalUsersResult[0]?.count || 0

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const newUsersResult = await db.select({ count: count() })
      .from(users)
      .where(gte(users.createdAt, thirtyDaysAgo))
    const newUsers = newUsersResult[0]?.count || 0

    const totalInviteCodesResult = await db.select({ count: count() }).from(inviteCodes)
    const totalInviteCodes = totalInviteCodesResult[0]?.count || 0

    const totalTransactionsResult = await db.select({ count: count() }).from(creditTransactions)
    const totalTransactions = totalTransactionsResult[0]?.count || 0

    return Response.json({
      success: true,
      analytics: {
        totalUsers,
        newUsersLast30Days: newUsers,
        totalInviteCodes,
        totalCreditTransactions: totalTransactions,
        generatedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Admin analytics error:', error)
    return Response.json(
      { success: false, error: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
