/**
 * 🔴 RED Phase: Admin API Endpoints Tests
 * 
 * Testing REST API endpoints for AdminService operations
 * Following TDD principles: RED -> GREEN -> REFACTOR
 */

describe('🔴 RED: Admin API Endpoints', () => {

    describe('GET /api/admin/users', () => {
        it('should list all users with pagination', async () => {
            const response = await fetch('http://localhost:3000/api/admin/users?page=1&limit=10', {
                headers: {
                    'Authorization': 'Bearer admin-token',
                    'Content-Type': 'application/json'
                }
            })

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data.success).toBe(true)
            expect(Array.isArray(data.users)).toBe(true)
            expect(data.pagination).toBeDefined()
            expect(data.pagination.total).toBeGreaterThanOrEqual(0)
        })

        it('should require admin privileges', async () => {
            const response = await fetch('http://localhost:3000/api/admin/users', {
                headers: {
                    'Authorization': 'Bearer regular-user-token'
                }
            })

            expect(response.status).toBe(403)
            const data = await response.json()
            expect(data.success).toBe(false)
            expect(data.error).toBe('ADMIN_REQUIRED')
        })
    })

    describe('POST /api/admin/users/[id]/credits', () => {
        it('should manage user credit balance', async () => {
            const response = await fetch('http://localhost:3000/api/admin/users/user-1/credits', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer admin-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'add',
                    amount: 500,
                    description: 'Admin credit grant',
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
                })
            })

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data.success).toBe(true)
            expect(data.transaction).toBeDefined()
            expect(data.newBalance).toBeGreaterThan(0)
        })
    })

    describe('POST /api/admin/invite-codes', () => {
        it('should generate new invite codes', async () => {
            const response = await fetch('http://localhost:3000/api/admin/invite-codes', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer admin-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    maxUses: 5,
                    expiresAt: new Date('2024-12-31'),
                    creditBonus: 100,
                    description: 'Holiday promotion'
                })
            })

            expect(response.status).toBe(201)
            const data = await response.json()
            expect(data.success).toBe(true)
            expect(data.inviteCode).toBeDefined()
            expect(data.inviteCode.code).toMatch(/^[A-Z0-9]{8,12}$/)
            expect(data.inviteCode.maxUses).toBe(5)
        })
    })

    describe('GET /api/admin/analytics', () => {
        it('should return system analytics', async () => {
            const response = await fetch('http://localhost:3000/api/admin/analytics', {
                headers: { 'Authorization': 'Bearer admin-token' }
            })

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data.success).toBe(true)
            expect(data.analytics).toBeDefined()
            expect(data.analytics.users).toBeDefined()
            expect(data.analytics.credits).toBeDefined()
            expect(data.analytics.inviteCodes).toBeDefined()
        })
    })

    describe('GET /api/admin/audit-trail', () => {
        it('should return audit trail with filtering', async () => {
            const response = await fetch('http://localhost:3000/api/admin/audit-trail?entityType=user&limit=20', {
                headers: { 'Authorization': 'Bearer admin-token' }
            })

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data.success).toBe(true)
            expect(Array.isArray(data.auditEntries)).toBe(true)
            expect(data.pagination).toBeDefined()
        })
    })
})
