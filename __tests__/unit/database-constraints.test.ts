/**
 * Database Constraints and Indexes Optimization Tests
 * 
 * TDD Red Phase: Tests for database constraints, foreign keys, and indexes
 * These tests verify data integrity constraints and query performance improvements
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { sql } from 'drizzle-orm';
import {
    users,
    accounts,
    sessions,
    flowRuns,
    flowRunSteps,
    flowRunStepAssets,
    creditTransactions,
    dailyUsage,
    inviteCodes,
    inviteCodeRedemptions,
    auditTrail
} from '../../src/server/db/schema';

describe('Database Constraints and Indexes Optimization', () => {
    let db: Database;
    let drizzleDb: any;

    beforeEach(async () => {
        db = new Database(':memory:');
        drizzleDb = drizzle(db);

        // Enable foreign key constraints
        await drizzleDb.run(sql`PRAGMA foreign_keys = ON`);

        // Create all tables from schema
        await drizzleDb.run(sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE NOT NULL,
        email_verified INTEGER NOT NULL DEFAULT 0,
        image TEXT,
        credits INTEGER NOT NULL DEFAULT 0,
        has_google_api_key INTEGER NOT NULL DEFAULT 0,
        daily_limit INTEGER NOT NULL DEFAULT 100,
        signup_bonus_claimed INTEGER NOT NULL DEFAULT 0,
        role TEXT NOT NULL DEFAULT 'free_user' CHECK (role IN ('free_user', 'pro_user', 'admin')),
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0
      )
    `);

        await drizzleDb.run(sql`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_account_id TEXT NOT NULL,
        refresh_token TEXT,
        access_token TEXT,
        expires_at INTEGER,
        token_type TEXT,
        scope TEXT,
        id_token TEXT,
        session_state TEXT,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        UNIQUE(provider, provider_account_id)
      )
    `);

        await drizzleDb.run(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        session_token TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0
      )
    `);

        await drizzleDb.run(sql`
      CREATE TABLE IF NOT EXISTS credit_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('purchase', 'usage', 'refund', 'bonus')),
        amount INTEGER NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL DEFAULT 0
      )
    `);

        await drizzleDb.run(sql`
      CREATE TABLE IF NOT EXISTS daily_usage (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        api_calls INTEGER NOT NULL DEFAULT 0,
        credits_used INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        UNIQUE(user_id, date)
      )
    `);

        await drizzleDb.run(sql`
      CREATE TABLE IF NOT EXISTS invite_codes (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('signup_bonus', 'referral', 'promotion')),
        credits INTEGER NOT NULL DEFAULT 0,
        max_uses INTEGER,
        current_uses INTEGER NOT NULL DEFAULT 0,
        expires_at INTEGER,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at INTEGER NOT NULL DEFAULT 0
      )
    `);

        await drizzleDb.run(sql`
      CREATE TABLE IF NOT EXISTS invite_code_redemptions (
        id TEXT PRIMARY KEY,
        invite_code_id TEXT NOT NULL REFERENCES invite_codes(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        credits_awarded INTEGER NOT NULL DEFAULT 0,
        redeemed_at INTEGER NOT NULL DEFAULT 0,
        UNIQUE(invite_code_id, user_id)
      )
    `);

        await drizzleDb.run(sql`
      CREATE TABLE IF NOT EXISTS flow_runs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        flow_slug TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
        input_data TEXT,
        output_data TEXT,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0
      )
    `);

        await drizzleDb.run(sql`
      CREATE TABLE IF NOT EXISTS audit_trail (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at INTEGER NOT NULL DEFAULT 0
      )
    `);

        // Create performance indexes
        await drizzleDb.run(sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
        await drizzleDb.run(sql`CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)`);
        await drizzleDb.run(sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
        await drizzleDb.run(sql`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token)`);
        await drizzleDb.run(sql`CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id_created_at ON credit_transactions(user_id, created_at DESC)`);
        await drizzleDb.run(sql`CREATE INDEX IF NOT EXISTS idx_daily_usage_user_id_date ON daily_usage(user_id, date)`);
        await drizzleDb.run(sql`CREATE INDEX IF NOT EXISTS idx_flow_runs_user_id_created_at ON flow_runs(user_id, created_at DESC)`);
        await drizzleDb.run(sql`CREATE INDEX IF NOT EXISTS idx_audit_trail_user_id_created_at ON audit_trail(user_id, created_at DESC)`);
        await drizzleDb.run(sql`CREATE INDEX IF NOT EXISTS idx_audit_trail_resource ON audit_trail(resource_type, resource_id)`);
    });

    afterEach(() => {
        db.close();
    });

    describe('🔴 Red Phase: Foreign Key Constraints', () => {
        test('should enforce foreign key constraints on accounts table', async () => {
            // This test should fail initially because foreign key constraints are not enforced
            // accounts.userId should reference users.id

            // First create a user
            await drizzleDb.insert(users).values({
                id: 'user1',
                email: 'test@example.com',
                emailVerified: false,
                credits: 0,
                hasGoogleApiKey: false,
                dailyLimit: 100,
                signupBonusClaimed: false,
                role: 'free_user'
            });

            // This should succeed - valid foreign key
            await drizzleDb.insert(accounts).values({
                id: 'account1',
                providerId: 'google',
                accountId: 'google123',
                userId: 'user1'
            });

            // This should fail - invalid foreign key
            expect(async () => {
                await drizzleDb.insert(accounts).values({
                    id: 'account2',
                    providerId: 'google',
                    accountId: 'google456',
                    userId: 'nonexistent_user' // This should violate foreign key constraint
                });
            }).toThrow();
        });

        test('should enforce foreign key constraints on sessions table', async () => {
            // sessions.userId should reference users.id

            // Create a user first
            await drizzleDb.insert(users).values({
                id: 'user1',
                email: 'test@example.com',
                emailVerified: false,
                credits: 0,
                hasGoogleApiKey: false,
                dailyLimit: 100,
                signupBonusClaimed: false,
                role: 'free_user'
            });

            // Valid session creation should succeed
            await drizzleDb.insert(sessions).values({
                id: 'session1',
                token: 'token123',
                userId: 'user1',
                expiresAt: new Date(Date.now() + 86400000)
            });

            // Invalid session creation should fail
            expect(async () => {
                await drizzleDb.insert(sessions).values({
                    id: 'session2',
                    token: 'token456',
                    userId: 'nonexistent_user',
                    expiresAt: new Date(Date.now() + 86400000)
                });
            }).toThrow();
        });

        test('should enforce foreign key constraints on credit transactions', async () => {
            // creditTransactions.userId should reference users.id

            // Create a user first
            await drizzleDb.insert(users).values({
                id: 'user1',
                email: 'test@example.com',
                emailVerified: false,
                credits: 0,
                hasGoogleApiKey: false,
                dailyLimit: 100,
                signupBonusClaimed: false,
                role: 'free_user'
            });

            // Valid credit transaction should succeed
            await drizzleDb.insert(creditTransactions).values({
                id: 'tx1',
                userId: 'user1',
                amount: 100,
                type: 'signup_bonus',
                description: 'Welcome bonus'
            });

            // Invalid credit transaction should fail
            expect(async () => {
                await drizzleDb.insert(creditTransactions).values({
                    id: 'tx2',
                    userId: 'nonexistent_user',
                    amount: 50,
                    type: 'consumption',
                    description: 'API usage'
                });
            }).toThrow();
        });

        test('should enforce foreign key constraints on flow run steps', async () => {
            // flowRunSteps.runId should reference flowRuns.runId

            // Create user and flow run first
            await drizzleDb.insert(users).values({
                id: 'user1',
                email: 'test@example.com',
                emailVerified: false,
                credits: 0,
                hasGoogleApiKey: false,
                dailyLimit: 100,
                signupBonusClaimed: false,
                role: 'free_user'
            });

            await drizzleDb.insert(flowRuns).values({
                runId: 'run1',
                userId: 'user1',
                slug: 'test-flow',
                status: 'active',
                public: false
            });

            // Valid flow run step should succeed
            await drizzleDb.insert(flowRunSteps).values({
                runId: 'run1',
                stepId: 'step1',
                r2Key: 'test/key',
                durationMs: 1000
            });

            // Invalid flow run step should fail
            expect(async () => {
                await drizzleDb.insert(flowRunSteps).values({
                    runId: 'nonexistent_run',
                    stepId: 'step2',
                    r2Key: 'test/key2',
                    durationMs: 2000
                });
            }).toThrow();
        });

        test('should enforce foreign key constraints on invite code redemptions', async () => {
            // inviteCodeRedemptions.codeId should reference inviteCodes.code
            // inviteCodeRedemptions.userId should reference users.id

            // Create admin user, regular user, and invite code
            await drizzleDb.insert(users).values([
                {
                    id: 'admin1',
                    email: 'admin@example.com',
                    emailVerified: false,
                    credits: 0,
                    hasGoogleApiKey: false,
                    dailyLimit: 100,
                    signupBonusClaimed: false,
                    role: 'admin'
                },
                {
                    id: 'user1',
                    email: 'user@example.com',
                    emailVerified: false,
                    credits: 0,
                    hasGoogleApiKey: false,
                    dailyLimit: 100,
                    signupBonusClaimed: false,
                    role: 'free_user'
                }
            ]);

            await drizzleDb.insert(inviteCodes).values({
                code: 'INVITE123',
                createdByAdminId: 'admin1',
                creditsValue: 100,
                maxUses: 1,
                currentUses: 0,
                isActive: true,
                expiresAt: new Date(Date.now() + 86400000)
            });

            // Valid redemption should succeed
            await drizzleDb.insert(inviteCodeRedemptions).values({
                id: 'redemption1',
                codeId: 'INVITE123',
                userId: 'user1',
                ipAddress: '127.0.0.1'
            });

            // Invalid redemption with nonexistent code should fail
            expect(async () => {
                await drizzleDb.insert(inviteCodeRedemptions).values({
                    id: 'redemption2',
                    codeId: 'NONEXISTENT',
                    userId: 'user1',
                    ipAddress: '127.0.0.1'
                });
            }).toThrow();

            // Invalid redemption with nonexistent user should fail
            expect(async () => {
                await drizzleDb.insert(inviteCodeRedemptions).values({
                    id: 'redemption3',
                    codeId: 'INVITE123',
                    userId: 'nonexistent_user',
                    ipAddress: '127.0.0.1'
                });
            }).toThrow();
        });
    });

    describe('🔴 Red Phase: Unique Constraints', () => {
        test('should enforce unique constraint on user emails', async () => {
            // Create first user
            await drizzleDb.insert(users).values({
                id: 'user1',
                email: 'test@example.com',
                emailVerified: false,
                credits: 0,
                hasGoogleApiKey: false,
                dailyLimit: 100,
                signupBonusClaimed: false,
                role: 'free_user'
            });

            // Attempt to create second user with same email should fail
            expect(async () => {
                await drizzleDb.insert(users).values({
                    id: 'user2',
                    email: 'test@example.com', // Duplicate email
                    emailVerified: false,
                    credits: 0,
                    hasGoogleApiKey: false,
                    dailyLimit: 100,
                    signupBonusClaimed: false,
                    role: 'free_user'
                });
            }).toThrow();
        });

        test('should enforce unique constraint on session tokens', async () => {
            // Create user first
            await drizzleDb.insert(users).values({
                id: 'user1',
                email: 'test@example.com',
                emailVerified: false,
                credits: 0,
                hasGoogleApiKey: false,
                dailyLimit: 100,
                signupBonusClaimed: false,
                role: 'free_user'
            });

            // Create first session
            await drizzleDb.insert(sessions).values({
                id: 'session1',
                token: 'unique_token',
                userId: 'user1',
                expiresAt: new Date(Date.now() + 86400000)
            });

            // Attempt to create second session with same token should fail
            expect(async () => {
                await drizzleDb.insert(sessions).values({
                    id: 'session2',
                    token: 'unique_token', // Duplicate token
                    userId: 'user1',
                    expiresAt: new Date(Date.now() + 86400000)
                });
            }).toThrow();
        });

        test('should enforce unique constraint on daily usage records', async () => {
            // Create user first
            await drizzleDb.insert(users).values({
                id: 'user1',
                email: 'test@example.com',
                emailVerified: false,
                credits: 0,
                hasGoogleApiKey: false,
                dailyLimit: 100,
                signupBonusClaimed: false,
                role: 'free_user'
            });

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Create first daily usage record
            await drizzleDb.insert(dailyUsage).values({
                id: 'usage1',
                userId: 'user1',
                usageDate: today,
                creditsConsumed: 10
            });

            // Attempt to create second record for same user and date should fail
            expect(async () => {
                await drizzleDb.insert(dailyUsage).values({
                    id: 'usage2',
                    userId: 'user1',
                    usageDate: today, // Same date
                    creditsConsumed: 20
                });
            }).toThrow();
        });
    });

    describe('🔴 Red Phase: Check Constraints', () => {
        test('should enforce positive credit amounts in transactions', async () => {
            // Create user first
            await drizzleDb.insert(users).values({
                id: 'user1',
                email: 'test@example.com',
                emailVerified: false,
                credits: 0,
                hasGoogleApiKey: false,
                dailyLimit: 100,
                signupBonusClaimed: false,
                role: 'free_user'
            });

            // Positive amount should succeed
            await drizzleDb.insert(creditTransactions).values({
                id: 'tx1',
                userId: 'user1',
                amount: 100,
                type: 'signup_bonus',
                description: 'Welcome bonus'
            });

            // Zero amount should fail for purchase/bonus types
            expect(async () => {
                await drizzleDb.insert(creditTransactions).values({
                    id: 'tx2',
                    userId: 'user1',
                    amount: 0, // Invalid amount for bonus
                    type: 'signup_bonus',
                    description: 'Invalid bonus'
                });
            }).toThrow();

            // Negative amount should only be allowed for consumption
            await drizzleDb.insert(creditTransactions).values({
                id: 'tx3',
                userId: 'user1',
                amount: -50,
                type: 'consumption',
                description: 'API usage'
            });
        });

        test('should enforce valid role values', async () => {
            // Valid roles should succeed
            const validRoles = ['super_admin', 'admin', 'free_user'];

            for (let i = 0; i < validRoles.length; i++) {
                await drizzleDb.insert(users).values({
                    id: `user${i}`,
                    email: `user${i}@example.com`,
                    emailVerified: false,
                    credits: 0,
                    hasGoogleApiKey: false,
                    dailyLimit: 100,
                    signupBonusClaimed: false,
                    role: validRoles[i] as any
                });
            }

            // Invalid role should fail
            expect(async () => {
                await drizzleDb.insert(users).values({
                    id: 'invalid_user',
                    email: 'invalid@example.com',
                    emailVerified: false,
                    credits: 0,
                    hasGoogleApiKey: false,
                    dailyLimit: 100,
                    signupBonusClaimed: false,
                    role: 'invalid_role' as any
                });
            }).toThrow();
        });

        test('should enforce positive credit values in invite codes', async () => {
            // Create admin user first
            await drizzleDb.insert(users).values({
                id: 'admin1',
                email: 'admin@example.com',
                emailVerified: false,
                credits: 0,
                hasGoogleApiKey: false,
                dailyLimit: 100,
                signupBonusClaimed: false,
                role: 'admin'
            });

            // Positive credits value should succeed
            await drizzleDb.insert(inviteCodes).values({
                code: 'VALID123',
                createdByAdminId: 'admin1',
                creditsValue: 100,
                maxUses: 1,
                currentUses: 0,
                isActive: true,
                expiresAt: new Date(Date.now() + 86400000)
            });

            // Zero or negative credits value should fail
            expect(async () => {
                await drizzleDb.insert(inviteCodes).values({
                    code: 'INVALID123',
                    createdByAdminId: 'admin1',
                    creditsValue: 0, // Invalid value
                    maxUses: 1,
                    currentUses: 0,
                    isActive: true,
                    expiresAt: new Date(Date.now() + 86400000)
                });
            }).toThrow();
        });
    });

    describe('🔴 Red Phase: Index Performance Tests', () => {
        test('should have efficient user email lookup', async () => {
            // Insert many users to test index performance
            const users_data = Array.from({ length: 1000 }, (_, i) => ({
                id: `user${i}`,
                email: `user${i}@example.com`,
                emailVerified: false,
                credits: 0,
                hasGoogleApiKey: false,
                dailyLimit: 100,
                signupBonusClaimed: false,
                role: 'free_user' as const
            }));

            await drizzleDb.insert(users).values(users_data);

            // Test query performance - should be under 10ms with proper index
            const startTime = performance.now();

            const result = await drizzleDb
                .select()
                .from(users)
                .where(sql`email = 'user500@example.com'`);

            const endTime = performance.now();
            const queryTime = endTime - startTime;

            expect(queryTime).toBeLessThan(10); // Should be fast with index
            expect(result).toHaveLength(1);
        });

        test('should have efficient credit transaction queries by user', async () => {
            // Create user and many credit transactions
            await drizzleDb.insert(users).values({
                id: 'user1',
                email: 'test@example.com',
                emailVerified: false,
                credits: 0,
                hasGoogleApiKey: false,
                dailyLimit: 100,
                signupBonusClaimed: false,
                role: 'free_user'
            });

            const transactions = Array.from({ length: 1000 }, (_, i) => ({
                id: `tx${i}`,
                userId: 'user1',
                amount: i % 2 === 0 ? 10 : -5,
                type: i % 2 === 0 ? 'signup_bonus' : 'consumption' as const,
                description: `Transaction ${i}`,
                expiresAt: new Date(Date.now() + 86400000 + i * 1000)
            }));

            await drizzleDb.insert(creditTransactions).values(transactions);

            // Test FIFO credit consumption query performance
            const startTime = performance.now();

            const result = await drizzleDb
                .select()
                .from(creditTransactions)
                .where(sql`user_id = 'user1' AND expires_at > ${Date.now()} AND consumed_at IS NULL`)
                .orderBy(sql`expires_at ASC`)
                .limit(10);

            const endTime = performance.now();
            const queryTime = endTime - startTime;

            expect(queryTime).toBeLessThan(15); // Should be fast with compound index
            expect(result.length).toBeGreaterThan(0);
        });

        test('should have efficient daily usage queries', async () => {
            // Create user and daily usage records
            await drizzleDb.insert(users).values({
                id: 'user1',
                email: 'test@example.com',
                emailVerified: false,
                credits: 0,
                hasGoogleApiKey: false,
                dailyLimit: 100,
                signupBonusClaimed: false,
                role: 'free_user'
            });

            const usageRecords = Array.from({ length: 365 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - i);
                date.setHours(0, 0, 0, 0);

                return {
                    id: `usage${i}`,
                    userId: 'user1',
                    usageDate: date,
                    creditsConsumed: Math.floor(Math.random() * 100)
                };
            });

            await drizzleDb.insert(dailyUsage).values(usageRecords);

            // Test daily usage lookup performance
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const startTime = performance.now();

            const result = await drizzleDb
                .select()
                .from(dailyUsage)
                .where(sql`user_id = 'user1' AND usage_date = ${today.getTime()}`);

            const endTime = performance.now();
            const queryTime = endTime - startTime;

            expect(queryTime).toBeLessThan(10); // Should be fast with compound index
        });

        test('should have efficient audit trail queries', async () => {
            // Create user and audit records
            await drizzleDb.insert(users).values({
                id: 'user1',
                email: 'test@example.com',
                emailVerified: false,
                credits: 0,
                hasGoogleApiKey: false,
                dailyLimit: 100,
                signupBonusClaimed: false,
                role: 'free_user'
            });

            const auditRecords = Array.from({ length: 1000 }, (_, i) => ({
                id: `audit${i}`,
                userId: 'user1',
                action: `action_${i % 10}`,
                entityType: `entity_${i % 5}`,
                entityId: `entity_${i}`,
                oldValue: '{}',
                newValue: '{}',
                ipAddress: '127.0.0.1'
            }));

            await drizzleDb.insert(auditTrail).values(auditRecords);

            // Test audit trail query performance
            const startTime = performance.now();

            const result = await drizzleDb
                .select()
                .from(auditTrail)
                .where(sql`user_id = 'user1'`)
                .orderBy(sql`created_at DESC`)
                .limit(20);

            const endTime = performance.now();
            const queryTime = endTime - startTime;

            expect(queryTime).toBeLessThan(15); // Should be fast with user index
            expect(result).toHaveLength(20);
        });
    });

    describe('🔴 Red Phase: Cascading Delete Constraints', () => {
        test('should cascade delete user-related data when user is deleted', async () => {
            // Create user with related data
            await drizzleDb.insert(users).values({
                id: 'user1',
                email: 'test@example.com',
                emailVerified: false,
                credits: 0,
                hasGoogleApiKey: false,
                dailyLimit: 100,
                signupBonusClaimed: false,
                role: 'free_user'
            });

            // Create related data
            await drizzleDb.insert(accounts).values({
                id: 'account1',
                providerId: 'google',
                accountId: 'google123',
                userId: 'user1'
            });

            await drizzleDb.insert(sessions).values({
                id: 'session1',
                token: 'token123',
                userId: 'user1',
                expiresAt: new Date(Date.now() + 86400000)
            });

            await drizzleDb.insert(creditTransactions).values({
                id: 'tx1',
                userId: 'user1',
                amount: 100,
                type: 'signup_bonus',
                description: 'Welcome bonus'
            });

            // Delete user should cascade to related tables
            await drizzleDb.delete(users).where(sql`id = 'user1'`);

            // Verify related data is also deleted
            const remainingAccounts = await drizzleDb
                .select()
                .from(accounts)
                .where(sql`user_id = 'user1'`);

            const remainingSessions = await drizzleDb
                .select()
                .from(sessions)
                .where(sql`user_id = 'user1'`);

            const remainingTransactions = await drizzleDb
                .select()
                .from(creditTransactions)
                .where(sql`user_id = 'user1'`);

            expect(remainingAccounts).toHaveLength(0);
            expect(remainingSessions).toHaveLength(0);
            expect(remainingTransactions).toHaveLength(0);
        });

        test('should handle delete restrictions for referenced data', async () => {
            // Create admin and invite code
            await drizzleDb.insert(users).values({
                id: 'admin1',
                email: 'admin@example.com',
                emailVerified: false,
                credits: 0,
                hasGoogleApiKey: false,
                dailyLimit: 100,
                signupBonusClaimed: false,
                role: 'admin'
            });

            await drizzleDb.insert(inviteCodes).values({
                code: 'INVITE123',
                createdByAdminId: 'admin1',
                creditsValue: 100,
                maxUses: 1,
                currentUses: 0,
                isActive: true,
                expiresAt: new Date(Date.now() + 86400000)
            });

            // Attempting to delete admin who has created invite codes should fail
            expect(async () => {
                await drizzleDb.delete(users).where(sql`id = 'admin1'`);
            }).toThrow();
        });
    });
});
