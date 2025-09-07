/**
 * InviteCodeService TDD Tests - RED Phase
 * 
 * Testing comprehensive invite code functionality including:
 * - Secure code generation with admin authorization
 * - Code validation and expiry management
 * - Code redemption with usage limits
 * - Security and audit features
 * - Database error handling
 * 
 * Following TDD principles - all tests should FAIL initially
 */

import { InviteCodeService } from '../../src/server/services/invite-code-service'

describe('InviteCodeService - RED Phase Tests', () => {
    let inviteCodeService: InviteCodeService
    let mockDatabase: any

    beforeEach(() => {
        // Mock database with invite codes data
        mockDatabase = {
            mockData: {
                users: [
                    { id: 'admin-user-1', role: 'admin', email: 'admin@example.com' },
                    { id: 'user-1', role: 'free_user', email: 'user1@example.com' }
                ],
                inviteCodes: [
                    {
                        id: 'existing-code-1',
                        code: 'INVITE123',
                        createdBy: 'admin-user-1',
                        createdAt: new Date('2024-01-01'),
                        expiresAt: new Date('2025-12-31'), // Changed to future date
                        maxUses: 10,
                        currentUses: 3,
                        isActive: true,
                        metadata: { purpose: 'general', batch: 'batch-1' }
                    },
                    {
                        id: 'expired-code-1',
                        code: 'EXPIRED123',
                        createdBy: 'admin-user-1',
                        createdAt: new Date('2024-01-01'),
                        expiresAt: new Date('2024-01-02'), // Expired
                        maxUses: 5,
                        currentUses: 0,
                        isActive: true
                    }
                ],
                codeRedemptions: [
                    {
                        id: 'redemption-1',
                        codeId: 'existing-code-1',
                        userId: 'user-1',
                        redeemedAt: new Date(),
                        ipAddress: '192.168.1.1'
                    }
                ]
            }
        }

        inviteCodeService = new InviteCodeService(mockDatabase)
    })

    describe('Code Generation', () => {
        it('should generate secure invite code with admin privileges', async () => {
            const result = await inviteCodeService.generateInviteCode({
                createdBy: 'admin-user-1',
                maxUses: 5,
                expiresAt: new Date('2025-12-31'),
                metadata: { purpose: 'premium-trial' }
            })

            expect(result.success).toBe(true)
            expect(result.inviteCode).toBeDefined()
            expect(result.inviteCode?.code).toMatch(/^[A-Z0-9]{8,12}$/) // Secure format
            expect(result.inviteCode?.maxUses).toBe(5)
            expect(result.inviteCode?.currentUses).toBe(0)
            expect(result.inviteCode?.isActive).toBe(true)
            expect(result.inviteCode?.createdBy).toBe('admin-user-1')
        })

        it('should reject code generation for non-admin users', async () => {
            const result = await inviteCodeService.generateInviteCode({
                createdBy: 'user-1', // Non-admin user
                maxUses: 5,
                expiresAt: new Date('2025-12-31')
            })

            expect(result.success).toBe(false)
            expect(result.error).toBe('ADMIN_REQUIRED')
            expect(result.inviteCode).toBeUndefined()
        })

        it('should handle database errors during code generation', async () => {
            // Simulate database error
            const errorDatabase = { mockData: null }
            const errorService = new InviteCodeService(errorDatabase)

            const result = await errorService.generateInviteCode({
                createdBy: 'admin-user-1',
                maxUses: 5,
                expiresAt: new Date('2025-12-31')
            })

            expect(result.success).toBe(false)
            expect(result.error).toBe('DATABASE_ERROR')
        })

        it('should generate unique codes to prevent collisions', async () => {
            const codes = new Set()

            for (let i = 0; i < 5; i++) {
                const result = await inviteCodeService.generateInviteCode({
                    createdBy: 'admin-user-1',
                    maxUses: 1,
                    expiresAt: new Date('2025-12-31')
                })

                expect(result.success).toBe(true)
                expect(codes.has(result.inviteCode?.code)).toBe(false)
                codes.add(result.inviteCode?.code)
            }
        })
    })

    describe('Code Validation', () => {
        it('should validate active invite code correctly', async () => {
            const result = await inviteCodeService.validateInviteCode('INVITE123')

            expect(result.success).toBe(true)
            expect(result.isValid).toBe(true)
            expect(result.inviteCode?.code).toBe('INVITE123')
            expect(result.inviteCode?.maxUses).toBe(10)
            expect(result.inviteCode?.currentUses).toBe(3)
            expect(result.remainingUses).toBe(7)
        })

        it('should reject expired invite codes', async () => {
            const result = await inviteCodeService.validateInviteCode('EXPIRED123')

            expect(result.success).toBe(true)
            expect(result.isValid).toBe(false)
            expect(result.error).toBe('CODE_EXPIRED')
            expect(result.remainingUses).toBe(0)
        })

        it('should reject non-existent invite codes', async () => {
            const result = await inviteCodeService.validateInviteCode('NONEXISTENT')

            expect(result.success).toBe(true)
            expect(result.isValid).toBe(false)
            expect(result.error).toBe('CODE_NOT_FOUND')
        })

        it('should handle invalid code format', async () => {
            const result = await inviteCodeService.validateInviteCode('invalid-format!')

            expect(result.success).toBe(false)
            expect(result.error).toBe('INVALID_CODE_FORMAT')
        })

        it('should validate remaining usage limits', async () => {
            // Create a code with no remaining uses
            mockDatabase.mockData.inviteCodes.push({
                id: 'exhausted-code',
                code: 'EXHAUSTED',
                createdBy: 'admin-user-1',
                createdAt: new Date(),
                expiresAt: new Date('2025-12-31'),
                maxUses: 1,
                currentUses: 1, // Fully used
                isActive: true
            })

            const result = await inviteCodeService.validateInviteCode('EXHAUSTED')

            expect(result.success).toBe(true)
            expect(result.isValid).toBe(false)
            expect(result.error).toBe('CODE_EXHAUSTED')
            expect(result.remainingUses).toBe(0)
        })
    })

    describe('Code Redemption', () => {
        it('should redeem valid invite code successfully', async () => {
            const result = await inviteCodeService.redeemInviteCode({
                code: 'INVITE123',
                userId: 'new-user-1',
                ipAddress: '192.168.1.100',
                userAgent: 'Mozilla/5.0...'
            })

            expect(result.success).toBe(true)
            expect(result.redemption).toBeDefined()
            expect(result.redemption?.userId).toBe('new-user-1')
            expect(result.redemption?.codeId).toBe('existing-code-1')
            expect(result.redemption?.ipAddress).toBe('192.168.1.100')
            expect(result.newUseCount).toBe(4) // Was 3, now 4
        })

        it('should prevent redemption of expired codes', async () => {
            const result = await inviteCodeService.redeemInviteCode({
                code: 'EXPIRED123',
                userId: 'new-user-1',
                ipAddress: '192.168.1.100'
            })

            expect(result.success).toBe(false)
            expect(result.error).toBe('CODE_EXPIRED')
            expect(result.redemption).toBeUndefined()
        })

        it('should prevent double redemption by same user', async () => {
            const result = await inviteCodeService.redeemInviteCode({
                code: 'INVITE123',
                userId: 'user-1', // Already redeemed this code
                ipAddress: '192.168.1.100'
            })

            expect(result.success).toBe(false)
            expect(result.error).toBe('ALREADY_REDEEMED')
            expect(result.redemption).toBeUndefined()
        })

        it('should handle concurrent redemption attempts safely', async () => {
            // Simulate concurrent redemptions
            const redemptions = await Promise.all([
                inviteCodeService.redeemInviteCode({
                    code: 'INVITE123',
                    userId: 'concurrent-user-1',
                    ipAddress: '192.168.1.101'
                }),
                inviteCodeService.redeemInviteCode({
                    code: 'INVITE123',
                    userId: 'concurrent-user-2',
                    ipAddress: '192.168.1.102'
                })
            ])

            // At least one should succeed
            const successful = redemptions.filter((r: any) => r.success)
            expect(successful.length).toBeGreaterThanOrEqual(1)

            // Usage count should be consistent
            const validationResult = await inviteCodeService.validateInviteCode('INVITE123')
            expect(validationResult.inviteCode?.currentUses).toBeGreaterThan(3)
        })
    })

    describe('Code Management', () => {
        it('should deactivate invite code by admin', async () => {
            const result = await inviteCodeService.deactivateInviteCode({
                code: 'INVITE123',
                deactivatedBy: 'admin-user-1',
                reason: 'Security concern'
            })

            expect(result.success).toBe(true)
            expect(result.deactivatedAt).toBeDefined()

            // Verify code is no longer valid
            const validationResult = await inviteCodeService.validateInviteCode('INVITE123')
            expect(validationResult.isValid).toBe(false)
            expect(validationResult.error).toBe('CODE_DEACTIVATED')
        })

        it('should prevent deactivation by non-admin users', async () => {
            const result = await inviteCodeService.deactivateInviteCode({
                code: 'INVITE123',
                deactivatedBy: 'user-1', // Non-admin
                reason: 'Testing'
            })

            expect(result.success).toBe(false)
            expect(result.error).toBe('ADMIN_REQUIRED')
        })

        it('should list invite codes with usage statistics', async () => {
            const result = await inviteCodeService.listInviteCodes({
                requestedBy: 'admin-user-1',
                includeInactive: true,
                limit: 10
            })

            expect(result.success).toBe(true)
            expect(result.codes).toBeDefined()
            expect(result.codes?.length).toBeGreaterThan(0)
            expect(result.codes?.[0]).toMatchObject({
                code: expect.any(String),
                currentUses: expect.any(Number),
                maxUses: expect.any(Number),
                isActive: expect.any(Boolean)
            })
        })

        it('should cleanup expired invite codes automatically', async () => {
            const cleanupResult = await inviteCodeService.cleanupExpiredCodes({
                requestedBy: 'admin-user-1',
                olderThanDays: 30
            })

            expect(cleanupResult.success).toBe(true)
            expect(cleanupResult.deletedCount).toBeDefined()
            expect(cleanupResult.deletedCodes).toBeDefined()
        })
    })

    describe('Analytics and Audit', () => {
        it('should track invite code usage analytics', async () => {
            const result = await inviteCodeService.getCodeAnalytics({
                requestedBy: 'admin-user-1',
                codeId: 'existing-code-1'
            })

            expect(result.success).toBe(true)
            expect(result.analytics).toBeDefined()
            expect(result.analytics?.totalRedemptions).toBe(1)
            expect(result.analytics?.redemptionRate).toBeDefined()
            expect(result.analytics?.uniqueUsers).toBe(1)
        })

        it('should provide system-wide invite code statistics', async () => {
            const result = await inviteCodeService.getSystemStatistics({
                requestedBy: 'admin-user-1',
                timeRange: '30d'
            })

            expect(result.success).toBe(true)
            expect(result.statistics).toBeDefined()
            expect(result.statistics?.totalCodes).toBeGreaterThan(0)
            expect(result.statistics?.totalRedemptions).toBeGreaterThan(0)
            expect(result.statistics?.activeCodeCount).toBeDefined()
        })

        it('should create audit trail for invite code operations', async () => {
            const auditResult = await inviteCodeService.getAuditTrail({
                requestedBy: 'admin-user-1',
                codeId: 'existing-code-1',
                limit: 10
            })

            expect(auditResult.success).toBe(true)
            expect(auditResult.auditEntries).toBeDefined()
            expect(auditResult.auditEntries?.length).toBeGreaterThan(0)
            expect(auditResult.auditEntries?.[0]).toMatchObject({
                action: expect.any(String),
                performedBy: expect.any(String),
                timestamp: expect.any(Date)
            })
        })
    })
})
