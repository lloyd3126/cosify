import { NextRequest } from 'next/server'
import { auth } from '@/server/auth'
import { AuthService } from '@/server/services/auth-service'
import { db } from '@/server/db'
import { auditTrail } from '@/server/db/schema'
import { desc, count, gte, and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'

/**
 * GET /api/admin/audit-trail
 * Get audit trail with filtering (admin only)
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

        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
        const offset = (page - 1) * limit
        const action = searchParams.get('action')
        const userId = searchParams.get('userId')
        const days = parseInt(searchParams.get('days') || '7')

        // Build filters
        const filters: any[] = []

        if (days > 0) {
            const dateThreshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            filters.push(gte(auditTrail.createdAt, dateThreshold))
        }

        if (action) {
            filters.push(eq(auditTrail.action, action))
        }

        if (userId) {
            filters.push(eq(auditTrail.userId, userId))
        }

        const whereClause = filters.length > 0 ? and(...filters) : undefined

        // Get audit entries
        const auditEntries = await db.select()
            .from(auditTrail)
            .where(whereClause)
            .orderBy(desc(auditTrail.createdAt))
            .limit(limit)
            .offset(offset)

        // Get total count
        const totalResult = await db.select({ count: count() })
            .from(auditTrail)
            .where(whereClause)

        const total = totalResult[0]?.count || 0

        return Response.json({
            success: true,
            auditEntries: auditEntries.map(entry => ({
                id: entry.id,
                action: entry.action,
                userId: entry.userId,
                entityType: entry.entityType,
                entityId: entry.entityId,
                oldValue: entry.oldValue,
                newValue: entry.newValue,
                metadata: entry.metadata,
                createdAt: entry.createdAt
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            },
            filters: {
                action,
                userId,
                days
            }
        })

    } catch (error) {
        console.error('Admin audit trail error:', error)
        return Response.json(
            { success: false, error: 'INTERNAL_ERROR' },
            { status: 500 }
        )
    }
}
