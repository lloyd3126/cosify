/**
 * Input Validator Service
 * Phase 1.8 from Plan 10: TDD Green Phase
 * 
 * Comprehensive input validation and data sanitization
 */

export interface ValidationRule {
    type: 'string' | 'number' | 'email' | 'url' | 'phone' | 'date';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: any) => boolean | string;
}

export interface SanitizationOptions {
    trim?: boolean;
    removeHtml?: boolean;
    escapeHtml?: boolean;
    normalizeUnicode?: boolean;
    removeDangerousPatterns?: boolean;
    toLowerCase?: boolean;
    toUpperCase?: boolean;
}

export interface ObjectValidationRules {
    [key: string]: ValidationRule[];
}

export interface ObjectSanitizationOptions {
    [key: string]: SanitizationOptions;
}

export class InputValidator {
    // SQL Injection patterns
    private readonly sqlInjectionPatterns = [
        /(\s|^)(union|select|insert|update|delete|drop|create|alter|exec|execute)\s/gi,
        /(\s|^)(or|and)\s+\d+\s*=\s*\d+/gi,
        /(\s|^)(or|and)\s+['"]\w+['\"]\s*=\s*['"]\w+['"]/gi,
        /['";]\s*(--|#|\/\*)/gi,
        /\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b.*\b(from|into|where|set|values)\b/gi,
        /['"]\s*;\s*(drop|delete|update|insert)\s/gi,
        /['"]\s*--/gi,
        /'\s*(or|and)\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?/gi
    ];

    // XSS patterns
    private readonly xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
        /javascript:/gi,
        /on\w+\s*=\s*["'][^"']*["']/gi,
        /<img[^>]+src\s*=\s*["']?[^"'\s>]*javascript:/gi,
        /<[^>]*\s(onerror|onload|onclick|onmouseover)\s*=/gi
    ];

    // Path traversal patterns
    private readonly pathTraversalPatterns = [
        /\.\.[\/\\]/g,
        /%2e%2e[\/\\]/gi,
        /\.\.%2f/gi,
        /\.\.%5c/gi,
        /\.\.\\/g,
        /\.\.%5c%5c/gi,
        /\.\.\/\.\.\/\.\./g,
        /\.{4,}[\/\\]/g,
        /%2e%2e%2f/gi
    ];

    // Command injection patterns
    private readonly commandInjectionPatterns = [
        /[;&|`$\(\)]/g,
        /\b(cat|ls|pwd|id|whoami|uname|wget|curl|rm|mv|cp|chmod|chown)\b/gi,
        /(\||&|\;|\$\(|\`)/g
    ];

    // Dangerous patterns for general sanitization
    private readonly dangerousPatterns = [
        /javascript:/gi,
        /vbscript:/gi,
        /data:text\/html/gi,
        /<[^>]*>/g, // All HTML tags for general sanitization
        /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g // Control characters
    ];

    /**
     * Validate input against basic constraints
     */
    validate(input: any, rules?: ValidationRule[]): boolean {
        if (input === null || input === undefined) {
            throw new Error('Input cannot be null or undefined');
        }

        if (!rules || rules.length === 0) {
            return true;
        }

        for (const rule of rules) {
            this.validateAgainstRule(input, rule);
        }

        return true;
    }

    /**
     * Validate input against security threats
     */
    validateSecurity(input: string): boolean {
        if (typeof input !== 'string') {
            return true;
        }

        // Check for SQL injection
        for (const pattern of this.sqlInjectionPatterns) {
            if (pattern.test(input)) {
                throw new Error('Potential SQL injection detected');
            }
        }

        // Check for XSS
        for (const pattern of this.xssPatterns) {
            if (pattern.test(input)) {
                throw new Error('Potential XSS attack detected');
            }
        }

        // Check for path traversal
        for (const pattern of this.pathTraversalPatterns) {
            if (pattern.test(input)) {
                throw new Error('Potential path traversal detected');
            }
        }

        // Check for command injection
        for (const pattern of this.commandInjectionPatterns) {
            if (pattern.test(input)) {
                throw new Error('Potential command injection detected');
            }
        }

        return true;
    }

    /**
     * Sanitize input data
     */
    sanitize(input: string, options: SanitizationOptions = {}): string {
        if (typeof input !== 'string') {
            return input;
        }

        let result = input;

        // Trim whitespace
        if (options.trim) {
            result = result.trim();
        }

        // Remove HTML tags
        if (options.removeHtml) {
            // First remove script and style content completely
            result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            result = result.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
            // Then remove all other HTML tags
            result = result.replace(/<[^>]*>/g, '');
        }

        // Escape HTML characters
        if (options.escapeHtml) {
            result = result
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;');
        }

        // Normalize Unicode
        if (options.normalizeUnicode) {
            result = result.normalize('NFKC');
        }

        // Remove dangerous patterns
        if (options.removeDangerousPatterns) {
            // Remove javascript: protocol and content after it
            result = result.replace(/javascript:[^;\s]*/gi, '');
            result = result.replace(/vbscript:[^;\s]*/gi, '');
            result = result.replace(/data:text\/html[^;\s]*/gi, '');
            // Remove control characters
            result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
            // Clean up extra spaces
            result = result.replace(/\s+/g, ' ').trim();
        }

        // Case conversion
        if (options.toLowerCase) {
            result = result.toLowerCase();
        } else if (options.toUpperCase) {
            result = result.toUpperCase();
        }

        return result;
    }

    /**
     * Validate and sanitize object with multiple fields
     */
    validateAndSanitizeObject(
        data: Record<string, any>,
        validationRules: ObjectValidationRules,
        sanitizationOptions: ObjectSanitizationOptions = {}
    ): Record<string, any> {
        const result: Record<string, any> = {};

        for (const [key, value] of Object.entries(data)) {
            let processedValue = value;

            // Apply sanitization first
            if (typeof value === 'string' && sanitizationOptions[key]) {
                processedValue = this.sanitize(value, sanitizationOptions[key]);
            }

            // Then apply security validation on sanitized value
            if (typeof processedValue === 'string') {
                this.validateSecurity(processedValue);
            }

            // Apply validation rules
            if (validationRules[key]) {
                this.validate(processedValue, validationRules[key]);
            }

            result[key] = processedValue;
        }

        return result;
    }

    /**
     * Validate nested object using dot notation
     */
    validateNestedObject(data: any, rules: Record<string, ValidationRule[]>): boolean {
        for (const [path, validationRules] of Object.entries(rules)) {
            const value = this.getNestedValue(data, path);

            if (typeof value === 'string') {
                this.validateSecurity(value);
            }

            this.validate(value, validationRules);
        }

        return true;
    }

    /**
     * Validate array of inputs
     */
    validateArray(inputs: any[], rules: ValidationRule[]): boolean {
        for (const input of inputs) {
            if (typeof input === 'string') {
                this.validateSecurity(input);
            }
            this.validate(input, rules);
        }

        return true;
    }

    /**
     * Validate file names for upload security
     */
    validateFileName(fileName: string): boolean {
        if (typeof fileName !== 'string') {
            throw new Error('File name must be a string');
        }

        // Check for path traversal
        if (this.pathTraversalPatterns.some(pattern => pattern.test(fileName))) {
            throw new Error('Invalid file name: path traversal detected');
        }

        // Check for dangerous extensions
        const dangerousExtensions = [
            '.php', '.asp', '.aspx', '.jsp', '.js', '.vbs', '.bat', '.cmd',
            '.exe', '.scr', '.pif', '.com', '.htaccess', '.htpasswd'
        ];

        const lowerFileName = fileName.toLowerCase();
        if (dangerousExtensions.some(ext => lowerFileName.endsWith(ext))) {
            throw new Error('Invalid file name: dangerous file extension');
        }

        // Check for hidden files that could be dangerous
        if (fileName.startsWith('.') && !fileName.match(/^\.[a-zA-Z0-9_-]+\.(jpg|jpeg|png|gif|pdf|txt|doc|docx)$/)) {
            throw new Error('Invalid file name: hidden file not allowed');
        }

        // Check for specific dangerous file names
        const dangerousNames = ['.htaccess', 'web.config'];
        if (dangerousNames.includes(lowerFileName)) {
            throw new Error('Invalid file name: system file not allowed');
        }

        return true;
    }

    /**
     * Private helper methods
     */
    private validateAgainstRule(input: any, rule: ValidationRule): void {
        switch (rule.type) {
            case 'string':
                this.validateString(input, rule);
                break;
            case 'number':
                this.validateNumber(input, rule);
                break;
            case 'email':
                this.validateEmail(input);
                break;
            case 'url':
                this.validateUrl(input);
                break;
            case 'phone':
                this.validatePhone(input);
                break;
            case 'date':
                this.validateDate(input);
                break;
            default:
                throw new Error(`Unsupported validation type: ${rule.type}`);
        }

        // Custom validation
        if (rule.custom) {
            const result = rule.custom(input);
            if (result !== true) {
                throw new Error(typeof result === 'string' ? result : 'Custom validation failed');
            }
        }
    }

    private validateString(input: any, rule: ValidationRule): void {
        if (typeof input !== 'string') {
            throw new Error('Input must be a string');
        }

        if (rule.minLength !== undefined && input.length < rule.minLength) {
            if (rule.maxLength !== undefined) {
                throw new Error(`String length must be between ${rule.minLength} and ${rule.maxLength}`);
            } else {
                throw new Error(`String length must be at least ${rule.minLength}`);
            }
        }

        if (rule.maxLength !== undefined && input.length > rule.maxLength) {
            if (rule.minLength !== undefined) {
                throw new Error(`String length must be between ${rule.minLength} and ${rule.maxLength}`);
            } else {
                throw new Error(`String length must be at most ${rule.maxLength}`);
            }
        }

        if (rule.pattern && !rule.pattern.test(input)) {
            throw new Error('String does not match required pattern');
        }
    }

    private validateNumber(input: any, rule: ValidationRule): void {
        const num = typeof input === 'string' ? parseFloat(input) : input;

        if (typeof num !== 'number' || isNaN(num)) {
            throw new Error('Input must be a valid number');
        }

        if (rule.min !== undefined && num < rule.min) {
            if (rule.max !== undefined) {
                throw new Error(`Number must be between ${rule.min} and ${rule.max}`);
            } else {
                throw new Error(`Number must be at least ${rule.min}`);
            }
        }

        if (rule.max !== undefined && num > rule.max) {
            if (rule.min !== undefined) {
                throw new Error(`Number must be between ${rule.min} and ${rule.max}`);
            } else {
                throw new Error(`Number must be at most ${rule.max}`);
            }
        }
    }

    private validateEmail(input: any): void {
        if (typeof input !== 'string') {
            throw new Error('Email must be a string');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(input)) {
            throw new Error('Invalid email format');
        }
    }

    private validateUrl(input: any): void {
        if (typeof input !== 'string') {
            throw new Error('URL must be a string');
        }

        try {
            new URL(input);
        } catch {
            throw new Error('Invalid URL format');
        }
    }

    private validatePhone(input: any): void {
        if (typeof input !== 'string') {
            throw new Error('Phone number must be a string');
        }

        const phoneRegex = /^\+?[\d\s\-\(\)]{10,15}$/;
        if (!phoneRegex.test(input)) {
            throw new Error('Invalid phone number format');
        }
    }

    private validateDate(input: any): void {
        const date = new Date(input);
        if (isNaN(date.getTime())) {
            throw new Error('Invalid date format');
        }
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
}
