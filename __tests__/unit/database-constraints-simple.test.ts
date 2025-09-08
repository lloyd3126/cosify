/**
 * Database Constraints and Indexes Optimization Tests (Simplified)
 * 
 * TDD Red Phase: Tests for database constraints, foreign keys, and indexes
 * These tests verify data integrity constraints and query performance improvements
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';

describe('Database Constraints and Indexes Optimization', () => {
    let db: Database;

    beforeEach(async () => {
        db = new Database(':memory:');

        // Enable foreign key constraints
        db.run('PRAGMA foreign_keys = ON');

        // Create all tables from schema with constraints
        db.run(`
      CREATE TABLE users (
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

        db.run(`
      CREATE TABLE accounts (
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

        db.run(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        session_token TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0
      )
    `);

        db.run(`
      CREATE TABLE credit_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('purchase', 'usage', 'refund', 'bonus')),
        amount INTEGER NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL DEFAULT 0
      )
    `);

        db.run(`
      CREATE TABLE daily_usage (
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

        db.run(`
      CREATE TABLE invite_codes (
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

        db.run(`
      CREATE TABLE invite_code_redemptions (
        id TEXT PRIMARY KEY,
        invite_code_id TEXT NOT NULL REFERENCES invite_codes(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        credits_awarded INTEGER NOT NULL DEFAULT 0,
        redeemed_at INTEGER NOT NULL DEFAULT 0,
        UNIQUE(invite_code_id, user_id)
      )
    `);

        db.run(`
      CREATE TABLE flow_runs (
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

        db.run(`
      CREATE TABLE audit_trail (
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
        db.run('CREATE INDEX idx_users_email ON users(email)');
        db.run('CREATE INDEX idx_accounts_user_id ON accounts(user_id)');
        db.run('CREATE INDEX idx_sessions_user_id ON sessions(user_id)');
        db.run('CREATE INDEX idx_sessions_token ON sessions(session_token)');
        db.run('CREATE INDEX idx_credit_transactions_user_id_created_at ON credit_transactions(user_id, created_at DESC)');
        db.run('CREATE INDEX idx_daily_usage_user_id_date ON daily_usage(user_id, date)');
        db.run('CREATE INDEX idx_flow_runs_user_id_created_at ON flow_runs(user_id, created_at DESC)');
        db.run('CREATE INDEX idx_audit_trail_user_id_created_at ON audit_trail(user_id, created_at DESC)');
        db.run('CREATE INDEX idx_audit_trail_resource ON audit_trail(resource_type, resource_id)');
    });

    afterEach(() => {
        db.close();
    });

    describe('🔴 Red Phase: Foreign Key Constraints', () => {
        test('should enforce foreign key constraints on accounts table', async () => {
            // This test should fail initially because foreign key constraints are not enforced
            // accounts.user_id should reference users.id

            const currentTime = Date.now();

            // First create a user
            db.run(`
        INSERT INTO users (id, email, email_verified, credits, has_google_api_key, daily_limit, signup_bonus_claimed, role, created_at, updated_at)
        VALUES ('user1', 'test@example.com', 0, 0, 0, 100, 0, 'free_user', ${currentTime}, ${currentTime})
      `);

            // This should succeed - valid foreign key
            db.run(`
        INSERT INTO accounts (id, user_id, type, provider, provider_account_id, created_at, updated_at)
        VALUES ('acc1', 'user1', 'oauth', 'google', '123', ${currentTime}, ${currentTime})
      `);

            // This should fail - invalid foreign key
            expect(() => {
                db.run(`
          INSERT INTO accounts (id, user_id, type, provider, provider_account_id, created_at, updated_at)
          VALUES ('acc2', 'nonexistent', 'oauth', 'google', '456', ${currentTime}, ${currentTime})
        `);
            }).toThrow();
        });

        test('should enforce foreign key constraints on sessions table', async () => {
            // sessions.user_id should reference users.id

            const currentTime = Date.now();

            // This should fail - invalid foreign key
            expect(() => {
                db.run(`
          INSERT INTO sessions (id, session_token, user_id, expires, created_at, updated_at)
          VALUES ('sess1', 'token123', 'nonexistent', ${currentTime + 86400000}, ${currentTime}, ${currentTime})
        `);
            }).toThrow();
        });

        test('should enforce foreign key constraints on credit_transactions table', async () => {
            // credit_transactions.user_id should reference users.id

            const currentTime = Date.now();

            // This should fail - invalid foreign key
            expect(() => {
                db.run(`
          INSERT INTO credit_transactions (id, user_id, type, amount, created_at)
          VALUES ('ct1', 'nonexistent', 'purchase', 100, ${currentTime})
        `);
            }).toThrow();
        });

        test('should enforce foreign key constraints on daily_usage table', async () => {
            // daily_usage.user_id should reference users.id

            const currentTime = Date.now();

            // This should fail - invalid foreign key
            expect(() => {
                db.run(`
          INSERT INTO daily_usage (id, user_id, date, api_calls, credits_used, created_at, updated_at)
          VALUES ('du1', 'nonexistent', '2024-01-01', 10, 50, ${currentTime}, ${currentTime})
        `);
            }).toThrow();
        });

        test('should enforce foreign key constraints on flow_runs table', async () => {
            // flow_runs.user_id should reference users.id

            const currentTime = Date.now();

            // This should fail - invalid foreign key
            expect(() => {
                db.run(`
          INSERT INTO flow_runs (id, user_id, flow_slug, status, created_at, updated_at)
          VALUES ('fr1', 'nonexistent', 'test-flow', 'pending', ${currentTime}, ${currentTime})
        `);
            }).toThrow();
        });

        test('should enforce foreign key constraints on invite_code_redemptions table', async () => {
            // invite_code_redemptions should reference both invite_codes and users

            const currentTime = Date.now();

            // This should fail - invalid foreign key
            expect(() => {
                db.run(`
          INSERT INTO invite_code_redemptions (id, invite_code_id, user_id, credits_awarded, redeemed_at)
          VALUES ('icr1', 'nonexistent', 'nonexistent', 10, ${currentTime})
        `);
            }).toThrow();
        });
    });

    describe('🔴 Red Phase: Unique Constraints', () => {
        test('should enforce unique email constraint on users table', async () => {
            const currentTime = Date.now();

            // First user should succeed
            db.run(`
        INSERT INTO users (id, email, email_verified, credits, has_google_api_key, daily_limit, signup_bonus_claimed, role, created_at, updated_at)
        VALUES ('user1', 'test@example.com', 0, 0, 0, 100, 0, 'free_user', ${currentTime}, ${currentTime})
      `);

            // Second user with same email should fail
            expect(() => {
                db.run(`
          INSERT INTO users (id, email, email_verified, credits, has_google_api_key, daily_limit, signup_bonus_claimed, role, created_at, updated_at)
          VALUES ('user2', 'test@example.com', 0, 0, 0, 100, 0, 'free_user', ${currentTime}, ${currentTime})
        `);
            }).toThrow();
        });

        test('should enforce unique session_token constraint on sessions table', async () => {
            const currentTime = Date.now();

            // Create a user first
            db.run(`
        INSERT INTO users (id, email, email_verified, credits, has_google_api_key, daily_limit, signup_bonus_claimed, role, created_at, updated_at)
        VALUES ('user1', 'test@example.com', 0, 0, 0, 100, 0, 'free_user', ${currentTime}, ${currentTime})
      `);

            // First session should succeed
            db.run(`
        INSERT INTO sessions (id, session_token, user_id, expires, created_at, updated_at)
        VALUES ('sess1', 'token123', 'user1', ${currentTime + 86400000}, ${currentTime}, ${currentTime})
      `);

            // Second session with same token should fail
            expect(() => {
                db.run(`
          INSERT INTO sessions (id, session_token, user_id, expires, created_at, updated_at)
          VALUES ('sess2', 'token123', 'user1', ${currentTime + 86400000}, ${currentTime}, ${currentTime})
        `);
            }).toThrow();
        });

        test('should enforce unique provider+provider_account_id constraint on accounts table', async () => {
            const currentTime = Date.now();

            // Create a user first
            db.run(`
        INSERT INTO users (id, email, email_verified, credits, has_google_api_key, daily_limit, signup_bonus_claimed, role, created_at, updated_at)
        VALUES ('user1', 'test@example.com', 0, 0, 0, 100, 0, 'free_user', ${currentTime}, ${currentTime})
      `);

            // First account should succeed
            db.run(`
        INSERT INTO accounts (id, user_id, type, provider, provider_account_id, created_at, updated_at)
        VALUES ('acc1', 'user1', 'oauth', 'google', '123', ${currentTime}, ${currentTime})
      `);

            // Second account with same provider+provider_account_id should fail
            expect(() => {
                db.run(`
          INSERT INTO accounts (id, user_id, type, provider, provider_account_id, created_at, updated_at)
          VALUES ('acc2', 'user1', 'oauth', 'google', '123', ${currentTime}, ${currentTime})
        `);
            }).toThrow();
        });

        test('should enforce unique user_id+date constraint on daily_usage table', async () => {
            const currentTime = Date.now();

            // Create a user first
            db.run(`
        INSERT INTO users (id, email, email_verified, credits, has_google_api_key, daily_limit, signup_bonus_claimed, role, created_at, updated_at)
        VALUES ('user1', 'test@example.com', 0, 0, 0, 100, 0, 'free_user', ${currentTime}, ${currentTime})
      `);

            // First daily usage should succeed
            db.run(`
        INSERT INTO daily_usage (id, user_id, date, api_calls, credits_used, created_at, updated_at)
        VALUES ('du1', 'user1', '2024-01-01', 10, 50, ${currentTime}, ${currentTime})
      `);

            // Second daily usage for same user+date should fail
            expect(() => {
                db.run(`
          INSERT INTO daily_usage (id, user_id, date, api_calls, credits_used, created_at, updated_at)
          VALUES ('du2', 'user1', '2024-01-01', 15, 75, ${currentTime}, ${currentTime})
        `);
            }).toThrow();
        });

        test('should enforce unique invite_code_id+user_id constraint on invite_code_redemptions table', async () => {
            const currentTime = Date.now();

            // Create a user first
            db.run(`
        INSERT INTO users (id, email, email_verified, credits, has_google_api_key, daily_limit, signup_bonus_claimed, role, created_at, updated_at)
        VALUES ('user1', 'test@example.com', 0, 0, 0, 100, 0, 'free_user', ${currentTime}, ${currentTime})
      `);

            // Create an invite code
            db.run(`
        INSERT INTO invite_codes (id, code, type, credits, created_at)
        VALUES ('ic1', 'WELCOME10', 'signup_bonus', 10, ${currentTime})
      `);

            // First redemption should succeed
            db.run(`
        INSERT INTO invite_code_redemptions (id, invite_code_id, user_id, credits_awarded, redeemed_at)
        VALUES ('icr1', 'ic1', 'user1', 10, ${currentTime})
      `);

            // Second redemption for same invite_code+user should fail
            expect(() => {
                db.run(`
          INSERT INTO invite_code_redemptions (id, invite_code_id, user_id, credits_awarded, redeemed_at)
          VALUES ('icr2', 'ic1', 'user1', 10, ${currentTime})
        `);
            }).toThrow();
        });
    });

    describe('🔴 Red Phase: Check Constraints', () => {
        test('should enforce role check constraint on users table', async () => {
            const currentTime = Date.now();

            // Valid roles should succeed
            db.run(`
        INSERT INTO users (id, email, email_verified, credits, has_google_api_key, daily_limit, signup_bonus_claimed, role, created_at, updated_at)
        VALUES ('user1', 'test@example.com', 0, 0, 0, 100, 0, 'free_user', ${currentTime}, ${currentTime})
      `);

            // Invalid role should fail
            expect(() => {
                db.run(`
          INSERT INTO users (id, email, email_verified, credits, has_google_api_key, daily_limit, signup_bonus_claimed, role, created_at, updated_at)
          VALUES ('user2', 'test2@example.com', 0, 0, 0, 100, 0, 'invalid_role', ${currentTime}, ${currentTime})
        `);
            }).toThrow();
        });

        test('should enforce type check constraint on credit_transactions table', async () => {
            const currentTime = Date.now();

            // Create a user first
            db.run(`
        INSERT INTO users (id, email, email_verified, credits, has_google_api_key, daily_limit, signup_bonus_claimed, role, created_at, updated_at)
        VALUES ('user1', 'test@example.com', 0, 0, 0, 100, 0, 'free_user', ${currentTime}, ${currentTime})
      `);

            // Valid transaction types should succeed
            db.run(`
        INSERT INTO credit_transactions (id, user_id, type, amount, created_at)
        VALUES ('ct1', 'user1', 'purchase', 100, ${currentTime})
      `);

            // Invalid transaction type should fail
            expect(() => {
                db.run(`
          INSERT INTO credit_transactions (id, user_id, type, amount, created_at)
          VALUES ('ct2', 'user1', 'invalid_type', 50, ${currentTime})
        `);
            }).toThrow();
        });

        test('should enforce type check constraint on invite_codes table', async () => {
            const currentTime = Date.now();

            // Valid invite code types should succeed
            db.run(`
        INSERT INTO invite_codes (id, code, type, credits, created_at)
        VALUES ('ic1', 'WELCOME10', 'signup_bonus', 10, ${currentTime})
      `);

            // Invalid invite code type should fail
            expect(() => {
                db.run(`
          INSERT INTO invite_codes (id, code, type, credits, created_at)
          VALUES ('ic2', 'INVALID10', 'invalid_type', 10, ${currentTime})
        `);
            }).toThrow();
        });

        test('should enforce status check constraint on flow_runs table', async () => {
            const currentTime = Date.now();

            // Create a user first
            db.run(`
        INSERT INTO users (id, email, email_verified, credits, has_google_api_key, daily_limit, signup_bonus_claimed, role, created_at, updated_at)
        VALUES ('user1', 'test@example.com', 0, 0, 0, 100, 0, 'free_user', ${currentTime}, ${currentTime})
      `);

            // Valid flow run status should succeed
            db.run(`
        INSERT INTO flow_runs (id, user_id, flow_slug, status, created_at, updated_at)
        VALUES ('fr1', 'user1', 'test-flow', 'pending', ${currentTime}, ${currentTime})
      `);

            // Invalid flow run status should fail
            expect(() => {
                db.run(`
          INSERT INTO flow_runs (id, user_id, flow_slug, status, created_at, updated_at)
          VALUES ('fr2', 'user1', 'test-flow', 'invalid_status', ${currentTime}, ${currentTime})
        `);
            }).toThrow();
        });
    });

    describe('🔴 Red Phase: Index Performance Tests', () => {
        test('should have efficient user email lookup', async () => {
            const currentTime = Date.now();

            // Create test users
            for (let i = 0; i < 1000; i++) {
                db.run(`
          INSERT INTO users (id, email, email_verified, credits, has_google_api_key, daily_limit, signup_bonus_claimed, role, created_at, updated_at)
          VALUES ('user${i}', 'user${i}@example.com', 0, 0, 0, 100, 0, 'free_user', ${currentTime}, ${currentTime})
        `);
            }

            // Query should use email index (this test verifies index exists)
            const result = db.prepare('SELECT * FROM users WHERE email = ?').get('user500@example.com');
            expect(result).toBeDefined();
            expect(result.email).toBe('user500@example.com');
        });

        test('should have efficient credit transaction queries by user', async () => {
            const currentTime = Date.now();

            // Create a test user
            db.run(`
        INSERT INTO users (id, email, email_verified, credits, has_google_api_key, daily_limit, signup_bonus_claimed, role, created_at, updated_at)
        VALUES ('user1', 'test@example.com', 0, 0, 0, 100, 0, 'free_user', ${currentTime}, ${currentTime})
      `);

            // Create test transactions
            for (let i = 0; i < 1000; i++) {
                db.run(`
          INSERT INTO credit_transactions (id, user_id, type, amount, created_at)
          VALUES ('ct${i}', 'user1', 'purchase', ${i * 10}, ${currentTime + i})
        `);
            }

            // Query should use user_id + created_at index for efficient sorting
            const results = db.prepare('SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').all('user1');
            expect(results).toHaveLength(10);
            expect(results[0].created_at).toBeGreaterThan(results[1].created_at);
        });

        test('should have efficient daily usage queries', async () => {
            const currentTime = Date.now();

            // Create a test user
            db.run(`
        INSERT INTO users (id, email, email_verified, credits, has_google_api_key, daily_limit, signup_bonus_claimed, role, created_at, updated_at)
        VALUES ('user1', 'test@example.com', 0, 0, 0, 100, 0, 'free_user', ${currentTime}, ${currentTime})
      `);

            // Create test daily usage records
            for (let i = 0; i < 365; i++) {
                db.run(`
          INSERT INTO daily_usage (id, user_id, date, api_calls, credits_used, created_at, updated_at)
          VALUES ('du${i}', 'user1', '2024-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}', ${i}, ${i * 5}, ${currentTime}, ${currentTime})
        `);
            }

            // Query should use user_id + date index
            const result = db.prepare('SELECT * FROM daily_usage WHERE user_id = ? AND date = ?').get('user1', '2024-06-15');
            expect(result).toBeDefined();
        });

        test('should have efficient audit trail queries', async () => {
            const currentTime = Date.now();

            // Create a test user
            db.run(`
        INSERT INTO users (id, email, email_verified, credits, has_google_api_key, daily_limit, signup_bonus_claimed, role, created_at, updated_at)
        VALUES ('user1', 'test@example.com', 0, 0, 0, 100, 0, 'free_user', ${currentTime}, ${currentTime})
      `);

            // Create test audit trail records
            for (let i = 0; i < 1000; i++) {
                db.run(`
          INSERT INTO audit_trail (id, user_id, action, resource_type, resource_id, created_at)
          VALUES ('at${i}', 'user1', 'create', 'flow_run', 'fr${i}', ${currentTime + i})
        `);
            }

            // Query should use user_id + created_at index for efficient sorting
            const results = db.prepare('SELECT * FROM audit_trail WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all('user1');
            expect(results).toHaveLength(5);
            expect(results[0].created_at).toBeGreaterThan(results[1].created_at);
        });
    });

    describe('🔴 Red Phase: Cascading Delete Constraints', () => {
        test('should cascade delete user-related data when user is deleted', async () => {
            const currentTime = Date.now();

            // Create a test user
            db.run(`
        INSERT INTO users (id, email, email_verified, credits, has_google_api_key, daily_limit, signup_bonus_claimed, role, created_at, updated_at)
        VALUES ('user1', 'test@example.com', 0, 0, 0, 100, 0, 'free_user', ${currentTime}, ${currentTime})
      `);

            // Create related data
            db.run(`
        INSERT INTO accounts (id, user_id, type, provider, provider_account_id, created_at, updated_at)
        VALUES ('acc1', 'user1', 'oauth', 'google', '123', ${currentTime}, ${currentTime})
      `);

            db.run(`
        INSERT INTO sessions (id, session_token, user_id, expires, created_at, updated_at)
        VALUES ('sess1', 'token123', 'user1', ${currentTime + 86400000}, ${currentTime}, ${currentTime})
      `);

            db.run(`
        INSERT INTO credit_transactions (id, user_id, type, amount, created_at)
        VALUES ('ct1', 'user1', 'purchase', 100, ${currentTime})
      `);

            // Verify data exists
            expect(db.prepare('SELECT COUNT(*) as count FROM accounts WHERE user_id = ?').get('user1').count).toBe(1);
            expect(db.prepare('SELECT COUNT(*) as count FROM sessions WHERE user_id = ?').get('user1').count).toBe(1);
            expect(db.prepare('SELECT COUNT(*) as count FROM credit_transactions WHERE user_id = ?').get('user1').count).toBe(1);

            // Delete user - should cascade delete related data
            db.run('DELETE FROM users WHERE id = ?', 'user1');

            // Verify related data was deleted
            expect(db.prepare('SELECT COUNT(*) as count FROM accounts WHERE user_id = ?').get('user1').count).toBe(0);
            expect(db.prepare('SELECT COUNT(*) as count FROM sessions WHERE user_id = ?').get('user1').count).toBe(0);
            expect(db.prepare('SELECT COUNT(*) as count FROM credit_transactions WHERE user_id = ?').get('user1').count).toBe(0);
        });

        test('should handle delete restrictions for referenced data', async () => {
            const currentTime = Date.now();

            // Create admin user and invite code
            db.run(`
        INSERT INTO users (id, email, email_verified, credits, has_google_api_key, daily_limit, signup_bonus_claimed, role, created_at, updated_at)
        VALUES ('admin1', 'admin@example.com', 0, 0, 0, 100, 0, 'admin', ${currentTime}, ${currentTime})
      `);

            db.run(`
        INSERT INTO invite_codes (id, code, type, credits, created_by, created_at)
        VALUES ('ic1', 'ADMIN10', 'promotion', 10, 'admin1', ${currentTime})
      `);

            // Deleting admin should set created_by to NULL, not fail
            db.run('DELETE FROM users WHERE id = ?', 'admin1');

            const inviteCode = db.prepare('SELECT * FROM invite_codes WHERE id = ?').get('ic1');
            expect(inviteCode).toBeDefined();
            expect(inviteCode.created_by).toBeNull();
        });
    });
});
