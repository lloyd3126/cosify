/**
 * Phase 2.9: 敏感資料遮罩 - 全面測試套件
 * 
 * 🔴 TDD Red Phase: 建立失敗測試驗證所有遮罩功能
 * 
 * 測試範圍：
 * - 基礎資料遮罩 (電子郵件、電話、信用卡)
 * - 個人識別資訊 (ID號碼、護照號碼)
 * - 金融資料 (銀行賬號、金額)
 * - 自定義遮罩規則
 * - 物件和陣列遮罩
 * - 日誌遮罩
 * - API 回應遮罩
 * - 效能和邊界條件
 */

import { DataMasker, MaskingOptions, MaskingRule, MaskingStrategy } from '../../src/server/services/data-masker'
import { DataMaskingMiddleware } from '../../src/server/middleware/data-masking-middleware'

describe('Data Masking System', () => {
    let dataMasker: DataMasker
    let maskingMiddleware: DataMaskingMiddleware

    beforeEach(() => {
        dataMasker = new DataMasker()
        maskingMiddleware = new DataMaskingMiddleware()
    })

    describe('🔴 TDD Red Phase - Basic Data Masking', () => {
        test('should mask email addresses correctly', () => {
            const email = 'user@example.com'
            const masked = dataMasker.maskEmail(email)

            expect(masked).toBe('u***@example.com')
            expect(masked).not.toBe(email)
            expect(masked).toContain('@example.com')
        })

        test('should mask phone numbers with different formats', () => {
            const phoneNumbers = [
                '+886-912-345-678',
                '0912345678',
                '(02)2555-1234'
            ]

            phoneNumbers.forEach(phone => {
                const masked = dataMasker.maskPhone(phone)

                expect(masked).not.toBe(phone)
                expect(masked).toContain('***')
                expect(masked.length).toBeGreaterThanOrEqual(phone.length - 4)
            })
        })

        test('should mask credit card numbers securely', () => {
            const creditCards = [
                '4532-1234-5678-9012',
                '4532123456789012',
                '5555 5555 5555 4444'
            ]

            creditCards.forEach(card => {
                const masked = dataMasker.maskCreditCard(card)

                expect(masked).not.toBe(card)
                expect(masked).toMatch(/\*{4,}/) // 至少4個星號
                // 應該顯示最後4位數字
                const lastFour = card.replace(/\D/g, '').slice(-4)
                expect(masked).toContain(lastFour)
            })
        })

        test('should mask passwords completely', () => {
            const passwords = ['password123', 'mySecretP@ssw0rd', '短密碼']

            passwords.forEach(password => {
                const masked = dataMasker.maskPassword(password)

                expect(masked).toBe('***')
                expect(masked).not.toContain(password)
            })
        })

        test('should handle null and undefined values gracefully', () => {
            expect(dataMasker.maskEmail(null)).toBe(null)
            expect(dataMasker.maskPhone(undefined)).toBe(undefined)
            expect(dataMasker.maskCreditCard('')).toBe('')
        })
    })

    describe('🔴 TDD Red Phase - Advanced Personal Data Masking', () => {
        test('should mask Taiwan ID numbers correctly', () => {
            const taiwanIds = ['A123456789', 'B234567890']

            taiwanIds.forEach(id => {
                const masked = dataMasker.maskTaiwanId(id)

                expect(masked).toBe(id[0] + '****' + id.slice(-2))
                expect(masked).not.toBe(id)
            })
        })

        test('should mask passport numbers', () => {
            const passports = ['A12345678', 'AB1234567']

            passports.forEach(passport => {
                const masked = dataMasker.maskPassport(passport)

                expect(masked).not.toBe(passport)
                expect(masked).toContain('***')
            })
        })

        test('should mask addresses while preserving structure', () => {
            const address = '台北市大安區忠孝東路四段123號5樓'
            const masked = dataMasker.maskAddress(address)

            expect(masked).toBe('台北市***區***路***號***樓')
            expect(masked).not.toBe(address)
            expect(masked).toContain('台北市')
        })

        test('should mask names appropriately', () => {
            const names = ['王小明', 'John Smith', 'Mary Jane Watson']

            names.forEach(name => {
                const masked = dataMasker.maskName(name)

                expect(masked).not.toBe(name)
                expect(masked).toContain('*')
                // 中文姓名應保留姓氏
                if (name === '王小明') {
                    expect(masked).toBe('王**')
                }
            })
        })
    })

    describe('🔴 TDD Red Phase - Financial Data Masking', () => {
        test('should mask bank account numbers', () => {
            const accounts = ['123-45-67890', '0012345678901234']

            accounts.forEach(account => {
                const masked = dataMasker.maskBankAccount(account)

                expect(masked).not.toBe(account)
                expect(masked).toMatch(/\*+/)
                // 應保留最後3-4位數字
                expect(masked).toContain(account.slice(-3))
            })
        })

        test('should mask monetary amounts appropriately', () => {
            const amounts = [1000, 50000, 1234567]

            amounts.forEach(amount => {
                const masked = dataMasker.maskAmount(amount)

                expect(masked).toContain('***')
                expect(masked).not.toContain(amount.toString())
            })
        })

        test('should handle different currency formats', () => {
            const currencies = ['NT$1,000', '$50.00', '€123.45']

            currencies.forEach(currency => {
                const masked = dataMasker.maskCurrency(currency)

                expect(masked).toContain('*') // 至少包含一個星號
                expect(masked).not.toBe(currency)
            })
        })
    })

    describe('🔴 TDD Red Phase - Custom Masking Rules', () => {
        test('should apply custom masking rules', () => {
            const customRule: MaskingRule = {
                field: 'socialSecurityNumber',
                strategy: MaskingStrategy.PARTIAL,
                pattern: /(\d{3})-(\d{2})-(\d{4})/,
                replacement: '$1-**-****'
            }

            dataMasker.addRule(customRule)

            const ssn = '123-45-6789'
            const masked = dataMasker.applyRule('socialSecurityNumber', ssn)

            expect(masked).toBe('123-**-****')
        })

        test('should support configurable masking options', () => {
            const options: MaskingOptions = {
                emailStrategy: MaskingStrategy.PARTIAL,
                phoneStrategy: MaskingStrategy.COMPLETE,
                preserveFormat: true,
                maskCharacter: '#'
            }

            const maskerWithOptions = new DataMasker(options)
            const email = 'test@example.com'
            const masked = maskerWithOptions.maskEmail(email)

            expect(masked).toContain('#')
            expect(masked).toContain('@example.com')
        })

        test('should validate masking rules before applying', () => {
            const invalidRule: MaskingRule = {
                field: '',
                strategy: MaskingStrategy.PARTIAL,
                pattern: null as any,
                replacement: ''
            }

            expect(() => dataMasker.addRule(invalidRule)).toThrow()
        })
    })

    describe('🔴 TDD Red Phase - Object and Array Masking', () => {
        test('should mask nested objects recursively', () => {
            const userData = {
                name: '王小明',
                email: 'wang@example.com',
                phone: '0912345678',
                address: {
                    street: '忠孝東路123號',
                    city: '台北市',
                    zipCode: '10001'
                },
                creditCards: ['4532123456789012']
            }

            const masked = dataMasker.maskObject(userData, [
                'name', 'email', 'phone', 'address.street', 'creditCards'
            ])

            expect(masked.name).toBe('王**')
            expect(masked.email).toBe('w***@example.com')
            expect(masked.phone).toContain('***')
            expect(masked.address.street).toContain('***')
            expect(masked.address.city).toBe('台北市') // 未遮罩
            expect(masked.creditCards[0]).toContain('***')
        })

        test('should mask arrays of sensitive data', () => {
            const emails = ['user1@test.com', 'user2@test.com', 'user3@test.com']
            const maskedEmails = dataMasker.maskArray(emails, 'email')

            maskedEmails.forEach((masked, index) => {
                expect(masked).not.toBe(emails[index])
                expect(masked).toContain('***')
                expect(masked).toContain('@test.com')
            })
        })

        test('should handle deeply nested structures', () => {
            const complexData = {
                users: [
                    {
                        profile: {
                            personal: {
                                email: 'deep@test.com',
                                ssn: '123-45-6789'
                            }
                        }
                    }
                ]
            }

            const masked = dataMasker.maskDeepObject(complexData, [
                'users.*.profile.personal.email',
                'users.*.profile.personal.ssn'
            ])

            expect(masked.users[0].profile.personal.email).toContain('***')
            expect(masked.users[0].profile.personal.ssn).toContain('***')
        })
    })

    describe('🔴 TDD Red Phase - System Integration', () => {
        test('should mask system logs appropriately', () => {
            const logEntry = {
                timestamp: '2025-09-09T10:00:00Z',
                level: 'INFO',
                message: 'User wang@example.com logged in with phone 0912345678',
                userId: 'A123456789',
                metadata: {
                    ip: '192.168.1.1',
                    userAgent: 'Mozilla/5.0'
                }
            }

            const maskedLog = dataMasker.maskLogEntry(logEntry)

            expect(maskedLog.message).toContain('***@example.com')
            expect(maskedLog.message).toContain('091***5678')
            expect(maskedLog.userId).toBe('A****89')
            expect(maskedLog.metadata.ip).toBe('192.168.*.*')
        })

        test('should integrate with API response masking', () => {
            const apiResponse = {
                success: true,
                data: {
                    user: {
                        id: 'A123456789',
                        name: '王小明',
                        email: 'wang@example.com',
                        phone: '0912345678'
                    }
                }
            }

            const maskedResponse = dataMasker.maskApiResponse(apiResponse, [
                'data.user.name',
                'data.user.email',
                'data.user.phone'
            ])

            expect(maskedResponse.data.user.name).toBe('王**')
            expect(maskedResponse.data.user.email).toContain('***')
            expect(maskedResponse.data.user.phone).toContain('***')
            expect(maskedResponse.data.user.id).toBe('A123456789') // 未遮罩
        })
    })

    describe('🔴 TDD Red Phase - Performance and Edge Cases', () => {
        test('should handle large datasets efficiently', () => {
            const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
                email: `user${i}@test.com`,
                phone: `091234${String(i).padStart(4, '0')}`
            }))

            const startTime = Date.now()
            const masked = dataMasker.maskArray(largeDataset, ['email', 'phone'])
            const endTime = Date.now()

            expect(endTime - startTime).toBeLessThan(1000) // 應在1秒內完成
            expect(masked.length).toBe(10000)
            expect(masked[0].email).toContain('***')
        })

        test('should handle malformed data gracefully', () => {
            const malformedData = [
                'not-an-email',
                'invalid-phone-123abc',
                '短信用卡號',
                null,
                undefined,
                123,
                {}
            ]

            malformedData.forEach(data => {
                expect(() => {
                    dataMasker.maskEmail(data as any)
                    dataMasker.maskPhone(data as any)
                    dataMasker.maskCreditCard(data as any)
                }).not.toThrow()
            })
        })

        test('should maintain thread safety in concurrent operations', async () => {
            const concurrentOperations = Array.from({ length: 100 }, (_, i) =>
                Promise.resolve().then(() =>
                    dataMasker.maskEmail(`user${i}@test.com`)
                )
            )

            const results = await Promise.all(concurrentOperations)

            results.forEach((result, index) => {
                expect(result).toContain('***')
                expect(result).toContain('@test.com')
            })
        })

        test('should provide masking statistics', () => {
            dataMasker.maskEmail('test@example.com')
            dataMasker.maskPhone('0912345678')
            dataMasker.maskCreditCard('4532123456789012')

            const stats = dataMasker.getStatistics()

            expect(stats.totalMaskedItems).toBe(3)
            expect(stats.maskingTypes.email).toBe(1)
            expect(stats.maskingTypes.phone).toBe(1)
            expect(stats.maskingTypes.creditCard).toBe(1)
        })
    })
})

describe('Data Masking Middleware', () => {
    let req: any
    let res: any
    let next: jest.Mock
    let maskingMiddleware: DataMaskingMiddleware

    beforeEach(() => {
        req = {
            body: {},
            query: {},
            headers: {}
        }
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            locals: {}
        }
        next = jest.fn()
        maskingMiddleware = new DataMaskingMiddleware()
    })

    describe('🔴 TDD Red Phase - Middleware Integration', () => {
        test('should mask request body data', async () => {
            req.body = {
                email: 'test@example.com',
                phone: '0912345678'
            }

            const middleware = maskingMiddleware.createMiddleware({
                maskRequest: true,
                requestFields: ['email', 'phone']
            })

            await middleware(req, res, next)

            expect(req.body.email).toContain('***')
            expect(req.body.phone).toContain('***')
            expect(next).toHaveBeenCalled()
        })

        test('should mask response data before sending', async () => {
            const responseData = {
                user: {
                    name: '王小明',
                    email: 'wang@example.com',
                    phone: '0912345678'
                }
            }

            const masked = maskingMiddleware.maskResponseData(responseData, [
                'user.email', 'user.phone'
            ])

            expect(masked.user.email).toContain('***')
            expect(masked.user.phone).toContain('***')
            expect(masked.user.name).toBe('王小明') // 未遮罩
        })

        test('should handle middleware errors gracefully', async () => {
            req.body = { invalid: 'data' }

            const middleware = maskingMiddleware.createMiddleware({
                maskRequest: true,
                requestFields: ['nonexistent.field']
            })

            expect(async () => {
                await middleware(req, res, next)
            }).not.toThrow()

            expect(next).toHaveBeenCalled()
        })

        test('should support conditional masking based on user role', async () => {
            req.user = { role: 'admin' }
            req.body = { email: 'admin@company.com' }

            const middleware = maskingMiddleware.createMiddleware({
                maskRequest: true,
                requestFields: ['email'],
                skipForRoles: ['admin']
            })

            await middleware(req, res, next)

            expect(req.body.email).toBe('admin@company.com') // 未遮罩
        })

        test('should audit masking operations', async () => {
            req.body = { email: 'test@example.com' }

            const middleware = maskingMiddleware.createMiddleware({
                maskRequest: true,
                requestFields: ['email'],
                enableAudit: true
            })

            await middleware(req, res, next)

            const auditLog = maskingMiddleware.getAuditLog()
            expect(auditLog).toHaveLength(1)
            expect(auditLog[0].field).toBe('request.email')
            expect(auditLog[0].action).toBe('mask')
        })
    })
})
