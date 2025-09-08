/**
 * Input Validation Middleware
 * Phase 1.8 from Plan 10: TDD Refactor Phase
 * 
 * Next.js middleware for input validation and sanitization
 */

import { NextRequest, NextResponse } from 'next/server';
import { InputValidator, ValidationRule, SanitizationOptions, ObjectValidationRules, ObjectSanitizationOptions } from '../services/input-validator';

export interface ValidationConfig {
    body?: ObjectValidationRules;
    query?: ObjectValidationRules;
    headers?: ObjectValidationRules;
    sanitization?: {
        body?: ObjectSanitizationOptions;
        query?: ObjectSanitizationOptions;
        headers?: ObjectSanitizationOptions;
    };
    skipSecurity?: boolean;
}

export class InputValidationMiddleware {
    private validator: InputValidator;

    constructor() {
        this.validator = new InputValidator();
    }

    /**
     * Create middleware function for Next.js API routes
     */
    createMiddleware(config: ValidationConfig) {
        return async (request: NextRequest): Promise<NextResponse | null> => {
            try {
                // Validate and sanitize request body
                if (config.body && request.method !== 'GET') {
                    const body = await this.parseRequestBody(request);
                    if (body) {
                        const validatedBody = this.validator.validateAndSanitizeObject(
                            body,
                            config.body,
                            config.sanitization?.body || {}
                        );

                        // Store validated body for later use
                        (request as any).validatedBody = validatedBody;
                    }
                }

                // Validate and sanitize query parameters
                if (config.query) {
                    const queryParams = this.parseQueryParams(request);
                    const validatedQuery = this.validator.validateAndSanitizeObject(
                        queryParams,
                        config.query,
                        config.sanitization?.query || {}
                    );

                    (request as any).validatedQuery = validatedQuery;
                }

                // Validate headers if needed
                if (config.headers) {
                    const headers = this.parseHeaders(request);
                    const validatedHeaders = this.validator.validateAndSanitizeObject(
                        headers,
                        config.headers,
                        config.sanitization?.headers || {}
                    );

                    (request as any).validatedHeaders = validatedHeaders;
                }

                // Security validation on all string inputs unless skipped
                if (!config.skipSecurity) {
                    this.performSecurityValidation(request);
                }

                return null; // Continue to next middleware/handler
            } catch (error) {
                console.error('Input validation failed:', error);

                return NextResponse.json(
                    {
                        error: 'Invalid input',
                        message: error instanceof Error ? error.message : 'Unknown validation error',
                        timestamp: new Date().toISOString()
                    },
                    { status: 400 }
                );
            }
        };
    }

    /**
     * Predefined middleware functions for common use cases
     */
    static requireValidEmail() {
        const middleware = new InputValidationMiddleware();
        return middleware.createMiddleware({
            body: {
                email: [{ type: 'email' }]
            },
            sanitization: {
                body: {
                    email: { trim: true, toLowerCase: true }
                }
            }
        });
    }

    static requireValidUserData() {
        const middleware = new InputValidationMiddleware();
        return middleware.createMiddleware({
            body: {
                username: [{ type: 'string', minLength: 3, maxLength: 20 }],
                email: [{ type: 'email' }],
                password: [{ type: 'string', minLength: 8 }]
            },
            sanitization: {
                body: {
                    username: { trim: true },
                    email: { trim: true, toLowerCase: true }
                }
            }
        });
    }

    static requireValidSearch() {
        const middleware = new InputValidationMiddleware();
        return middleware.createMiddleware({
            query: {
                q: [{ type: 'string', minLength: 1, maxLength: 100 }],
                page: [{ type: 'number', min: 1 }],
                limit: [{ type: 'number', min: 1, max: 100 }]
            },
            sanitization: {
                query: {
                    q: { trim: true, removeDangerousPatterns: true }
                }
            }
        });
    }

    /**
     * Helper method to use validation in API route handlers
     */
    static async validateRequest(
        request: NextRequest,
        config: ValidationConfig
    ): Promise<{
        body?: any;
        query?: any;
        headers?: any;
        errors?: string[];
    }> {
        const middleware = new InputValidationMiddleware();
        const errors: string[] = [];
        let validatedBody, validatedQuery, validatedHeaders;

        try {
            // Validate body
            if (config.body && request.method !== 'GET') {
                const body = await middleware.parseRequestBody(request);
                if (body) {
                    validatedBody = middleware.validator.validateAndSanitizeObject(
                        body,
                        config.body,
                        config.sanitization?.body || {}
                    );
                }
            }

            // Validate query
            if (config.query) {
                const queryParams = middleware.parseQueryParams(request);
                validatedQuery = middleware.validator.validateAndSanitizeObject(
                    queryParams,
                    config.query,
                    config.sanitization?.query || {}
                );
            }

            // Validate headers
            if (config.headers) {
                const headers = middleware.parseHeaders(request);
                validatedHeaders = middleware.validator.validateAndSanitizeObject(
                    headers,
                    config.headers,
                    config.sanitization?.headers || {}
                );
            }

            return {
                body: validatedBody,
                query: validatedQuery,
                headers: validatedHeaders
            };
        } catch (error) {
            errors.push(error instanceof Error ? error.message : 'Validation failed');
            return { errors };
        }
    }

    /**
     * Private helper methods
     */
    private async parseRequestBody(request: NextRequest): Promise<any> {
        const contentType = request.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            return await request.json();
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
            const formData = await request.formData();
            const result: Record<string, any> = {};
            for (const [key, value] of formData.entries()) {
                result[key] = value.toString();
            }
            return result;
        }

        return null;
    }

    private parseQueryParams(request: NextRequest): Record<string, any> {
        const url = new URL(request.url);
        const params: Record<string, any> = {};

        for (const [key, value] of url.searchParams.entries()) {
            // Try to parse numbers
            if (/^\d+$/.test(value)) {
                params[key] = parseInt(value, 10);
            } else if (/^\d+\.\d+$/.test(value)) {
                params[key] = parseFloat(value);
            } else {
                params[key] = value;
            }
        }

        return params;
    }

    private parseHeaders(request: NextRequest): Record<string, any> {
        const headers: Record<string, any> = {};

        request.headers.forEach((value, key) => {
            // Only include specific headers that we might want to validate
            if (['authorization', 'x-api-key', 'user-agent'].includes(key.toLowerCase())) {
                headers[key] = value;
            }
        });

        return headers;
    }

    private performSecurityValidation(request: NextRequest): void {
        // Get all string values from the request
        const stringValues: string[] = [];

        // Check URL path
        stringValues.push(request.nextUrl.pathname);

        // Check query parameters
        request.nextUrl.searchParams.forEach((value) => {
            if (typeof value === 'string') {
                stringValues.push(value);
            }
        });

        // Check specific headers
        const userAgent = request.headers.get('user-agent');
        if (userAgent) {
            stringValues.push(userAgent);
        }

        // Perform security validation on all collected strings
        for (const value of stringValues) {
            this.validator.validateSecurity(value);
        }
    }
}

/**
 * Utility function for easy validation in API routes
 */
export async function withInputValidation<T = any>(
    request: NextRequest,
    config: ValidationConfig,
    handler: (validatedData: { body?: T; query?: any; headers?: any }) => Promise<NextResponse>
): Promise<NextResponse> {
    try {
        const result = await InputValidationMiddleware.validateRequest(request, config);

        if (result.errors?.length) {
            return NextResponse.json(
                {
                    error: 'Validation failed',
                    messages: result.errors,
                    timestamp: new Date().toISOString()
                },
                { status: 400 }
            );
        }

        return await handler({
            body: result.body,
            query: result.query,
            headers: result.headers
        });
    } catch (error) {
        console.error('Input validation middleware error:', error);

        return NextResponse.json(
            {
                error: 'Internal validation error',
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
}
