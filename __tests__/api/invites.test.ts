/**
 * 🔴 RED Phase: Invite Code API Endpoints Tests
 * 
 * Testing REST API endpoints for InviteCodeService operations
 * Following TDD principles: RED -> GREEN -> REFACTOR
 */

describe('🔴 RED: Invite Code API Endpoints', () => {

    describe('POST /api/invites/validate', () => {
        it('should validate invite code format and availability', async () => {
            const response = await fetch('http://localhost:3000/api/invites/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: 'WELCOME2024'
                })
            })

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data.success).toBe(true)
            expect(data.valid).toBe(true)
            expect(data.inviteCode).toBeDefined()
            expect(data.inviteCode.remainingUses).toBeGreaterThan(0)
        })

        it('should reject invalid codes', async () => {
            const response = await fetch('http://localhost:3000/api/invites/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: 'INVALID123'
                })
            })

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data.success).toBe(true)
            expect(data.valid).toBe(false)
            expect(data.error).toBeDefined()
        })
    })

    describe('POST /api/invites/redeem', () => {
        it('should redeem valid invite code', async () => {
            const response = await fetch('http://localhost:3000/api/invites/redeem', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer user-token'
                },
                body: JSON.stringify({
                    code: 'WELCOME2024',
                    userId: 'user-1'
                })
            })

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data.success).toBe(true)
            expect(data.redemption).toBeDefined()
            expect(data.creditsAwarded).toBeGreaterThan(0)
            expect(data.remainingUses).toBeGreaterThanOrEqual(0)
        })

        it('should prevent duplicate redemption', async () => {
            // First redemption
            await fetch('http://localhost:3000/api/invites/redeem', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer user-token'
                },
                body: JSON.stringify({
                    code: 'WELCOME2024',
                    userId: 'user-1'
                })
            })

            // Second redemption attempt
            const response = await fetch('http://localhost:3000/api/invites/redeem', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer user-token'
                },
                body: JSON.stringify({
                    code: 'WELCOME2024',
                    userId: 'user-1'
                })
            })

            expect(response.status).toBe(400)
            const data = await response.json()
            expect(data.success).toBe(false)
            expect(data.error).toBe('ALREADY_REDEEMED')
        })

        it('should require authentication', async () => {
            const response = await fetch('http://localhost:3000/api/invites/redeem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: 'WELCOME2024',
                    userId: 'user-1'
                })
            })

            expect(response.status).toBe(401)
            const data = await response.json()
            expect(data.success).toBe(false)
            expect(data.error).toBe('UNAUTHORIZED')
        })
    })

    describe('GET /api/invites/my-redemptions', () => {
        it('should return user redemption history', async () => {
            const response = await fetch('http://localhost:3000/api/invites/my-redemptions', {
                headers: { 'Authorization': 'Bearer user-token' }
            })

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data.success).toBe(true)
            expect(Array.isArray(data.redemptions)).toBe(true)
            expect(data.totalRedeemed).toBeGreaterThanOrEqual(0)
        })
    })
})
