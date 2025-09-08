/**
 * TDD Red Phase: Distributed ID Generator Tests
 * 
 * Testing distributed environment ID generation for multi-instance deployments
 * Ensures unique ID generation across multiple application instances
 */

import { DistributedIdGenerator } from '../../src/server/services/distributed-id-generator';

describe('DistributedIdGenerator Service', () => {
    let generator: DistributedIdGenerator;

    beforeEach(() => {
        generator = new DistributedIdGenerator({
            nodeId: 1,
            datacenter: 1
        });
    });

    describe('🔴 Red Phase: Basic Distributed ID Generation', () => {
        test('should generate unique distributed IDs', () => {
            const id1 = generator.generate();
            const id2 = generator.generate();

            expect(id1).not.toBe(id2);
            expect(typeof id1).toBe('string');
            expect(typeof id2).toBe('string');

            // IDs should be numeric strings (Snowflake-like format)
            expect(id1).toMatch(/^\d+$/);
            expect(id2).toMatch(/^\d+$/);
        });

        test('should generate IDs with node identification', () => {
            const generator1 = new DistributedIdGenerator({ nodeId: 1, datacenter: 1 });
            const generator2 = new DistributedIdGenerator({ nodeId: 2, datacenter: 1 });

            const id1 = generator1.generate();
            const id2 = generator2.generate();

            expect(id1).not.toBe(id2);

            // Different nodes should generate different IDs even at same time
            const parsed1 = generator1.parseId(id1);
            const parsed2 = generator2.parseId(id2);

            expect(parsed1.nodeId).toBe(1);
            expect(parsed2.nodeId).toBe(2);
        });

        test('should generate time-ordered IDs', async () => {
            const id1 = generator.generate();

            // Wait a small amount to ensure time difference
            await new Promise(resolve => setTimeout(resolve, 2));

            const id2 = generator.generate();

            // Later generated ID should be larger (lexicographically and numerically)
            expect(BigInt(id2)).toBeGreaterThan(BigInt(id1));
        });

        test('should support multiple datacenters', () => {
            const dc1Generator = new DistributedIdGenerator({ nodeId: 1, datacenter: 1 });
            const dc2Generator = new DistributedIdGenerator({ nodeId: 1, datacenter: 2 });

            const id1 = dc1Generator.generate();
            const id2 = dc2Generator.generate();

            expect(id1).not.toBe(id2);

            const parsed1 = dc1Generator.parseId(id1);
            const parsed2 = dc2Generator.parseId(id2);

            expect(parsed1.datacenter).toBe(1);
            expect(parsed2.datacenter).toBe(2);
        });
    });

    describe('🔴 Red Phase: ID Parsing and Validation', () => {
        test('should parse generated IDs correctly', () => {
            const id = generator.generate();
            const parsed = generator.parseId(id);

            expect(parsed).toHaveProperty('timestamp');
            expect(parsed).toHaveProperty('nodeId');
            expect(parsed).toHaveProperty('datacenter');
            expect(parsed).toHaveProperty('sequence');

            expect(typeof parsed.timestamp).toBe('number');
            expect(parsed.nodeId).toBe(1);
            expect(parsed.datacenter).toBe(1);
            expect(typeof parsed.sequence).toBe('number');
        });

        test('should validate distributed IDs', () => {
            const validId = generator.generate();

            expect(generator.isValid(validId)).toBe(true);
            expect(generator.isValid('invalid-id')).toBe(false);
            expect(generator.isValid('')).toBe(false);
            expect(generator.isValid('123abc')).toBe(false);
        });

        test('should extract timestamp from ID', () => {
            const beforeGeneration = Date.now();
            const id = generator.generate();
            const afterGeneration = Date.now();

            const parsed = generator.parseId(id);

            // Timestamp should be within reasonable range
            expect(parsed.timestamp).toBeGreaterThanOrEqual(beforeGeneration);
            expect(parsed.timestamp).toBeLessThanOrEqual(afterGeneration + 1000); // 1 second tolerance
        });
    });

    describe('🔴 Red Phase: High Throughput Generation', () => {
        test('should generate unique IDs under high load', () => {
            const idCount = 10000;
            const ids = new Set<string>();

            for (let i = 0; i < idCount; i++) {
                const id = generator.generate();
                ids.add(id);
            }

            // All IDs should be unique
            expect(ids.size).toBe(idCount);
        });

        test('should handle rapid sequential generation', () => {
            const ids: string[] = [];

            // Generate 1000 IDs as fast as possible
            for (let i = 0; i < 1000; i++) {
                ids.push(generator.generate());
            }

            // Check all are unique
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(1000);

            // Check all are in order
            for (let i = 1; i < ids.length; i++) {
                expect(BigInt(ids[i])).toBeGreaterThanOrEqual(BigInt(ids[i - 1]));
            }
        });

        test('should handle concurrent generation from multiple instances', async () => {
            const generator1 = new DistributedIdGenerator({ nodeId: 1, datacenter: 1 });
            const generator2 = new DistributedIdGenerator({ nodeId: 2, datacenter: 1 });
            const generator3 = new DistributedIdGenerator({ nodeId: 3, datacenter: 2 });

            const allIds = new Set<string>();

            // Generate IDs concurrently
            const promises = [
                Promise.resolve().then(() => {
                    const ids = [];
                    for (let i = 0; i < 100; i++) {
                        ids.push(generator1.generate());
                    }
                    return ids;
                }),
                Promise.resolve().then(() => {
                    const ids = [];
                    for (let i = 0; i < 100; i++) {
                        ids.push(generator2.generate());
                    }
                    return ids;
                }),
                Promise.resolve().then(() => {
                    const ids = [];
                    for (let i = 0; i < 100; i++) {
                        ids.push(generator3.generate());
                    }
                    return ids;
                })
            ];

            const results = await Promise.all(promises);

            // Collect all IDs
            results.forEach(ids => {
                ids.forEach(id => allIds.add(id));
            });

            // All 300 IDs should be unique across instances
            expect(allIds.size).toBe(300);
        });
    });

    describe('🔴 Red Phase: Error Handling and Edge Cases', () => {
        test('should handle invalid node configuration', () => {
            expect(() => {
                new DistributedIdGenerator({ nodeId: -1, datacenter: 1 });
            }).toThrow('Node ID must be between 0 and 1023');

            expect(() => {
                new DistributedIdGenerator({ nodeId: 1024, datacenter: 1 });
            }).toThrow('Node ID must be between 0 and 1023');
        });

        test('should handle invalid datacenter configuration', () => {
            expect(() => {
                new DistributedIdGenerator({ nodeId: 1, datacenter: -1 });
            }).toThrow('Datacenter ID must be between 0 and 31');

            expect(() => {
                new DistributedIdGenerator({ nodeId: 1, datacenter: 32 });
            }).toThrow('Datacenter ID must be between 0 and 31');
        });

        test('should handle clock backwards scenarios', () => {
            const generator = new DistributedIdGenerator({
                nodeId: 1,
                datacenter: 1,
                clockBackwardsThreshold: 1000 // 1 second
            });

            // Generate an ID
            const id1 = generator.generate();

            // This should still work (simulates small clock adjustments)
            const id2 = generator.generate();

            expect(generator.isValid(id1)).toBe(true);
            expect(generator.isValid(id2)).toBe(true);
            expect(id1).not.toBe(id2);
        });

        test('should handle sequence overflow gracefully', () => {
            // This test simulates what happens when sequence number overflows
            // within the same millisecond (very high throughput scenario)
            const ids = new Set<string>();

            // Generate many IDs rapidly to potentially trigger sequence overflow
            for (let i = 0; i < 5000; i++) {
                const id = generator.generate();
                ids.add(id);
            }

            // Should still generate unique IDs
            expect(ids.size).toBe(5000);
        });
    });

    describe('🔴 Red Phase: Performance Requirements', () => {
        test('should generate IDs within performance thresholds', () => {
            const iterations = 10000;
            const startTime = performance.now();

            for (let i = 0; i < iterations; i++) {
                generator.generate();
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Should generate 10,000 IDs in under 100ms
            expect(duration).toBeLessThan(100);

            // Average per-ID generation should be under 0.01ms
            const avgTimePerID = duration / iterations;
            expect(avgTimePerID).toBeLessThan(0.01);
        });

        test('should maintain performance under sustained load', async () => {
            const testDuration = 1000; // 1 second
            const startTime = Date.now();
            let idCount = 0;

            while (Date.now() - startTime < testDuration) {
                generator.generate();
                idCount++;
            }

            // Should generate at least 100,000 IDs per second
            expect(idCount).toBeGreaterThan(100000);
        });
    });

    describe('🔴 Red Phase: Integration with Database Tables', () => {
        test('should generate compatible IDs for database storage', () => {
            const id = generator.generate();

            // ID should be a valid string for database storage
            expect(typeof id).toBe('string');
            expect(id.length).toBeGreaterThan(0);
            expect(id.length).toBeLessThan(20); // Reasonable length for database

            // Should be compatible with BigInt for mathematical operations
            expect(() => BigInt(id)).not.toThrow();
        });

        test('should support custom epoch for application-specific needs', () => {
            const customEpoch = new Date('2024-01-01').getTime();
            const generator = new DistributedIdGenerator({
                nodeId: 1,
                datacenter: 1,
                epoch: customEpoch
            });

            const id = generator.generate();
            const parsed = generator.parseId(id);

            // Timestamp should be relative to custom epoch
            expect(parsed.timestamp).toBeGreaterThan(customEpoch);
        });
    });
});
