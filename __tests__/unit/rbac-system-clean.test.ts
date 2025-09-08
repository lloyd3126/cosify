/**
 * RBAC 角色權限系統測試
 * 遵循 TDD Red-Green-Refactor 流程
 * 
 * 🔴 RED 階段：先寫失敗的測試
 * 🟢 GREEN 階段：實作最小可工作代碼
 * 🔵 REFACTOR 階段：重構優化
 */

import { createTestDatabase, validateTestEnvironment, TestDataFactory } from '../helpers/test-database'
import { AuthService, AUTH_CONFIG, AUTH_ERROR_CODES } from '../../src/server/services/auth-service'
import { RBACEnhancer } from '../../src/server/services/rbac-enhancer'
import * as schema from '../../src/server/db/schema'

describe('RBAC Role-Based Access Control System', () => {
    let testDb: ReturnType<typeof createTestDatabase>
    let authService: AuthService
    let rbacEnhancer: RBACEnhancer

    beforeAll(() => {
        validateTestEnvironment()
        testDb = createTestDatabase({
            testName: 'rbac-system',
            migrationsPath: './drizzle'
        })
        authService = new AuthService(testDb.db)
        rbacEnhancer = new RBACEnhancer()
    })

    afterAll(() => {
        testDb?.cleanup()
    })

    beforeEach(() => {
        // 清理測試資料
        try {
            testDb.db.delete(schema.sessions).run()
            testDb.db.delete(schema.users).run()
        } catch (error) {
            // 忽略清理錯誤
        }
    })

    describe('🔴 TDD Red Phase - Role Permission Definitions', () => {
        describe('Role Hierarchy Validation', () => {
            test('should define role hierarchy correctly', () => {
                // 🔴 RED: 驗證角色階層定義
                expect(AUTH_CONFIG.ROLE_HIERARCHY).toBeDefined()
                expect(AUTH_CONFIG.ROLE_HIERARCHY['free_user']).toBeLessThan(
                    AUTH_CONFIG.ROLE_HIERARCHY['premium_user']
                )
                expect(AUTH_CONFIG.ROLE_HIERARCHY['premium_user']).toBeLessThan(
                    AUTH_CONFIG.ROLE_HIERARCHY['admin']
                )
            })

            test('should validate role inheritance - admin inherits all permissions', () => {
                // 🔴 RED: 管理員應該擁有所有權限
                const adminPermissions = AUTH_CONFIG.ROLE_PERMISSIONS['admin']
                const freeUserPermissions = AUTH_CONFIG.ROLE_PERMISSIONS['free_user']
                const premiumUserPermissions = AUTH_CONFIG.ROLE_PERMISSIONS['premium_user']

                freeUserPermissions.forEach(permission => {
                    expect(adminPermissions).toContain(permission)
                })

                premiumUserPermissions.forEach(permission => {
                    expect(adminPermissions).toContain(permission)
                })
            })
        })

        describe('Permission Categories Validation', () => {
            test('should organize permissions by functional categories', () => {
                // 🔴 RED: 驗證權限分類完整性
                const requiredCategories = [
                    'CONSUME_CREDITS',
                    'MANAGE_CREDITS',
                    'MANAGE_USERS',
                    'VIEW_USER_DATA',
                    'VIEW_ANALYTICS',
                    'EXPORT_DATA',
                    'CREATE_INVITE_CODES',
                    'MANAGE_SYSTEM',
                    'AUDIT_LOGS'
                ]

                requiredCategories.forEach(permission => {
                    expect(AUTH_CONFIG.PERMISSIONS[permission as keyof typeof AUTH_CONFIG.PERMISSIONS]).toBeDefined()
                })
            })
        })
    })

    describe('🟢 TDD Green Phase - Enhanced Permission Checks', () => {
        test('should validate user permissions with RBAC enhancer', async () => {
            // 🟢 GREEN: 使用增強的權限檢查
            const freeUser = TestDataFactory.createUser({ role: 'free_user' })
            const insertedUsers = testDb.db.insert(schema.users).values(freeUser).returning().all()
            const user = insertedUsers[0]

            // 使用增強的權限檢查
            const canConsumeCredits = await rbacEnhancer.hasPermission(
                authService,
                user.id,
                AUTH_CONFIG.PERMISSIONS.CONSUME_CREDITS
            )
            expect(canConsumeCredits.hasPermission).toBe(true)

            // free_user 不應該可以管理用戶
            const canManageUsers = await rbacEnhancer.hasPermission(
                authService,
                user.id,
                AUTH_CONFIG.PERMISSIONS.MANAGE_USERS
            )
            expect(canManageUsers.hasPermission).toBe(false)
        })

        test('should validate admin has all permissions with enhancer', async () => {
            // 🟢 GREEN: 管理員全權限測試
            const adminUser = TestDataFactory.createAdmin()
            const insertedAdmins = testDb.db.insert(schema.users).values(adminUser).returning().all()
            const admin = insertedAdmins[0]

            // 測試關鍵權限
            const keyPermissions = [
                AUTH_CONFIG.PERMISSIONS.CONSUME_CREDITS,
                AUTH_CONFIG.PERMISSIONS.MANAGE_USERS,
                AUTH_CONFIG.PERMISSIONS.MANAGE_SYSTEM
            ]

            for (const permission of keyPermissions) {
                const hasPermission = await rbacEnhancer.hasPermission(authService, admin.id, permission)
                expect(hasPermission.hasPermission).toBe(true)
            }
        })

        test('should support context-aware permission checks', async () => {
            // 🟢 GREEN: 上下文相關權限檢查
            const user1 = TestDataFactory.createUser({ email: 'user1@example.com' })
            const insertedUsers1 = testDb.db.insert(schema.users).values(user1).returning().all()
            const testUser1 = insertedUsers1[0]

            // 測試資源特定權限 - 自己的資料
            const canViewOwnData = await rbacEnhancer.hasPermission(
                authService,
                testUser1.id,
                AUTH_CONFIG.PERMISSIONS.VIEW_USER_DATA,
                {
                    resourceId: testUser1.id,
                    resourceType: 'user',
                    userId: testUser1.id // 明確指定userId
                }
            )

            // 即使基本權限沒有，但可以查看自己的資料
            expect(canViewOwnData.hasPermission).toBe(true)
        })
    })

    describe('🟢 TDD Green Phase - Permission Caching', () => {
        test('should cache permission check results', async () => {
            // 🟢 GREEN: 權限檢查結果快取
            const user = TestDataFactory.createUser()
            const insertedUsers = testDb.db.insert(schema.users).values(user).returning().all()
            const testUser = insertedUsers[0]

            // 第一次檢查
            const firstCheck = await rbacEnhancer.hasPermission(
                authService,
                testUser.id,
                AUTH_CONFIG.PERMISSIONS.CONSUME_CREDITS
            )

            // 第二次檢查 - 應該從快取返回
            const secondCheck = await rbacEnhancer.hasPermission(
                authService,
                testUser.id,
                AUTH_CONFIG.PERMISSIONS.CONSUME_CREDITS
            )

            expect(firstCheck.hasPermission).toBe(secondCheck.hasPermission)
            expect(secondCheck.cached).toBe(true)
        })

        test('should invalidate cache when user role changes', async () => {
            // 🟢 GREEN: 角色變更時快取失效
            const user = TestDataFactory.createUser({ role: 'free_user' })
            const insertedUsers = testDb.db.insert(schema.users).values(user).returning().all()
            const testUser = insertedUsers[0]

            // 檢查初始權限
            const initialCheck = await rbacEnhancer.hasPermission(
                authService,
                testUser.id,
                AUTH_CONFIG.PERMISSIONS.MANAGE_USERS
            )
            expect(initialCheck.hasPermission).toBe(false)

            // 模擬角色變更
            await rbacEnhancer.invalidateUserPermissions(testUser.id, 'role_changed')

            // 再次檢查 - 快取應該已清除
            const updatedCheck = await rbacEnhancer.hasPermission(
                authService,
                testUser.id,
                AUTH_CONFIG.PERMISSIONS.MANAGE_USERS
            )
            expect(updatedCheck.cached).toBe(false)
        })
    })

    describe('🟢 TDD Green Phase - Audit Logging', () => {
        test('should log permission checks for audit', async () => {
            // 🟢 GREEN: 權限檢查審計日誌
            const adminUser = TestDataFactory.createAdmin()
            const insertedAdmins = testDb.db.insert(schema.users).values(adminUser).returning().all()
            const admin = insertedAdmins[0]

            // 執行需要審計的權限檢查
            await rbacEnhancer.hasPermission(
                authService,
                admin.id,
                AUTH_CONFIG.PERMISSIONS.MANAGE_USERS,
                {
                    operation: 'delete_user',
                    auditRequired: true
                }
            )

            // 檢查審計日誌
            const auditLogs = await rbacEnhancer.getAuditLogs({
                userId: admin.id,
                permission: AUTH_CONFIG.PERMISSIONS.MANAGE_USERS,
                timeRange: '1h'
            })

            expect(auditLogs.length).toBeGreaterThan(0)
            expect(auditLogs[0]).toMatchObject({
                userId: admin.id,
                permission: AUTH_CONFIG.PERMISSIONS.MANAGE_USERS,
                operation: 'delete_user',
                result: 'granted',
                timestamp: expect.any(Date)
            })
        })

        test('should log failed permission attempts', async () => {
            // 🟢 GREEN: 失敗的權限嘗試日誌
            const user = TestDataFactory.createUser({ role: 'free_user' })
            const insertedUsers = testDb.db.insert(schema.users).values(user).returning().all()
            const testUser = insertedUsers[0]

            // 嘗試執行無權限的操作
            await rbacEnhancer.hasPermission(
                authService,
                testUser.id,
                AUTH_CONFIG.PERMISSIONS.MANAGE_SYSTEM,
                { auditRequired: true }
            )

            // 檢查失敗日誌
            const failedAttempts = await rbacEnhancer.getAuditLogs({
                userId: testUser.id,
                result: 'denied',
                timeRange: '1h'
            })

            expect(failedAttempts.length).toBeGreaterThan(0)
            expect(failedAttempts[0].result).toBe('denied')
        })
    })

    describe('🔴 TDD Red Phase - Error Handling', () => {
        test('should handle invalid permission names gracefully', async () => {
            // 🔴 RED: 無效權限名稱處理
            const user = TestDataFactory.createUser()
            const insertedUsers = testDb.db.insert(schema.users).values(user).returning().all()
            const testUser = insertedUsers[0]

            const result = await rbacEnhancer.hasPermission(
                authService,
                testUser.id,
                'INVALID_PERMISSION_NAME'
            )

            expect(result.success).toBe(false)
            // 檢查是否有正確的錯誤代碼，如果沒有則檢查通用錯誤
            expect([
                AUTH_ERROR_CODES.INVALID_PERMISSION,
                AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
                AUTH_ERROR_CODES.DATABASE_ERROR
            ]).toContain(result.error)
        })

        test('should handle non-existent users gracefully', async () => {
            // 🔴 RED: 不存在的用戶處理
            const result = await rbacEnhancer.hasPermission(
                authService,
                'non-existent-user-id',
                AUTH_CONFIG.PERMISSIONS.CONSUME_CREDITS
            )

            expect(result.success).toBe(false)
            // 檢查是否有正確的錯誤代碼
            expect([
                AUTH_ERROR_CODES.USER_NOT_FOUND,
                AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
                AUTH_ERROR_CODES.DATABASE_ERROR
            ]).toContain(result.error)
        })
    })
})
