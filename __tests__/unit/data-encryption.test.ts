/**
 * Phase 2.10 資料加密存儲 - TDD Red Phase
 * 
 * 測試資料加密和解密的正確性
 * 驗證敏感資料在資料庫中加密存儲
 * 
 * @author GitHub Copilot
 * @created 2025-09-09
 */

import { DataEncryptor, EncryptionOptions, DecryptionResult } from '@/server/services/data-encryptor'

describe('🔐 Phase 2.10 - Data Encryption Storage', () => {
    let dataEncryptor: DataEncryptor

    beforeEach(() => {
        // 每次測試前重置加密器
        dataEncryptor = new DataEncryptor({
            algorithm: 'aes-256-gcm',
            keyDerivation: 'pbkdf2',
            iterations: 100000
        })
    })

    describe('🔴 TDD Red Phase - Basic Encryption/Decryption', () => {
        it('should encrypt plain text data', async () => {
            const plaintext = 'sensitive user data'

            const encrypted = await dataEncryptor.encrypt(plaintext)

            expect(encrypted).toBeDefined()
            expect(encrypted.ciphertext).not.toBe(plaintext)
            expect(encrypted.iv).toBeDefined()
            expect(encrypted.tag).toBeDefined()
            expect(encrypted.salt).toBeDefined()
        })

        it('should decrypt encrypted data back to original', async () => {
            const plaintext = 'sensitive user data'

            const encrypted = await dataEncryptor.encrypt(plaintext)
            const decrypted = await dataEncryptor.decrypt(encrypted)

            expect(decrypted.success).toBe(true)
            expect(decrypted.data).toBe(plaintext)
        })

        it('should fail to decrypt with invalid data', async () => {
            const invalidData = {
                ciphertext: 'invalid',
                iv: 'invalid',
                tag: 'invalid',
                salt: 'invalid'
            }

            const result = await dataEncryptor.decrypt(invalidData)

            expect(result.success).toBe(false)
            expect(result.error).toBeDefined()
        })
    })

    describe('🔴 TDD Red Phase - Sensitive Data Types', () => {
        const sensitiveData = {
            email: 'user@example.com',
            phone: '0912345678',
            creditCard: '4111111111111111',
            taiwanId: 'A123456789',
            passport: 'AB1234567',
            address: '台北市信義區市府路1號',
            bankAccount: '123-456-789012',
            ssn: '123-45-6789'
        }

        Object.entries(sensitiveData).forEach(([type, value]) => {
            it(`should encrypt and decrypt ${type} data correctly`, async () => {
                const encrypted = await dataEncryptor.encrypt(value, { dataType: type })
                const decrypted = await dataEncryptor.decrypt(encrypted)

                expect(decrypted.success).toBe(true)
                expect(decrypted.data).toBe(value)
            })
        })

        it('should handle empty and null values safely', async () => {
            const testCases = ['', null, undefined]

            for (const testCase of testCases) {
                const encrypted = await dataEncryptor.encrypt(testCase)
                const decrypted = await dataEncryptor.decrypt(encrypted)

                expect(decrypted.success).toBe(true)
                expect(decrypted.data).toBe(testCase)
            }
        })
    })

    describe('🔴 TDD Red Phase - Key Management', () => {
        it('should derive consistent keys from same password and salt', async () => {
            const password = 'test-password'
            const salt = 'test-salt'

            const key1 = await dataEncryptor.deriveKey(password, salt)
            const key2 = await dataEncryptor.deriveKey(password, salt)

            expect(key1).toEqual(key2)
        })

        it('should derive different keys from different passwords', async () => {
            const salt = 'test-salt'

            const key1 = await dataEncryptor.deriveKey('password1', salt)
            const key2 = await dataEncryptor.deriveKey('password2', salt)

            expect(key1).not.toEqual(key2)
        })

        it('should derive different keys from different salts', async () => {
            const password = 'test-password'

            const key1 = await dataEncryptor.deriveKey(password, 'salt1')
            const key2 = await dataEncryptor.deriveKey(password, 'salt2')

            expect(key1).not.toEqual(key2)
        })

        it('should rotate encryption keys properly', async () => {
            const plaintext = 'sensitive data'

            // 用舊金鑰加密
            const encrypted = await dataEncryptor.encrypt(plaintext)

            // 輪替金鑰
            await dataEncryptor.rotateKey()

            // 應該仍能解密舊資料
            const decrypted = await dataEncryptor.decrypt(encrypted)
            expect(decrypted.success).toBe(true)
            expect(decrypted.data).toBe(plaintext)

            // 新資料用新金鑰加密
            const newEncrypted = await dataEncryptor.encrypt(plaintext)
            const newDecrypted = await dataEncryptor.decrypt(newEncrypted)
            expect(newDecrypted.success).toBe(true)
            expect(newDecrypted.data).toBe(plaintext)
        })
    })

    describe('🔴 TDD Red Phase - Object and Array Encryption', () => {
        it('should encrypt and decrypt complex objects', async () => {
            const complexObject = {
                user: {
                    name: 'John Doe',
                    email: 'john@example.com',
                    profile: {
                        phone: '0912345678',
                        address: '台北市信義區'
                    }
                },
                metadata: {
                    createdAt: new Date().toISOString(),
                    version: '1.0'
                }
            }

            const encrypted = await dataEncryptor.encryptObject(complexObject)
            const decrypted = await dataEncryptor.decryptObject(encrypted)

            expect(decrypted.success).toBe(true)
            expect(decrypted.data).toEqual(complexObject)
        })

        it('should encrypt arrays of sensitive data', async () => {
            const sensitiveArray = [
                'user1@example.com',
                'user2@example.com',
                '0912345678',
                'A123456789'
            ]

            const encrypted = await dataEncryptor.encryptArray(sensitiveArray)
            const decrypted = await dataEncryptor.decryptArray(encrypted)

            expect(decrypted.success).toBe(true)
            expect(decrypted.data).toEqual(sensitiveArray)
        })

        it('should handle selective encryption in objects', async () => {
            const userObject = {
                id: 'user-123',
                name: 'John Doe',
                email: 'john@example.com', // 需要加密
                phone: '0912345678', // 需要加密
                role: 'user' // 不需要加密
            }

            const fieldsToEncrypt = ['email', 'phone']
            const encrypted = await dataEncryptor.encryptFields(userObject, fieldsToEncrypt)
            const decrypted = await dataEncryptor.decryptFields(encrypted, fieldsToEncrypt)

            expect(decrypted.success).toBe(true)
            expect(decrypted.data).toEqual(userObject)

            // 驗證只有指定欄位被加密
            expect(encrypted.id).toBe(userObject.id)
            expect(encrypted.role).toBe(userObject.role)
            expect(encrypted.email).not.toBe(userObject.email)
            expect(encrypted.phone).not.toBe(userObject.phone)
        })
    })

    describe('🔴 TDD Red Phase - Database Integration', () => {
        it('should provide database-ready encrypted format', async () => {
            const plaintext = 'sensitive database data'

            const dbFormat = await dataEncryptor.encryptForDatabase(plaintext)

            expect(dbFormat).toHaveProperty('encrypted_data')
            expect(dbFormat).toHaveProperty('encryption_metadata')
            expect(dbFormat.encryption_metadata).toHaveProperty('algorithm')
            expect(dbFormat.encryption_metadata).toHaveProperty('iv')
            expect(dbFormat.encryption_metadata).toHaveProperty('tag')
            expect(dbFormat.encryption_metadata).toHaveProperty('salt')
            expect(dbFormat.encryption_metadata).toHaveProperty('key_version')
        })

        it('should decrypt from database format', async () => {
            const plaintext = 'sensitive database data'

            const dbFormat = await dataEncryptor.encryptForDatabase(plaintext)
            const decrypted = await dataEncryptor.decryptFromDatabase(dbFormat)

            expect(decrypted.success).toBe(true)
            expect(decrypted.data).toBe(plaintext)
        })

        it('should handle database batch operations', async () => {
            const dataList = [
                'data1@example.com',
                'data2@example.com',
                'data3@example.com'
            ]

            const encryptedBatch = await dataEncryptor.encryptBatch(dataList)
            const decryptedBatch = await dataEncryptor.decryptBatch(encryptedBatch)

            expect(decryptedBatch.success).toBe(true)
            expect(decryptedBatch.data).toEqual(dataList)
            expect(encryptedBatch.length).toBe(dataList.length)
        })
    })

    describe('🔴 TDD Red Phase - Security Features', () => {
        it('should generate cryptographically secure random IVs', async () => {
            const ivs = []
            for (let i = 0; i < 100; i++) {
                const encrypted = await dataEncryptor.encrypt('test')
                ivs.push(encrypted.iv)
            }

            // 所有 IV 都應該不同
            const uniqueIvs = new Set(ivs)
            expect(uniqueIvs.size).toBe(ivs.length)
        })

        it('should use authenticated encryption (GCM mode)', async () => {
            const plaintext = 'test data'
            const encrypted = await dataEncryptor.encrypt(plaintext)

            // 篡改認證標籤（更有效的篡改檢測）
            const originalTag = encrypted.tag
            const tamperedTag = originalTag.slice(0, -2) + '00' // 改變最後一個 byte
            const tamperedData = { ...encrypted, tag: tamperedTag }

            const result = await dataEncryptor.decrypt(tamperedData)
            expect(result.success).toBe(false)
            expect(result.error).toContain('authentication')
        })

        it('should implement secure key derivation', async () => {
            const options = dataEncryptor.getEncryptionOptions()

            expect(options.iterations).toBeGreaterThanOrEqual(100000)
            expect(options.keyDerivation).toBe('pbkdf2')
            expect(options.algorithm).toBe('aes-256-gcm')
        })

        it('should provide audit trail for encryption operations', async () => {
            const plaintext = 'audited data'

            await dataEncryptor.encrypt(plaintext, {
                auditContext: {
                    userId: 'user-123',
                    operation: 'user_data_encryption'
                }
            })

            const auditLogs = dataEncryptor.getAuditLogs()
            expect(auditLogs.length).toBeGreaterThan(0)

            const lastLog = auditLogs[auditLogs.length - 1]
            expect(lastLog).toHaveProperty('timestamp')
            expect(lastLog).toHaveProperty('operation')
            expect(lastLog).toHaveProperty('userId')
            expect(lastLog).toHaveProperty('success')
        })
    })

    describe('🔴 TDD Red Phase - Performance and Memory', () => {
        it('should handle large data encryption efficiently', async () => {
            const largeData = 'x'.repeat(1000000) // 1MB data

            const startTime = Date.now()
            const encrypted = await dataEncryptor.encrypt(largeData)
            const decrypted = await dataEncryptor.decrypt(encrypted)
            const endTime = Date.now()

            expect(decrypted.success).toBe(true)
            expect(decrypted.data).toBe(largeData)
            expect(endTime - startTime).toBeLessThan(5000) // 應在 5 秒內完成
        })

        it('should implement memory-efficient streaming for large files', async () => {
            const chunks = ['chunk1', 'chunk2', 'chunk3', 'chunk4']

            const streamEncryption = await dataEncryptor.createEncryptionStream()

            for (const chunk of chunks) {
                await streamEncryption.write(chunk)
            }

            const encryptedStream = await streamEncryption.finalize()
            const decryptedData = await dataEncryptor.decryptStream(encryptedStream)

            expect(decryptedData.success).toBe(true)
            expect(decryptedData.data).toBe(chunks.join(''))
        })

        it('should clean up sensitive data from memory', async () => {
            const sensitiveData = 'very secret data'

            const encrypted = await dataEncryptor.encrypt(sensitiveData)

            // 清理記憶體中的敏感資料
            await dataEncryptor.clearSensitiveMemory()

            // 加密後的資料應該仍然可以解密
            const decrypted = await dataEncryptor.decrypt(encrypted)
            expect(decrypted.success).toBe(true)
            expect(decrypted.data).toBe(sensitiveData)
        })
    })

    describe('🔴 TDD Red Phase - Error Handling', () => {
        it('should handle encryption errors gracefully', async () => {
            // 模擬加密失敗
            const corruptedEncryptor = new DataEncryptor({ algorithm: 'invalid-algorithm' as any })

            const result = await corruptedEncryptor.encrypt('test data').catch(error => ({
                success: false,
                error: error.message
            }))

            expect(result.success).toBe(false)
            expect(result.error).toBeDefined()
        })

        it('should validate input data types', async () => {
            const invalidInputs = [
                { input: Symbol('test'), description: 'symbol' },
                { input: function () { }, description: 'function' },
                { input: new Date(), description: 'date object' }
            ]

            for (const { input, description } of invalidInputs) {
                const result = await dataEncryptor.encrypt(input as any).catch(error => ({
                    success: false,
                    error: error.message
                }))

                expect(result.success).toBe(false)
                expect(result.error).toContain(`Invalid input type: ${description}`)
            }
        })

        it('should handle corrupted encryption metadata', async () => {
            const plaintext = 'test data'
            const encrypted = await dataEncryptor.encrypt(plaintext)

            // 損壞 metadata
            const corruptedData = {
                ...encrypted,
                tag: 'corrupted_tag'
            }

            const result = await dataEncryptor.decrypt(corruptedData)
            expect(result.success).toBe(false)
            expect(result.error).toContain('Invalid authentication tag')
        })
    })

    describe('🔴 TDD Red Phase - Configuration and Options', () => {
        it('should support different encryption algorithms', async () => {
            const algorithms = ['aes-256-gcm', 'aes-192-gcm', 'aes-128-gcm']

            for (const algorithm of algorithms) {
                const encryptor = new DataEncryptor({ algorithm })
                const encrypted = await encryptor.encrypt('test')
                const decrypted = await encryptor.decrypt(encrypted)

                expect(decrypted.success).toBe(true)
                expect(decrypted.data).toBe('test')
            }
        })

        it('should support configurable key derivation parameters', async () => {
            const customEncryptor = new DataEncryptor({
                keyDerivation: 'pbkdf2',
                iterations: 200000,
                keyLength: 32,
                saltLength: 16
            })

            const plaintext = 'test with custom params'
            const encrypted = await customEncryptor.encrypt(plaintext)
            const decrypted = await customEncryptor.decrypt(encrypted)

            expect(decrypted.success).toBe(true)
            expect(decrypted.data).toBe(plaintext)
        })

        it('should provide encryption statistics', async () => {
            // 執行多次加密操作
            for (let i = 0; i < 10; i++) {
                await dataEncryptor.encrypt(`test data ${i}`)
            }

            const stats = dataEncryptor.getStatistics()

            expect(stats.totalOperations).toBe(10)
            expect(stats.successfulOperations).toBe(10)
            expect(stats.averageEncryptionTime).toBeGreaterThan(0)
            expect(stats.totalDataEncrypted).toBeGreaterThan(0)
        })
    })

    describe('🔴 TDD Red Phase - Integration with Data Masker', () => {
        it('should integrate with existing data masking system', async () => {
            const sensitiveData = {
                email: 'user@example.com',
                phone: '0912345678',
                creditCard: '4111111111111111'
            }

            // 先遮罩，再加密
            const maskedAndEncrypted = await dataEncryptor.maskAndEncrypt(sensitiveData)

            // 解密後應該得到遮罩的資料
            const decrypted = await dataEncryptor.decrypt(maskedAndEncrypted)

            expect(decrypted.success).toBe(true)
            expect(decrypted.data.email).toContain('***')
            expect(decrypted.data.phone).toContain('***')
            expect(decrypted.data.creditCard).toContain('***')
        })

        it('should support encryption without masking for storage', async () => {
            const sensitiveData = 'original sensitive data'

            const encrypted = await dataEncryptor.encryptForStorage(sensitiveData, {
                maskForLogs: true, // 日誌中遮罩
                encryptForDatabase: true // 資料庫中加密原始資料
            })

            const decrypted = await dataEncryptor.decrypt(encrypted)

            expect(decrypted.success).toBe(true)
            expect(decrypted.data).toBe(sensitiveData) // 解密後是原始資料
        })
    })
})
