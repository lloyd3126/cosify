/**
 * Database Migration Service Tests
 * 
 * TDD tests for UUID primary key migration utilities
 */

import { DatabaseMigrationService } from '../../src/server/services/database-migration';
import { createTestDatabase, type TestDbConfig } from '../helpers/test-database';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('DatabaseMigrationService', () => {
    let migrationService: DatabaseMigrationService;
    let testDb: DatabaseType;
    let cleanup: () => void;

    beforeEach(async () => {
        migrationService = new DatabaseMigrationService();
        const testDbSetup = createTestDatabase({ testName: 'migration' });
        testDb = testDbSetup.sqliteDb;
        cleanup = testDbSetup.cleanup;
    });

    afterEach(() => {
        if (cleanup) {
            cleanup();
        }
    });

    describe('🔵 Refactor Phase: Schema Analysis', () => {
        test('should analyze database schema for UUID compliance', async () => {
            const analysis = await migrationService.analyzeSchema(testDb);

            expect(analysis.tablesAnalyzed).toBeGreaterThan(0);
            expect(Array.isArray(analysis.uuidCompliant)).toBe(true);
            expect(Array.isArray(analysis.needsMigration)).toBe(true);
            expect(typeof analysis.analysis).toBe('object');
        });

        test('should identify existing tables', async () => {
            // Create a test table with UUID primary key
            testDb.exec(`
        CREATE TABLE test_users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL
        )
      `);

            // Insert a record with UUID
            const uuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
            testDb.prepare('INSERT INTO test_users (id, name) VALUES (?, ?)').run(uuid, 'Test User');

            // Note: This test works with actual schema tables, not test tables
            const analysis = await migrationService.analyzeSchema(testDb);

            expect(analysis.tablesAnalyzed).toBe(14); // All schema tables
        });
    });

    describe('🔵 Refactor Phase: UUID Validation', () => {
        test('should validate table UUIDs for empty table', async () => {
            // Create empty test table (not part of main schema)
            testDb.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT
        )
      `);

            const validation = await migrationService.validateTableUUIDs(testDb, 'users');

            expect(validation.totalRecords).toBe(0);
            expect(validation.validUUIDs).toBe(0);
            expect(validation.invalidUUIDs).toBe(0);
            expect(validation.isCompliant).toBe(true);
        });

        test('should validate table UUIDs with valid data', async () => {
            // Create and populate test table with clean state
            testDb.exec(`DROP TABLE IF EXISTS users`);
            testDb.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT
        )
      `);

            const uuid1 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
            const uuid2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

            testDb.prepare('INSERT INTO users (id, name) VALUES (?, ?)').run(uuid1, 'User 1');
            testDb.prepare('INSERT INTO users (id, name) VALUES (?, ?)').run(uuid2, 'User 2');

            // Debug: Check what's actually in the database
            const allRecords = testDb.prepare('SELECT id FROM users').all();
            console.log('All records:', allRecords);

            const validation = await migrationService.validateTableUUIDs(testDb, 'users');
            console.log('Validation result:', validation);

            expect(validation.totalRecords).toBe(2);
            expect(validation.validUUIDs).toBe(2);
            expect(validation.invalidUUIDs).toBe(0);
            expect(validation.isCompliant).toBe(true);
        });

        test('should detect non-UUID primary keys', async () => {
            // Create table with non-UUID data
            testDb.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT
        )
      `);

            testDb.prepare('INSERT INTO users (id, name) VALUES (?, ?)').run('1', 'User 1');
            testDb.prepare('INSERT INTO users (id, name) VALUES (?, ?)').run('2', 'User 2');

            const validation = await migrationService.validateTableUUIDs(testDb, 'users');

            expect(validation.totalRecords).toBe(2);
            expect(validation.validUUIDs).toBe(0);
            expect(validation.invalidUUIDs).toBe(2);
            expect(validation.isCompliant).toBe(false);
        });
    });

    describe('🔵 Refactor Phase: New Record Generation', () => {
        test('should generate UUID for new records', () => {
            const userId = migrationService.generateNewRecordId('users');
            const sessionId = migrationService.generateNewRecordId('sessions');
            const accountId = migrationService.generateNewRecordId('accounts');

            // All should be valid UUIDs
            expect(userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
            expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
            expect(accountId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

            // All should be unique
            expect(userId).not.toBe(sessionId);
            expect(sessionId).not.toBe(accountId);
            expect(userId).not.toBe(accountId);
        });
    });

    describe('🔵 Refactor Phase: Migration Status', () => {
        test('should get migration status for all tables', async () => {
            const status = await migrationService.getMigrationStatus(testDb);

            // Should have status for all database tables
            const expectedTables = [
                'users', 'accounts', 'sessions', 'verification',
                'appUsers', 'generations', 'flowRuns', 'flowRunSteps',
                'flowRunStepAssets', 'creditTransactions', 'dailyUsage',
                'inviteCodes', 'inviteCodeRedemptions', 'auditTrail'
            ];

            expectedTables.forEach(tableName => {
                expect(status[tableName as keyof typeof status]).toBeDefined();
            });
        });

        test('should handle non-existent tables gracefully', async () => {
            const status = await migrationService.getMigrationStatus(testDb);

            // Most tables won't exist in test database, should have error info
            Object.values(status).forEach(tableStatus => {
                expect(tableStatus).toBeDefined();
                // Should either have validation data or error information
                expect(
                    typeof tableStatus.totalRecords === 'number' ||
                    typeof tableStatus.error === 'string'
                ).toBe(true);
            });
        });
    });

    describe('🔵 Refactor Phase: Migration Execution', () => {
        test('should execute migration steps without errors', async () => {
            const result = await migrationService.executeMigration(testDb);

            expect(result.success).toBe(true);
            expect(Array.isArray(result.stepsCompleted)).toBe(true);
            expect(result.error).toBeUndefined();
        });

        test('should handle migration errors gracefully', async () => {
            // Create a database connection that will cause errors
            const invalidDb = testDb; // Keep reference but create invalid query scenario

            // Override the prepared statement to cause an error by using an invalid table
            const originalPrepare = invalidDb.prepare;
            invalidDb.prepare = () => {
                throw new Error('Simulated database error');
            };

            const result = await migrationService.executeMigration(invalidDb);

            expect(result.success).toBe(false);
            expect(Array.isArray(result.stepsCompleted)).toBe(true);
            expect(typeof result.error).toBe('string');

            // Restore original prepare method
            invalidDb.prepare = originalPrepare;
        });
    });
});
