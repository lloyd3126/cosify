import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
    StructuredLogger,
    LogLevel,
    LogEntry,
    LogFormatter,
    LogFilter,
    LogTarget,
    ConsoleTarget,
    FileTarget,
    JsonFormatter,
    SimpleFormatter
} from '../../src/server/services/structured-logger.js';

describe('Structured Logging System', () => {
    describe('🔴 Red Phase: Log Entry Creation and Structure', () => {
        describe('Log Entry Validation', () => {
            it('should create valid log entry with required fields', () => {
                const logger = new StructuredLogger();
                const entry = logger.info('Test message');

                expect(entry).toBeDefined();
                expect(entry.timestamp).toBeInstanceOf(Date);
                expect(entry.level).toBe(LogLevel.INFO);
                expect(entry.message).toBe('Test message');
                expect(entry.metadata).toBeDefined();
                expect(typeof entry.id).toBe('string');
                expect(entry.id.length).toBeGreaterThan(0);
            });

            it('should create log entry with custom metadata', () => {
                const logger = new StructuredLogger();
                const metadata = { userId: '123', operation: 'login' };
                const entry = logger.info('User login', metadata);

                expect(entry.metadata).toEqual(expect.objectContaining(metadata));
                expect(entry.metadata.userId).toBe('123');
                expect(entry.metadata.operation).toBe('login');
            });

            it('should support different log levels', () => {
                const logger = new StructuredLogger();

                const debugEntry = logger.debug('Debug message');
                const infoEntry = logger.info('Info message');
                const warnEntry = logger.warn('Warning message');
                const errorEntry = logger.error('Error message');

                expect(debugEntry.level).toBe(LogLevel.DEBUG);
                expect(infoEntry.level).toBe(LogLevel.INFO);
                expect(warnEntry.level).toBe(LogLevel.WARN);
                expect(errorEntry.level).toBe(LogLevel.ERROR);
            });

            it('should include correlation ID in log entries', () => {
                const logger = new StructuredLogger();
                const correlationId = 'test-correlation-123';

                const entry = logger.info('Test message', { correlationId });

                expect(entry.correlationId).toBe(correlationId);
                expect(entry.metadata.correlationId).toBe(correlationId);
            });
        });

        describe('Log Levels and Filtering', () => {
            it('should filter logs based on minimum level', () => {
                const logger = new StructuredLogger({ minLevel: LogLevel.WARN });

                const debugEntry = logger.debug('Debug message');
                const infoEntry = logger.info('Info message');
                const warnEntry = logger.warn('Warning message');
                const errorEntry = logger.error('Error message');

                expect(debugEntry).toBeNull();
                expect(infoEntry).toBeNull();
                expect(warnEntry).toBeDefined();
                expect(errorEntry).toBeDefined();
            });

            it('should support custom log level filtering', () => {
                const customFilter: LogFilter = (entry) => {
                    return entry.level === LogLevel.ERROR ||
                        (entry.metadata?.critical === true);
                };

                const logger = new StructuredLogger({ filter: customFilter });

                const infoEntry = logger.info('Info message');
                const errorEntry = logger.error('Error message');
                const criticalInfo = logger.info('Critical info', { critical: true });

                expect(infoEntry).toBeNull();
                expect(errorEntry).toBeDefined();
                expect(criticalInfo).toBeDefined();
            });

            it('should validate log level hierarchy', () => {
                expect(LogLevel.DEBUG).toBeLessThan(LogLevel.INFO);
                expect(LogLevel.INFO).toBeLessThan(LogLevel.WARN);
                expect(LogLevel.WARN).toBeLessThan(LogLevel.ERROR);
            });
        });
    });

    describe('🔴 Red Phase: Log Formatters', () => {
        describe('JSON Formatter', () => {
            it('should format log entry as valid JSON', () => {
                const formatter = new JsonFormatter();
                const entry: LogEntry = {
                    id: 'test-id',
                    timestamp: new Date('2025-09-08T12:00:00Z'),
                    level: LogLevel.INFO,
                    message: 'Test message',
                    metadata: { userId: '123' }
                };

                const formatted = formatter.format(entry);
                const parsed = JSON.parse(formatted);

                expect(parsed.id).toBe('test-id');
                expect(parsed.level).toBe('INFO');
                expect(parsed.message).toBe('Test message');
                expect(parsed.metadata.userId).toBe('123');
                expect(parsed.timestamp).toBe('2025-09-08T12:00:00.000Z');
            });

            it('should handle special characters and escape properly', () => {
                const formatter = new JsonFormatter();
                const entry: LogEntry = {
                    id: 'test-id',
                    timestamp: new Date(),
                    level: LogLevel.INFO,
                    message: 'Message with "quotes" and \n newlines',
                    metadata: { special: 'value with \t tabs' }
                };

                const formatted = formatter.format(entry);
                expect(() => JSON.parse(formatted)).not.toThrow();

                const parsed = JSON.parse(formatted);
                expect(parsed.message).toBe('Message with "quotes" and \n newlines');
                expect(parsed.metadata.special).toBe('value with \t tabs');
            });
        });

        describe('Simple Formatter', () => {
            it('should format log entry as human-readable string', () => {
                const formatter = new SimpleFormatter();
                const entry: LogEntry = {
                    id: 'test-id',
                    timestamp: new Date('2025-09-08T12:00:00Z'),
                    level: LogLevel.WARN,
                    message: 'Warning message',
                    metadata: { userId: '123', operation: 'delete' }
                };

                const formatted = formatter.format(entry);

                expect(formatted).toContain('2025-09-08T12:00:00.000Z');
                expect(formatted).toContain('[WARN]');
                expect(formatted).toContain('Warning message');
                expect(formatted).toContain('userId=123');
                expect(formatted).toContain('operation=delete');
            });

            it('should handle entries without metadata', () => {
                const formatter = new SimpleFormatter();
                const entry: LogEntry = {
                    id: 'test-id',
                    timestamp: new Date('2025-09-08T12:00:00Z'),
                    level: LogLevel.INFO,
                    message: 'Simple message',
                    metadata: {}
                };

                const formatted = formatter.format(entry);

                expect(formatted).toContain('[INFO]');
                expect(formatted).toContain('Simple message');
                expect(formatted).not.toContain('{}');
            });
        });

        describe('Custom Formatter', () => {
            it('should support custom formatting functions', () => {
                const customFormatter: LogFormatter = {
                    format: (entry) => {
                        return `[${LogLevel[entry.level]}] ${entry.message} | ID: ${entry.id}`;
                    }
                };

                const entry: LogEntry = {
                    id: 'test-123',
                    timestamp: new Date(),
                    level: LogLevel.ERROR,
                    message: 'Custom format test',
                    metadata: {}
                };

                const formatted = customFormatter.format(entry);
                expect(formatted).toBe('[ERROR] Custom format test | ID: test-123');
            });
        });
    });

    describe('🔴 Red Phase: Log Targets and Output', () => {
        describe('Console Target', () => {
            it('should output to console with correct format', () => {
                const consoleOutput: string[] = [];
                const mockConsole = {
                    log: (message: string) => consoleOutput.push(`LOG: ${message}`),
                    debug: (message: string) => consoleOutput.push(`DEBUG: ${message}`),
                    info: (message: string) => consoleOutput.push(`INFO: ${message}`),
                    warn: (message: string) => consoleOutput.push(`WARN: ${message}`),
                    error: (message: string) => consoleOutput.push(`ERROR: ${message}`)
                };

                const target = new ConsoleTarget(mockConsole);
                const entry: LogEntry = {
                    id: 'test-id',
                    timestamp: new Date(),
                    level: LogLevel.INFO,
                    message: 'Console test',
                    metadata: {}
                };

                target.write(entry, 'formatted message');
                expect(consoleOutput).toHaveLength(1);
                expect(consoleOutput[0]).toBe('INFO: formatted message');
            });

            it('should use appropriate console method for log level', () => {
                const consoleOutput: Array<{ method: string, message: string }> = [];
                const mockConsole = {
                    log: (msg: string) => consoleOutput.push({ method: 'log', message: msg }),
                    debug: (msg: string) => consoleOutput.push({ method: 'debug', message: msg }),
                    info: (msg: string) => consoleOutput.push({ method: 'info', message: msg }),
                    warn: (msg: string) => consoleOutput.push({ method: 'warn', message: msg }),
                    error: (msg: string) => consoleOutput.push({ method: 'error', message: msg })
                };

                const target = new ConsoleTarget(mockConsole);

                target.write({ id: '1', timestamp: new Date(), level: LogLevel.INFO, message: 'info', metadata: {} }, 'info msg');
                target.write({ id: '2', timestamp: new Date(), level: LogLevel.WARN, message: 'warn', metadata: {} }, 'warn msg');
                target.write({ id: '3', timestamp: new Date(), level: LogLevel.ERROR, message: 'error', metadata: {} }, 'error msg');

                expect(consoleOutput).toHaveLength(3);
                expect(consoleOutput[0].method).toBe('info');
                expect(consoleOutput[1].method).toBe('warn');
                expect(consoleOutput[2].method).toBe('error');
            });
        });

        describe('File Target', () => {
            it('should write to file with rotation support', () => {
                const fileWrites: Array<{ path: string, content: string }> = [];
                const mockFs = {
                    appendFileSync: (path: string, content: string) => {
                        fileWrites.push({ path, content });
                    },
                    existsSync: () => false,
                    statSync: () => ({ size: 1000 })
                };

                const target = new FileTarget('/tmp/test.log', {
                    maxSize: 5000,
                    fs: mockFs
                });

                const entry: LogEntry = {
                    id: 'test-id',
                    timestamp: new Date(),
                    level: LogLevel.INFO,
                    message: 'File test',
                    metadata: {}
                };

                target.write(entry, 'formatted file message\n');
                expect(fileWrites).toHaveLength(1);
                expect(fileWrites[0].path).toBe('/tmp/test.log');
                expect(fileWrites[0].content).toBe('formatted file message\n');
            });

            it('should handle file rotation when size limit exceeded', () => {
                const fileWrites: Array<{ path: string, content: string }> = [];
                const renamedFiles: Array<{ from: string, to: string }> = [];

                const mockFs = {
                    appendFileSync: (path: string, content: string) => {
                        fileWrites.push({ path, content });
                    },
                    existsSync: () => true,
                    statSync: () => ({ size: 6000 }), // Exceeds 5000 limit
                    renameSync: (from: string, to: string) => {
                        renamedFiles.push({ from, to });
                    }
                };

                const target = new FileTarget('/tmp/test.log', {
                    maxSize: 5000,
                    fs: mockFs
                });

                const entry: LogEntry = {
                    id: 'test-id',
                    timestamp: new Date(),
                    level: LogLevel.INFO,
                    message: 'File rotation test',
                    metadata: {}
                };

                target.write(entry, 'rotation test message\n');

                expect(renamedFiles).toHaveLength(1);
                expect(renamedFiles[0].from).toBe('/tmp/test.log');
                expect(renamedFiles[0].to).toContain('/tmp/test.log.');
            });
        });
    });

    describe('🔴 Red Phase: Logger Integration and Configuration', () => {
        describe('Logger Configuration', () => {
            it('should support multiple targets configuration', () => {
                const consoleOutput: string[] = [];
                const fileWrites: Array<{ path: string, content: string }> = [];

                const mockConsole = {
                    log: (msg: string) => consoleOutput.push(msg),
                    debug: (msg: string) => consoleOutput.push(msg),
                    info: (msg: string) => consoleOutput.push(msg),
                    warn: (msg: string) => consoleOutput.push(msg),
                    error: (msg: string) => consoleOutput.push(msg)
                };

                const mockFs = {
                    appendFileSync: (path: string, content: string) => {
                        fileWrites.push({ path, content });
                    }
                };

                const logger = new StructuredLogger({
                    targets: [
                        new ConsoleTarget(mockConsole),
                        new FileTarget('/tmp/app.log', { fs: mockFs })
                    ],
                    formatter: new SimpleFormatter()
                });

                logger.info('Multi-target test');

                expect(consoleOutput).toHaveLength(1);
                expect(fileWrites).toHaveLength(1);
                expect(fileWrites[0].path).toBe('/tmp/app.log');
            });

            it('should support different formatters for different targets', () => {
                const consoleOutput: string[] = [];
                const fileWrites: Array<{ path: string, content: string }> = [];

                const logger = new StructuredLogger({
                    targets: [
                        {
                            target: new ConsoleTarget({
                                log: (msg: string) => consoleOutput.push(msg),
                                debug: (msg: string) => consoleOutput.push(msg),
                                info: (msg: string) => consoleOutput.push(msg),
                                warn: (msg: string) => consoleOutput.push(msg),
                                error: (msg: string) => consoleOutput.push(msg)
                            }),
                            formatter: new SimpleFormatter()
                        },
                        {
                            target: new FileTarget('/tmp/app.json', {
                                fs: {
                                    appendFileSync: (path: string, content: string) => {
                                        fileWrites.push({ path, content });
                                    }
                                }
                            }),
                            formatter: new JsonFormatter()
                        }
                    ]
                });

                logger.info('Format test', { key: 'value' });

                expect(consoleOutput[0]).toContain('[INFO]');
                expect(consoleOutput[0]).toContain('Format test');

                const fileContent = JSON.parse(fileWrites[0].content);
                expect(fileContent.level).toBe('INFO');
                expect(fileContent.message).toBe('Format test');
                expect(fileContent.metadata.key).toBe('value');
            });
        });

        describe('Error Handling and Resilience', () => {
            it('should handle target write failures gracefully', () => {
                const errors: string[] = [];
                const failingTarget = {
                    write: () => {
                        throw new Error('Target write failed');
                    }
                };

                const logger = new StructuredLogger({
                    targets: [failingTarget],
                    onError: (error) => errors.push(error.message)
                });

                expect(() => logger.info('Test message')).not.toThrow();
                expect(errors).toHaveLength(1);
                expect(errors[0]).toBe('Target write failed');
            });

            it('should continue writing to working targets when one fails', () => {
                const workingOutput: string[] = [];
                const errors: string[] = [];

                const workingTarget = {
                    write: (entry: LogEntry, formatted: string) => {
                        workingOutput.push(formatted);
                    }
                };

                const failingTarget = {
                    write: () => {
                        throw new Error('Failed target');
                    }
                };

                const logger = new StructuredLogger({
                    targets: [workingTarget, failingTarget],
                    formatter: new SimpleFormatter(),
                    onError: (error) => errors.push(error.message)
                });

                logger.info('Resilience test');

                expect(workingOutput).toHaveLength(1);
                expect(errors).toHaveLength(1);
                expect(workingOutput[0]).toContain('Resilience test');
            });
        });

        describe('Performance and Memory Management', () => {
            it('should batch log writes for performance', () => {
                const writeCount = { count: 0 };
                const batchTarget = {
                    write: () => {
                        writeCount.count++;
                    }
                };

                const logger = new StructuredLogger({
                    targets: [batchTarget],
                    batchSize: 3,
                    flushInterval: 100
                });

                logger.info('Message 1');
                logger.info('Message 2');

                // Should not have written yet (batch size not reached)
                expect(writeCount.count).toBe(0);

                logger.info('Message 3');

                // Should now write batch
                expect(writeCount.count).toBe(3);
            });

            it('should auto-flush batches after timeout', (done) => {
                const writeCount = { count: 0 };
                const batchTarget = {
                    write: () => {
                        writeCount.count++;
                    }
                };

                const logger = new StructuredLogger({
                    targets: [batchTarget],
                    batchSize: 10,
                    flushInterval: 50
                });

                logger.info('Timeout test');

                setTimeout(() => {
                    expect(writeCount.count).toBe(1);
                    done();
                }, 100);
            });
        });
    });

    describe('🔴 Red Phase: Integration with Error Handling', () => {
        describe('Error Context Logging', () => {
            it('should log errors with full stack trace and context', () => {
                const logEntries: LogEntry[] = [];
                const mockTarget = {
                    write: (entry: LogEntry) => {
                        logEntries.push(entry);
                    }
                };

                const logger = new StructuredLogger({
                    targets: [mockTarget]
                });

                const error = new Error('Test error');
                logger.error('Operation failed', {
                    error: error.message,
                    stack: error.stack,
                    userId: '123',
                    operation: 'user-update'
                });

                expect(logEntries).toHaveLength(1);
                expect(logEntries[0].level).toBe(LogLevel.ERROR);
                expect(logEntries[0].metadata.error).toBe('Test error');
                expect(logEntries[0].metadata.stack).toBeDefined();
                expect(logEntries[0].metadata.userId).toBe('123');
            });

            it('should integrate with unified error handling middleware', () => {
                const logEntries: LogEntry[] = [];
                const mockTarget = {
                    write: (entry: LogEntry) => {
                        logEntries.push(entry);
                    }
                };

                const logger = new StructuredLogger({
                    targets: [mockTarget]
                });

                // Simulate error from unified error handler
                const errorContext = {
                    errorId: 'ERR_001',
                    statusCode: 400,
                    userMessage: 'Invalid input',
                    internalError: 'Validation failed: missing required field',
                    requestId: 'req_123',
                    userId: 'user_456'
                };

                logger.error('Request validation failed', errorContext);

                expect(logEntries).toHaveLength(1);
                expect(logEntries[0].metadata.errorId).toBe('ERR_001');
                expect(logEntries[0].metadata.statusCode).toBe(400);
                expect(logEntries[0].metadata.requestId).toBe('req_123');
            });
        });

        describe('Request/Response Logging', () => {
            it('should log HTTP requests with structured format', () => {
                const logEntries: LogEntry[] = [];
                const mockTarget = {
                    write: (entry: LogEntry) => {
                        logEntries.push(entry);
                    }
                };

                const logger = new StructuredLogger({
                    targets: [mockTarget]
                });

                const requestContext = {
                    method: 'POST',
                    url: '/api/users',
                    statusCode: 201,
                    responseTime: 125,
                    userAgent: 'Mozilla/5.0...',
                    ip: '192.168.1.1',
                    userId: 'user_123'
                };

                logger.info('HTTP Request completed', requestContext);

                expect(logEntries).toHaveLength(1);
                expect(logEntries[0].metadata.method).toBe('POST');
                expect(logEntries[0].metadata.statusCode).toBe(201);
                expect(logEntries[0].metadata.responseTime).toBe(125);
            });

            it('should support request correlation across services', () => {
                const logEntries: LogEntry[] = [];
                const mockTarget = {
                    write: (entry: LogEntry) => {
                        logEntries.push(entry);
                    }
                };

                const logger = new StructuredLogger({
                    targets: [mockTarget]
                });

                const correlationId = 'corr_123_456';

                logger.info('Service A: Processing request', {
                    correlationId,
                    service: 'user-service',
                    operation: 'create-user'
                });

                logger.info('Service B: Database operation', {
                    correlationId,
                    service: 'database-service',
                    operation: 'insert-user'
                });

                expect(logEntries).toHaveLength(2);
                expect(logEntries[0].correlationId).toBe(correlationId);
                expect(logEntries[1].correlationId).toBe(correlationId);
                expect(logEntries[0].metadata.service).toBe('user-service');
                expect(logEntries[1].metadata.service).toBe('database-service');
            });
        });
    });
});
