/**
 * 企業級結構化日誌系統 (Phase 2.6)
 * 
 * 提供結構化、可配置和高性能的日誌記錄功能，適用於企業級應用程序。
 * 
 * 核心功能：
 * - 多重日誌等級與過濾機制
 * - 可插拔格式化器 (JSON, Simple, Custom)
 * - 多重輸出目標 (Console, File, Custom)
 * - 批次處理以提升性能
 * - 錯誤恢復能力和優雅降級
 * - 請求關聯和分散式追蹤支持
 * - 與統一錯誤處理系統集成
 * 
 * @example
 * ```typescript
 * const logger = new StructuredLogger({
 *   minLevel: LogLevel.INFO,
 *   targets: [
 *     new ConsoleTarget(),
 *     new FileTarget('/tmp/app.log')
 *   ],
 *   formatter: new JsonFormatter()
 * });
 * 
 * logger.info('User created', { userId: '123', email: 'user@example.com' });
 * logger.error('Operation failed', { error: error.message, stack: error.stack });
 * ```
 */

/**
 * Log severity levels
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

/**
 * Structured log entry
 */
export interface LogEntry {
    /** Unique identifier for this log entry */
    id: string;
    /** Timestamp when the log was created */
    timestamp: Date;
    /** Log severity level */
    level: LogLevel;
    /** Primary log message */
    message: string;
    /** Additional structured metadata */
    metadata: Record<string, any>;
    /** Correlation ID for request tracing */
    correlationId?: string;
}

/**
 * Log formatter interface
 */
export interface LogFormatter {
    format(entry: LogEntry): string;
}

/**
 * Log filter function type
 */
export type LogFilter = (entry: LogEntry) => boolean;

/**
 * Log target interface for output destinations
 */
export interface LogTarget {
    write(entry: LogEntry, formattedMessage: string): void;
}

/**
 * Configuration for logger target with specific formatter
 */
export interface LoggerTargetConfig {
    target: LogTarget;
    formatter?: LogFormatter;
}

/**
 * Structured logger configuration options
 */
export interface StructuredLoggerConfig {
    /** Minimum log level to process */
    minLevel?: LogLevel;
    /** Custom log filter function */
    filter?: LogFilter;
    /** Default formatter for all targets */
    formatter?: LogFormatter;
    /** Log output targets */
    targets?: (LogTarget | LoggerTargetConfig)[];
    /** Batch size for performance optimization */
    batchSize?: number;
    /** Flush interval for batched logs (ms) */
    flushInterval?: number;
    /** Error handler for target failures */
    onError?: (error: Error) => void;
}

/**
 * JSON log formatter
 * 
 * Formats log entries as JSON strings for structured logging systems
 */
export class JsonFormatter implements LogFormatter {
    /**
     * Format log entry as JSON string
     * 
     * @param entry - Log entry to format
     * @returns JSON formatted string
     */
    format(entry: LogEntry): string {
        const logObject = {
            id: entry.id,
            timestamp: entry.timestamp.toISOString(),
            level: LogLevel[entry.level],
            message: entry.message,
            correlationId: entry.correlationId,
            metadata: entry.metadata
        };

        return JSON.stringify(logObject);
    }
}/**
 * Simple human-readable log formatter
 * 
 * Formats log entries as human-readable strings suitable for console output
 */
export class SimpleFormatter implements LogFormatter {
    /**
     * Format log entry as human-readable string
     * 
     * @param entry - Log entry to format
     * @returns Formatted string
     */
    format(entry: LogEntry): string {
        const timestamp = entry.timestamp.toISOString();
        const level = LogLevel[entry.level];
        const metadataStr = this.formatMetadata(entry.metadata);
        const correlation = entry.correlationId ? ` [${entry.correlationId}]` : '';

        return `${timestamp} [${level}]${correlation} ${entry.message}${metadataStr}`;
    }

    /**
     * Format metadata as key=value pairs
     * 
     * @param metadata - Metadata object
     * @returns Formatted metadata string
     */
    private formatMetadata(metadata: Record<string, any>): string {
        const entries = Object.entries(metadata);
        if (entries.length === 0) return '';

        const pairs = entries.map(([key, value]) => `${key}=${value}`);
        return ` | ${pairs.join(', ')}`;
    }
}

/**
 * Console log target
 * 
 * Outputs logs to console using appropriate console methods for each log level
 */
export class ConsoleTarget implements LogTarget {
    private consoleInstance: any;

    constructor(consoleOverride?: any) {
        this.consoleInstance = consoleOverride || console;
    }

    /**
     * Write formatted log message to console
     * 
     * @param entry - Log entry being written
     * @param formattedMessage - Already formatted log message
     */
    write(entry: LogEntry, formattedMessage: string): void {
        switch (entry.level) {
            case LogLevel.DEBUG:
                this.consoleInstance.debug(formattedMessage);
                break;
            case LogLevel.INFO:
                this.consoleInstance.info(formattedMessage);
                break;
            case LogLevel.WARN:
                this.consoleInstance.warn(formattedMessage);
                break;
            case LogLevel.ERROR:
                this.consoleInstance.error(formattedMessage);
                break;
            default:
                this.consoleInstance.log(formattedMessage);
        }
    }
}/**
 * File system interface for dependency injection
 */
interface FileSystem {
    appendFileSync(path: string, data: string): void;
    existsSync?(path: string): boolean;
    statSync?(path: string): { size: number };
    renameSync?(oldPath: string, newPath: string): void;
}

/**
 * File target configuration
 */
interface FileTargetConfig {
    /** Maximum file size before rotation (bytes) */
    maxSize?: number;
    /** File system implementation (for testing) */
    fs?: FileSystem;
}

/**
 * File log target
 * 
 * Outputs logs to files with rotation support
 */
export class FileTarget implements LogTarget {
    private fs: FileSystem;
    private maxSize: number;

    constructor(
        private filePath: string,
        config: FileTargetConfig = {}
    ) {
        this.maxSize = config.maxSize || 10 * 1024 * 1024; // 10MB default
        this.fs = config.fs || require('fs');
    }

    /**
     * Write log entry to file
     * 
     * @param entry - Log entry
     * @param formattedMessage - Pre-formatted message
     */
    write(entry: LogEntry, formattedMessage: string): void {
        this.checkRotation();
        this.fs.appendFileSync(this.filePath, formattedMessage);
    }

    /**
     * Check if file rotation is needed and perform rotation
     */
    private checkRotation(): void {
        if (!this.fs.existsSync || !this.fs.statSync || !this.fs.renameSync) {
            return; // Skip rotation if FS methods not available
        }

        if (this.fs.existsSync(this.filePath)) {
            const stats = this.fs.statSync(this.filePath);
            if (stats.size > this.maxSize) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const rotatedPath = `${this.filePath}.${timestamp}`;
                this.fs.renameSync(this.filePath, rotatedPath);
            }
        }
    }
}

/**
 * Batched log entry for performance optimization
 */
interface BatchedLogEntry {
    entry: LogEntry;
    formattedMessage: string;
    target: LogTarget;
}

/**
 * Main structured logger class
 * 
 * Provides centralized logging with configurable formatting, filtering,
 * and output targets. Supports batching for performance and error resilience.
 */
export class StructuredLogger {
    private config: Required<StructuredLoggerConfig>;
    private batch: BatchedLogEntry[] = [];
    private flushTimer?: NodeJS.Timeout;

    constructor(config: StructuredLoggerConfig = {}) {
        this.config = {
            minLevel: config.minLevel || LogLevel.DEBUG,
            filter: config.filter || (() => true),
            formatter: config.formatter || new JsonFormatter(),
            targets: config.targets || [new ConsoleTarget()],
            batchSize: config.batchSize || 1, // No batching by default
            flushInterval: config.flushInterval || 1000,
            onError: config.onError || ((error) => console.error('Logger error:', error))
        };
    }

    /**
     * Log debug message
     * 
     * @param message - Log message
     * @param metadata - Additional structured data
     * @returns Log entry if processed, null if filtered
     */
    debug(message: string, metadata: Record<string, any> = {}): LogEntry | null {
        return this.log(LogLevel.DEBUG, message, metadata);
    }

    /**
     * Log info message
     * 
     * @param message - Log message
     * @param metadata - Additional structured data
     * @returns Log entry if processed, null if filtered
     */
    info(message: string, metadata: Record<string, any> = {}): LogEntry | null {
        return this.log(LogLevel.INFO, message, metadata);
    }

    /**
     * Log warning message
     * 
     * @param message - Log message
     * @param metadata - Additional structured data
     * @returns Log entry if processed, null if filtered
     */
    warn(message: string, metadata: Record<string, any> = {}): LogEntry | null {
        return this.log(LogLevel.WARN, message, metadata);
    }

    /**
     * Log error message
     * 
     * @param message - Log message
     * @param metadata - Additional structured data
     * @returns Log entry if processed, null if filtered
     */
    error(message: string, metadata: Record<string, any> = {}): LogEntry | null {
        return this.log(LogLevel.ERROR, message, metadata);
    }

    /**
     * Core logging method
     * 
     * @param level - Log level
     * @param message - Log message
     * @param metadata - Additional structured data
     * @returns Log entry if processed, null if filtered
     */
    private log(level: LogLevel, message: string, metadata: Record<string, any>): LogEntry | null {
        // Apply level and custom filtering
        if (level < this.config.minLevel) {
            return null;
        }

        const entry: LogEntry = {
            id: this.generateId(),
            timestamp: new Date(),
            level,
            message,
            metadata,
            correlationId: metadata.correlationId
        };

        if (!this.config.filter(entry)) {
            return null;
        }

        this.processLogEntry(entry);
        return entry;
    }

    /**
     * Process log entry through configured targets
     * 
     * @param entry - Log entry to process
     */
    private processLogEntry(entry: LogEntry): void {
        const targets = this.normalizeTargets();

        for (const targetConfig of targets) {
            try {
                const formatted = targetConfig.formatter.format(entry);

                if (this.config.batchSize > 1) {
                    this.addToBatch({
                        entry,
                        formattedMessage: formatted,
                        target: targetConfig.target
                    });
                } else {
                    targetConfig.target.write(entry, formatted);
                }
            } catch (error) {
                this.config.onError(error as Error);
            }
        }
    }

    /**
     * Add log entry to batch for later processing
     * 
     * @param batchEntry - Batched log entry
     */
    private addToBatch(batchEntry: BatchedLogEntry): void {
        this.batch.push(batchEntry);

        if (this.batch.length >= this.config.batchSize) {
            this.flushBatch();
        } else if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => {
                this.flushBatch();
            }, this.config.flushInterval);
        }
    }

    /**
     * Flush batched log entries to targets
     */
    private flushBatch(): void {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = undefined;
        }

        const entriesToFlush = [...this.batch];
        this.batch = [];

        for (const batchEntry of entriesToFlush) {
            try {
                batchEntry.target.write(batchEntry.entry, batchEntry.formattedMessage);
            } catch (error) {
                this.config.onError(error as Error);
            }
        }
    }

    /**
     * Normalize targets configuration to consistent format
     * 
     * @returns Normalized target configurations
     */
    private normalizeTargets(): Array<{ target: LogTarget; formatter: LogFormatter }> {
        return this.config.targets.map(targetOrConfig => {
            if ('target' in targetOrConfig) {
                return {
                    target: targetOrConfig.target,
                    formatter: targetOrConfig.formatter || this.config.formatter
                };
            } else {
                return {
                    target: targetOrConfig,
                    formatter: this.config.formatter
                };
            }
        });
    }

    /**
     * Generate unique ID for log entry
     * 
     * @returns Unique identifier string
     */
    private generateId(): string {
        return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
