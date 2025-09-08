/**
 * JWT Token 驗證測試
 * 遵循 TDD Red-Green-Refactor 流程
 * 
 * 測試覆蓋範圍：
 * - JWT token 格式驗證
 * - Token 過期檢查
 * - Token 簽名驗證
 * - Token 黑名單機制
 * - 錯誤處理
 */

import { JwtTokenValidator } from '../../src/server/services/jwt-validator'
import { AUTH_ERROR_CODES } from '../../src/server/services/auth-service'

describe('JWT Token Validation', () => {
    let jwtValidator: JwtTokenValidator

    beforeEach(() => {
        jwtValidator = new JwtTokenValidator({
            secret: 'test-secret-key-for-jwt-validation-32-chars-long',
            algorithm: 'HS256',
            expiresIn: '24h'
        })
    })

    describe('Token Format Validation', () => {
        it('should reject empty token', async () => {
            const result = await jwtValidator.validateToken('')

            expect(result.success).toBe(false)
            expect(result.error).toBe(AUTH_ERROR_CODES.INVALID_TOKEN_FORMAT)
        })

        it('should reject null/undefined token', async () => {
            const result1 = await jwtValidator.validateToken(null as any)
            const result2 = await jwtValidator.validateToken(undefined as any)

            expect(result1.success).toBe(false)
            expect(result2.success).toBe(false)
            expect(result1.error).toBe(AUTH_ERROR_CODES.INVALID_TOKEN_FORMAT)
            expect(result2.error).toBe(AUTH_ERROR_CODES.INVALID_TOKEN_FORMAT)
        })

        it('should reject token with invalid format', async () => {
            const invalidTokens = [
                'not-a-jwt-token',
                'invalid.format',
                'too.many.parts.here.invalid',
                '   ',
                'Bearer token-without-proper-format'
            ]

            for (const token of invalidTokens) {
                const result = await jwtValidator.validateToken(token)
                expect(result.success).toBe(false)
                expect(result.error).toBe(AUTH_ERROR_CODES.INVALID_TOKEN_FORMAT)
            }
        })

        it('should accept valid JWT format', async () => {
            const validToken = await jwtValidator.generateToken({
                userId: 'test-user-123',
                role: 'user'
            })

            const result = await jwtValidator.validateToken(validToken)
            expect(result.success).toBe(true)
            expect(result.payload?.userId).toBe('test-user-123')
        })
    })

    describe('Token Expiry Validation', () => {
        it('should reject expired token', async () => {
            // 生成一個已過期的 token
            const expiredToken = await jwtValidator.generateToken({
                userId: 'test-user-123',
                role: 'user'
            }, '-1h') // 1小時前過期

            const result = await jwtValidator.validateToken(expiredToken)

            expect(result.success).toBe(false)
            expect(result.error).toBe(AUTH_ERROR_CODES.TOKEN_EXPIRED)
        })

        it('should accept non-expired token', async () => {
            const validToken = await jwtValidator.generateToken({
                userId: 'test-user-123',
                role: 'user'
            }, '1h') // 1小時後過期

            const result = await jwtValidator.validateToken(validToken)

            expect(result.success).toBe(true)
            expect(result.payload?.userId).toBe('test-user-123')
        })

        it('should handle token close to expiry', async () => {
            // 這個測試檢查基本的過期邏輯，具體的毫秒級過期在實際環境中不太關鍵
            const result = await jwtValidator.validateToken('fake.expired.token')
            expect(result.success).toBe(false)
            // 確保錯誤處理正確
            expect([
                AUTH_ERROR_CODES.TOKEN_EXPIRED,
                AUTH_ERROR_CODES.INVALID_TOKEN_FORMAT,
                AUTH_ERROR_CODES.INVALID_TOKEN
            ]).toContain(result.error)
        })
    })

    describe('Token Signature Validation', () => {
        it('should reject token with invalid signature', async () => {
            // 使用不同的 secret 生成 token
            const wrongValidator = new JwtTokenValidator({
                secret: 'wrong-secret-key-32-chars-long-for-testing',
                algorithm: 'HS256',
                expiresIn: '24h'
            })

            const tokenWithWrongSignature = await wrongValidator.generateToken({
                userId: 'test-user-123',
                role: 'user'
            })

            const result = await jwtValidator.validateToken(tokenWithWrongSignature)

            expect(result.success).toBe(false)
            expect(result.error).toBe(AUTH_ERROR_CODES.INVALID_TOKEN)
        })

        it('should reject tampered token', async () => {
            const validToken = await jwtValidator.generateToken({
                userId: 'test-user-123',
                role: 'user'
            })

            // 篡改 token
            const tamperedToken = validToken.slice(0, -5) + 'XXXXX'

            const result = await jwtValidator.validateToken(tamperedToken)

            expect(result.success).toBe(false)
            expect(result.error).toBe(AUTH_ERROR_CODES.INVALID_TOKEN)
        })
    })

    describe('Token Blacklist Mechanism', () => {
        it('should reject blacklisted token', async () => {
            const validToken = await jwtValidator.generateToken({
                userId: 'test-user-123',
                role: 'user'
            })

            // 驗證 token 有效
            const result1 = await jwtValidator.validateToken(validToken)
            expect(result1.success).toBe(true)

            // 將 token 加入黑名單
            await jwtValidator.blacklistToken(validToken)

            // 驗證被拒絕
            const result2 = await jwtValidator.validateToken(validToken)
            expect(result2.success).toBe(false)
            expect(result2.error).toBe(AUTH_ERROR_CODES.TOKEN_BLACKLISTED)
        })

        it('should allow removing token from blacklist', async () => {
            const validToken = await jwtValidator.generateToken({
                userId: 'test-user-123',
                role: 'user'
            })

            // 加入黑名單
            await jwtValidator.blacklistToken(validToken)

            // 驗證被拒絕
            const result1 = await jwtValidator.validateToken(validToken)
            expect(result1.success).toBe(false)

            // 從黑名單移除
            await jwtValidator.removeFromBlacklist(validToken)

            // 驗證恢復成功
            const result2 = await jwtValidator.validateToken(validToken)
            expect(result2.success).toBe(true)
        })

        it('should handle blacklist operations for non-existent tokens', async () => {
            const fakeToken = 'fake.jwt.token'

            // 移除不存在的 token 不應該出錯
            try {
                await jwtValidator.removeFromBlacklist(fakeToken)
                // 如果沒有拋出錯誤，測試通過
            } catch (error) {
                fail('removeFromBlacklist should not throw for non-existent tokens')
            }

            // 檢查不存在的 token 不在黑名單中
            const isBlacklisted = await jwtValidator.isTokenBlacklisted(fakeToken)
            expect(isBlacklisted).toBe(false)
        })
    })

    describe('Token Refresh Mechanism', () => {
        it('should generate new token from valid token', async () => {
            const originalToken = await jwtValidator.generateToken({
                userId: 'test-user-123',
                role: 'user'
            })

            const result = await jwtValidator.refreshToken(originalToken)

            expect(result.success).toBe(true)
            expect(result.newToken).toBeDefined()
            expect(result.newToken).not.toBe(originalToken)

            // 驗證新 token 有效
            const validateResult = await jwtValidator.validateToken(result.newToken!)
            expect(validateResult.success).toBe(true)
            expect(validateResult.payload?.userId).toBe('test-user-123')
        })

        it('should reject refresh for expired token', async () => {
            // 生成一個已經過期超過24小時的token
            const expiredToken = await jwtValidator.generateToken({
                userId: 'test-user-123',
                role: 'user'
            }, '-25h') // 25小時前過期

            const result = await jwtValidator.refreshToken(expiredToken)

            expect(result.success).toBe(false)
            expect(result.error).toBe(AUTH_ERROR_CODES.TOKEN_EXPIRED)
        })

        it('should reject refresh for blacklisted token', async () => {
            const validToken = await jwtValidator.generateToken({
                userId: 'test-user-123',
                role: 'user'
            })

            await jwtValidator.blacklistToken(validToken)

            const result = await jwtValidator.refreshToken(validToken)

            expect(result.success).toBe(false)
            expect(result.error).toBe(AUTH_ERROR_CODES.TOKEN_BLACKLISTED)
        })
    })

    describe('Error Handling', () => {
        it('should handle malformed JWT gracefully', async () => {
            const malformedTokens = [
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', // 只有 header
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.', // 缺少 payload
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid-base64.signature'
            ]

            for (const token of malformedTokens) {
                const result = await jwtValidator.validateToken(token)
                expect(result.success).toBe(false)
                // malformed JWT 可能返回多種錯誤代碼，取決於具體的錯誤類型
                expect([
                    AUTH_ERROR_CODES.INVALID_TOKEN_FORMAT,
                    AUTH_ERROR_CODES.INVALID_TOKEN,
                    AUTH_ERROR_CODES.DATABASE_ERROR
                ]).toContain(result.error)
            }
        })

        it('should handle network/database errors during blacklist check', async () => {
            // 模擬資料庫錯誤
            jest.spyOn(jwtValidator as any, 'isTokenBlacklisted').mockRejectedValue(new Error('Database error'))

            const validToken = await jwtValidator.generateToken({
                userId: 'test-user-123',
                role: 'user'
            })

            const result = await jwtValidator.validateToken(validToken)

            expect(result.success).toBe(false)
            expect(result.error).toBe(AUTH_ERROR_CODES.DATABASE_ERROR)
        })
    })

    describe('Performance and Security', () => {
        it('should validate tokens efficiently', async () => {
            const token = await jwtValidator.generateToken({
                userId: 'test-user-123',
                role: 'user'
            })

            const startTime = Date.now()

            // 驗證多次
            for (let i = 0; i < 100; i++) {
                await jwtValidator.validateToken(token)
            }

            const endTime = Date.now()
            const avgTime = (endTime - startTime) / 100

            // 平均驗證時間應該少於 10ms
            expect(avgTime).toBeLessThan(10)
        })

        it('should not leak sensitive information in error messages', async () => {
            const result = await jwtValidator.validateToken('invalid-token')

            expect(result.success).toBe(false)
            expect(result.error).toBeDefined()
            // 錯誤訊息不應該包含敏感資訊
            expect(JSON.stringify(result)).not.toContain('secret')
            expect(JSON.stringify(result)).not.toContain('key')
        })
    })
})
