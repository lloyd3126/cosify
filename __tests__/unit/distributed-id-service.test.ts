/**
 * Distributed ID Service Tests
 * 
 * TDD tests for high-level distributed ID service functionality
 */

import { DistributedIdService } from '../../src/server/services/distributed-id-service';

describe('DistributedIdService', () => {
    let service: DistributedIdService;

    beforeEach(() => {
        service = DistributedIdService.createForTesting();
    });

    describe('🔵 Refactor Phase: Service Integration', () => {
        test('should create service with auto-configuration', () => {
            const autoService = DistributedIdService.createAutoConfigured();

            expect(autoService).toBeInstanceOf(DistributedIdService);

            const info = autoService.getInfo();
            expect(info.nodeId).toBeGreaterThanOrEqual(0);
            expect(info.nodeId).toBeLessThanOrEqual(1023);
            expect(info.datacenter).toBe(0);
        });

        test('should generate IDs for database tables', () => {
            const userId = service.generateForTable('users');
            const sessionId = service.generateForTable('sessions');
            const accountId = service.generateForTable('accounts');

            expect(service.isValid(userId)).toBe(true);
            expect(service.isValid(sessionId)).toBe(true);
            expect(service.isValid(accountId)).toBe(true);

            expect(userId).not.toBe(sessionId);
            expect(sessionId).not.toBe(accountId);
        });

        test('should generate batch IDs efficiently', () => {
            const count = 1000;
            const ids = service.generateBatch(count);

            expect(ids).toHaveLength(count);

            // Check all are unique
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(count);

            // Check all are valid
            ids.forEach(id => {
                expect(service.isValid(id)).toBe(true);
            });
        });

        test('should handle empty batch generation', () => {
            const emptyBatch = service.generateBatch(0);
            expect(emptyBatch).toHaveLength(0);

            const negativeBatch = service.generateBatch(-5);
            expect(negativeBatch).toHaveLength(0);
        });
    });

    describe('🔵 Refactor Phase: Time-based Operations', () => {
        test('should extract timestamp from ID', () => {
            const beforeGeneration = Date.now();
            const id = service.generate();
            const afterGeneration = Date.now();

            const timestamp = service.getTimestamp(id);

            expect(timestamp).toBeGreaterThanOrEqual(beforeGeneration);
            expect(timestamp).toBeLessThanOrEqual(afterGeneration + 100); // Small tolerance
        });

        test('should compare IDs by time', () => {
            const id1 = service.generate();

            // Small delay to ensure different timestamp
            const delay = new Promise(resolve => setTimeout(resolve, 2));

            return delay.then(() => {
                const id2 = service.generate();

                expect(service.isAfter(id2, service.getTimestamp(id1))).toBe(true);
                expect(service.isBefore(id1, service.getTimestamp(id2))).toBe(true);
                expect(service.isAfter(id1, service.getTimestamp(id2))).toBe(false);
                expect(service.isBefore(id2, service.getTimestamp(id1))).toBe(false);
            });
        });

        test('should sort IDs by time', () => {
            const ids: string[] = [];

            // Generate IDs with small delays
            for (let i = 0; i < 5; i++) {
                ids.push(service.generate());
            }

            const sortedAsc = service.sortByTime([...ids], true);
            const sortedDesc = service.sortByTime([...ids], false);

            // Check ascending order
            for (let i = 1; i < sortedAsc.length; i++) {
                const prevTime = service.getTimestamp(sortedAsc[i - 1]);
                const currentTime = service.getTimestamp(sortedAsc[i]);
                expect(currentTime).toBeGreaterThanOrEqual(prevTime);
            }

            // Check descending order
            for (let i = 1; i < sortedDesc.length; i++) {
                const prevTime = service.getTimestamp(sortedDesc[i - 1]);
                const currentTime = service.getTimestamp(sortedDesc[i]);
                expect(currentTime).toBeLessThanOrEqual(prevTime);
            }
        });

        test('should filter IDs by time range', () => {
            const startTime = Date.now();

            // Generate some IDs
            const ids: string[] = [];
            for (let i = 0; i < 10; i++) {
                ids.push(service.generate());
            }

            const endTime = Date.now() + 1000; // 1 second buffer

            const filteredIds = service.filterByTimeRange(ids, startTime, endTime);

            expect(filteredIds.length).toBe(ids.length); // All should be in range

            filteredIds.forEach(id => {
                const timestamp = service.getTimestamp(id);
                expect(timestamp).toBeGreaterThanOrEqual(startTime);
                expect(timestamp).toBeLessThanOrEqual(endTime);
            });
        });
    });

    describe('🔵 Refactor Phase: Metrics and Monitoring', () => {
        test('should collect metrics when enabled', () => {
            const metricsService = new DistributedIdService({
                nodeId: 1,
                datacenter: 0,
                enableMetrics: true
            });

            // Generate some IDs
            for (let i = 0; i < 10; i++) {
                metricsService.generate();
            }

            const metrics = metricsService.getMetrics();

            expect(metrics.totalGenerated).toBe(10);
            expect(metrics.averageGenerationTime).toBeGreaterThan(0);
            expect(metrics.lastGeneratedAt).toBeGreaterThan(0);
        });

        test('should reset metrics', () => {
            const metricsService = new DistributedIdService({
                nodeId: 1,
                datacenter: 0,
                enableMetrics: true
            });

            // Generate some IDs
            metricsService.generate();
            metricsService.generate();

            let metrics = metricsService.getMetrics();
            expect(metrics.totalGenerated).toBe(2);

            // Reset metrics
            metricsService.resetMetrics();

            metrics = metricsService.getMetrics();
            expect(metrics.totalGenerated).toBe(0);
            expect(metrics.averageGenerationTime).toBe(0);
            expect(metrics.lastGeneratedAt).toBe(0);
        });

        test('should not collect metrics when disabled', () => {
            const noMetricsService = new DistributedIdService({
                nodeId: 1,
                datacenter: 0,
                enableMetrics: false
            });

            // Generate some IDs
            noMetricsService.generate();
            noMetricsService.generate();

            const metrics = noMetricsService.getMetrics();

            // Metrics should remain at default values
            expect(metrics.totalGenerated).toBe(0);
            expect(metrics.averageGenerationTime).toBe(0);
        });
    });

    describe('🔵 Refactor Phase: Factory Methods', () => {
        test('should create development instance', () => {
            const devService = DistributedIdService.createForDevelopment();

            const info = devService.getInfo();
            expect(info.nodeId).toBe(1);
            expect(info.datacenter).toBe(0);

            const id = devService.generate();
            expect(devService.isValid(id)).toBe(true);
        });

        test('should create testing instance', () => {
            const testService = DistributedIdService.createForTesting();

            const info = testService.getInfo();
            expect(info.nodeId).toBe(999);
            expect(info.datacenter).toBe(0);

            const id = testService.generate();
            expect(testService.isValid(id)).toBe(true);
        });

        test('should detect node ID from environment', () => {
            // Test with NODE_ID environment variable
            const originalNodeId = process.env.NODE_ID;
            process.env.NODE_ID = '42';

            const envService = DistributedIdService.createAutoConfigured();
            const info = envService.getInfo();

            expect(info.nodeId).toBe(42);

            // Restore original environment
            if (originalNodeId) {
                process.env.NODE_ID = originalNodeId;
            } else {
                delete process.env.NODE_ID;
            }
        });

        test('should detect node ID from hostname', () => {
            const originalNodeId = process.env.NODE_ID;
            const originalHostname = process.env.HOSTNAME;

            // Remove NODE_ID to test hostname fallback
            delete process.env.NODE_ID;
            process.env.HOSTNAME = 'app-server-123';

            const hostnameService = DistributedIdService.createAutoConfigured();
            const info = hostnameService.getInfo();

            expect(info.nodeId).toBe(123);

            // Restore original environment
            if (originalNodeId) {
                process.env.NODE_ID = originalNodeId;
            }
            if (originalHostname) {
                process.env.HOSTNAME = originalHostname;
            } else {
                delete process.env.HOSTNAME;
            }
        });
    });

    describe('🔵 Refactor Phase: Error Handling', () => {
        test('should handle parsing errors gracefully', () => {
            expect(service.isValid('invalid-id')).toBe(false);
            expect(service.isValid('')).toBe(false);
            expect(service.isValid('123abc')).toBe(false);

            expect(() => service.parseId('invalid-id')).toThrow();
        });

        test('should handle invalid configuration', () => {
            expect(() => {
                new DistributedIdService({ nodeId: -1 });
            }).toThrow();

            expect(() => {
                new DistributedIdService({ nodeId: 1024 });
            }).toThrow();

            expect(() => {
                new DistributedIdService({ datacenter: -1 });
            }).toThrow();

            expect(() => {
                new DistributedIdService({ datacenter: 32 });
            }).toThrow();
        });
    });

    describe('🔵 Refactor Phase: Performance', () => {
        test('should maintain performance with metrics enabled', () => {
            const metricsService = new DistributedIdService({
                nodeId: 1,
                datacenter: 0,
                enableMetrics: true
            });

            const iterations = 10000;
            const startTime = performance.now();

            for (let i = 0; i < iterations; i++) {
                metricsService.generate();
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Should still generate 10,000 IDs in under 200ms even with metrics
            expect(duration).toBeLessThan(200);
        });

        test('should handle batch operations efficiently', () => {
            const batchSize = 10000;
            const startTime = performance.now();

            const ids = service.generateBatch(batchSize);

            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(ids).toHaveLength(batchSize);
            expect(duration).toBeLessThan(200); // Should complete in under 200ms

            // Verify all are unique
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(batchSize);
        });
    });
});
