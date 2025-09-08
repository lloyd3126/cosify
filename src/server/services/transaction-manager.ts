import { createHash } from 'crypto';

/**
 * 交易狀態枚舉
 */
export enum TransactionStatus {
    ACTIVE = 'active',
    COMMITTED = 'committed',
    ROLLED_BACK = 'rolled_back',
    FAILED = 'failed'
}

/**
 * 交易隔離級別枚舉
 */
export enum IsolationLevel {
    READ_UNCOMMITTED = 'read_uncommitted',
    READ_COMMITTED = 'read_committed',
    REPEATABLE_READ = 'repeatable_read',
    SERIALIZABLE = 'serializable'
}

/**
 * 交易選項接口
 */
export interface TransactionOptions {
    /** 隔離級別 */
    isolationLevel?: IsolationLevel;
    /** 是否為只讀交易 */
    readonly?: boolean;
    /** 超時時間（毫秒） */
    timeout?: number;
    /** 重試次數 */
    retryAttempts?: number;
    /** 保存點名稱（用於嵌套交易） */
    savepoint?: string;
}

/**
 * 交易統計接口
 */
export interface TransactionStats {
    /** 開始時間 */
    startTime?: number;
    /** 結束時間 */
    endTime?: number;
    /** 執行的查詢數量 */
    queriesExecuted: number;
    /** 持續時間（毫秒） */
    duration: number;
    /** 交易狀態 */
    status?: TransactionStatus;
    /** 死鎖重試次數 */
    deadlockRetries: number;
    /** 回滾原因 */
    rollbackReason?: string;
}

/**
 * 交易管理器選項接口
 */
export interface TransactionManagerOptions {
    /** 最大並發交易數 */
    maxConcurrentTransactions?: number;
    /** 默認隔離級別 */
    defaultIsolationLevel?: IsolationLevel;
    /** 默認超時時間 */
    defaultTimeout?: number;
}

/**
 * 交易接口 - 定義單個交易的所有操作
 */
export interface Transaction {
    /** 交易唯一標識符 */
    id: string;
    /** 當前交易狀態 */
    status: TransactionStatus;
    /** 交易隔離級別 */
    isolationLevel: IsolationLevel;
    /** 交易創建時間 */
    createdAt: Date;
    /** 提交交易 */
    commit(): Promise<void>;
    /** 回滾交易 */
    rollback(): Promise<void>;
    /** 執行查詢 */
    query<T>(sql: string, params?: any[]): Promise<T>;
    /** 檢查交易是否活躍 */
    isActive(): boolean;
    /** 獲取交易統計 */
    getStats(): TransactionStats;
    /** 增加死鎖重試計數（供 TransactionManager 使用） */
    incrementDeadlockRetries(): void;
}

/**
 * 交易管理器接口 - 定義交易管理的標準接口
 */
export interface TransactionManager {
    /** 開始新交易 */
    begin(isolationLevel?: IsolationLevel): Promise<Transaction>;
    /** 獲取當前活躍交易 */
    getCurrentTransaction(): Transaction | null;
    /** 在交易中執行回調函數 */
    withTransaction<T>(callback: (tx: Transaction) => Promise<T>, options?: TransactionOptions): Promise<T>;
}

/**
 * 交易實現類
 */
class TransactionImpl implements Transaction {
    public readonly id: string;
    public status: TransactionStatus = TransactionStatus.ACTIVE;
    public readonly isolationLevel: IsolationLevel;
    public readonly createdAt: Date = new Date();
    private readonly startTime: number = Date.now();

    private stats: TransactionStats = {
        queriesExecuted: 0,
        duration: 0,
        deadlockRetries: 0
    };

    private timeoutHandle?: NodeJS.Timeout;

    constructor(
        id: string,
        private database: any,
        isolationLevel: IsolationLevel = IsolationLevel.READ_COMMITTED,
        private readonly: boolean = false,
        private timeout?: number
    ) {
        this.id = id;
        this.isolationLevel = isolationLevel;

        // 設置超時定時器
        if (timeout && timeout > 0) {
            this.timeoutHandle = setTimeout(() => {
                this.handleTimeout();
            }, timeout);
        }
    }

    /**
     * 提交交易
     */
    async commit(): Promise<void> {
        if (!this.isActive()) {
            throw new Error(`Cannot commit transaction ${this.id}: transaction is not active`);
        }

        try {
            await this.database.commit();
            this.status = TransactionStatus.COMMITTED;
            this.updateDuration();
        } catch (error) {
            this.status = TransactionStatus.FAILED;
            this.clearTimeout();
            throw error;
        }
    }

    /**
     * 回滾交易
     */
    async rollback(): Promise<void> {
        if (!this.isActive()) {
            throw new Error(`Cannot rollback transaction ${this.id}: transaction is not active`);
        }

        try {
            await this.database.rollback();
            this.status = TransactionStatus.ROLLED_BACK;
            this.stats.rollbackReason = 'Manual rollback';
            this.updateDuration();
        } catch (error) {
            this.status = TransactionStatus.FAILED;
            this.clearTimeout();
            throw error;
        }
    }

    /**
     * 執行查詢
     */
    async query<T>(sql: string, params?: any[]): Promise<T> {
        if (!this.isActive()) {
            throw new Error(`Cannot execute query in transaction ${this.id}: transaction is not active`);
        }

        try {
            this.stats.queriesExecuted++;
            return await this.database.query(sql, params);
        } catch (error) {
            // 檢查是否為死鎖錯誤
            if (this.isDeadlockError(error)) {
                this.stats.deadlockRetries++;
                throw error;
            }
            throw error;
        }
    }

    /**
     * 檢查交易是否活躍
     */
    isActive(): boolean {
        return this.status === TransactionStatus.ACTIVE;
    }

    /**
     * 獲取交易統計
     */
    getStats(): TransactionStats {
        const currentStats = { ...this.stats };
        // 總是計算當前持續時間
        currentStats.duration = Date.now() - this.startTime;
        return currentStats;
    }

    /**
     * 增加死鎖重試計數（供 TransactionManager 使用）
     */
    incrementDeadlockRetries(): void {
        this.stats.deadlockRetries++;
    }

    /**
     * 處理超時
     */
    private async handleTimeout(): Promise<void> {
        if (this.isActive()) {
            this.status = TransactionStatus.ROLLED_BACK;
            this.stats.rollbackReason = 'Transaction timeout';
            try {
                await this.database.rollback();
            } catch (error) {
                this.status = TransactionStatus.FAILED;
            }
        }
    }

    /**
     * 清除超時定時器
     */
    private clearTimeout(): void {
        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle);
            this.timeoutHandle = undefined;
        }
    }

    /**
     * 更新持續時間
     */
    private updateDuration(): void {
        this.stats.duration = Date.now() - this.startTime;
        this.clearTimeout();
    }

    /**
     * 檢查是否為死鎖錯誤
     */
    private isDeadlockError(error: any): boolean {
        return !!(error && (
            error.name === 'DeadlockError' ||
            error.code === 'ER_LOCK_DEADLOCK' ||
            (error.message && error.message.includes('deadlock'))
        ));
    }
}

/**
 * 交易管理器實現類
 * 
 * 提供企業級數據庫交易管理功能，包括：
 * - 交易生命週期管理 (begin/commit/rollback)
 * - 自動錯誤處理和回滾
 * - 嵌套交易支持（使用保存點）
 * - 交易隔離級別控制
 * - 死鎖檢測和自動重試機制
 * - 並發交易處理和池管理
 * - 交易超時管理
 * - 統計和監控功能
 */
export class TransactionManagerImpl implements TransactionManager {
    private currentTransaction: Transaction | null = null;
    private activeTransactions: Map<string, Transaction> = new Map();
    private statistics: Map<string, TransactionStats> = new Map();
    private readonly maxPoolSize: number;
    private readonly defaultIsolationLevel: IsolationLevel;
    private readonly defaultTimeout: number;
    private readonly waitingQueue: Array<() => void> = [];
    private availableSlots: number; // 添加可用槽位計數器

    constructor(
        private db: any,
        options: TransactionManagerOptions = {}
    ) {
        this.maxPoolSize = options.maxConcurrentTransactions || 10;
        this.availableSlots = this.maxPoolSize; // 初始化可用槽位
        this.defaultIsolationLevel = options.defaultIsolationLevel || IsolationLevel.READ_COMMITTED;
        this.defaultTimeout = options.defaultTimeout || 30000; // 30 秒
    }

    /**
     * 生成交易 ID
     */
    private generateTransactionId(): string {
        return `tx_${createHash('md5').update(`${Date.now()}_${Math.random()}`).digest('hex').substring(0, 12)}`;
    }

    /**
     * 開始新交易
     */
    async beginTransaction(options: TransactionOptions = {}): Promise<Transaction> {
        // 直接創建交易，不再在這裡做池管理（池管理移到 withTransaction）
        return this.createTransaction(options);
    }

    /**
     * 獲取交易槽位
     */
    private async acquireSlot(): Promise<void> {
        if (this.availableSlots > 0) {
            this.availableSlots--; // 減少可用槽位
            return; // 立即獲得槽位
        }

        // 等待槽位可用
        return new Promise<void>((resolve) => {
            this.waitingQueue.push(resolve);
        });
    }

    /**
     * 釋放交易槽位
     */
    private releaseSlot(): void {
        this.availableSlots++; // 增加可用槽位

        if (this.waitingQueue.length > 0 && this.availableSlots > 0) {
            const nextWaiter = this.waitingQueue.shift();
            if (nextWaiter) {
                this.availableSlots--; // 為下一個等待者預留槽位
                nextWaiter(); // 喚醒下一個等待者
            }
        }
    }    /**
     * 創建實際的交易實例
     */
    private async createTransaction(options: TransactionOptions): Promise<Transaction> {
        // 防禦性檢查：確保不會超過池大小
        if (this.activeTransactions.size >= this.maxPoolSize) {
            throw new Error('Transaction pool is full');
        }

        const id = this.generateTransactionId();
        const isolationLevel = options.isolationLevel || this.defaultIsolationLevel;
        const readonly = options.readonly || false;

        try {
            await this.db.begin({
                isolationLevel,
                readonly
            });

            const transaction = new TransactionImpl(
                id,
                this.db,
                isolationLevel,
                readonly,
                options.timeout
            );

            // 創建一個包裝器來追蹤統計和清理
            const wrappedTransaction = this.wrapTransactionWithCleanup(transaction);

            this.activeTransactions.set(id, wrappedTransaction);
            this.currentTransaction = wrappedTransaction;

            // 記錄統計
            this.statistics.set(id, {
                startTime: Date.now(),
                endTime: 0,
                queriesExecuted: 0,
                duration: 0,
                status: TransactionStatus.ACTIVE,
                deadlockRetries: 0,
                rollbackReason: undefined
            });

            return wrappedTransaction;
        } catch (error) {
            throw new Error(`Failed to begin transaction: ${(error as Error).message}`);
        }
    }

    /**
     * 包裝交易以添加清理邏輯
     */
    private wrapTransactionWithCleanup(transaction: Transaction): Transaction {
        const originalCommit = transaction.commit.bind(transaction);
        const originalRollback = transaction.rollback.bind(transaction);
        const originalQuery = transaction.query.bind(transaction);

        // 創建一個代理對象，保持所有原始屬性但添加清理邏輯
        const wrapper = {
            ...transaction,
            commit: async () => {
                await originalCommit();
                this.cleanupTransaction(transaction.id);
            },
            rollback: async () => {
                await originalRollback();
                this.cleanupTransaction(transaction.id);
            },
            query: async (sql: string, params?: any[]) => {
                const result = await originalQuery(sql, params);
                // 更新管理器統計
                const stats = this.statistics.get(transaction.id);
                if (stats) {
                    stats.queriesExecuted = transaction.getStats().queriesExecuted;
                }
                return result;
            },
            // 確保 status 等屬性通過 getter 訪問原始對象
            get status() { return transaction.status; },
            get id() { return transaction.id; },
            get isolationLevel() { return transaction.isolationLevel; },
            get createdAt() { return transaction.createdAt; },
            isActive: () => transaction.isActive(),
            getStats: () => transaction.getStats(),
            incrementDeadlockRetries: () => transaction.incrementDeadlockRetries()
        };

        return wrapper as Transaction;
    }

    /**
     * 清理交易
     */
    private cleanupTransaction(transactionId: string): void {
        this.activeTransactions.delete(transactionId);
        if (this.currentTransaction?.id === transactionId) {
            this.currentTransaction = null;
        }

        const stats = this.statistics.get(transactionId);
        if (stats) {
            stats.endTime = Date.now();
            stats.duration = stats.endTime - (stats.startTime || 0);
        }
    }    /**
     * 開始新交易（別名）
     */
    async begin(isolationLevel?: IsolationLevel): Promise<Transaction> {
        return this.beginTransaction({ isolationLevel });
    }

    /**
     * 獲取當前活躍交易
     */
    getCurrentTransaction(): Transaction | null {
        return this.currentTransaction;
    }

    /**
     * 在交易中執行回調函數
     */
    async withTransaction<T>(
        callback: (tx: Transaction) => Promise<T>,
        options: TransactionOptions = {}
    ): Promise<T> {
        // 獲取槽位（信號量控制在 withTransaction 級別）
        await this.acquireSlot();

        try {
            const maxRetries = options.retryAttempts || 3;
            let lastError: Error;
            let totalDeadlockRetries = 0; // 追蹤總死鎖重試次數

            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                const transaction = await this.beginTransaction(options);

                try {
                    // 如果不是第一次嘗試，將累積的死鎖重試次數設置到當前交易
                    if (totalDeadlockRetries > 0) {
                        // 設置累積的死鎖重試統計到當前交易
                        for (let i = 0; i < totalDeadlockRetries; i++) {
                            transaction.incrementDeadlockRetries();
                        }
                    }

                    // 如果設置了超時，為 withTransaction 設置一個獨立的超時檢查
                    if (options.timeout) {
                        const timeoutPromise = new Promise<never>((_, reject) => {
                            setTimeout(() => reject(new Error('Transaction timeout')), options.timeout);
                        });

                        const result = await Promise.race([
                            callback(transaction),
                            timeoutPromise
                        ]);

                        await transaction.commit();
                        return result;
                    } else {
                        const result = await callback(transaction);
                        await transaction.commit();
                        return result;
                    }
                } catch (error) {
                    lastError = error as Error;

                    try {
                        await transaction.rollback();
                    } catch (rollbackError) {
                        // 忽略回滾錯誤
                    }

                    // 檢查是否為死鎖錯誤且應該重試
                    if (this.isDeadlockError(lastError) && attempt < maxRetries) {
                        totalDeadlockRetries++; // 增加總死鎖重試計數
                        // 更新統計將由 rollback 的包裝器處理

                        await this.delay(100 * Math.pow(2, attempt)); // 指數退避
                        continue;
                    }

                    break; // 不是死鎖錯誤或達到最大重試次數
                }
            }

            throw lastError!;
        } finally {
            // 確保在任何情況下都釋放槽位
            this.releaseSlot();
        }
    }

    /**
     * 獲取交易統計
     */
    getTransactionStats(transactionId: string): TransactionStats | null {
        return this.statistics.get(transactionId) || null;
    }

    /**
     * 獲取所有活躍交易
     */
    getActiveTransactions(): Transaction[] {
        return Array.from(this.activeTransactions.values());
    }

    /**
     * 獲取交易池大小
     */
    getPoolSize(): number {
        return this.activeTransactions.size;
    }

    /**
     * 獲取可用槽位數（用於調試）
     */
    getAvailableSlots(): number {
        return this.availableSlots;
    }

    /**
     * 檢查是否為死鎖錯誤
     */
    private isDeadlockError(error: Error): boolean {
        return !!(error && (
            error.name === 'DeadlockError' ||
            (error as any).code === 'ER_LOCK_DEADLOCK' ||
            (error.message && error.message.includes('deadlock'))
        ));
    }

    /**
     * 延遲函數
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 導出默認實例創建函數
export function createTransactionManager(database: any, options?: TransactionManagerOptions): TransactionManager {
    return new TransactionManagerImpl(database, options);
}
