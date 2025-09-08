/**
 * Phase 2.7: Redis 快取層整合 - TDD 測試套件
 * 
 * 🔴 Red Phase: 定義快取層規格和期望行為
 * 
 * 測試範圍：
 * - 基本快取操作 (GET, SET, DEL)
 * - TTL 管理和過期處理
 * - 快取命中率統計
 * - 錯誤處理和降級機制
 * - 效能基準和並發處理
 * - 快取失效策略
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// 快取接口定義
interface CacheProvider {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    del(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
    clear(): Promise<void>;
    getStats(): Promise<CacheStats>;
}

// 快取統計接口
interface CacheStats {
    hits: number;
    misses: number;
    hitRate: number;
    totalOperations: number;
    memoryUsage?: number;
}

// 快取配置接口
interface CacheConfig {
    host?: string;
    port?: number;
    password?: string;
    defaultTtl?: number;
    maxMemory?: string;
    keyPrefix?: string;
    enableStats?: boolean;
    retryAttempts?: number;
    retryDelay?: number;
}

// 快取裝飾器接口
interface Cacheable {
    (target: any, propertyName: string, descriptor: PropertyDescriptor): PropertyDescriptor;
}

describe('Redis Cache Integration System', () => {
    let cache: CacheProvider;
    let mockRedisClient: any;

    beforeEach(() => {
        // Mock Redis client
        mockRedisClient = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            exists: jest.fn(),
            flushall: jest.fn(),
            info: jest.fn(),
            connect: jest.fn(),
            disconnect: jest.fn(),
            on: jest.fn(),
            ping: jest.fn()
        };
    });

    afterEach(async () => {
        jest.clearAllMocks();

        // 重置全域快取實例
        const { resetCache } = await import('../../src/server/services/redis-cache');
        resetCache();
    });

    describe('🔴 Red Phase: 基本快取操作', () => {
        describe('Cache Provider 初始化', () => {
            it('should initialize cache provider with default configuration', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                const cacheProvider = new RedisCacheProvider();
                expect(cacheProvider).toBeDefined();
                expect(cacheProvider.get).toBeDefined();
                expect(cacheProvider.set).toBeDefined();
                expect(cacheProvider.del).toBeDefined();
            });

            it('should initialize cache provider with custom configuration', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                const config: CacheConfig = {
                    host: 'localhost',
                    port: 6379,
                    defaultTtl: 300,
                    keyPrefix: 'cosify:',
                    enableStats: true
                };

                const cacheProvider = new RedisCacheProvider(config);
                expect(cacheProvider).toBeDefined();
            });

            it('should handle connection failures gracefully', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                mockRedisClient.connect.mockRejectedValue(new Error('Connection failed'));

                const cacheProvider = new RedisCacheProvider({}, mockRedisClient);

                // 應該不拋出錯誤，而是進入降級模式
                await expect(cacheProvider.get('test')).resolves.toBeNull();
            });
        });

        describe('GET 操作', () => {
            it('should retrieve cached value for existing key', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                const testValue = { id: 1, name: 'Test User' };
                mockRedisClient.get.mockResolvedValue(JSON.stringify(testValue));

                const cacheProvider = new RedisCacheProvider({}, mockRedisClient);
                const result = await cacheProvider.get('user:1');

                expect(result).toEqual(testValue);
                expect(mockRedisClient.get).toHaveBeenCalledWith('user:1');
            });

            it('should return null for non-existing key', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                mockRedisClient.get.mockResolvedValue(null);

                const cacheProvider = new RedisCacheProvider({}, mockRedisClient);
                const result = await cacheProvider.get('non-existing');

                expect(result).toBeNull();
                expect(mockRedisClient.get).toHaveBeenCalledWith('non-existing');
            });

            it('should handle JSON parsing errors gracefully', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                mockRedisClient.get.mockResolvedValue('invalid-json{');

                const cacheProvider = new RedisCacheProvider({}, mockRedisClient);
                const result = await cacheProvider.get('corrupted-data');

                expect(result).toBeNull();
            });

            it('should apply key prefix when configured', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                const config: CacheConfig = { keyPrefix: 'cosify:' };
                mockRedisClient.get.mockResolvedValue('"test-value"');

                const cacheProvider = new RedisCacheProvider(config, mockRedisClient);
                await cacheProvider.get('test');

                expect(mockRedisClient.get).toHaveBeenCalledWith('cosify:test');
            });
        });

        describe('SET 操作', () => {
            it('should store value with default TTL', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                const testValue = { id: 1, name: 'Test User' };
                mockRedisClient.set.mockResolvedValue('OK');

                const cacheProvider = new RedisCacheProvider({ defaultTtl: 300 }, mockRedisClient);
                await cacheProvider.set('user:1', testValue);

                expect(mockRedisClient.set).toHaveBeenCalledWith(
                    'user:1',
                    JSON.stringify(testValue),
                    'EX',
                    300
                );
            });

            it('should store value with custom TTL', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                const testValue = { id: 1, name: 'Test User' };
                mockRedisClient.set.mockResolvedValue('OK');

                const cacheProvider = new RedisCacheProvider({}, mockRedisClient);
                await cacheProvider.set('user:1', testValue, 600);

                expect(mockRedisClient.set).toHaveBeenCalledWith(
                    'user:1',
                    JSON.stringify(testValue),
                    'EX',
                    600
                );
            });

            it('should store value without TTL when not specified', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                const testValue = { id: 1, name: 'Test User' };
                mockRedisClient.set.mockResolvedValue('OK');

                const cacheProvider = new RedisCacheProvider({}, mockRedisClient);
                await cacheProvider.set('user:1', testValue);

                expect(mockRedisClient.set).toHaveBeenCalledWith(
                    'user:1',
                    JSON.stringify(testValue)
                );
            });

            it('should handle Redis set failures gracefully', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                const testValue = { id: 1, name: 'Test User' };
                mockRedisClient.set.mockRejectedValue(new Error('Redis error'));

                const cacheProvider = new RedisCacheProvider({}, mockRedisClient);

                // 應該不拋出錯誤
                await expect(cacheProvider.set('user:1', testValue)).resolves.toBeUndefined();
            });
        });

        describe('DEL 操作', () => {
            it('should delete existing key', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                mockRedisClient.del.mockResolvedValue(1);

                const cacheProvider = new RedisCacheProvider({}, mockRedisClient);
                await cacheProvider.del('user:1');

                expect(mockRedisClient.del).toHaveBeenCalledWith('user:1');
            });

            it('should handle deletion of non-existing key', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                mockRedisClient.del.mockResolvedValue(0);

                const cacheProvider = new RedisCacheProvider({}, mockRedisClient);
                await cacheProvider.del('non-existing');

                expect(mockRedisClient.del).toHaveBeenCalledWith('non-existing');
            });
        });

        describe('EXISTS 檢查', () => {
            it('should return true for existing key', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                mockRedisClient.exists.mockResolvedValue(1);

                const cacheProvider = new RedisCacheProvider({}, mockRedisClient);
                const exists = await cacheProvider.exists('user:1');

                expect(exists).toBe(true);
                expect(mockRedisClient.exists).toHaveBeenCalledWith('user:1');
            });

            it('should return false for non-existing key', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                mockRedisClient.exists.mockResolvedValue(0);

                const cacheProvider = new RedisCacheProvider({}, mockRedisClient);
                const exists = await cacheProvider.exists('non-existing');

                expect(exists).toBe(false);
            });
        });
    });

    describe('🔴 Red Phase: 快取統計和監控', () => {
        describe('命中率統計', () => {
            it('should track cache hits and misses', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                // 模擬命中和未命中
                mockRedisClient.get
                    .mockResolvedValueOnce('"cached-value"')  // 命中
                    .mockResolvedValueOnce(null)              // 未命中
                    .mockResolvedValueOnce('"another-value"'); // 命中

                const cacheProvider = new RedisCacheProvider({ enableStats: true }, mockRedisClient);

                await cacheProvider.get('key1'); // 命中
                await cacheProvider.get('key2'); // 未命中
                await cacheProvider.get('key3'); // 命中

                const stats = await cacheProvider.getStats();
                expect(stats.hits).toBe(2);
                expect(stats.misses).toBe(1);
                expect(stats.totalOperations).toBe(3);
                expect(stats.hitRate).toBeCloseTo(0.667, 3);
            });

            it('should calculate hit rate correctly', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                mockRedisClient.get
                    .mockResolvedValueOnce('"value1"')
                    .mockResolvedValueOnce('"value2"')
                    .mockResolvedValueOnce('"value3"')
                    .mockResolvedValueOnce('"value4"')
                    .mockResolvedValueOnce(null);

                const cacheProvider = new RedisCacheProvider({ enableStats: true }, mockRedisClient);

                // 4 次命中，1 次未命中
                for (let i = 1; i <= 5; i++) {
                    await cacheProvider.get(`key${i}`);
                }

                const stats = await cacheProvider.getStats();
                expect(stats.hitRate).toBe(0.8); // 80%
            });

            it('should handle zero operations gracefully', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                const cacheProvider = new RedisCacheProvider({ enableStats: true }, mockRedisClient);
                const stats = await cacheProvider.getStats();

                expect(stats.hits).toBe(0);
                expect(stats.misses).toBe(0);
                expect(stats.totalOperations).toBe(0);
                expect(stats.hitRate).toBe(0);
            });
        });

        describe('內存使用監控', () => {
            it('should report memory usage when available', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                mockRedisClient.info.mockResolvedValue('used_memory:1048576\r\n');

                const cacheProvider = new RedisCacheProvider({ enableStats: true }, mockRedisClient);
                const stats = await cacheProvider.getStats();

                expect(stats.memoryUsage).toBe(1048576);
            });
        });
    });

    describe('🔴 Red Phase: 錯誤處理和降級', () => {
        describe('連接錯誤處理', () => {
            it('should enter fallback mode when Redis is unavailable', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                mockRedisClient.get.mockRejectedValue(new Error('Connection lost'));
                mockRedisClient.set.mockRejectedValue(new Error('Connection lost'));

                const cacheProvider = new RedisCacheProvider({}, mockRedisClient);

                // 應該降級到記憶體快取或直接回傳 null
                const result = await cacheProvider.get('test');
                expect(result).toBeNull();

                // SET 操作應該靜默失敗
                await expect(cacheProvider.set('test', 'value')).resolves.toBeUndefined();
            });

            it('should attempt reconnection after connection failure', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                mockRedisClient.get
                    .mockRejectedValueOnce(new Error('Connection lost'))
                    .mockResolvedValueOnce('"recovered-value"');

                mockRedisClient.connect.mockResolvedValue(undefined);

                const cacheProvider = new RedisCacheProvider({ retryAttempts: 1 }, mockRedisClient);

                // 第一次失敗，第二次成功
                const result1 = await cacheProvider.get('test');
                expect(result1).toBeNull();

                const result2 = await cacheProvider.get('test');
                expect(result2).toBe('recovered-value');
            });
        });

        describe('資料損壞處理', () => {
            it('should handle corrupted data gracefully', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                mockRedisClient.get.mockResolvedValue('corrupted-json-{');

                const cacheProvider = new RedisCacheProvider({}, mockRedisClient);
                const result = await cacheProvider.get('corrupted');

                expect(result).toBeNull();
            });
        });
    });

    describe('🔴 Red Phase: 快取裝飾器', () => {
        describe('方法快取裝飾器', () => {
            it('should cache method results with @Cacheable decorator', async () => {
                const { Cacheable } = await import('../../src/server/services/redis-cache');

                let callCount = 0;

                class TestService {
                    @Cacheable('user', 300)
                    async getUser(id: number) {
                        callCount++;
                        return { id, name: `User ${id}` };
                    }
                }

                const service = new TestService();

                const result1 = await service.getUser(1);
                const result2 = await service.getUser(1);

                expect(result1).toEqual(result2);
                expect(callCount).toBe(1); // 只調用一次，第二次使用快取
            });

            it('should use different cache keys for different parameters', async () => {
                const { Cacheable } = await import('../../src/server/services/redis-cache');

                let callCount = 0;

                class TestService {
                    @Cacheable('user', 300)
                    async getUser(id: number) {
                        callCount++;
                        return { id, name: `User ${id}` };
                    }
                }

                const service = new TestService();

                await service.getUser(1);
                await service.getUser(2);
                await service.getUser(1); // 應該使用快取

                expect(callCount).toBe(2); // User 1 和 User 2 各調用一次
            });

            it('should handle async method errors correctly', async () => {
                const { Cacheable } = await import('../../src/server/services/redis-cache');

                class TestService {
                    @Cacheable('error-prone', 300)
                    async errorMethod() {
                        throw new Error('Method error');
                    }
                }

                const service = new TestService();

                await expect(service.errorMethod()).rejects.toThrow('Method error');

                // 錯誤不應該被快取
                await expect(service.errorMethod()).rejects.toThrow('Method error');
            });
        });
    });

    describe('🔴 Red Phase: 效能基準測試', () => {
        describe('快取效能', () => {
            it('should meet performance benchmarks for cache operations', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                mockRedisClient.get.mockResolvedValue('"test-value"');
                mockRedisClient.set.mockResolvedValue('OK');

                const cacheProvider = new RedisCacheProvider({}, mockRedisClient);

                const startTime = Date.now();

                // 執行 100 次快取操作
                for (let i = 0; i < 100; i++) {
                    await cacheProvider.get(`key${i}`);
                    await cacheProvider.set(`key${i}`, `value${i}`);
                }

                const endTime = Date.now();
                const avgTime = (endTime - startTime) / 200; // 200 operations

                expect(avgTime).toBeLessThan(5); // 平均每次操作少於 5ms
            });

            it('should achieve minimum 80% hit rate in realistic scenarios', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                // 模擬 80% 命中率
                const responses = Array(80).fill('"cached-value"').concat(Array(20).fill(null));
                mockRedisClient.get.mockImplementation(() => {
                    return Promise.resolve(responses.shift());
                });

                const cacheProvider = new RedisCacheProvider({ enableStats: true }, mockRedisClient);

                for (let i = 0; i < 100; i++) {
                    await cacheProvider.get(`key${i}`);
                }

                const stats = await cacheProvider.getStats();
                expect(stats.hitRate).toBeGreaterThanOrEqual(0.8);
            });
        });

        describe('並發處理', () => {
            it('should handle concurrent cache operations correctly', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                mockRedisClient.get.mockResolvedValue('"concurrent-value"');
                mockRedisClient.set.mockResolvedValue('OK');

                const cacheProvider = new RedisCacheProvider({}, mockRedisClient);

                const promises = [];
                for (let i = 0; i < 50; i++) {
                    promises.push(cacheProvider.get(`key${i}`));
                    promises.push(cacheProvider.set(`key${i}`, `value${i}`));
                }

                const results = await Promise.all(promises);

                // 所有操作都應該成功完成
                expect(results).toHaveLength(100);
            });
        });
    });

    describe('🔴 Red Phase: 快取失效策略', () => {
        describe('TTL 管理', () => {
            it('should support different TTL strategies', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                mockRedisClient.set.mockResolvedValue('OK');

                const cacheProvider = new RedisCacheProvider({}, mockRedisClient);

                await cacheProvider.set('short-lived', 'value', 60);
                await cacheProvider.set('long-lived', 'value', 3600);
                await cacheProvider.set('permanent', 'value');

                expect(mockRedisClient.set).toHaveBeenCalledWith('short-lived', '"value"', 'EX', 60);
                expect(mockRedisClient.set).toHaveBeenCalledWith('long-lived', '"value"', 'EX', 3600);
                expect(mockRedisClient.set).toHaveBeenCalledWith('permanent', '"value"');
            });
        });

        describe('手動失效', () => {
            it('should support manual cache invalidation', async () => {
                const { RedisCacheProvider } = await import('../../src/server/services/redis-cache');

                mockRedisClient.del.mockResolvedValue(1);
                mockRedisClient.flushall.mockResolvedValue('OK');

                const cacheProvider = new RedisCacheProvider({}, mockRedisClient);

                await cacheProvider.del('specific-key');
                await cacheProvider.clear();

                expect(mockRedisClient.del).toHaveBeenCalledWith('specific-key');
                expect(mockRedisClient.flushall).toHaveBeenCalled();
            });
        });
    });
});
