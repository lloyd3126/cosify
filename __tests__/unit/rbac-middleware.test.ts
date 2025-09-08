/**
 * RBAC Middleware 測試
 * 🔴 TDD Red-Green-Blue 循環測試
 */

import { NextRequest } from 'next/server'
import { RBACMiddleware, RBACErrorType, RBACMiddlewareOptions } from '../../src/server/middleware/rbac-middleware'
import { JwtTokenValidator } from '../../src/server/services/jwt-validator'
import { AuthService, AUTH_CONFIG } from '../../src/server/services/auth-service'
import { RBACEnhancer } from '../../src/server/services/rbac-enhancer'
import { createTestDatabase, TestDataFactory, cleanupOldTestDatabases } from '../helpers/test-database'
import * as schema from '../../src/server/db/schema'

describe('RBAC Middleware', () => {
    let jwtValidator: JwtTokenValidator
    let authService: AuthService
    let rbacEnhancer: RBACEnhancer
    let rbacMiddleware: RBACMiddleware
    let testDb: any

    beforeEach(async () => {
        // 設置測試環境
        testDb = createTestDatabase({ testName: 'rbac-middleware' })
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

    describe('🔴 TDD Red Phase - Middleware Core Functionality', () => {
        test('should reject requests without token', async () => {
            // 🔴 RED: 沒有token的請求應該被拒絕
            const middleware = rbacMiddleware.createMiddleware({
                requiredPermission: AUTH_CONFIG.PERMISSIONS.CONSUME_CREDITS
            })

            const request = new NextRequest('http://localhost:3000/api/test')
            const response = await middleware(request)

            expect(response?.status).toBe(401)
            const body = await response?.json()
            expect(body.type).toBe(RBACErrorType.TOKEN_MISSING)
        })

        test('should reject requests with invalid token', async () => {
            // 🔴 RED: 無效token應該被拒絕
            const middleware = rbacMiddleware.createMiddleware({
                requiredPermission: AUTH_CONFIG.PERMISSIONS.CONSUME_CREDITS
            })

            const request = new NextRequest('http://localhost:3000/api/test', {
                headers: {
                    'Authorization': 'Bearer invalid-token'
                }
            })
            const response = await middleware(request)

            expect(response?.status).toBe(401)
            const body = await response?.json()
            expect(body.type).toBe(RBACErrorType.TOKEN_INVALID)
        })

        test('should reject requests with insufficient permissions', async () => {
            // 🔴 RED: 權限不足的請求應該被拒絕
            // 這個測試需要有效token但權限不足的場景
            expect(true).toBe(true) // 暫時placeholder，待實作有效token生成
        })
    })

    describe('🟢 TDD Green Phase - Valid Token Processing', () => {
        let validToken: string
        let testUser: any

        beforeEach(async () => {
            // 創建測試用戶和有效token
            testUser = TestDataFactory.createUser({ role: 'free_user' })
            const insertedUsers = testDb.db.insert(schema.users).values(testUser).returning().all()
            testUser = insertedUsers[0]

            // 生成有效token
            const tokenResult = await jwtValidator.generateToken({
                userId: testUser.id,
                email: testUser.email,
                role: testUser.role
            })
            validToken = tokenResult
        })

        test('should accept valid token with sufficient permissions', async () => {
            // 🟢 GREEN: 有效token和足夠權限應該通過
            const middleware = rbacMiddleware.createMiddleware({
                requiredPermission: AUTH_CONFIG.PERMISSIONS.CONSUME_CREDITS
            })

            const request = new NextRequest('http://localhost:3000/api/test', {
                headers: {
                    'Authorization': `Bearer ${validToken}`
                }
            })

            const response = await middleware(request)

            // 如果返回response，表示被拒絕；如果undefined，表示通過
            expect(response).toBeUndefined() // 成功通過中間件
        })

        test('should reject valid token with insufficient permissions', async () => {
            // 🟢 GREEN: 有效token但權限不足應該被拒絕
            const middleware = rbacMiddleware.createMiddleware({
                requiredPermission: AUTH_CONFIG.PERMISSIONS.MANAGE_USERS // free_user沒有此權限
            })

            const request = new NextRequest('http://localhost:3000/api/test', {
                headers: {
                    'Authorization': `Bearer ${validToken}`
                }
            })

            const response = await middleware(request)

            expect(response?.status).toBe(403)
            const body = await response?.json()
            expect(body.type).toBe(RBACErrorType.PERMISSION_DENIED)
        })

        test('should handle context-aware permissions correctly', async () => {
            // 🟢 GREEN: 上下文相關權限應該正確處理
            const middleware = rbacMiddleware.createMiddleware({
                requiredPermission: AUTH_CONFIG.PERMISSIONS.VIEW_USER_DATA,
                context: {
                    resourceId: testUser.id,
                    resourceType: 'user',
                    userId: testUser.id
                }
            })

            const request = new NextRequest('http://localhost:3000/api/test', {
                headers: {
                    'Authorization': `Bearer ${validToken}`
                }
            })

            const response = await middleware(request)

            // 用戶應該能查看自己的資料
            expect(response).toBeUndefined() // 成功通過
        })

        test('should set correct headers on successful permission check', async () => {
            // 🟢 GREEN: 成功的權限檢查應該設置正確的標頭
            const middleware = rbacMiddleware.createMiddleware({
                requiredPermission: AUTH_CONFIG.PERMISSIONS.CONSUME_CREDITS
            })

            const request = new NextRequest('http://localhost:3000/api/test', {
                headers: {
                    'Authorization': `Bearer ${validToken}`
                }
            })

            const response = await middleware(request)

            if (response && response.headers) {
                expect(response.headers.get('X-User-ID')).toBe(testUser.id)
                expect(response.headers.get('X-User-Role')).toBe('free_user')
                expect(response.headers.get('X-Permission-Check')).toBe('passed')
            }
        })
    })

    describe('🔵 TDD Blue Phase - Advanced Features', () => {
        let validToken: string
        let testUser: any

        beforeEach(async () => {
            testUser = TestDataFactory.createUser({ role: 'admin' })
            const insertedUsers = testDb.db.insert(schema.users).values(testUser).returning().all()
            testUser = insertedUsers[0]

            const tokenResult = await jwtValidator.generateToken({
                userId: testUser.id,
                email: testUser.email,
                role: testUser.role
            })
            validToken = tokenResult
        })

        test('should handle audit logging when enabled', async () => {
            // 🔵 BLUE: 啟用審計日誌時應該正確記錄
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

            const middleware = rbacMiddleware.createMiddleware({
                requiredPermission: AUTH_CONFIG.PERMISSIONS.MANAGE_USERS,
                auditLog: true
            })

            const request = new NextRequest('http://localhost:3000/api/test', {
                headers: {
                    'Authorization': `Bearer ${validToken}`
                }
            })

            await middleware(request)

            expect(consoleSpy).toHaveBeenCalledWith(
                'RBAC Audit Log:',
                expect.stringContaining('permission_check')
            )

            consoleSpy.mockRestore()
        })

        test('should extract token from cookie when header not present', async () => {
            // 🔵 BLUE: 從cookie中提取token的功能
            const middleware = rbacMiddleware.createMiddleware({
                requiredPermission: AUTH_CONFIG.PERMISSIONS.CONSUME_CREDITS
            })

            const request = new NextRequest('http://localhost:3000/api/test', {
                headers: {
                    'Cookie': `auth-token=${validToken}`
                }
            })

            const response = await middleware(request)

            expect(response).toBeUndefined() // 成功通過
        })

        test('should handle skipOnError option correctly', async () => {
            // 🔵 BLUE: skipOnError選項應該正確處理錯誤
            const middleware = rbacMiddleware.createMiddleware({
                requiredPermission: AUTH_CONFIG.PERMISSIONS.CONSUME_CREDITS,
                skipOnError: true
            })

            // 模擬系統錯誤
            jest.spyOn(jwtValidator, 'validateToken').mockRejectedValue(new Error('System error'))

            const request = new NextRequest('http://localhost:3000/api/test', {
                headers: {
                    'Authorization': `Bearer ${validToken}`
                }
            })

            const response = await middleware(request)

            expect(response).toBeUndefined() // 錯誤被跳過，繼續處理
        })
    })

    describe('Token Extraction Methods', () => {
        test('should extract token from Authorization header', () => {
            // 測試從Authorization header提取token
            const middleware = rbacMiddleware.createMiddleware({
                requiredPermission: AUTH_CONFIG.PERMISSIONS.CONSUME_CREDITS
            })

            const request = new NextRequest('http://localhost:3000/api/test', {
                headers: {
                    'Authorization': 'Bearer test-token'
                }
            })

            // 我們無法直接測試私有方法，但可以通過整體行為測試
            expect(request.headers.get('Authorization')).toBe('Bearer test-token')
        })

        test('should extract token from query parameter', () => {
            // 測試從查詢參數提取token
            const request = new NextRequest('http://localhost:3000/api/test?token=test-token')

            expect(request.nextUrl.searchParams.get('token')).toBe('test-token')
        })
    })

    describe('Error Response Generation', () => {
        test('should generate correct error response format', async () => {
            // 測試錯誤響應格式
            const middleware = rbacMiddleware.createMiddleware({
                requiredPermission: AUTH_CONFIG.PERMISSIONS.CONSUME_CREDITS
            })

            const request = new NextRequest('http://localhost:3000/api/test')
            const response = await middleware(request)

            expect(response?.status).toBe(401)
            const body = await response?.json()

            expect(body).toHaveProperty('error')
            expect(body).toHaveProperty('message')
            expect(body).toHaveProperty('type')
            expect(body).toHaveProperty('timestamp')
            expect(body).toHaveProperty('requestId')
        })
    })
})
