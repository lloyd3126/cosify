/**
 * UUID Generator Service
 * 
 * Provides comprehensive UUID v4 generation and validation
 * for database primary key migration and management
 */

import { randomUUID } from 'crypto';

export interface UUIDGeneratorConfig {
    prefix?: string;
    version?: 4; // Currently only supports UUID v4
}

export type DatabaseTable =
    | 'users'
    | 'accounts'
    | 'sessions'
    | 'verification'
    | 'appUsers'
    | 'generations'
    | 'flowRuns'
    | 'flowRunSteps'
    | 'flowRunStepAssets'
    | 'creditTransactions'
    | 'dailyUsage'
    | 'inviteCodes'
    | 'inviteCodeRedemptions'
    | 'auditTrail';

export class UUIDGenerator {
    private static readonly UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    private config: UUIDGeneratorConfig;

    constructor(config: UUIDGeneratorConfig = {}) {
        this.config = {
            version: 4,
            ...config
        };
    }

    /**
     * Generate a single UUID v4
     */
    generate(): string {
        return randomUUID();
    }

    /**
     * Generate multiple unique UUIDs
     */
    generateBatch(count: number): string[] {
        if (count < 0) {
            throw new Error('Batch size must be a positive number');
        }

        if (count === 0) {
            return [];
        }

        const uuids: string[] = [];
        for (let i = 0; i < count; i++) {
            uuids.push(this.generate());
        }

        return uuids;
    }

    /**
     * Generate UUID for specific database table
     */
    generateForTable(tableName: DatabaseTable, prefix?: string): string {
        const uuid = this.generate();

        if (prefix) {
            return `${prefix}_${uuid}`;
        }

        return uuid;
    }

    /**
     * Validate UUID format
     */
    isValid(uuid: any): boolean {
        if (typeof uuid !== 'string') {
            return false;
        }

        return UUIDGenerator.UUID_V4_REGEX.test(uuid);
    }

    /**
     * Convert existing ID to UUID if needed
     * Preserves existing UUIDs, converts non-UUIDs
     */
    migrateId(existingId: string): string {
        if (this.isValid(existingId)) {
            return existingId;
        }

        // Generate new UUID for non-UUID IDs
        return this.generate();
    }

    /**
     * Generate migration mapping for legacy IDs
     */
    generateMigrationMapping(legacyIds: string[]): Record<string, string> {
        const mapping: Record<string, string> = {};

        legacyIds.forEach(legacyId => {
            if (this.isValid(legacyId)) {
                // Preserve existing UUIDs
                mapping[legacyId] = legacyId;
            } else {
                // Generate new UUID for non-UUID IDs
                mapping[legacyId] = this.generate();
            }
        });

        return mapping;
    }

    /**
     * Static method for quick UUID generation
     */
    static generate(): string {
        return randomUUID();
    }

    /**
     * Static method for quick UUID validation
     */
    static isValid(uuid: any): boolean {
        if (typeof uuid !== 'string') {
            return false;
        }

        return UUIDGenerator.UUID_V4_REGEX.test(uuid);
    }
}
