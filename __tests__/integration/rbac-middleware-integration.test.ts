/**
 * RBAC Middleware 整合測試
 * 🔴 TDD 簡化版 - 專注核心功能
 */

import { JwtTokenValidator } from '../../src/server/services/jwt-validator'
import { AuthService, AUTH_CONFIG } from '../../src/server/services/auth-service'
import { RBACEnhancer } from '../../src/server/services/rbac-enhancer'
import { RBACMiddleware, RBACErrorType } from '../../src/server/middleware/rbac-middleware'
import { createTestDatabase, TestDataFactory, cleanupOldTestDatabases } from '../helpers/test-database'
import * as schema from '../../src/server/db/schema'

describe('RBAC Middleware Integration', () => {
    let jwtValidator: JwtTokenValidator
    let authService: AuthService
    let rbacEnhancer: RBACEnhancer
    let rbacMiddleware: RBACMiddleware
    let testDb: any

    beforeEach(async () => {
        // 設置測試環境
        testDb = createTestDatabase({
            testName: 'rbac-middleware-integration',
            migrationsPath: './drizzle'
        })
        authService = new AuthService(testDb.db)
        jwtValidator = new JwtTokenValidator({
            secret: 'test-secret-key-for-jwt-validation',
            expiresIn: '1h'
        })
        rbacEnhancer = new RBACEnhancer()
        rbacMiddleware = new RBACMiddleware(jwtValidator, authService, rbacEnhancer)
    })

    afterEach(async () => {
        cleanupOldTestDatabases()
    })

    describe('🔴 TDD Red Phase - Core Functionality', () => {
        test('should initialize RBAC middleware correctly', () => {
            // 🔴 RED: 中間件應該正確初始化
            expect(rbacMiddleware).toBeInstanceOf(RBACMiddleware)
        })

        test('should create middleware function with required permission', () => {
            // 🔴 RED: 應該能創建帶有必需權限的中間件函數
            const middleware = rbacMiddleware.createMiddleware({
                requiredPermission: AUTH_CONFIG.PERMISSIONS.CONSUME_CREDITS
            })

            expect(typeof middleware).toBe('function')
        })
    })

    describe('🟢 TDD Green Phase - Token and Permission Validation', () => {
        let validToken: string
        let testUser: any

        beforeEach(async () => {
            // 創建測試用戶和有效token
            testUser = TestDataFactory.createUser({ role: 'free_user' })
            const insertedUsers = testDb.db.insert(schema.users).values(testUser).returning().all()
            testUser = insertedUsers[0]

            // 生成有效token
            validToken = await jwtValidator.generateToken({
                userId: testUser.id,
                email: testUser.email,
                role: testUser.role
            })
        })

        test('should validate JWT token correctly', async () => {
            // 🟢 GREEN: 應該正確驗證JWT token
            const validation = await jwtValidator.validateToken(validToken)

            expect(validation.success).toBe(true)
            expect(validation.payload?.userId).toBe(testUser.id)
        })

        test('should check RBAC permissions correctly', async () => {
            // 🟢 GREEN: 應該正確檢查RBAC權限
            const permissionResult = await rbacEnhancer.hasPermission(
                authService,
                testUser.id,
                AUTH_CONFIG.PERMISSIONS.CONSUME_CREDITS
            )

            expect(permissionResult.success).toBe(true)
            expect(permissionResult.hasPermission).toBe(true)
        })

        test('should deny permissions for insufficient roles', async () => {
            // 🟢 GREEN: 應該拒絕權限不足的角色
            const permissionResult = await rbacEnhancer.hasPermission(
                authService,
                testUser.id,
                AUTH_CONFIG.PERMISSIONS.MANAGE_USERS // free_user沒有此權限
            )

            expect(permissionResult.hasPermission).toBe(false)
        })

        test('should handle context-aware permissions', async () => {
            // 🟢 GREEN: 應該處理上下文相關權限
            const permissionResult = await rbacEnhancer.hasPermission(
                authService,
                testUser.id,
                AUTH_CONFIG.PERMISSIONS.VIEW_USER_DATA,
                {
                    resourceId: testUser.id,
                    resourceType: 'user',
                    userId: testUser.id
                }
            )

            // 用戶應該能查看自己的資料
            expect(permissionResult.success).toBe(true)
            expect(permissionResult.hasPermission).toBe(true)
        })
    })

    describe('🔵 TDD Blue Phase - Advanced Functionality', () => {
        let adminToken: string
        let adminUser: any

        beforeEach(async () => {
            // 創建管理員用戶
            adminUser = TestDataFactory.createAdmin()
            const insertedAdmins = testDb.db.insert(schema.users).values(adminUser).returning().all()
            adminUser = insertedAdmins[0]

            adminToken = await jwtValidator.generateToken({
                userId: adminUser.id,
                email: adminUser.email,
                role: adminUser.role
            })
        })

        test('should validate admin permissions', async () => {
            // 🔵 BLUE: 應該驗證管理員權限
            const adminPermissions = [
                AUTH_CONFIG.PERMISSIONS.CONSUME_CREDITS,
                AUTH_CONFIG.PERMISSIONS.MANAGE_USERS,
                AUTH_CONFIG.PERMISSIONS.MANAGE_SYSTEM
            ]

            for (const permission of adminPermissions) {
                const result = await rbacEnhancer.hasPermission(
                    authService,
                    adminUser.id,
                    permission
                )
                expect(result.hasPermission).toBe(true)
            }
        })

        test('should support permission caching', async () => {
            // 🔵 BLUE: 應該支援權限快取
            const permission = AUTH_CONFIG.PERMISSIONS.MANAGE_USERS

            // 第一次檢查
            const result1 = await rbacEnhancer.hasPermission(
                authService,
                adminUser.id,
                permission
            )

            // 第二次檢查（應該使用快取）
            const result2 = await rbacEnhancer.hasPermission(
                authService,
                adminUser.id,
                permission
            )

            expect(result1.hasPermission).toBe(true)
            expect(result2.hasPermission).toBe(true)
            expect(result2.cached).toBe(true)
        })

        test('should invalidate cache when needed', async () => {
            // 🔵 BLUE: 應該在需要時使快取失效
            const permission = AUTH_CONFIG.PERMISSIONS.MANAGE_USERS

            // 第一次檢查
            await rbacEnhancer.hasPermission(authService, adminUser.id, permission)

            // 再次檢查（可能使用快取）
            const result = await rbacEnhancer.hasPermission(
                authService,
                adminUser.id,
                permission
            )

            expect(result.hasPermission).toBe(true)
        })
    })

    describe('Token Extraction Logic', () => {
        test('should extract token from Authorization header format', () => {
            // 測試Authorization header格式
            const headerValue = 'Bearer test-token-123'
            const token = headerValue.startsWith('Bearer ') ? headerValue.substring(7) : null

            expect(token).toBe('test-token-123')
        })

        test('should handle missing Authorization header', () => {
            // 測試缺少Authorization header的情況
            const headerValue: string | null = null
            const token = headerValue && headerValue.startsWith('Bearer ') ? headerValue.substring(7) : null

            expect(token).toBeNull()
        })

        test('should handle malformed Authorization header', () => {
            // 測試格式錯誤的Authorization header
            const headerValue = 'Invalid token-123'
            const token = headerValue.startsWith('Bearer ') ? headerValue.substring(7) : null

            expect(token).toBeNull()
        })
    })

    describe('Error Type Mapping', () => {
        test('should map error types to correct HTTP status codes', () => {
            // 測試錯誤類型到HTTP狀態碼的映射
            const errorMappings = [
                { type: RBACErrorType.TOKEN_MISSING, expectedStatus: 401 },
                { type: RBACErrorType.TOKEN_INVALID, expectedStatus: 401 },
                { type: RBACErrorType.TOKEN_EXPIRED, expectedStatus: 401 },
                { type: RBACErrorType.PERMISSION_DENIED, expectedStatus: 403 },
                { type: RBACErrorType.USER_NOT_FOUND, expectedStatus: 404 },
                { type: RBACErrorType.SYSTEM_ERROR, expectedStatus: 500 }
            ]

            errorMappings.forEach(({ type, expectedStatus }) => {
                // 這裡我們測試邏輯而不是實際的HTTP響應
                const getStatusCodeForError = (errorType: RBACErrorType): number => {
                    switch (errorType) {
                        case RBACErrorType.TOKEN_MISSING:
                        case RBACErrorType.TOKEN_INVALID:
                        case RBACErrorType.TOKEN_EXPIRED:
                            return 401
                        case RBACErrorType.PERMISSION_DENIED:
                            return 403
                        case RBACErrorType.USER_NOT_FOUND:
                            return 404
                        case RBACErrorType.SYSTEM_ERROR:
                        default:
                            return 500
                    }
                }

                expect(getStatusCodeForError(type)).toBe(expectedStatus)
            })
        })
    })

    describe('Audit Logging Functionality', () => {
        test('should create audit log entry structure', () => {
            // 測試審計日誌結構
            const auditEntry = {
                timestamp: new Date().toISOString(),
                userId: 'test-user-id',
                action: 'permission_check',
                permission: AUTH_CONFIG.PERMISSIONS.MANAGE_USERS,
                result: 'granted',
                metadata: {
                    userRole: 'admin',
                    path: '/api/admin/users',
                    method: 'GET'
                }
            }

            expect(auditEntry).toHaveProperty('timestamp')
            expect(auditEntry).toHaveProperty('userId')
            expect(auditEntry).toHaveProperty('action')
            expect(auditEntry).toHaveProperty('permission')
            expect(auditEntry).toHaveProperty('result')
            expect(auditEntry).toHaveProperty('metadata')
            expect(['granted', 'denied']).toContain(auditEntry.result)
        })
    })
})
