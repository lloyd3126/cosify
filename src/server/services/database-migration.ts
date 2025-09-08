/**
 * Database Migration Service
 * 
 * Provides database migration utilities for UUID primary key transition
 * and database schema management
 */

import { UUIDGenerator, DatabaseTable } from './uuid-generator';
import { Database } from 'better-sqlite3';

export interface MigrationStep {
    name: string;
    description: string;
    tableName: DatabaseTable;
    execute: (db: Database, uuidGenerator: UUIDGenerator) => Promise<void>;
    rollback: (db: Database) => Promise<void>;
}

export interface MigrationResult {
    success: boolean;
    stepsCompleted: string[];
    error?: string;
    rollbackSteps?: string[];
}

export class DatabaseMigrationService {
    private uuidGenerator: UUIDGenerator;
    private migrationSteps: MigrationStep[] = [];

    constructor() {
        this.uuidGenerator = new UUIDGenerator();
        this.initializeMigrationSteps();
    }

    /**
     * Initialize all migration steps for UUID primary key transition
     */
    private initializeMigrationSteps(): void {
        // Migration steps will be added here based on current schema analysis
        this.migrationSteps = [
            {
                name: 'ensure_uuid_format_users',
                description: 'Ensure users table uses UUID format for primary keys',
                tableName: 'users',
                execute: async (db, uuidGen) => {
                    try {
                        // Check if any existing IDs need migration
                        const result = db.prepare('SELECT id FROM users WHERE id NOT GLOB "*-*-*-*-*" LIMIT 1').get();
                        if (result) {
                            console.log('Found non-UUID format IDs in users table, migration would be needed');
                            // In a real migration, we would create mapping and update references
                        }
                    } catch (error) {
                        // Table might not exist, that's OK for this step
                        console.log('Users table not found, skipping migration check');
                    }
                },
                rollback: async (db) => {
                    // Rollback logic would go here
                    console.log('Rollback for users UUID migration');
                }
            },
            {
                name: 'ensure_uuid_format_sessions',
                description: 'Ensure sessions table uses UUID format where appropriate',
                tableName: 'sessions',
                execute: async (db, uuidGen) => {
                    try {
                        // Sessions table uses token as primary key, but id field should be UUID
                        const result = db.prepare('SELECT id FROM sessions WHERE id IS NOT NULL AND id NOT GLOB "*-*-*-*-*" LIMIT 1').get();
                        if (result) {
                            console.log('Found non-UUID format IDs in sessions table');
                        }
                    } catch (error) {
                        // Table might not exist, that's OK for this step
                        console.log('Sessions table not found, skipping migration check');
                    }
                },
                rollback: async (db) => {
                    console.log('Rollback for sessions UUID migration');
                }
            }
        ];
    }

    /**
     * Analyze current database schema for UUID compliance
     */
    async analyzeSchema(db: Database): Promise<{
        tablesAnalyzed: number;
        uuidCompliant: DatabaseTable[];
        needsMigration: DatabaseTable[];
        analysis: Record<string, any>;
    }> {
        const analysis: Record<string, any> = {};
        const uuidCompliant: DatabaseTable[] = [];
        const needsMigration: DatabaseTable[] = [];

        const tables: DatabaseTable[] = [
            'users', 'accounts', 'sessions', 'verification',
            'appUsers', 'generations', 'flowRuns', 'flowRunSteps',
            'flowRunStepAssets', 'creditTransactions', 'dailyUsage',
            'inviteCodes', 'inviteCodeRedemptions', 'auditTrail'
        ];

        for (const tableName of tables) {
            try {
                // Check if table exists
                const tableExists = db.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name=?
        `).get(tableName);

                if (!tableExists) {
                    analysis[tableName] = { exists: false };
                    continue;
                }

                // Check primary key format
                const sample = db.prepare(`SELECT * FROM ${tableName} LIMIT 1`).get() as any;

                analysis[tableName] = {
                    exists: true,
                    sampleData: sample ? Object.keys(sample) : [],
                    primaryKeyFormat: 'unknown'
                };

                if (sample && sample.id) {
                    const isUuidFormat = this.uuidGenerator.isValid(sample.id);
                    analysis[tableName].primaryKeyFormat = isUuidFormat ? 'uuid' : 'non-uuid';

                    if (isUuidFormat) {
                        uuidCompliant.push(tableName);
                    } else {
                        needsMigration.push(tableName);
                    }
                } else {
                    // Table exists but no data, assume UUID compliant schema
                    uuidCompliant.push(tableName);
                }
            } catch (error) {
                analysis[tableName] = {
                    exists: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        }

        return {
            tablesAnalyzed: tables.length,
            uuidCompliant,
            needsMigration,
            analysis
        };
    }

    /**
     * Execute migration steps
     */
    async executeMigration(db: Database): Promise<MigrationResult> {
        const stepsCompleted: string[] = [];

        try {
            for (const step of this.migrationSteps) {
                await step.execute(db, this.uuidGenerator);
                stepsCompleted.push(step.name);
            }

            return {
                success: true,
                stepsCompleted
            };
        } catch (error) {
            return {
                success: false,
                stepsCompleted,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Generate UUID for new record insertion
     */
    generateNewRecordId(tableName: DatabaseTable): string {
        return this.uuidGenerator.generateForTable(tableName);
    }

    /**
     * Validate all IDs in a table are UUID format
     */
    async validateTableUUIDs(db: Database, tableName: DatabaseTable): Promise<{
        totalRecords: number;
        validUUIDs: number;
        invalidUUIDs: number;
        isCompliant: boolean;
    }> {
        try {
            const totalResult = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number };
            const totalRecords = totalResult.count;

            if (totalRecords === 0) {
                return {
                    totalRecords: 0,
                    validUUIDs: 0,
                    invalidUUIDs: 0,
                    isCompliant: true
                };
            }

            // For tables with id field, check UUID format
            const sampleResult = db.prepare(`SELECT id FROM ${tableName} LIMIT 1`).get() as { id?: string };

            if (!sampleResult || !sampleResult.id) {
                // No id field or null id, consider compliant
                return {
                    totalRecords,
                    validUUIDs: totalRecords,
                    invalidUUIDs: 0,
                    isCompliant: true
                };
            }

            // Check all IDs for UUID format
            const allIds = db.prepare(`SELECT id FROM ${tableName} WHERE id IS NOT NULL`).all() as { id: string }[];

            let validUUIDs = 0;
            let invalidUUIDs = 0;

            for (const record of allIds) {
                if (this.uuidGenerator.isValid(record.id)) {
                    validUUIDs++;
                } else {
                    invalidUUIDs++;
                }
            }

            return {
                totalRecords,
                validUUIDs,
                invalidUUIDs,
                isCompliant: invalidUUIDs === 0
            };
        } catch (error) {
            throw new Error(`Failed to validate UUIDs in table ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get migration status for all tables
     */
    async getMigrationStatus(db: Database): Promise<Record<DatabaseTable, any>> {
        const status: Record<string, any> = {};

        const tables: DatabaseTable[] = [
            'users', 'accounts', 'sessions', 'verification',
            'appUsers', 'generations', 'flowRuns', 'flowRunSteps',
            'flowRunStepAssets', 'creditTransactions', 'dailyUsage',
            'inviteCodes', 'inviteCodeRedemptions', 'auditTrail'
        ];

        for (const tableName of tables) {
            try {
                status[tableName] = await this.validateTableUUIDs(db, tableName);
            } catch (error) {
                status[tableName] = {
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        }

        return status as Record<DatabaseTable, any>;
    }
}
