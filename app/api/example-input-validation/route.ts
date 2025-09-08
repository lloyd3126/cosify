/**
 * Example API Route with Input Validation
 * Phase 1.8 from Plan 10: Input Validation Demo
 * 
 * Demonstrates secure input validation and sanitization
 */

import { NextRequest, NextResponse } from 'next/server';
import { withInputValidation } from '../../../src/server/middleware/input-validation-middleware';

export async function POST(request: NextRequest) {
    return withInputValidation(
        request,
        {
            body: {
                username: [
                    { type: 'string', minLength: 3, maxLength: 20 },
                    {
                        custom: (value: string) => {
                            if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
                                return 'Username can only contain letters, numbers, underscores, and hyphens';
                            }
                            return true;
                        }
                    }
                ],
                email: [{ type: 'email' }],
                bio: [{ type: 'string', maxLength: 500 }],
                age: [{ type: 'number', min: 13, max: 120 }]
            },
            sanitization: {
                body: {
                    username: { trim: true, toLowerCase: true },
                    email: { trim: true, toLowerCase: true },
                    bio: { trim: true, removeHtml: true, removeDangerousPatterns: true }
                }
            }
        },
        async ({ body }) => {
            // Simulate user creation
            const user = {
                id: Math.random().toString(36).substr(2, 9),
                username: body.username,
                email: body.email,
                bio: body.bio,
                age: body.age,
                createdAt: new Date().toISOString()
            };

            return NextResponse.json({
                success: true,
                message: 'User created successfully with validated and sanitized data',
                user,
                securityInfo: {
                    dataValidated: true,
                    dataSanitized: true,
                    securityChecks: 'passed'
                }
            });
        }
    );
}

export async function GET(request: NextRequest) {
    return withInputValidation(
        request,
        {
            query: {
                search: [{ type: 'string', minLength: 1, maxLength: 100 }],
                page: [{ type: 'number', min: 1 }],
                limit: [{ type: 'number', min: 1, max: 50 }]
            },
            sanitization: {
                query: {
                    search: { trim: true, removeDangerousPatterns: true }
                }
            }
        },
        async ({ query }) => {
            // Simulate search results
            const results = [
                {
                    id: 1,
                    title: `Search results for: "${query.search}"`,
                    description: 'This is a safe search result with validated input'
                }
            ];

            return NextResponse.json({
                success: true,
                query: query,
                results,
                pagination: {
                    page: query.page || 1,
                    limit: query.limit || 10,
                    total: results.length
                },
                securityInfo: {
                    inputValidated: true,
                    sanitized: true,
                    searchSafe: true
                }
            });
        }
    );
}
