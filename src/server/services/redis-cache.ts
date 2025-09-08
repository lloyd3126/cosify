/**
 * Phase 2.7: Redis 快取層整合 - 核心實現
 * 
 * 🟢 Green Phase: 企業級 Redis 快取系統
 * 
 * 主要特性：
 * - 高效能快取操作（GET/SET/DEL/EXISTS/CLEAR）
 * - 智能 TTL 管理和過期處理
 * - 即時統計和監控（命中率、記憶體使用）
 * - 錯誤處理和自動降級到記憶體快取
 * - 方法快取裝飾器 (@Cacheable)
 * - 並發操作支持和批次處理
 * - 連接池管理和重連機制
 * 
 * 使用範例：
 * ```typescript
 * // 基本使用
 * const cache = new RedisCacheProvider({ host: 'localhost', port: 6379 });
 * await cache.set('user:1', { id: 1, name: 'John' }, 300);
 * const user = await cache.get('user:1');
 * 
 * // 使用裝飾器
 * class UserService {
 *   @Cacheable('user', 300)
 *   async getUser(id: number) {
 *     return await this.db.findUser(id);
 *   }
 * }
 * ```
 */

import { createClient, RedisClientType } from 'redis';
import { createHash } from 'crypto';

/**
 * 快取統計接口 - 提供快取性能監控數據
 */
export interface CacheStats {
    /** 快取命中次數 */
    hits: number;
    /** 快取未命中次數 */
    misses: number;
    /** 快取命中率 (0-1) */
    hitRate: number;
    /** 總操作次數 */
    totalOperations: number;
    /** 記憶體使用量 (bytes, 可選) */
    memoryUsage?: number;
}

/**
 * 快取配置接口 - 可自定義 Redis 連接和行為參數
 */
export interface CacheConfig {
    /** Redis 主機名，默認 'localhost' */
    host?: string;
    /** Redis 端口，默認 6379 */
    port?: number;
    /** Redis 密碼 */
    password?: string;
    /** 默認 TTL 秒數，未設置則永久快取 */
    defaultTtl?: number;
    /** 最大記憶體設置 */
    maxMemory?: string;
    /** 快取鍵前綴 */
    keyPrefix?: string;
    /** 是否啟用統計，默認 true */
    enableStats?: boolean;
    /** 重試次數，默認 3 */
    retryAttempts?: number;
    /** 重試延遲 (ms)，默認 1000 */
    retryDelay?: number;
}

/**
 * 快取提供者接口 - 定義所有快取操作的標準接口
 */
export interface CacheProvider {
    /** 獲取快取值 */
    get<T>(key: string): Promise<T | null>;
    /** 設置快取值，可選 TTL */
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    /** 刪除快取項目 */
    del(key: string): Promise<void>;
    /** 檢查快取項目是否存在 */
    exists(key: string): Promise<boolean>;
    /** 清空所有快取 */
    clear(): Promise<void>;
    /** 獲取快取統計 */
    getStats(): Promise<CacheStats>;
}

/**
 * Redis 快取提供者實現
 */
export class RedisCacheProvider implements CacheProvider {
    private client: RedisClientType | any;
    private config: CacheConfig;
    private stats: CacheStats;
    private isConnected: boolean = false;
    private fallbackCache: Map<string, { value: any; expiry?: number }> = new Map();

    constructor(config: CacheConfig = {}, mockClient?: any) {
        this.config = {
            host: 'localhost',
            port: 6379,
            keyPrefix: '',
            enableStats: true,
            retryAttempts: 3,
            retryDelay: 1000,
            ...config
        };

        this.stats = {
            hits: 0,
            misses: 0,
            hitRate: 0,
            totalOperations: 0
        };

        if (mockClient) {
            this.client = mockClient;
            this.isConnected = true;
        } else {
            // 只在非測試環境初始化真實客戶端
            if (process.env.NODE_ENV !== 'test') {
                this.initializeClient();
            } else {
                // 測試環境使用記憶體快取
                this.isConnected = false;
            }
        }
    }

    /**
     * 初始化 Redis 客戶端
     */
    private async initializeClient(): Promise<void> {
        try {
            this.client = createClient({
                socket: {
                    host: this.config.host,
                    port: this.config.port
                },
                password: this.config.password
            });

            this.client.on('error', (err: Error) => {
                console.error('Redis Client Error:', err);
                this.isConnected = false;
            });

            this.client.on('connect', () => {
                this.isConnected = true;
            });

            await this.client.connect();
            this.isConnected = true;
        } catch (error) {
            console.error('Failed to initialize Redis client:', error);
            this.isConnected = false;
        }
    }

    /**
     * 生成完整的快取鍵
     */
    private getFullKey(key: string): string {
        return `${this.config.keyPrefix}${key}`;
    }

    /**
     * 更新統計資料
     */
    private updateStats(isHit: boolean): void {
        if (!this.config.enableStats) return;

        this.stats.totalOperations++;
        if (isHit) {
            this.stats.hits++;
        } else {
            this.stats.misses++;
        }

        this.stats.hitRate = this.stats.totalOperations > 0
            ? this.stats.hits / this.stats.totalOperations
            : 0;
    }

    /**
     * 降級模式快取操作
     */
    private getFallback<T>(key: string): T | null {
        const cached = this.fallbackCache.get(key);
        if (!cached) return null;

        if (cached.expiry && Date.now() > cached.expiry) {
            this.fallbackCache.delete(key);
            return null;
        }

        return cached.value;
    }

    private setFallback<T>(key: string, value: T, ttl?: number): void {
        // Set expiry based on TTL parameter
        let expiry: number | undefined;
        if (ttl && ttl > 0) {
            expiry = Date.now() + (ttl * 1000);
        }

        this.fallbackCache.set(key, { value, expiry });
    }    /**
     * GET 操作 - 從快取獲取值
     */
    async get<T>(key: string): Promise<T | null> {
        const fullKey = this.getFullKey(key);

        try {
            if (!this.isConnected) {
                // 嘗試重連
                await this.attemptReconnection();

                if (!this.isConnected) {
                    const fallbackValue = this.getFallback<T>(key);
                    this.updateStats(fallbackValue !== null);
                    return fallbackValue;
                }
            }

            const result = await this.client.get(fullKey);

            if (result === null) {
                this.updateStats(false);
                return null;
            }

            this.updateStats(true);

            try {
                return JSON.parse(result);
            } catch (parseError) {
                console.error('JSON parse error for key:', fullKey, parseError);
                this.updateStats(false);
                return null;
            }
        } catch (error) {
            console.error('Redis GET error:', error);
            this.isConnected = false;

            const fallbackValue = this.getFallback<T>(key);
            this.updateStats(fallbackValue !== null);
            return fallbackValue;
        }
    }

    /**
     * 嘗試重連 Redis
     */
    private async attemptReconnection(): Promise<void> {
        if (!this.config.retryAttempts || this.config.retryAttempts <= 0) {
            return;
        }

        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                if (this.client && this.client.connect) {
                    await this.client.connect();
                    this.isConnected = true;
                    return;
                }
            } catch (error) {
                console.error(`Reconnection attempt ${attempt} failed:`, error);

                if (attempt < this.config.retryAttempts && this.config.retryDelay) {
                    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
                }
            }
        }
    }

    /**
     * SET 操作 - 設置快取值
     */
    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
        const fullKey = this.getFullKey(key);

        try {
            const serializedValue = JSON.stringify(value);

            if (this.isConnected) {
                // Determine effective TTL: explicit TTL, then default TTL, then no TTL
                const effectiveTtl = ttl !== undefined ? ttl : this.config.defaultTtl;

                if (effectiveTtl && effectiveTtl > 0) {
                    await this.client.set(fullKey, serializedValue, 'EX', effectiveTtl);
                } else {
                    // No TTL - permanent cache
                    await this.client.set(fullKey, serializedValue);
                }
            } else {
                // Fallback cache logic
                const effectiveTtl = ttl !== undefined ? ttl : this.config.defaultTtl;
                this.setFallback(key, value, effectiveTtl);
            }

            this.updateStats(true);
        } catch (error) {
            console.error('Redis SET error:', error);

            // Fallback to memory cache
            const effectiveTtl = ttl !== undefined ? ttl : this.config.defaultTtl;
            this.setFallback(key, value, effectiveTtl);
            this.updateStats(false);
        }
    }    /**
     * DEL 操作 - 刪除快取項目
     */
    async del(key: string): Promise<void> {
        const fullKey = this.getFullKey(key);

        try {
            if (this.isConnected) {
                await this.client.del(fullKey);
            }
            this.fallbackCache.delete(key);
        } catch (error) {
            console.error('Redis DEL error:', error);
            this.isConnected = false;
            this.fallbackCache.delete(key);
        }
    }

    /**
     * EXISTS 操作 - 檢查鍵是否存在
     */
    async exists(key: string): Promise<boolean> {
        const fullKey = this.getFullKey(key);

        try {
            if (!this.isConnected) {
                return this.fallbackCache.has(key);
            }

            const result = await this.client.exists(fullKey);
            return result === 1;
        } catch (error) {
            console.error('Redis EXISTS error:', error);
            this.isConnected = false;
            return this.fallbackCache.has(key);
        }
    }

    /**
     * CLEAR 操作 - 清空所有快取
     */
    async clear(): Promise<void> {
        try {
            if (this.isConnected) {
                await this.client.flushall();
            }
            this.fallbackCache.clear();
        } catch (error) {
            console.error('Redis CLEAR error:', error);
            this.isConnected = false;
            this.fallbackCache.clear();
        }
    }

    /**
     * 獲取快取統計資料
     */
    async getStats(): Promise<CacheStats> {
        const stats = { ...this.stats };

        try {
            if (this.isConnected && this.client.info) {
                const info = await this.client.info('memory');
                if (info && typeof info === 'string') {
                    const match = info.match(/used_memory:(\d+)/);
                    if (match) {
                        stats.memoryUsage = parseInt(match[1], 10);
                    }
                }
            }
        } catch (error) {
            console.error('Error getting Redis memory info:', error);
        }

        return stats;
    }

    /**
     * 斷開連接
     */
    async disconnect(): Promise<void> {
        try {
            if (this.client && this.isConnected) {
                await this.client.disconnect();
            }
        } catch (error) {
            console.error('Error disconnecting Redis client:', error);
        }
        this.isConnected = false;
    }
}

/**
 * 全域快取實例
 */
let globalCache: RedisCacheProvider | null = null;

/**
 * 獲取全域快取實例
 */
export function getCache(config?: CacheConfig): RedisCacheProvider {
    // 創建新實例只在明確需要時（如配置變更）
    if (!globalCache) {
        globalCache = new RedisCacheProvider(config);
    }
    return globalCache;
}

/**
 * 重置全域快取實例 (主要用於測試)
 */
export function resetCache(): void {
    globalCache = null;
}

/**
 * 快取裝飾器 - 用於方法快取
 */
export function Cacheable(keyPrefix: string, ttl?: number) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const cache = getCache();

            // 為不同參數生成不同的快取鍵
            const argsKey = args.length > 0 ? createHash('md5').update(JSON.stringify(args)).digest('hex') : 'no-args';
            const cacheKey = `${keyPrefix}:${propertyName}:${argsKey}`;

            try {
                // 嘗試從快取獲取
                const cached = await cache.get(cacheKey);
                if (cached !== null) {
                    return cached;
                }

                // 執行原始方法
                const result = await originalMethod.apply(this, args);

                // 儲存到快取
                await cache.set(cacheKey, result, ttl);

                return result;
            } catch (error) {
                // 如果快取操作失敗，仍執行原始方法
                return await originalMethod.apply(this, args);
            }
        };

        return descriptor;
    };
}

/**
 * 快取管理器 - 提供高級快取操作
 */
export class CacheManager {
    private cache: CacheProvider;

    constructor(cache?: CacheProvider) {
        this.cache = cache || getCache();
    }

    /**
     * 批次獲取多個快取項目
     */
    async multiGet<T>(keys: string[]): Promise<(T | null)[]> {
        const promises = keys.map(key => this.cache.get<T>(key));
        return Promise.all(promises);
    }

    /**
     * 批次設置多個快取項目
     */
    async multiSet<T>(items: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
        const promises = items.map(item =>
            this.cache.set(item.key, item.value, item.ttl)
        );
        await Promise.all(promises);
    }

    /**
     * 帶鎖的快取更新 (避免快取穿透)
     */
    async getOrSet<T>(
        key: string,
        factory: () => Promise<T>,
        ttl?: number
    ): Promise<T> {
        // 嘗試從快取獲取
        let value = await this.cache.get<T>(key);
        if (value !== null) {
            return value;
        }

        // 檢查是否有其他進程正在更新此快取
        const lockKey = `${key}:lock`;
        const isLocked = await this.cache.exists(lockKey);

        if (isLocked) {
            // 等待一小段時間後重試
            await new Promise(resolve => setTimeout(resolve, 100));
            value = await this.cache.get<T>(key);
            if (value !== null) {
                return value;
            }
        }

        try {
            // 設置鎖
            await this.cache.set(lockKey, true, 30); // 30 秒鎖

            // 再次檢查快取
            value = await this.cache.get<T>(key);
            if (value !== null) {
                return value;
            }

            // 執行工廠函數
            value = await factory();

            // 儲存到快取
            await this.cache.set(key, value, ttl);

            return value;
        } finally {
            // 釋放鎖
            await this.cache.del(lockKey);
        }
    }

    /**
     * 快取預熱 - 預先載入常用資料
     */
    async warmup<T>(
        keys: string[],
        factory: (key: string) => Promise<T>,
        ttl?: number
    ): Promise<void> {
        const promises = keys.map(async key => {
            const exists = await this.cache.exists(key);
            if (!exists) {
                const value = await factory(key);
                await this.cache.set(key, value, ttl);
            }
        });

        await Promise.all(promises);
    }

    /**
     * 獲取快取統計
     */
    async getStats(): Promise<CacheStats> {
        return this.cache.getStats();
    }
}

/**
 * 匯出預設快取管理器實例
 */
export const cacheManager = new CacheManager();
