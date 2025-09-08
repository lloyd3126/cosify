/**
 * RBAC Middleware - Role-Based Access Control for API Routes
 * 
 * 此middleware將JWT驗證和RBAC權限檢查整合到Next.js API路由中
 * 遵循 NextAuth.js 模式和 Plan 10 的安全要求
 */

import { NextRequest, NextResponse } from 'next/server'
import { JwtTokenValidator, JwtValidationResult } from '../services/jwt-validator'
import { AuthService, AUTH_CONFIG } from '../services/auth-service'
import { RBACEnhancer, ExtendedPermissionResult } from '../services/rbac-enhancer'

// RBAC Context for permission checking
export interface RBACContext {
    resourceId?: string
    resourceType?: string
    userId?: string
    timestamp?: Date
    metadata?: Record<string, any>
}

// RBAC Middleware Options
export interface RBACMiddlewareOptions {
    requiredPermission: string
    context?: RBACContext
    skipOnError?: boolean
    auditLog?: boolean
}

// RBAC Middleware Error Types
export enum RBACErrorType {
    TOKEN_MISSING = 'TOKEN_MISSING',
    TOKEN_INVALID = 'TOKEN_INVALID',
    TOKEN_EXPIRED = 'TOKEN_EXPIRED',
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    USER_NOT_FOUND = 'USER_NOT_FOUND',
    SYSTEM_ERROR = 'SYSTEM_ERROR'
}

// RBAC Error Response
export interface RBACErrorResponse {
    error: string
    message: string
    type: RBACErrorType
    timestamp: string
    requestId?: string
}

/**
 * RBAC Middleware Class
 * 
 * 提供完整的JWT驗證和權限控制功能
 */
export class RBACMiddleware {
    private jwtValidator: JwtTokenValidator
    private authService: AuthService
    private rbacEnhancer: RBACEnhancer

    constructor(
        jwtValidator: JwtTokenValidator,
        authService: AuthService,
        rbacEnhancer: RBACEnhancer
    ) {
        this.jwtValidator = jwtValidator
        this.authService = authService
        this.rbacEnhancer = rbacEnhancer
    }

    /**
     * 創建RBAC中介層函式
     * 
     * @param options RBAC選項配置
     * @returns Next.js中介層函式
     */
    public createMiddleware(options: RBACMiddlewareOptions) {
        return async (request: NextRequest): Promise<NextResponse | void> => {
            try {
                // 1. 提取JWT Token
                const token = this.extractToken(request)
                if (!token) {
                    return this.createErrorResponse(
                        RBACErrorType.TOKEN_MISSING,
                        'Authorization token is required'
                    )
                }

                // 2. 驗證JWT Token
                const tokenValidation = await this.jwtValidator.validateToken(token)
                if (!tokenValidation.success) {
                    const errorType = tokenValidation.error === 'Token expired'
                        ? RBACErrorType.TOKEN_EXPIRED
                        : RBACErrorType.TOKEN_INVALID

                    return this.createErrorResponse(
                        errorType,
                        tokenValidation.error || 'Invalid token'
                    )
                }

                // 3. 獲取用戶資訊
                const userId = tokenValidation.payload?.userId
                if (!userId) {
                    return this.createErrorResponse(
                        RBACErrorType.USER_NOT_FOUND,
                        'User ID not found in token'
                    )
                }

                // 4. 權限檢查
                const permissionResult = await this.rbacEnhancer.hasPermission(
                    this.authService,
                    userId,
                    options.requiredPermission,
                    options.context
                )

                if (!permissionResult.hasPermission) {
                    return this.createErrorResponse(
                        RBACErrorType.PERMISSION_DENIED,
                        `Access denied: ${options.requiredPermission} permission required`,
                        {
                            requiredPermission: options.requiredPermission,
                            userRole: permissionResult.userRole,
                            reason: permissionResult.error || 'Insufficient permissions'
                        }
                    )
                }

                // 5. 審計日誌記錄 (如果啟用)
                if (options.auditLog) {
                    await this.logPermissionCheck(userId, options, permissionResult, request)
                }

                // 6. 添加用戶資訊到請求標頭 (供後續使用)
                const response = NextResponse.next()
                response.headers.set('X-User-ID', userId)
                response.headers.set('X-User-Role', permissionResult.userRole || 'unknown')
                response.headers.set('X-Permission-Check', 'passed')

                return response

            } catch (error) {
                console.error('RBAC Middleware Error:', error)

                if (options.skipOnError) {
                    // 跳過錯誤，繼續處理請求
                    return NextResponse.next()
                }

                return this.createErrorResponse(
                    RBACErrorType.SYSTEM_ERROR,
                    'Internal server error during permission check'
                )
            }
        }
    }

    /**
     * 從請求中提取JWT Token
     */
    private extractToken(request: NextRequest): string | null {
        // 1. 檢查 Authorization header
        const authHeader = request.headers.get('Authorization')
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7)
        }

        // 2. 檢查 Cookie (適用於瀏覽器請求)
        const tokenCookie = request.cookies.get('auth-token')
        if (tokenCookie) {
            return tokenCookie.value
        }

        // 3. 檢查查詢參數 (謹慎使用，僅用於特定API)
        const tokenParam = request.nextUrl.searchParams.get('token')
        if (tokenParam) {
            return tokenParam
        }

        return null
    }

    /**
     * 創建錯誤響應
     */
    private createErrorResponse(
        type: RBACErrorType,
        message: string,
        metadata?: Record<string, any>
    ): NextResponse {
        const errorResponse: RBACErrorResponse = {
            error: 'Permission Denied',
            message,
            type,
            timestamp: new Date().toISOString(),
            requestId: crypto.randomUUID()
        }

        const status = this.getStatusCodeForError(type)

        return NextResponse.json(
            { ...errorResponse, ...metadata },
            { status }
        )
    }

    /**
     * 根據錯誤類型返回適當的HTTP狀態碼
     */
    private getStatusCodeForError(type: RBACErrorType): number {
        switch (type) {
            case RBACErrorType.TOKEN_MISSING:
            case RBACErrorType.TOKEN_INVALID:
            case RBACErrorType.TOKEN_EXPIRED:
                return 401 // Unauthorized
            case RBACErrorType.PERMISSION_DENIED:
                return 403 // Forbidden  
            case RBACErrorType.USER_NOT_FOUND:
                return 404 // Not Found
            case RBACErrorType.SYSTEM_ERROR:
            default:
                return 500 // Internal Server Error
        }
    }

    /**
     * 記錄權限檢查審計日誌
     */
    private async logPermissionCheck(
        userId: string,
        options: RBACMiddlewareOptions,
        result: any,
        request: NextRequest
    ): Promise<void> {
        try {
            // 構建審計日誌條目
            const auditEntry = {
                timestamp: new Date().toISOString(),
                userId,
                action: 'permission_check',
                permission: options.requiredPermission,
                result: result.hasPermission ? 'granted' : 'denied',
                context: options.context,
                metadata: {
                    userAgent: request.headers.get('user-agent'),
                    ip: request.headers.get('x-forwarded-for') || 'unknown',
                    path: request.nextUrl.pathname,
                    method: request.method,
                    userRole: result.userRole,
                    reason: result.error
                }
            }

            // 在實際實作中，這裡會寫入資料庫或日誌系統
            console.log('RBAC Audit Log:', JSON.stringify(auditEntry, null, 2))

        } catch (error) {
            console.error('Failed to log permission check:', error)
            // 不因日誌失敗而影響正常流程
        }
    }
}

/**
 * Helper function: 創建權限檢查中介層
 * 
 * 簡化版本，用於快速創建特定權限的中介層
 */
export function createPermissionMiddleware(
    permission: string,
    context?: RBACContext
) {
    return (
        jwtValidator: JwtTokenValidator,
        authService: AuthService,
        rbacEnhancer: RBACEnhancer
    ) => {
        const middleware = new RBACMiddleware(jwtValidator, authService, rbacEnhancer)
        return middleware.createMiddleware({
            requiredPermission: permission,
            context,
            auditLog: true
        })
    }
}

/**
 * Pre-defined middleware functions for common permissions
 */
export const CommonPermissionMiddleware = {
    // 管理用戶權限
    manageUsers: (services: {
        jwtValidator: JwtTokenValidator,
        authService: AuthService,
        rbacEnhancer: RBACEnhancer
    }) => createPermissionMiddleware(
        AUTH_CONFIG.PERMISSIONS.MANAGE_USERS
    )(services.jwtValidator, services.authService, services.rbacEnhancer),

    // 管理信用點權限
    manageCredits: (services: {
        jwtValidator: JwtTokenValidator,
        authService: AuthService,
        rbacEnhancer: RBACEnhancer
    }) => createPermissionMiddleware(
        AUTH_CONFIG.PERMISSIONS.MANAGE_CREDITS
    )(services.jwtValidator, services.authService, services.rbacEnhancer),

    // 系統管理權限
    manageSystem: (services: {
        jwtValidator: JwtTokenValidator,
        authService: AuthService,
        rbacEnhancer: RBACEnhancer
    }) => createPermissionMiddleware(
        AUTH_CONFIG.PERMISSIONS.MANAGE_SYSTEM
    )(services.jwtValidator, services.authService, services.rbacEnhancer),

    // 查看用戶資料權限 (支援上下文)
    viewUserData: (
        resourceId: string,
        services: {
            jwtValidator: JwtTokenValidator,
            authService: AuthService,
            rbacEnhancer: RBACEnhancer
        }
    ) => createPermissionMiddleware(
        AUTH_CONFIG.PERMISSIONS.VIEW_USER_DATA,
        {
            resourceId,
            resourceType: 'user'
        }
    )(services.jwtValidator, services.authService, services.rbacEnhancer)
}
