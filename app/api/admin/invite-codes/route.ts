import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/server/auth'
import { db } from '@/server/db'
import { inviteCodes, users } from '@/server/db/schema'
import { eq, and, sql, desc } from 'drizzle-orm'
import { headers } from 'next/headers'

export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        })

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 檢查是否為管理員
        const user = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1)
        if (!user[0]?.isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // 獲取查詢參數
        const searchParams = request.nextUrl.searchParams
        const status = searchParams.get('status') || 'all'
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')
        const offset = (page - 1) * limit

        // 構建查詢條件
        let whereConditions = []

        if (status === 'active') {
            whereConditions.push(
                and(
                    eq(inviteCodes.isActive, true),
                    sql`${inviteCodes.currentUses} < ${inviteCodes.maxUses}`,
                    sql`${inviteCodes.expiresAt} > CURRENT_TIMESTAMP`
                )
            )
        } else if (status === 'used') {
            whereConditions.push(
                sql`${inviteCodes.currentUses} >= ${inviteCodes.maxUses}`
            )
        } else if (status === 'expired') {
            whereConditions.push(
                and(
                    sql`${inviteCodes.currentUses} < ${inviteCodes.maxUses}`,
                    sql`${inviteCodes.expiresAt} <= CURRENT_TIMESTAMP`
                )
            )
        }

        // 查詢邀請碼
        const codesQuery = db
            .select()
            .from(inviteCodes)
            .orderBy(desc(inviteCodes.createdAt))
            .limit(limit)
            .offset(offset)

        if (whereConditions.length > 0) {
            codesQuery.where(whereConditions[0])
        }

        const codes = await codesQuery

        // 計算總數
        let totalQuery = db
            .select({ count: sql<number>`count(*)` })
            .from(inviteCodes)

        if (whereConditions.length > 0) {
            totalQuery = totalQuery.where(whereConditions[0])
        }

        const [{ count: total }] = await totalQuery

        // 格式化響應數據
        const formattedCodes = codes.map(code => {
            const now = new Date()
            const expiresAt = new Date(code.expiresAt)

            let status: 'active' | 'used' | 'expired'
            if (code.currentUses >= code.maxUses) {
                status = 'used'
            } else if (expiresAt <= now) {
                status = 'expired'
            } else {
                status = 'active'
            }

            return {
                id: code.code, // 使用 code 作為 id
                code: code.code,
                creditsValue: code.creditsValue,
                status,
                expiresAt: code.expiresAt,
                usedAt: code.usedAt,
                usedBy: code.usedByUserId,
                createdAt: code.createdAt
            }
        })

        return NextResponse.json({
            codes: formattedCodes,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: limit
            }
        })

    } catch (error) {
        console.error('Failed to fetch invite codes:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        })

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 檢查是否為管理員
        const user = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1)
        if (!user[0]?.isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { creditsValue, expiresAt } = body

        if (!creditsValue || !expiresAt) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        if (creditsValue <= 0 || creditsValue > 10000) {
            return NextResponse.json(
                { error: 'Credits value must be between 1 and 10000' },
                { status: 400 }
            )
        }

        // 生成唯一的邀請碼
        const generateCode = () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
            let result = 'NEWCODE'
            for (let i = 0; i < 13; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length))
            }
            return result
        }

        let code = generateCode()
        let attempts = 0
        const maxAttempts = 10

        // 確保邀請碼唯一
        while (attempts < maxAttempts) {
            const existing = await db
                .select({ code: inviteCodes.code })
                .from(inviteCodes)
                .where(eq(inviteCodes.code, code))
                .limit(1)

            if (existing.length === 0) {
                break
            }

            code = generateCode()
            attempts++
        }

        if (attempts >= maxAttempts) {
            return NextResponse.json(
                { error: 'Failed to generate unique code' },
                { status: 500 }
            )
        }

        // 創建邀請碼
        const [newCode] = await db
            .insert(inviteCodes)
            .values({
                code,
                creditsValue: parseInt(creditsValue),
                expiresAt: new Date(expiresAt),
                createdByAdminId: session.user.id,
                maxUses: 1,
                currentUses: 0,
                isActive: true
            })
            .returning()

        return NextResponse.json({
            code: {
                id: newCode.code,
                code: newCode.code,
                creditsValue: newCode.creditsValue,
                status: 'active' as const,
                expiresAt: newCode.expiresAt,
                usedAt: null,
                usedBy: null,
                createdAt: newCode.createdAt
            }
        })

    } catch (error) {
        console.error('Failed to create invite code:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        })

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 檢查是否為管理員
        const user = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1)
        if (!user[0]?.isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const searchParams = request.nextUrl.searchParams
        const codeId = searchParams.get('id')

        if (!codeId) {
            return NextResponse.json(
                { error: 'Missing code ID' },
                { status: 400 }
            )
        }

        // 檢查邀請碼是否存在且未使用
        const [existingCode] = await db
            .select()
            .from(inviteCodes)
            .where(eq(inviteCodes.code, codeId))
            .limit(1)

        if (!existingCode) {
            return NextResponse.json(
                { error: 'Invite code not found' },
                { status: 404 }
            )
        }

        if (existingCode.currentUses > 0) {
            return NextResponse.json(
                { error: 'Cannot delete used invite code' },
                { status: 400 }
            )
        }

        // 刪除邀請碼
        await db
            .delete(inviteCodes)
            .where(eq(inviteCodes.code, codeId))

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Failed to delete invite code:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
