/**
 * AdminService TDD Implementation - RED Phase
 * 
 * Test Suite for comprehensive admin management system:
 * - User Management (CRUD, roles, status)
 * - System Monitoring (statistics, health checks)
 * - Credit System Administration
 * - Invite Code Administration
 * - Analytics and Reporting
 * - Audit Trail Management
 * 
 * Following TDD Red-Green-Refactor cycle
 */

import { AdminService } from '../../src/server/services/admin-service'

// Mock database interface
interface MockDatabase {
    mockData: {
        users: any[]
        credits: any[]
        inviteCodes: any[]
        codeRedemptions: any[]
        auditTrail: any[]
        systemStats: any
    }
}

describe('AdminService - RED Phase Tests', () => {
    let adminService: AdminService
    let mockDb: MockDatabase

    beforeEach(() => {
        // Initialize mock database with test data
        mockDb = {
            mockData: {
                users: [
                    {
                        id: 'user-1',
                        email: 'user1@example.com',
                        role: 'user',
                        status: 'active',
                        createdAt: new Date('2024-01-01'),
                        credits: 100
                    },
                    {
                        id: 'admin-1',
                        email: 'admin@example.com',
                        role: 'admin',
                        status: 'active',
                        createdAt: new Date('2024-01-01'),
                        credits: 1000
                    }
                ],
                credits: [
                    {
                        id: 'credit-1',
                        userId: 'user-1',
                        amount: 50,
                        type: 'earned',
                        createdAt: new Date('2024-01-15')
                    }
                ],
                inviteCodes: [
                    {
                        id: 'invite-1',
                        code: 'WELCOME2024',
                        createdBy: 'admin-1',
                        maxUses: 10,
                        currentUses: 3,
                        isActive: true,
                        expiresAt: new Date('2024-12-31')
                    }
                ],
                codeRedemptions: [
                    {
                        id: 'redemption-1',
                        codeId: 'invite-1',
                        userId: 'user-1',
                        redeemedAt: new Date('2024-01-10')
                    }
                ],
                auditTrail: [],
                systemStats: {
                    lastUpdated: new Date(),
                    totalUsers: 2,
                    activeUsers: 2,
                    totalCreditsIssued: 1150
                }
            }
        }

        adminService = new AdminService(mockDb as any)
    })

    // === USER MANAGEMENT TESTS ===

    describe('User Management', () => {
        test('should list all users with pagination and filtering', async () => {
            const request = {
                requestedBy: 'admin-1',
                page: 1,
                limit: 10,
                role: 'user',
                status: 'active'
            }

            const result = await adminService.listUsers(request)

            expect(result.success).toBe(true)
            expect(result.users).toBeDefined()
            expect(result.users.length).toBeGreaterThan(0)
            expect(result.pagination).toBeDefined()
            expect(result.pagination.totalCount).toBe(1) // Only user role, not admin
        })

        test('should reject user listing for non-admin users', async () => {
            const request = {
                requestedBy: 'user-1',
                page: 1,
                limit: 10
            }

            const result = await adminService.listUsers(request)

            expect(result.success).toBe(false)
            expect(result.error).toBe('ADMIN_REQUIRED')
        })

        test('should get detailed user information by ID', async () => {
            const request = {
                requestedBy: 'admin-1',
                userId: 'user-1'
            }

            const result = await adminService.getUserDetails(request)

            expect(result.success).toBe(true)
            expect(result.user).toBeDefined()
            expect(result.user.id).toBe('user-1')
            expect(result.user.email).toBe('user1@example.com')
            expect(result.statistics).toBeDefined()
            expect(result.statistics.totalCreditsEarned).toBeDefined()
        })

        test('should update user role and status', async () => {
            const request = {
                requestedBy: 'admin-1',
                userId: 'user-1',
                updates: {
                    role: 'premium',
                    status: 'active'
                }
            }

            const result = await adminService.updateUser(request)

            expect(result.success).toBe(true)
            expect(result.user.role).toBe('premium')
            expect(result.user.status).toBe('active')
        })

        test('should deactivate user account', async () => {
            const request = {
                requestedBy: 'admin-1',
                userId: 'user-1',
                reason: 'Policy violation'
            }

            const result = await adminService.deactivateUser(request)

            expect(result.success).toBe(true)
            expect(result.user.status).toBe('deactivated')
            expect(result.audit).toBeDefined()
        })

        test('should create audit trail for user management actions', async () => {
            const request = {
                requestedBy: 'admin-1',
                userId: 'user-1',
                updates: { role: 'premium' }
            }

            await adminService.updateUser(request)

            const auditRequest = {
                requestedBy: 'admin-1',
                entityType: 'user',
                entityId: 'user-1',
                limit: 10
            }

            const auditResult = await adminService.getAuditTrail(auditRequest)

            expect(auditResult.success).toBe(true)
            expect(auditResult.auditEntries.length).toBeGreaterThan(0)
            expect(auditResult.auditEntries[0].action).toBe('USER_UPDATED')
        })
    })

    // === SYSTEM MONITORING TESTS ===

    describe('System Monitoring', () => {
        test('should get comprehensive system statistics', async () => {
            const request = {
                requestedBy: 'admin-1',
                timeRange: '30d'
            }

            const result = await adminService.getSystemStatistics(request)

            expect(result.success).toBe(true)
            expect(result.statistics).toBeDefined()
            expect(result.statistics.users).toBeDefined()
            expect(result.statistics.credits).toBeDefined()
            expect(result.statistics.inviteCodes).toBeDefined()
            expect(result.statistics.system).toBeDefined()
        })

        test('should perform system health check', async () => {
            const request = {
                requestedBy: 'admin-1'
            }

            const result = await adminService.performHealthCheck(request)

            expect(result.success).toBe(true)
            expect(result.healthStatus).toBeDefined()
            expect(result.healthStatus.database).toBeDefined()
            expect(result.healthStatus.services).toBeDefined()
            expect(result.healthStatus.overall).toBe('healthy')
        })

        test('should generate activity report', async () => {
            const request = {
                requestedBy: 'admin-1',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
                includeDetails: true
            }

            const result = await adminService.generateActivityReport(request)

            expect(result.success).toBe(true)
            expect(result.report).toBeDefined()
            expect(result.report.userActivity).toBeDefined()
            expect(result.report.creditActivity).toBeDefined()
            expect(result.report.inviteCodeActivity).toBeDefined()
        })
    })

    // === CREDIT SYSTEM ADMINISTRATION TESTS ===

    describe('Credit System Administration', () => {
        test('should manage user credits with admin privileges', async () => {
            const request = {
                requestedBy: 'admin-1',
                userId: 'user-1',
                action: 'add',
                amount: 50,
                reason: 'Bonus credits'
            }

            const result = await adminService.manageCreditBalance(request)

            expect(result.success).toBe(true)
            expect(result.newBalance).toBe(150) // 100 + 50
            expect(result.transaction).toBeDefined()
        })

        test('should get credit transaction history', async () => {
            const request = {
                requestedBy: 'admin-1',
                userId: 'user-1',
                page: 1,
                limit: 20
            }

            const result = await adminService.getCreditHistory(request)

            expect(result.success).toBe(true)
            expect(result.transactions).toBeDefined()
            expect(result.transactions.length).toBeGreaterThan(0)
            expect(result.summary).toBeDefined()
        })

        test('should set daily credit limits', async () => {
            const request = {
                requestedBy: 'admin-1',
                userId: 'user-1',
                dailyLimit: 200
            }

            const result = await adminService.setCreditLimits(request)

            expect(result.success).toBe(true)
            expect(result.limits.dailyLimit).toBe(200)
        })
    })

    // === INVITE CODE ADMINISTRATION TESTS ===

    describe('Invite Code Administration', () => {
        test('should manage invite codes with advanced options', async () => {
            const request = {
                requestedBy: 'admin-1',
                action: 'create',
                codeParams: {
                    maxUses: 5,
                    expiresAt: new Date('2024-12-31'),
                    purpose: 'new-user-promo',
                    creditBonus: 25
                }
            }

            const result = await adminService.manageInviteCodes(request)

            expect(result.success).toBe(true)
            expect(result.inviteCode).toBeDefined()
            expect(result.inviteCode.maxUses).toBe(5)
            expect(result.inviteCode.metadata.creditBonus).toBe(25)
        })

        test('should get invite code analytics', async () => {
            const request = {
                requestedBy: 'admin-1',
                timeRange: '7d'
            }

            const result = await adminService.getInviteCodeAnalytics(request)

            expect(result.success).toBe(true)
            expect(result.analytics).toBeDefined()
            expect(result.analytics.totalCodes).toBeDefined()
            expect(result.analytics.redemptionRate).toBeDefined()
            expect(result.analytics.topPerformingCodes).toBeDefined()
        })

        test('should bulk manage invite codes', async () => {
            const request = {
                requestedBy: 'admin-1',
                action: 'bulk-create',
                count: 10,
                template: {
                    maxUses: 1,
                    expiresAt: new Date('2024-06-30'),
                    purpose: 'event-promotion'
                }
            }

            const result = await adminService.bulkManageInviteCodes(request)

            expect(result.success).toBe(true)
            expect(result.inviteCodes).toBeDefined()
            expect(result.inviteCodes.length).toBe(10)
            expect(result.summary.created).toBe(10)
        })
    })

    // === ANALYTICS AND REPORTING TESTS ===

    describe('Analytics and Reporting', () => {
        test('should generate user growth analytics', async () => {
            const request = {
                requestedBy: 'admin-1',
                timeRange: '90d',
                granularity: 'daily'
            }

            const result = await adminService.getUserGrowthAnalytics(request)

            expect(result.success).toBe(true)
            expect(result.analytics).toBeDefined()
            expect(result.analytics.growthData).toBeDefined()
            expect(result.analytics.trends).toBeDefined()
        })

        test('should export data for external analysis', async () => {
            const request = {
                requestedBy: 'admin-1',
                dataType: 'users',
                format: 'csv',
                filters: {
                    dateRange: {
                        start: new Date('2024-01-01'),
                        end: new Date('2024-01-31')
                    }
                }
            }

            const result = await adminService.exportData(request)

            expect(result.success).toBe(true)
            expect(result.exportUrl).toBeDefined()
            expect(result.metadata.format).toBe('csv')
            expect(result.metadata.recordCount).toBeGreaterThan(0)
        })

        test('should generate custom dashboard metrics', async () => {
            const request = {
                requestedBy: 'admin-1',
                metrics: ['active_users', 'credit_usage', 'invite_conversion'],
                timeRange: '30d'
            }

            const result = await adminService.getDashboardMetrics(request)

            expect(result.success).toBe(true)
            expect(result.metrics).toBeDefined()
            expect(result.metrics.active_users).toBeDefined()
            expect(result.metrics.credit_usage).toBeDefined()
            expect(result.metrics.invite_conversion).toBeDefined()
        })
    })

    // === ERROR HANDLING AND SECURITY TESTS ===

    describe('Error Handling and Security', () => {
        test('should handle database connection errors gracefully', async () => {
            // Simulate database error
            const errorAdminService = new AdminService(null as any)

            const request = {
                requestedBy: 'admin-1',
                page: 1,
                limit: 10
            }

            const result = await errorAdminService.listUsers(request)

            expect(result.success).toBe(false)
            expect(result.error).toBe('DATABASE_ERROR')
        })

        test('should validate admin permissions for all operations', async () => {
            const request = {
                requestedBy: 'user-1', // Non-admin user
                userId: 'user-1',
                amount: 1000000,
                action: 'add'
            }

            const result = await adminService.manageCreditBalance(request)

            expect(result.success).toBe(false)
            expect(result.error).toBe('ADMIN_REQUIRED')
        })

        test('should log all administrative actions for audit', async () => {
            const request = {
                requestedBy: 'admin-1',
                userId: 'user-1',
                updates: { status: 'suspended' }
            }

            await adminService.updateUser(request)

            // Check that audit trail was created
            const auditRequest = {
                requestedBy: 'admin-1',
                limit: 1
            }

            const auditResult = await adminService.getAuditTrail(auditRequest)

            expect(auditResult.success).toBe(true)
            expect(auditResult.auditEntries.length).toBeGreaterThan(0)
            expect(auditResult.auditEntries[0].action).toContain('USER_')
        })
    })
})
