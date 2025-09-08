/**
 * Phase 2.8: 資料庫交易管理 - TDD 測試套件
 * 
 * 🔴 Red Phase: 定義交易管理規格和期望行為
 * 
 * 測試範圍：
 * - 基            it('should create new transaction with unique ID', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });

                const transaction = await transactionManager.begin();

                expect(transaction.id).toBeDefined();
                expect(transaction.id).toMatch(/^tx_[a-f0-9]{12}$/);
                expect(transaction.status).toBe(TransactionStatus.ACTIVE);
                expect(mockDatabase.begin).toHaveBeenCalled();
            }); commit, rollback)
 * - 交易失敗自動回滾
 * - 嵌套交易處理
 * - 交易隔離級別
 * - 並發交易處理
 * - 死鎖檢測和處理
 * - 交易超時管理
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// 交易管理器接口定義
interface createTransactionManager {
    begin(isolationLevel?: IsolationLevel): Promise<Transaction>;
    getCurrentTransaction(): Transaction | null;
    withTransaction<T>(callback: (tx: Transaction) => Promise<T>, options?: TransactionOptions): Promise<T>;
}

// 交易接口定義
interface Transaction {
    id: string;
    status: TransactionStatus;
    isolationLevel: IsolationLevel;
    createdAt: Date;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    query<T>(sql: string, params?: any[]): Promise<T>;
    isActive(): boolean;
    getStats(): TransactionStats;
}

// 交易選項
interface TransactionOptions {
    isolationLevel?: IsolationLevel;
    timeout?: number;
    retryAttempts?: number;
    readonly?: boolean;
}

// 交易統計
interface TransactionStats {
    queriesExecuted: number;
    duration: number;
    rollbackReason?: string;
    deadlockRetries: number;
}

// 交易狀態
enum TransactionStatus {
    ACTIVE = 'active',
    COMMITTED = 'committed',
    ROLLED_BACK = 'rolled_back',
    FAILED = 'failed'
}

// 隔離級別
enum IsolationLevel {
    READ_UNCOMMITTED = 'read_uncommitted',
    READ_COMMITTED = 'read_committed',
    REPEATABLE_READ = 'repeatable_read',
    SERIALIZABLE = 'serializable'
}

describe('Database Transaction Management System', () => {
    let transactionManager: createTransactionManager;
    let mockDatabase: any;

    beforeEach(() => {
        // Mock 資料庫客戶端
        mockDatabase = {
            query: jest.fn(),
            begin: jest.fn(),
            commit: jest.fn(),
            rollback: jest.fn(),
            release: jest.fn(),
            on: jest.fn()
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('🔴 Red Phase: 基本交易管理', () => {
        describe('交易生命週期', () => {
            it('should create new transaction with unique ID', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });

                const transaction = await transactionManager.begin();

                expect(transaction.id).toBeDefined();
                expect(transaction.id).toMatch(/^tx_[a-f0-9]{12}$/);
                expect(transaction.status).toBe(TransactionStatus.ACTIVE);
                expect(mockDatabase.begin).toHaveBeenCalled();
            });

            it('should commit transaction successfully', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });
                mockDatabase.commit.mockResolvedValue(undefined);

                const transaction = await transactionManager.begin();
                await transaction.commit();

                expect(transaction.status).toBe(TransactionStatus.COMMITTED);
                expect(transaction.isActive()).toBe(false);
                expect(mockDatabase.commit).toHaveBeenCalled();
            });

            it('should rollback transaction on failure', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });
                mockDatabase.rollback.mockResolvedValue(undefined);

                const transaction = await transactionManager.begin();
                await transaction.rollback();

                expect(transaction.status).toBe(TransactionStatus.ROLLED_BACK);
                expect(transaction.isActive()).toBe(false);
                expect(mockDatabase.rollback).toHaveBeenCalled();
            });

            it('should track current active transaction', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });

                expect(transactionManager.getCurrentTransaction()).toBeNull();

                const transaction = await transactionManager.begin();
                expect(transactionManager.getCurrentTransaction()).toBe(transaction);

                await transaction.commit();
                expect(transactionManager.getCurrentTransaction()).toBeNull();
            });
        });

        describe('交易選項和配置', () => {
            it('should support different isolation levels', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });

                const transaction = await transactionManager.begin(IsolationLevel.SERIALIZABLE);

                expect(transaction.isolationLevel).toBe(IsolationLevel.SERIALIZABLE);
                expect(mockDatabase.begin).toHaveBeenCalledWith(
                    expect.objectContaining({
                        isolationLevel: IsolationLevel.SERIALIZABLE
                    })
                );
            });

            it('should use default isolation level when not specified', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });

                const transaction = await transactionManager.begin();

                expect(transaction.isolationLevel).toBe(IsolationLevel.READ_COMMITTED);
            });

            it('should handle readonly transactions', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });

                const result = await transactionManager.withTransaction(
                    async (tx) => {
                        return await tx.query('SELECT * FROM users WHERE id = ?', [1]);
                    },
                    { readonly: true }
                );

                expect(mockDatabase.begin).toHaveBeenCalledWith(
                    expect.objectContaining({
                        readonly: true
                    })
                );
            });
        });
    });

    describe('🔴 Red Phase: 高級交易功能', () => {
        describe('withTransaction 包裝器', () => {
            it('should automatically commit successful operations', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });
                mockDatabase.commit.mockResolvedValue(undefined);

                const testData = { id: 1, name: 'Test User' };
                mockDatabase.query.mockResolvedValue(testData);

                const result = await transactionManager.withTransaction(async (tx) => {
                    return await tx.query('INSERT INTO users (name) VALUES (?)', ['Test User']);
                });

                expect(result).toEqual(testData);
                expect(mockDatabase.commit).toHaveBeenCalled();
                expect(mockDatabase.rollback).not.toHaveBeenCalled();
            });

            it('should automatically rollback on operation failure', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });
                mockDatabase.rollback.mockResolvedValue(undefined);

                const testError = new Error('Database operation failed');
                mockDatabase.query.mockRejectedValue(testError);

                await expect(
                    transactionManager.withTransaction(async (tx) => {
                        return await tx.query('INSERT INTO users (name) VALUES (?)', ['Test User']);
                    })
                ).rejects.toThrow('Database operation failed');

                expect(mockDatabase.rollback).toHaveBeenCalled();
                expect(mockDatabase.commit).not.toHaveBeenCalled();
            });

            it('should handle nested transactions properly', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });
                mockDatabase.commit.mockResolvedValue(undefined);

                let outerTransaction: Transaction;
                let innerTransaction: Transaction;

                const result = await transactionManager.withTransaction(async (tx1) => {
                    outerTransaction = tx1;

                    return await transactionManager.withTransaction(async (tx2) => {
                        innerTransaction = tx2;
                        return 'nested_result';
                    });
                });

                expect(result).toBe('nested_result');
                expect(outerTransaction).toBeDefined();
                expect(innerTransaction).toBeDefined();
                // 嵌套交易應該共享同一個交易或使用保存點
                expect(mockDatabase.begin).toHaveBeenCalled();
            });

            it('should rollback outer transaction when inner transaction fails', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });
                mockDatabase.rollback.mockResolvedValue(undefined);

                const innerError = new Error('Inner transaction failed');

                await expect(
                    transactionManager.withTransaction(async (tx1) => {
                        await tx1.query('INSERT INTO users (name) VALUES (?)', ['User 1']);

                        return await transactionManager.withTransaction(async (tx2) => {
                            throw innerError;
                        });
                    })
                ).rejects.toThrow('Inner transaction failed');

                expect(mockDatabase.rollback).toHaveBeenCalled();
            });
        });

        describe('交易統計和監控', () => {
            it('should track transaction statistics', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });
                mockDatabase.query.mockResolvedValue({ affectedRows: 1 });

                const transaction = await transactionManager.begin();
                await new Promise(resolve => setTimeout(resolve, 1)); // 小延遲確保 duration > 0
                await transaction.query('INSERT INTO users (name) VALUES (?)', ['User 1']);
                await transaction.query('UPDATE users SET name = ? WHERE id = ?', ['Updated User', 1]);

                const stats = transaction.getStats();

                expect(stats.queriesExecuted).toBe(2);
                expect(stats.duration).toBeGreaterThan(0);
                expect(stats.deadlockRetries).toBe(0);
            });

            it('should record rollback reason in statistics', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });
                mockDatabase.rollback.mockResolvedValue(undefined);

                const transaction = await transactionManager.begin();
                await transaction.rollback();

                const stats = transaction.getStats();

                expect(stats.rollbackReason).toBeDefined();
                expect(transaction.status).toBe(TransactionStatus.ROLLED_BACK);
            });
        });
    });

    describe('🔴 Red Phase: 錯誤處理和恢復', () => {
        describe('死鎖處理', () => {
            it('should detect and retry on deadlock', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });

                const deadlockError = new Error('Deadlock detected');
                deadlockError.name = 'DeadlockError';

                mockDatabase.query
                    .mockRejectedValueOnce(deadlockError)
                    .mockResolvedValueOnce({ affectedRows: 1 });

                const result = await transactionManager.withTransaction(
                    async (tx) => {
                        return await tx.query('UPDATE users SET balance = balance - 100 WHERE id = ?', [1]);
                    },
                    { retryAttempts: 3 }
                );

                expect(result).toEqual({ affectedRows: 1 });
                expect(mockDatabase.query).toHaveBeenCalledTimes(2);
            });

            it('should fail after maximum retry attempts', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });
                mockDatabase.rollback.mockResolvedValue(undefined);

                const deadlockError = new Error('Deadlock detected');
                deadlockError.name = 'DeadlockError';

                mockDatabase.query.mockRejectedValue(deadlockError);

                await expect(
                    transactionManager.withTransaction(
                        async (tx) => {
                            return await tx.query('UPDATE users SET balance = balance - 100 WHERE id = ?', [1]);
                        },
                        { retryAttempts: 2 }
                    )
                ).rejects.toThrow('Deadlock detected');

                expect(mockDatabase.query).toHaveBeenCalledTimes(3); // 初始 + 2 次重試
                expect(mockDatabase.rollback).toHaveBeenCalled();
            });

            it('should track deadlock retry attempts in statistics', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });

                const deadlockError = new Error('Deadlock detected');
                deadlockError.name = 'DeadlockError';

                mockDatabase.query
                    .mockRejectedValueOnce(deadlockError)
                    .mockResolvedValueOnce({ affectedRows: 1 });

                let transactionStats: TransactionStats;

                await transactionManager.withTransaction(async (tx) => {
                    const result = await tx.query('UPDATE users SET balance = balance - 100 WHERE id = ?', [1]);
                    transactionStats = tx.getStats();
                    return result;
                });

                expect(transactionStats!.deadlockRetries).toBe(1);
            });
        });

        describe('交易超時處理', () => {
            it('should timeout long-running transactions', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });
                mockDatabase.rollback.mockResolvedValue(undefined);

                await expect(
                    transactionManager.withTransaction(
                        async (tx) => {
                            // 模擬長時間運行的操作
                            await new Promise(resolve => setTimeout(resolve, 200));
                            return await tx.query('SELECT * FROM users');
                        },
                        { timeout: 100 }
                    )
                ).rejects.toThrow(/Transaction timeout/);

                expect(mockDatabase.rollback).toHaveBeenCalled();
            });

            it('should not timeout fast transactions', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });
                mockDatabase.commit.mockResolvedValue(undefined);
                mockDatabase.query.mockResolvedValue([{ id: 1, name: 'User' }]);

                const result = await transactionManager.withTransaction(
                    async (tx) => {
                        return await tx.query('SELECT * FROM users');
                    },
                    { timeout: 1000 }
                );

                expect(result).toEqual([{ id: 1, name: 'User' }]);
                expect(mockDatabase.commit).toHaveBeenCalled();
                expect(mockDatabase.rollback).not.toHaveBeenCalled();
            });
        });

        describe('連接錯誤處理', () => {
            it('should handle database connection failures', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);

                const connectionError = new Error('Connection lost');
                connectionError.name = 'ConnectionError';
                mockDatabase.begin.mockRejectedValue(connectionError);

                await expect(
                    transactionManager.withTransaction(async (tx) => {
                        return await tx.query('SELECT * FROM users');
                    })
                ).rejects.toThrow('Connection lost');
            });

            it('should cleanup resources on connection failure', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });

                const connectionError = new Error('Connection lost during query');
                connectionError.name = 'ConnectionError';
                mockDatabase.query.mockRejectedValue(connectionError);
                mockDatabase.rollback.mockResolvedValue(undefined);

                await expect(
                    transactionManager.withTransaction(async (tx) => {
                        return await tx.query('SELECT * FROM users');
                    })
                ).rejects.toThrow('Connection lost during query');

                expect(mockDatabase.rollback).toHaveBeenCalled();
            });
        });
    });

    describe('🔴 Red Phase: 並發交易處理', () => {
        describe('並發交易隔離', () => {
            it('should handle concurrent transactions independently', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });
                mockDatabase.commit.mockResolvedValue(undefined);
                mockDatabase.query.mockResolvedValue({ affectedRows: 1 });

                const promises = [
                    transactionManager.withTransaction(async (tx) => {
                        return await tx.query('UPDATE users SET balance = balance - 100 WHERE id = ?', [1]);
                    }),
                    transactionManager.withTransaction(async (tx) => {
                        return await tx.query('UPDATE users SET balance = balance + 50 WHERE id = ?', [2]);
                    }),
                    transactionManager.withTransaction(async (tx) => {
                        return await tx.query('INSERT INTO transactions (amount) VALUES (?)', [75]);
                    })
                ];

                const results = await Promise.all(promises);

                expect(results).toHaveLength(3);
                results.forEach(result => {
                    expect(result).toEqual({ affectedRows: 1 });
                });
                expect(mockDatabase.commit).toHaveBeenCalledTimes(3);
            });

            it('should handle partial failures in concurrent transactions', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });
                mockDatabase.commit.mockResolvedValue(undefined);
                mockDatabase.rollback.mockResolvedValue(undefined);

                let queryCallCount = 0;
                mockDatabase.query.mockImplementation(() => {
                    queryCallCount++;
                    if (queryCallCount === 2) {
                        throw new Error('Second transaction failed');
                    }
                    return Promise.resolve({ affectedRows: 1 });
                });

                const promises = [
                    transactionManager.withTransaction(async (tx) => {
                        return await tx.query('UPDATE users SET balance = balance - 100 WHERE id = ?', [1]);
                    }),
                    transactionManager.withTransaction(async (tx) => {
                        return await tx.query('UPDATE users SET balance = balance + 50 WHERE id = ?', [2]);
                    }),
                    transactionManager.withTransaction(async (tx) => {
                        return await tx.query('INSERT INTO transactions (amount) VALUES (?)', [75]);
                    })
                ];

                const results = await Promise.allSettled(promises);

                expect(results[0].status).toBe('fulfilled');
                expect(results[1].status).toBe('rejected');
                expect(results[2].status).toBe('fulfilled');

                expect(mockDatabase.commit).toHaveBeenCalledTimes(2);
                expect(mockDatabase.rollback).toHaveBeenCalledTimes(1);
            });
        });

        describe('交易池管理', () => {
            it('should manage transaction pool size', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase, { maxConcurrentTransactions: 2 });
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });

                let activeTransactions = 0;
                let maxConcurrentSeen = 0;

                mockDatabase.query.mockImplementation(async () => {
                    activeTransactions++;
                    maxConcurrentSeen = Math.max(maxConcurrentSeen, activeTransactions);
                    await new Promise(resolve => setTimeout(resolve, 50));
                    activeTransactions--;
                    return { affectedRows: 1 };
                });

                const promises = Array.from({ length: 5 }, (_, i) =>
                    transactionManager.withTransaction(async (tx) => {
                        return await tx.query(`SELECT * FROM users WHERE id = ${i + 1}`);
                    })
                );

                await Promise.all(promises);

                expect(maxConcurrentSeen).toBeLessThanOrEqual(2);
            });

            it('should queue transactions when pool is full', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase, { maxConcurrentTransactions: 1 });
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });
                mockDatabase.commit.mockResolvedValue(undefined);

                const executionOrder: number[] = [];

                mockDatabase.query.mockImplementation(async (sql: string) => {
                    const id = parseInt(sql.match(/id = (\d+)/)?.[1] || '0');
                    executionOrder.push(id);
                    await new Promise(resolve => setTimeout(resolve, 20));
                    return { affectedRows: 1 };
                });

                const promises = [1, 2, 3].map(id =>
                    transactionManager.withTransaction(async (tx) => {
                        return await tx.query(`UPDATE users SET name = 'Updated' WHERE id = ${id}`);
                    })
                );

                await Promise.all(promises);

                expect(executionOrder).toEqual([1, 2, 3]); // 序列執行，不是並發
            });
        });
    });

    describe('🔴 Red Phase: 效能基準測試', () => {
        describe('交易效能', () => {
            it('should meet performance benchmarks for simple transactions', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });
                mockDatabase.commit.mockResolvedValue(undefined);
                mockDatabase.query.mockResolvedValue({ affectedRows: 1 });

                const startTime = Date.now();

                await transactionManager.withTransaction(async (tx) => {
                    return await tx.query('INSERT INTO users (name) VALUES (?)', ['Test User']);
                });

                const duration = Date.now() - startTime;

                expect(duration).toBeLessThan(50); // 簡單交易應在 50ms 內完成
            });

            it('should handle high throughput concurrent transactions', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });
                mockDatabase.commit.mockResolvedValue(undefined);
                mockDatabase.query.mockResolvedValue({ affectedRows: 1 });

                const startTime = Date.now();
                const concurrentTransactions = 100;

                const promises = Array.from({ length: concurrentTransactions }, (_, i) =>
                    transactionManager.withTransaction(async (tx) => {
                        return await tx.query('INSERT INTO users (name) VALUES (?)', [`User ${i}`]);
                    })
                );

                await Promise.all(promises);

                const duration = Date.now() - startTime;
                const throughput = concurrentTransactions / (duration / 1000);

                expect(throughput).toBeGreaterThan(50); // 至少 50 TPS
            });

            it('should maintain performance under stress conditions', async () => {
                const { createTransactionManager } = await import('../../src/server/services/transaction-manager');

                transactionManager = createTransactionManager(mockDatabase);
                mockDatabase.begin.mockResolvedValue({ transactionId: 'tx_123' });
                mockDatabase.commit.mockResolvedValue(undefined);

                let queryCount = 0;
                mockDatabase.query.mockImplementation(async () => {
                    queryCount++;
                    // 模擬資料庫延遲
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
                    return { affectedRows: 1 };
                });

                const stressTestPromises = Array.from({ length: 50 }, (_, i) =>
                    transactionManager.withTransaction(async (tx) => {
                        // 每個交易執行多個操作
                        await tx.query('INSERT INTO users (name) VALUES (?)', [`User ${i}`]);
                        await tx.query('UPDATE users SET active = true WHERE name = ?', [`User ${i}`]);
                        await tx.query('INSERT INTO user_logs (user_name, action) VALUES (?, ?)', [`User ${i}`, 'created']);
                        return i;
                    })
                );

                const results = await Promise.all(stressTestPromises);

                expect(results).toHaveLength(50);
                expect(queryCount).toBe(150); // 50 * 3 操作
                expect(mockDatabase.commit).toHaveBeenCalledTimes(50);
                expect(mockDatabase.rollback).not.toHaveBeenCalled();
            });
        });
    });
});
