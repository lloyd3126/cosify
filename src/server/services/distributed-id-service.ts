/**
 * Distributed ID Service Integration
 * 
 * Provides higher-level distributed ID management for application services
 * Integrates with database operations and provides convenience methods
 */

import { DistributedIdGenerator, type DistributedIdConfig } from './distributed-id-generator';
import { DatabaseTable } from './uuid-generator';

export interface IdServiceConfig {
    nodeId?: number;
    datacenter?: number;
    epoch?: number;
    enableMetrics?: boolean;
}

export interface IdMetrics {
    totalGenerated: number;
    averageGenerationTime: number;
    lastGeneratedAt: number;
    sequenceOverflows: number;
    clockBackwardsEvents: number;
}

/**
 * High-level distributed ID service for application use
 */
export class DistributedIdService {
    private generator: DistributedIdGenerator;
    private metrics: IdMetrics;
    private enableMetrics: boolean;

    constructor(config: IdServiceConfig = {}) {
        const generatorConfig: DistributedIdConfig = {
            nodeId: config.nodeId ?? this.detectNodeId(),
            datacenter: config.datacenter ?? 0,
            epoch: config.epoch
        };

        this.generator = new DistributedIdGenerator(generatorConfig);
        this.enableMetrics = config.enableMetrics ?? false;
        this.metrics = {
            totalGenerated: 0,
            averageGenerationTime: 0,
            lastGeneratedAt: 0,
            sequenceOverflows: 0,
            clockBackwardsEvents: 0
        };
    }

    /**
     * Generate ID for database table
     */
    generateForTable(tableName: DatabaseTable): string {
        return this.generate();
    }

    /**
     * Generate a new distributed ID
     */
    generate(): string {
        const startTime = this.enableMetrics ? performance.now() : 0;

        try {
            const id = this.generator.generate();

            if (this.enableMetrics) {
                this.updateMetrics(performance.now() - startTime);
            }

            return id;
        } catch (error) {
            if (this.enableMetrics && error instanceof Error && error.message.includes('Clock moved backwards')) {
                this.metrics.clockBackwardsEvents++;
            }
            throw error;
        }
    }

    /**
     * Generate multiple IDs efficiently
     */
    generateBatch(count: number): string[] {
        if (count <= 0) {
            return [];
        }

        const ids: string[] = [];
        for (let i = 0; i < count; i++) {
            ids.push(this.generate());
        }

        return ids;
    }

    /**
     * Parse distributed ID
     */
    parseId(id: string) {
        return this.generator.parseId(id);
    }

    /**
     * Validate distributed ID
     */
    isValid(id: string): boolean {
        return this.generator.isValid(id);
    }

    /**
     * Get service metrics
     */
    getMetrics(): IdMetrics {
        return { ...this.metrics };
    }

    /**
     * Reset metrics
     */
    resetMetrics(): void {
        this.metrics = {
            totalGenerated: 0,
            averageGenerationTime: 0,
            lastGeneratedAt: 0,
            sequenceOverflows: 0,
            clockBackwardsEvents: 0
        };
    }

    /**
     * Get generator information
     */
    getInfo() {
        return this.generator.getInfo();
    }

    /**
     * Extract timestamp from ID for sorting/filtering
     */
    getTimestamp(id: string): number {
        const parsed = this.parseId(id);
        return parsed.timestamp;
    }

    /**
     * Check if ID was generated after a certain timestamp
     */
    isAfter(id: string, timestamp: number): boolean {
        return this.getTimestamp(id) > timestamp;
    }

    /**
     * Check if ID was generated before a certain timestamp
     */
    isBefore(id: string, timestamp: number): boolean {
        return this.getTimestamp(id) < timestamp;
    }

    /**
     * Sort IDs by generation time
     */
    sortByTime(ids: string[], ascending = true): string[] {
        return ids.sort((a, b) => {
            const timeA = this.getTimestamp(a);
            const timeB = this.getTimestamp(b);
            return ascending ? timeA - timeB : timeB - timeA;
        });
    }

    /**
     * Filter IDs by time range
     */
    filterByTimeRange(ids: string[], startTime: number, endTime: number): string[] {
        return ids.filter(id => {
            const timestamp = this.getTimestamp(id);
            return timestamp >= startTime && timestamp <= endTime;
        });
    }

    /**
     * Auto-detect node ID based on environment
     */
    private detectNodeId(): number {
        // In production, this could use:
        // - Environment variables
        // - Container/pod identifiers
        // - Network interface MAC addresses
        // - Configuration files

        if (process.env.NODE_ID) {
            const nodeId = parseInt(process.env.NODE_ID, 10);
            if (nodeId >= 0 && nodeId <= 1023) {
                return nodeId;
            }
        }

        if (process.env.HOSTNAME) {
            // Extract number from hostname like "app-server-123"
            const match = process.env.HOSTNAME.match(/(\d+)$/);
            if (match) {
                const nodeId = parseInt(match[1], 10) % 1024;
                return nodeId;
            }
        }

        // Fallback to random node ID
        return Math.floor(Math.random() * 1024);
    }

    /**
     * Update metrics
     */
    private updateMetrics(generationTime: number): void {
        this.metrics.totalGenerated++;
        this.metrics.lastGeneratedAt = Date.now();

        // Update rolling average
        const currentAvg = this.metrics.averageGenerationTime;
        const count = this.metrics.totalGenerated;
        this.metrics.averageGenerationTime = (currentAvg * (count - 1) + generationTime) / count;
    }

    /**
     * Create service instance with auto-configuration
     */
    static createAutoConfigured(): DistributedIdService {
        return new DistributedIdService({
            enableMetrics: process.env.NODE_ENV === 'production'
        });
    }

    /**
     * Create service instance for development
     */
    static createForDevelopment(): DistributedIdService {
        return new DistributedIdService({
            nodeId: 1,
            datacenter: 0,
            enableMetrics: true
        });
    }

    /**
     * Create service instance for testing
     */
    static createForTesting(): DistributedIdService {
        return new DistributedIdService({
            nodeId: 999,
            datacenter: 0,
            enableMetrics: false
        });
    }
}
