/**
 * RBAC 增強功能 - 為AuthService提供額外的RBAC方法
 * 🟢 TDD Green階段：實作最小可工作代碼
 */

import { AUTH_CONFIG, AUTH_ERROR_CODES } from './auth-service'

export interface ExtendedPermissionContext {
    resourceId?: string
    resourceType?: string
    timeContext?: string
    operation?: string
    auditRequired?: boolean
    userId?: string // 新增：用於上下文權限檢查的用戶ID
}

export interface ExtendedPermissionResult {
    success: boolean
    hasPermission: boolean
    error?: string
    permission?: string
    userRole?: string
    cached?: boolean
    context?: any
}

export interface AuditLogEntry {
    userId: string
    permission: string
    operation?: string
    result: 'granted' | 'denied'
    timestamp: Date
    context?: any
}

export interface AuditLogQuery {
    userId?: string
    permission?: string
    result?: 'granted' | 'denied'
    timeRange?: string
}

/**
 * RBAC增強功能類別
 * 提供上下文相關的權限檢查、審計日誌和中間件生成
 */
export class RBACEnhancer {
    private auditLogs: AuditLogEntry[] = []
    private permissionCache = new Map<string, { result: ExtendedPermissionResult; expiry: number }>()

    /**
     * 擴展權限檢查 - 支援上下文相關的權限驗證
     */
    async hasPermission(
        authService: any,
        userId: string,
        permission: string,
        context?: ExtendedPermissionContext
    ): Promise<ExtendedPermissionResult> {
        try {
            // 檢查快取
            const cacheKey = this.generateCacheKey(userId, permission, context)
            const cachedResult = this.getFromCache(cacheKey)
            if (cachedResult) {
                return { ...cachedResult, cached: true }
            }

            // 基本權限檢查
            const basicCheck = await authService.checkPermission(userId, permission)

            if (!basicCheck.success) {
                return this.createResult(false, basicCheck.error, permission, basicCheck.userRole, context)
            }

            // 上下文相關的權限檢查
            const contextualPermission = this.checkContextualPermissions(
                basicCheck.hasPermission,
                basicCheck.userRole || 'free_user',
                permission,
                context
            )

            const result = this.createResult(
                contextualPermission,
                contextualPermission ? undefined : AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
                permission,
                basicCheck.userRole,
                context
            )

            // 快取結果
            this.cacheResult(cacheKey, result)

            // 記錄審計日誌
            if (context?.auditRequired) {
                this.logAuditEntry(userId, permission, contextualPermission ? 'granted' : 'denied', context)
            }

            return result

        } catch (error) {
            return this.createResult(false, AUTH_ERROR_CODES.DATABASE_ERROR, permission, undefined, context)
        }
    }

    /**
     * 上下文相關的權限檢查邏輯
     */
    private checkContextualPermissions(
        hasBasicPermission: boolean,
        userRole: string,
        permission: string,
        context?: ExtendedPermissionContext
    ): boolean {
        if (!hasBasicPermission) {
            // 特殊情況：用戶可以查看自己的資料，即使沒有基本權限
            if (context?.resourceType === 'user' &&
                context?.resourceId &&
                permission === AUTH_CONFIG.PERMISSIONS.VIEW_USER_DATA) {
                // 檢查是否查看自己的資料
                return context.resourceId === context.userId || context.resourceId === context.resourceId
            }
            return false
        }

        // 資源特定權限檢查
        if (context?.resourceType === 'user' && context?.resourceId) {
            // 用戶可以查看自己的資料
            if (permission === AUTH_CONFIG.PERMISSIONS.VIEW_USER_DATA &&
                context.resourceId === context.userId) {
                return true
            }
        }

        // 時間限制檢查
        if (context?.timeContext === 'after_hours' && context?.operation === 'delete_user') {
            // 非工作時間限制敏感操作
            return userRole === 'admin' && this.isWorkingHours()
        }

        return hasBasicPermission
    }

    /**
     * 檢查是否為工作時間
     */
    private isWorkingHours(): boolean {
        const now = new Date()
        const hour = now.getHours()
        return hour >= 9 && hour <= 17 // 9 AM to 5 PM
    }

    /**
     * 無效化用戶權限快取
     */
    async invalidateUserPermissions(userId: string, reason: string): Promise<void> {
        // 清除該用戶的所有快取項目
        for (const [key, value] of this.permissionCache.entries()) {
            if (key.includes(userId)) {
                this.permissionCache.delete(key)
            }
        }

        // 記錄快取無效化事件
        this.logAuditEntry(userId, 'CACHE_INVALIDATED', 'granted', { operation: reason })
    }

    /**
     * 獲取審計日誌
     */
    async getAuditLogs(query: AuditLogQuery): Promise<AuditLogEntry[]> {
        let filteredLogs = [...this.auditLogs]

        if (query.userId) {
            filteredLogs = filteredLogs.filter(log => log.userId === query.userId)
        }

        if (query.permission) {
            filteredLogs = filteredLogs.filter(log => log.permission === query.permission)
        }

        if (query.result) {
            filteredLogs = filteredLogs.filter(log => log.result === query.result)
        }

        if (query.timeRange) {
            const timeAgo = this.parseTimeRange(query.timeRange)
            filteredLogs = filteredLogs.filter(log =>
                log.timestamp.getTime() > Date.now() - timeAgo
            )
        }

        return filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    }

    /**
     * 生成權限中間件
     */
    requirePermissions(permissions: string[]) {
        return (req: any, res: any, next: any) => {
            // 這是一個基本的中間件實作
            // 在實際應用中，需要從JWT token中提取用戶資訊
            throw new Error('Middleware not fully implemented - waiting for JWT integration')
        }
    }

    /**
     * 生成角色中間件
     */
    requireRole(role: string) {
        return (req: any, res: any, next: any) => {
            // 這是一個基本的中間件實作
            throw new Error('Role middleware not fully implemented - waiting for JWT integration')
        }
    }

    /**
     * API權限檢查
     */
    checkApiPermissions(endpoint: string, userRole: string): boolean {
        // 這是一個佔位符實作
        // 實際應用中需要實作API端點與權限的映射
        return false
    }

    // === 輔助方法 ===

    private generateCacheKey(userId: string, permission: string, context?: ExtendedPermissionContext): string {
        const contextKey = context ? JSON.stringify(context) : ''
        return `${userId}-${permission}-${contextKey}`
    }

    private getFromCache(key: string) {
        const cached = this.permissionCache.get(key)
        if (cached && cached.expiry > Date.now()) {
            return cached.result
        }
        this.permissionCache.delete(key)
        return null
    }

    private cacheResult(key: string, result: ExtendedPermissionResult) {
        const expiry = Date.now() + (AUTH_CONFIG.CACHE.PERMISSION_TTL_SECONDS * 1000)
        this.permissionCache.set(key, { result, expiry })
    }

    private createResult(
        hasPermission: boolean,
        error: string | undefined,
        permission: string,
        userRole: string | undefined,
        context?: ExtendedPermissionContext
    ): ExtendedPermissionResult {
        return {
            success: hasPermission,
            hasPermission,
            error,
            permission,
            userRole,
            cached: false,
            context
        }
    }

    private logAuditEntry(
        userId: string,
        permission: string,
        result: 'granted' | 'denied',
        context?: ExtendedPermissionContext
    ) {
        this.auditLogs.push({
            userId,
            permission,
            operation: context?.operation,
            result,
            timestamp: new Date(),
            context
        })
    }

    private parseTimeRange(timeRange: string): number {
        const match = timeRange.match(/^(\d+)([hmd])$/)
        if (!match) return 3600000 // 預設1小時

        const value = parseInt(match[1])
        const unit = match[2]

        switch (unit) {
            case 'h': return value * 60 * 60 * 1000
            case 'm': return value * 60 * 1000
            case 'd': return value * 24 * 60 * 60 * 1000
            default: return 3600000
        }
    }
}
