/**
 * TDD Red Phase: UUID Generator Service Tests
 * 
 * Testing comprehensive UUID v4 generation and validation
 * for primary key migration in all database tables
 */

import { UUIDGenerator } from '../../src/server/services/uuid-generator';

describe('UUIDGenerator Service', () => {
    let uuidGenerator: UUIDGenerator;

    beforeEach(() => {
        uuidGenerator = new UUIDGenerator();
    });

    describe('🔴 Red Phase: Basic UUID Generation', () => {
        test('should generate valid UUID v4', () => {
            const uuid = uuidGenerator.generate();

            // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
            const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            expect(uuid).toMatch(uuidV4Regex);
            expect(typeof uuid).toBe('string');
            expect(uuid.length).toBe(36);
        });

        test('should generate unique UUIDs', () => {
            const uuid1 = uuidGenerator.generate();
            const uuid2 = uuidGenerator.generate();

            expect(uuid1).not.toBe(uuid2);
        });

        test('should validate correct UUID format', () => {
            const validUuid = '550e8400-e29b-41d4-a716-446655440000';

            expect(uuidGenerator.isValid(validUuid)).toBe(true);
        });

        test('should reject invalid UUID formats', () => {
            const invalidUuids = [
                '',
                'not-a-uuid',
                '550e8400-e29b-41d4-a716', // too short
                '550e8400-e29b-41d4-a716-446655440000-extra', // too long
                '550e8400-e29b-41d4-g716-446655440000', // invalid character
                '550e8400e29b41d4a716446655440000', // missing hyphens
            ];

            invalidUuids.forEach(uuid => {
                expect(uuidGenerator.isValid(uuid)).toBe(false);
            });
        });
    });

    describe('🔴 Red Phase: Batch Generation', () => {
        test('should generate multiple unique UUIDs', () => {
            const count = 100;
            const uuids = uuidGenerator.generateBatch(count);

            expect(uuids).toHaveLength(count);

            // Check all are unique
            const uniqueUuids = new Set(uuids);
            expect(uniqueUuids.size).toBe(count);

            // Check all are valid
            uuids.forEach((uuid: string) => {
                expect(uuidGenerator.isValid(uuid)).toBe(true);
            });
        });

        test('should handle large batch generation', () => {
            const count = 10000;
            const uuids = uuidGenerator.generateBatch(count);

            expect(uuids).toHaveLength(count);

            // Check uniqueness
            const uniqueUuids = new Set(uuids);
            expect(uniqueUuids.size).toBe(count);
        });
    });

    describe('🔴 Red Phase: Database Table ID Generation', () => {
        test('should generate ID for users table', () => {
            const userId = uuidGenerator.generateForTable('users');

            expect(uuidGenerator.isValid(userId)).toBe(true);
            expect(userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });

        test('should generate ID for all database tables', () => {
            const tables: Array<import('../../src/server/services/uuid-generator').DatabaseTable> = [
                'users',
                'accounts',
                'sessions',
                'verification',
                'appUsers',
                'generations',
                'flowRuns',
                'flowRunSteps',
                'flowRunStepAssets',
                'creditTransactions',
                'dailyUsage',
                'inviteCodes',
                'inviteCodeRedemptions',
                'auditTrail'
            ];

            tables.forEach(tableName => {
                const id = uuidGenerator.generateForTable(tableName);

                expect(uuidGenerator.isValid(id)).toBe(true);
                expect(typeof id).toBe('string');
            });
        });

        test('should support prefix for table IDs', () => {
            const userIdWithPrefix = uuidGenerator.generateForTable('users', 'usr');
            const sessionIdWithPrefix = uuidGenerator.generateForTable('sessions', 'ses');

            expect(userIdWithPrefix).toMatch(/^usr_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
            expect(sessionIdWithPrefix).toMatch(/^ses_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });
    });

    describe('🔴 Red Phase: Migration Utilities', () => {
        test('should convert existing ID to UUID if needed', () => {
            // Test with numeric ID
            const numericId = '12345';
            const convertedUuid = uuidGenerator.migrateId(numericId);

            expect(uuidGenerator.isValid(convertedUuid)).toBe(true);
            expect(convertedUuid).not.toBe(numericId);
        });

        test('should preserve existing UUID IDs', () => {
            const existingUuid = '550e8400-e29b-41d4-a716-446655440000';
            const preservedUuid = uuidGenerator.migrateId(existingUuid);

            expect(preservedUuid).toBe(existingUuid);
        });

        test('should generate mapping for legacy IDs', () => {
            const legacyIds = ['1', '2', '3', 'legacy-id-1', 'legacy-id-2'];
            const mapping = uuidGenerator.generateMigrationMapping(legacyIds);

            expect(Object.keys(mapping)).toHaveLength(legacyIds.length);

            legacyIds.forEach(legacyId => {
                expect(mapping[legacyId]).toBeDefined();
                expect(uuidGenerator.isValid(mapping[legacyId])).toBe(true);
            });

            // Check all generated UUIDs are unique
            const generatedUuids = Object.values(mapping);
            const uniqueUuids = new Set(generatedUuids);
            expect(uniqueUuids.size).toBe(generatedUuids.length);
        });
    });

    describe('🔴 Red Phase: Performance Tests', () => {
        test('should generate UUIDs efficiently', () => {
            const startTime = performance.now();

            for (let i = 0; i < 1000; i++) {
                uuidGenerator.generate();
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Should complete 1000 generations in under 100ms
            expect(duration).toBeLessThan(100);
        });

        test('should validate UUIDs efficiently', () => {
            const uuid = uuidGenerator.generate();
            const startTime = performance.now();

            for (let i = 0; i < 10000; i++) {
                uuidGenerator.isValid(uuid);
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Should complete 10000 validations in under 50ms
            expect(duration).toBeLessThan(50);
        });
    });

    describe('🔴 Red Phase: Error Handling', () => {
        test('should handle null/undefined input gracefully', () => {
            expect(uuidGenerator.isValid(null as any)).toBe(false);
            expect(uuidGenerator.isValid(undefined as any)).toBe(false);
        });

        test('should handle empty batch generation', () => {
            const emptyBatch = uuidGenerator.generateBatch(0);

            expect(emptyBatch).toHaveLength(0);
            expect(Array.isArray(emptyBatch)).toBe(true);
        });

        test('should throw error for invalid batch size', () => {
            expect(() => {
                uuidGenerator.generateBatch(-1);
            }).toThrow('Batch size must be a positive number');
        });
    });
});
