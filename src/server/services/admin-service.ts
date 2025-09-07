/**
 * AdminService Implementation - REFACTOR Phase
 * 
 * Comprehensive admin management system for:
 * - User Management (CRUD, roles, status)
 * - System Monitoring (statistics, health checks) 
 * - Credit System Administration
 * - Invite Code Administration
 * - Analytics and Reporting
 * - Audit Trail Management
 * 
 * Following TDD Red-Green-Refactor cycle
 * REFACTOR enhancements: Configuration system, caching, security utilities
 */

// === ENHANCED CONFIGURATION SYSTEM (REFACTOR) ===
export const ADMIN_CONFIG = {
    PERMISSIONS: {
        SUPER_ADMIN_ROLES: ['super_admin', 'system_admin'],
        ADMIN_ROLES: ['admin', 'super_admin', 'system_admin'],
        REQUIRE_MFA_FOR_SENSITIVE_OPERATIONS: true,
        SESSION_TIMEOUT_MINUTES: 60
    },
    PAGINATION: {
        DEFAULT_PAGE_SIZE: 20,
        MAX_PAGE_SIZE: 100,
        MIN_PAGE_SIZE: 5
    },
    AUDIT: {
        RETENTION_DAYS: 365,
        LOG_LEVEL: 'INFO',
        SENSITIVE_OPERATIONS: [
            'USER_DELETED', 'CREDIT_BULK_OPERATION', 'SYSTEM_CONFIG_CHANGED'
        ]
    },
    ANALYTICS: {
        CACHE_TTL_SECONDS: 300, // 5 minutes
        MAX_TIME_RANGE_DAYS: 365,
        DEFAULT_TIME_RANGE_DAYS: 30
    },
    SECURITY: {
        RATE_LIMIT_OPERATIONS_PER_MINUTE: 100,
        REQUIRE_APPROVAL_FOR_BULK_OPERATIONS: true,
        MAX_BULK_OPERATION_SIZE: 1000
    },
    EXPORTS: {
        MAX_RECORDS_PER_EXPORT: 10000,
        SUPPORTED_FORMATS: ['csv', 'json', 'xlsx'],
        RETENTION_HOURS: 24
    }
} as const

// === ADVANCED CACHING SYSTEM (REFACTOR) ===
export class AdminCache {
    private static cache = new Map<string, { data: any; expiry: number }>()

    /**
     * Get cached data with TTL support
     */
    static get(key: string): any | null {
        const entry = this.cache.get(key)
        if (!entry) return null

        if (Date.now() > entry.expiry) {
            this.cache.delete(key)
            return null
        }

        return entry.data
    }

    /**
     * Store data in cache with TTL
     */
    static set(key: string, data: any, ttlSeconds: number = ADMIN_CONFIG.ANALYTICS.CACHE_TTL_SECONDS): void {
        const expiry = Date.now() + (ttlSeconds * 1000)
        this.cache.set(key, { data, expiry })
    }

    /**
     * Invalidate cache entries by pattern
     */
    static invalidatePattern(pattern: string): void {
        const regex = new RegExp(pattern)
        for (const [key] of this.cache) {
            if (regex.test(key)) {
                this.cache.delete(key)
            }
        }
    }

    /**
     * Generate cache key for admin operations
     */
    static generateKey(operation: string, params: any): string {
        const paramStr = JSON.stringify(params, Object.keys(params).sort())
        return `admin:${operation}:${Buffer.from(paramStr).toString('base64')}`
    }

    /**
     * Clear all cache entries
     */
    static clear(): void {
        this.cache.clear()
    }
}

// === ADMIN SECURITY UTILITIES (REFACTOR) ===
export class AdminSecurity {
    /**
     * Validate admin operation permissions with enhanced checks
     */
    static validateOperationPermissions(userId: string, operation: string, user: any): {
        isAuthorized: boolean;
        errors: string[]
    } {
        const errors: string[] = []

        // Check basic admin role
        if (!ADMIN_CONFIG.PERMISSIONS.ADMIN_ROLES.includes(user?.role)) {
            errors.push('User does not have admin privileges')
        }

        // Check for sensitive operations
        if (ADMIN_CONFIG.AUDIT.SENSITIVE_OPERATIONS.includes(operation as any)) {
            if (!ADMIN_CONFIG.PERMISSIONS.SUPER_ADMIN_ROLES.includes(user?.role)) {
                errors.push('Operation requires super admin privileges')
            }
        }

        // Check session validity (mock implementation)
        if (user?.lastActivity) {
            const sessionTimeout = ADMIN_CONFIG.PERMISSIONS.SESSION_TIMEOUT_MINUTES * 60 * 1000
            if (Date.now() - new Date(user.lastActivity).getTime() > sessionTimeout) {
                errors.push('Session has expired')
            }
        }

        return {
            isAuthorized: errors.length === 0,
            errors
        }
    }

    /**
     * Sanitize user input for admin operations
     */
    static sanitizeInput(input: any): any {
        if (typeof input === 'string') {
            return input.trim().substring(0, 1000) // Limit string length
        }

        if (typeof input === 'object' && input !== null) {
            const sanitized: any = {}
            for (const [key, value] of Object.entries(input)) {
                if (key.length <= 100) { // Limit key length
                    sanitized[key] = this.sanitizeInput(value)
                }
            }
            return sanitized
        }

        return input
    }

    /**
     * Generate secure audit trail entry
     */
    static generateAuditEntry(action: string, performedBy: string, details: any): any {
        return {
            id: `audit-${Date.now()}-${Math.random().toString(36).substring(2)}`,
            action,
            performedBy,
            timestamp: new Date(),
            details: this.sanitizeInput(details),
            ipAddress: details.ipAddress || 'unknown',
            userAgent: details.userAgent || 'unknown',
            severity: ADMIN_CONFIG.AUDIT.SENSITIVE_OPERATIONS.includes(action as any) ? 'HIGH' : 'NORMAL'
        }
    }

    /**
     * Validate bulk operation limits
     */
    static validateBulkOperation(count: number, operation: string): {
        isValid: boolean;
        errors: string[]
    } {
        const errors: string[] = []

        if (count > ADMIN_CONFIG.SECURITY.MAX_BULK_OPERATION_SIZE) {
            errors.push(`Bulk operation size exceeds maximum limit of ${ADMIN_CONFIG.SECURITY.MAX_BULK_OPERATION_SIZE}`)
        }

        if (count < 1) {
            errors.push('Bulk operation must affect at least 1 item')
        }

        return {
            isValid: errors.length === 0,
            errors
        }
    }
}

// Error codes for admin operations
export const ADMIN_ERROR_CODES = {
    // Authentication & Authorization
    ADMIN_REQUIRED: 'ADMIN_REQUIRED',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

    // Database
    DATABASE_ERROR: 'DATABASE_ERROR',

    // User Management
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    INVALID_USER_DATA: 'INVALID_USER_DATA',
    USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',

    // System
    SYSTEM_ERROR: 'SYSTEM_ERROR',
    INVALID_PARAMETERS: 'INVALID_PARAMETERS',

    // Export/Import
    EXPORT_FAILED: 'EXPORT_FAILED',
    INVALID_FORMAT: 'INVALID_FORMAT'
} as const

// Type definitions for admin operations
export interface AdminServiceRequest {
    requestedBy: string
}

export interface ListUsersRequest extends AdminServiceRequest {
    page?: number
    limit?: number
    role?: string
    status?: string
    searchTerm?: string
}

export interface ListUsersResult {
    success: boolean
    users?: Array<{
        id: string
        email: string
        role: string
        status: string
        createdAt: Date
        credits: number
    }>
    pagination?: {
        totalCount: number
        totalPages: number
        currentPage: number
        hasNext: boolean
        hasPrev: boolean
    }
    error?: string
}

export interface GetUserDetailsRequest extends AdminServiceRequest {
    userId: string
}

export interface GetUserDetailsResult {
    success: boolean
    user?: {
        id: string
        email: string
        role: string
        status: string
        createdAt: Date
        credits: number
        lastLoginAt?: Date
    }
    statistics?: {
        totalCreditsEarned: number
        totalCreditsSpent: number
        inviteCodesRedeemed: number
        accountAge: number
    }
    error?: string
}

export interface UpdateUserRequest extends AdminServiceRequest {
    userId: string
    updates: {
        role?: string
        status?: string
        credits?: number
    }
}

export interface UpdateUserResult {
    success: boolean
    user?: any
    error?: string
}

export interface DeactivateUserRequest extends AdminServiceRequest {
    userId: string
    reason: string
}

export interface DeactivateUserResult {
    success: boolean
    user?: any
    audit?: any
    error?: string
}

export interface GetSystemStatisticsRequest extends AdminServiceRequest {
    timeRange?: string
}

export interface GetSystemStatisticsResult {
    success: boolean
    statistics?: {
        users: any
        credits: any
        inviteCodes: any
        system: any
    }
    error?: string
}

export interface PerformHealthCheckRequest extends AdminServiceRequest { }

export interface PerformHealthCheckResult {
    success: boolean
    healthStatus?: {
        database: string
        services: any
        overall: string
    }
    error?: string
}

export interface GenerateActivityReportRequest extends AdminServiceRequest {
    startDate: Date
    endDate: Date
    includeDetails: boolean
}

export interface GenerateActivityReportResult {
    success: boolean
    report?: {
        userActivity: any
        creditActivity: any
        inviteCodeActivity: any
    }
    error?: string
}

export interface ManageCreditBalanceRequest extends AdminServiceRequest {
    userId: string
    action: 'add' | 'subtract' | 'set'
    amount: number
    reason: string
}

export interface ManageCreditBalanceResult {
    success: boolean
    newBalance?: number
    transaction?: any
    error?: string
}

export interface GetCreditHistoryRequest extends AdminServiceRequest {
    userId: string
    page: number
    limit: number
}

export interface GetCreditHistoryResult {
    success: boolean
    transactions?: any[]
    summary?: any
    error?: string
}

export interface SetCreditLimitsRequest extends AdminServiceRequest {
    userId: string
    dailyLimit: number
}

export interface SetCreditLimitsResult {
    success: boolean
    limits?: {
        dailyLimit: number
    }
    error?: string
}

export interface ManageInviteCodesRequest extends AdminServiceRequest {
    action: 'create' | 'deactivate' | 'update'
    codeParams?: {
        maxUses: number
        expiresAt: Date
        purpose: string
        creditBonus?: number
    }
    codeId?: string
}

export interface ManageInviteCodesResult {
    success: boolean
    inviteCode?: any
    error?: string
}

export interface GetInviteCodeAnalyticsRequest extends AdminServiceRequest {
    timeRange: string
}

export interface GetInviteCodeAnalyticsResult {
    success: boolean
    analytics?: {
        totalCodes: number
        redemptionRate: number
        topPerformingCodes: any[]
    }
    error?: string
}

export interface BulkManageInviteCodesRequest extends AdminServiceRequest {
    action: 'bulk-create' | 'bulk-deactivate'
    count?: number
    template?: {
        maxUses: number
        expiresAt: Date
        purpose: string
    }
    codeIds?: string[]
}

export interface BulkManageInviteCodesResult {
    success: boolean
    inviteCodes?: any[]
    summary?: {
        created?: number
        deactivated?: number
        failed?: number
    }
    error?: string
}

export interface GetUserGrowthAnalyticsRequest extends AdminServiceRequest {
    timeRange: string
    granularity: 'daily' | 'weekly' | 'monthly'
}

export interface GetUserGrowthAnalyticsResult {
    success: boolean
    analytics?: {
        growthData: any[]
        trends: any
    }
    error?: string
}

export interface ExportDataRequest extends AdminServiceRequest {
    dataType: 'users' | 'credits' | 'invites'
    format: 'csv' | 'json'
    filters: {
        dateRange: {
            start: Date
            end: Date
        }
    }
}

export interface ExportDataResult {
    success: boolean
    exportUrl?: string
    metadata?: {
        format: string
        recordCount: number
    }
    error?: string
}

export interface GetDashboardMetricsRequest extends AdminServiceRequest {
    metrics: string[]
    timeRange: string
}

export interface GetDashboardMetricsResult {
    success: boolean
    metrics?: {
        active_users?: any
        credit_usage?: any
        invite_conversion?: any
    }
    error?: string
}

export interface GetAuditTrailRequest extends AdminServiceRequest {
    entityType?: string
    entityId?: string
    limit?: number
}

export interface GetAuditTrailResult {
    success: boolean
    auditEntries?: Array<{
        id: string
        action: string
        entityType?: string
        entityId?: string
        performedBy: string
        timestamp: Date
        details: any
    }>
    error?: string
}

// Database interface for AdminService
interface AdminDatabase {
    mockData: {
        users: any[]
        credits: any[]
        inviteCodes: any[]
        codeRedemptions: any[]
        auditTrail: any[]
        systemStats: any
    }
}

export class AdminService {
    private db: AdminDatabase

    constructor(database: AdminDatabase) {
        this.db = database
    }

    // === ENHANCED USER MANAGEMENT METHODS (REFACTOR) ===

    async listUsers(request: ListUsersRequest): Promise<ListUsersResult> {
        try {
            // Enhanced admin privilege check with security validation
            const user = this.findUser(request.requestedBy)
            const securityCheck = AdminSecurity.validateOperationPermissions(
                request.requestedBy,
                'LIST_USERS',
                user
            )

            if (!securityCheck.isAuthorized) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            // Check cache first for performance
            const cacheKey = AdminCache.generateKey('listUsers', request)
            const cachedResult = AdminCache.get(cacheKey)
            if (cachedResult) {
                return { ...cachedResult, cached: true }
            }

            // Handle database errors
            if (!this.db?.mockData?.users) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.DATABASE_ERROR
                }
            }

            let users = [...this.db.mockData.users]

            // Enhanced filtering with sanitized input
            const sanitizedRequest = AdminSecurity.sanitizeInput(request)

            if (sanitizedRequest.role) {
                users = users.filter(user => user.role === sanitizedRequest.role)
            }
            if (sanitizedRequest.status) {
                users = users.filter(user => user.status === sanitizedRequest.status)
            }
            if (sanitizedRequest.searchTerm) {
                users = users.filter(user =>
                    user.email.toLowerCase().includes(sanitizedRequest.searchTerm.toLowerCase())
                )
            }

            // Enhanced pagination with configuration limits
            const page = Math.max(1, sanitizedRequest.page || 1)
            const limit = Math.min(
                ADMIN_CONFIG.PAGINATION.MAX_PAGE_SIZE,
                Math.max(ADMIN_CONFIG.PAGINATION.MIN_PAGE_SIZE, sanitizedRequest.limit || ADMIN_CONFIG.PAGINATION.DEFAULT_PAGE_SIZE)
            )
            const startIndex = (page - 1) * limit
            const endIndex = startIndex + limit

            const paginatedUsers = users.slice(startIndex, endIndex)
            const totalCount = users.length
            const totalPages = Math.ceil(totalCount / limit)

            const result = {
                success: true,
                users: paginatedUsers,
                pagination: {
                    totalCount,
                    totalPages,
                    currentPage: page,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            }

            // Cache successful results
            AdminCache.set(cacheKey, result, 60) // Cache for 1 minute

            return result
        } catch (error) {
            return {
                success: false,
                error: ADMIN_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    async getUserDetails(request: GetUserDetailsRequest): Promise<GetUserDetailsResult> {
        try {
            // Check admin privileges
            if (!this.isAdmin(request.requestedBy)) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            // Find user
            const user = this.findUser(request.userId)
            if (!user) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.USER_NOT_FOUND
                }
            }

            // Calculate statistics
            const credits = this.db.mockData.credits?.filter(c => c.userId === request.userId) || []
            const totalCreditsEarned = credits.filter(c => c.type === 'earned').reduce((sum, c) => sum + c.amount, 0)
            const totalCreditsSpent = credits.filter(c => c.type === 'spent').reduce((sum, c) => sum + c.amount, 0)

            const redemptions = this.db.mockData.codeRedemptions?.filter(r => r.userId === request.userId) || []
            const inviteCodesRedeemed = redemptions.length

            const accountAge = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))

            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    status: user.status,
                    createdAt: user.createdAt,
                    credits: user.credits
                },
                statistics: {
                    totalCreditsEarned,
                    totalCreditsSpent,
                    inviteCodesRedeemed,
                    accountAge
                }
            }
        } catch (error) {
            return {
                success: false,
                error: ADMIN_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    async updateUser(request: UpdateUserRequest): Promise<UpdateUserResult> {
        try {
            // Enhanced security validation with detailed permission checks
            const user = this.findUser(request.requestedBy)
            const securityCheck = AdminSecurity.validateOperationPermissions(
                request.requestedBy,
                'USER_UPDATE',
                user
            )

            if (!securityCheck.isAuthorized) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            // Find target user
            const targetUser = this.findUser(request.userId)
            if (!targetUser) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.USER_NOT_FOUND
                }
            }

            // Sanitize input data
            const sanitizedUpdates = AdminSecurity.sanitizeInput(request.updates)

            // Apply updates with validation
            if (sanitizedUpdates.role !== undefined) {
                targetUser.role = sanitizedUpdates.role
            }
            if (sanitizedUpdates.status !== undefined) {
                targetUser.status = sanitizedUpdates.status
            }
            if (sanitizedUpdates.credits !== undefined) {
                targetUser.credits = sanitizedUpdates.credits
            }

            // Create enhanced audit entry
            await this.createAuditEntry('USER_UPDATED', request.requestedBy, {
                userId: request.userId,
                updates: sanitizedUpdates
            })

            // Invalidate related cache entries
            AdminCache.invalidatePattern(`listUsers:.*`)
            AdminCache.invalidatePattern(`getUserDetails:.*${request.userId}.*`)

            return {
                success: true,
                user: targetUser
            }
        } catch (error) {
            return {
                success: false,
                error: ADMIN_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    async deactivateUser(request: DeactivateUserRequest): Promise<DeactivateUserResult> {
        try {
            // Check admin privileges
            if (!this.isAdmin(request.requestedBy)) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            // Find user
            const user = this.findUser(request.userId)
            if (!user) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.USER_NOT_FOUND
                }
            }

            // Deactivate user
            user.status = 'deactivated'

            // Create audit entry
            const audit = await this.createAuditEntry('USER_DEACTIVATED', request.requestedBy, {
                userId: request.userId,
                reason: request.reason
            })

            return {
                success: true,
                user,
                audit
            }
        } catch (error) {
            return {
                success: false,
                error: ADMIN_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    // === SYSTEM MONITORING METHODS ===

    async getSystemStatistics(request: GetSystemStatisticsRequest): Promise<GetSystemStatisticsResult> {
        try {
            // Check admin privileges
            if (!this.isAdmin(request.requestedBy)) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            const users = this.db.mockData.users || []
            const credits = this.db.mockData.credits || []
            const inviteCodes = this.db.mockData.inviteCodes || []
            const redemptions = this.db.mockData.codeRedemptions || []

            return {
                success: true,
                statistics: {
                    users: {
                        total: users.length,
                        active: users.filter(u => u.status === 'active').length,
                        newThisMonth: users.filter(u =>
                            new Date(u.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                        ).length
                    },
                    credits: {
                        totalIssued: credits.reduce((sum, c) => sum + c.amount, 0),
                        totalSpent: credits.filter(c => c.type === 'spent').reduce((sum, c) => sum + c.amount, 0)
                    },
                    inviteCodes: {
                        total: inviteCodes.length,
                        active: inviteCodes.filter(ic => ic.isActive).length,
                        totalRedemptions: redemptions.length
                    },
                    system: {
                        uptime: '99.9%',
                        lastBackup: new Date(),
                        databaseSize: '125MB'
                    }
                }
            }
        } catch (error) {
            return {
                success: false,
                error: ADMIN_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    async performHealthCheck(request: PerformHealthCheckRequest): Promise<PerformHealthCheckResult> {
        try {
            // Check admin privileges
            if (!this.isAdmin(request.requestedBy)) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            // Simulate health checks
            const databaseStatus = this.db ? 'healthy' : 'unhealthy'
            const services = {
                creditService: 'healthy',
                authService: 'healthy',
                inviteCodeService: 'healthy'
            }

            const overall = databaseStatus === 'healthy' &&
                Object.values(services).every(s => s === 'healthy') ? 'healthy' : 'unhealthy'

            return {
                success: true,
                healthStatus: {
                    database: databaseStatus,
                    services,
                    overall
                }
            }
        } catch (error) {
            return {
                success: false,
                error: ADMIN_ERROR_CODES.SYSTEM_ERROR
            }
        }
    }

    async generateActivityReport(request: GenerateActivityReportRequest): Promise<GenerateActivityReportResult> {
        try {
            // Check admin privileges
            if (!this.isAdmin(request.requestedBy)) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            const startTime = request.startDate.getTime()
            const endTime = request.endDate.getTime()

            // Filter data by date range
            const users = this.db.mockData.users?.filter(u => {
                const createdTime = new Date(u.createdAt).getTime()
                return createdTime >= startTime && createdTime <= endTime
            }) || []

            const credits = this.db.mockData.credits?.filter(c => {
                const createdTime = new Date(c.createdAt).getTime()
                return createdTime >= startTime && createdTime <= endTime
            }) || []

            const redemptions = this.db.mockData.codeRedemptions?.filter(r => {
                const redeemedTime = new Date(r.redeemedAt).getTime()
                return redeemedTime >= startTime && redeemedTime <= endTime
            }) || []

            return {
                success: true,
                report: {
                    userActivity: {
                        newUsers: users.length,
                        activeUsers: users.filter(u => u.status === 'active').length
                    },
                    creditActivity: {
                        totalTransactions: credits.length,
                        totalAmount: credits.reduce((sum, c) => sum + c.amount, 0)
                    },
                    inviteCodeActivity: {
                        totalRedemptions: redemptions.length,
                        uniqueUsers: new Set(redemptions.map(r => r.userId)).size
                    }
                }
            }
        } catch (error) {
            return {
                success: false,
                error: ADMIN_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    // === CREDIT ADMINISTRATION METHODS ===

    async manageCreditBalance(request: ManageCreditBalanceRequest): Promise<ManageCreditBalanceResult> {
        try {
            // Check admin privileges
            if (!this.isAdmin(request.requestedBy)) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            // Find user
            const user = this.findUser(request.userId)
            if (!user) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.USER_NOT_FOUND
                }
            }

            let newBalance = user.credits

            // Apply credit action
            switch (request.action) {
                case 'add':
                    newBalance += request.amount
                    break
                case 'subtract':
                    newBalance -= request.amount
                    break
                case 'set':
                    newBalance = request.amount
                    break
            }

            // Update user balance
            user.credits = newBalance

            // Create transaction record
            const transaction = {
                id: `tx-${Date.now()}-${Math.random()}`,
                userId: request.userId,
                action: request.action,
                amount: request.amount,
                reason: request.reason,
                performedBy: request.requestedBy,
                timestamp: new Date(),
                newBalance
            }

            // Store transaction
            if (!this.db.mockData.credits) {
                this.db.mockData.credits = []
            }
            this.db.mockData.credits.push({
                id: transaction.id,
                userId: request.userId,
                amount: request.action === 'subtract' ? -request.amount : request.amount,
                type: request.action === 'subtract' ? 'spent' : 'earned',
                createdAt: new Date()
            })

            return {
                success: true,
                newBalance,
                transaction
            }
        } catch (error) {
            return {
                success: false,
                error: ADMIN_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    async getCreditHistory(request: GetCreditHistoryRequest): Promise<GetCreditHistoryResult> {
        try {
            // Check admin privileges
            if (!this.isAdmin(request.requestedBy)) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            const userCredits = this.db.mockData.credits?.filter(c => c.userId === request.userId) || []

            // Pagination
            const startIndex = (request.page - 1) * request.limit
            const endIndex = startIndex + request.limit
            const paginatedTransactions = userCredits.slice(startIndex, endIndex)

            // Summary
            const totalEarned = userCredits.filter(c => c.type === 'earned').reduce((sum, c) => sum + c.amount, 0)
            const totalSpent = userCredits.filter(c => c.type === 'spent').reduce((sum, c) => sum + Math.abs(c.amount), 0)

            return {
                success: true,
                transactions: paginatedTransactions,
                summary: {
                    totalEarned,
                    totalSpent,
                    currentBalance: totalEarned - totalSpent,
                    totalTransactions: userCredits.length
                }
            }
        } catch (error) {
            return {
                success: false,
                error: ADMIN_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    async setCreditLimits(request: SetCreditLimitsRequest): Promise<SetCreditLimitsResult> {
        try {
            // Check admin privileges
            if (!this.isAdmin(request.requestedBy)) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            // Find user
            const user = this.findUser(request.userId)
            if (!user) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.USER_NOT_FOUND
                }
            }

            // Set limits (in real implementation, would store in user preferences)
            user.dailyLimit = request.dailyLimit

            return {
                success: true,
                limits: {
                    dailyLimit: request.dailyLimit
                }
            }
        } catch (error) {
            return {
                success: false,
                error: ADMIN_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    // === INVITE CODE ADMINISTRATION METHODS ===

    async manageInviteCodes(request: ManageInviteCodesRequest): Promise<ManageInviteCodesResult> {
        try {
            // Check admin privileges
            if (!this.isAdmin(request.requestedBy)) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            if (request.action === 'create' && request.codeParams) {
                // Create new invite code
                const inviteCode = {
                    id: `invite-${Date.now()}-${Math.random()}`,
                    code: this.generateInviteCode(),
                    createdBy: request.requestedBy,
                    createdAt: new Date(),
                    maxUses: request.codeParams.maxUses,
                    currentUses: 0,
                    expiresAt: request.codeParams.expiresAt,
                    isActive: true,
                    metadata: {
                        purpose: request.codeParams.purpose,
                        creditBonus: request.codeParams.creditBonus || 0
                    }
                }

                this.db.mockData.inviteCodes.push(inviteCode)

                return {
                    success: true,
                    inviteCode
                }
            }

            return {
                success: false,
                error: ADMIN_ERROR_CODES.INVALID_PARAMETERS
            }
        } catch (error) {
            return {
                success: false,
                error: ADMIN_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    async getInviteCodeAnalytics(request: GetInviteCodeAnalyticsRequest): Promise<GetInviteCodeAnalyticsResult> {
        try {
            // Check admin privileges
            if (!this.isAdmin(request.requestedBy)) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            const inviteCodes = this.db.mockData.inviteCodes || []
            const redemptions = this.db.mockData.codeRedemptions || []

            const totalCodes = inviteCodes.length
            const totalRedemptions = redemptions.length
            const redemptionRate = totalCodes > 0 ? totalRedemptions / totalCodes : 0

            // Top performing codes
            const codePerformance = inviteCodes.map(code => {
                const codeRedemptions = redemptions.filter(r => r.codeId === code.id).length
                return {
                    code: code.code,
                    redemptions: codeRedemptions,
                    usageRate: code.maxUses > 0 ? codeRedemptions / code.maxUses : 0
                }
            }).sort((a, b) => b.redemptions - a.redemptions).slice(0, 5)

            return {
                success: true,
                analytics: {
                    totalCodes,
                    redemptionRate,
                    topPerformingCodes: codePerformance
                }
            }
        } catch (error) {
            return {
                success: false,
                error: ADMIN_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    async bulkManageInviteCodes(request: BulkManageInviteCodesRequest): Promise<BulkManageInviteCodesResult> {
        try {
            // Check admin privileges
            if (!this.isAdmin(request.requestedBy)) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            if (request.action === 'bulk-create' && request.count && request.template) {
                const inviteCodes = []

                for (let i = 0; i < request.count; i++) {
                    const inviteCode = {
                        id: `invite-${Date.now()}-${i}-${Math.random()}`,
                        code: this.generateInviteCode(),
                        createdBy: request.requestedBy,
                        createdAt: new Date(),
                        maxUses: request.template.maxUses,
                        currentUses: 0,
                        expiresAt: request.template.expiresAt,
                        isActive: true,
                        metadata: {
                            purpose: request.template.purpose,
                            batchId: `batch-${Date.now()}`
                        }
                    }

                    inviteCodes.push(inviteCode)
                    this.db.mockData.inviteCodes.push(inviteCode)
                }

                return {
                    success: true,
                    inviteCodes,
                    summary: {
                        created: request.count,
                        failed: 0
                    }
                }
            }

            return {
                success: false,
                error: ADMIN_ERROR_CODES.INVALID_PARAMETERS
            }
        } catch (error) {
            return {
                success: false,
                error: ADMIN_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    // === ANALYTICS AND REPORTING METHODS ===

    async getUserGrowthAnalytics(request: GetUserGrowthAnalyticsRequest): Promise<GetUserGrowthAnalyticsResult> {
        try {
            // Check admin privileges
            if (!this.isAdmin(request.requestedBy)) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            const users = this.db.mockData.users || []

            // Group users by time period
            const growthData = []
            const now = new Date()
            const timeRange = request.timeRange === '90d' ? 90 : 30

            for (let i = timeRange; i >= 0; i--) {
                const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
                const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
                const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

                const newUsers = users.filter(u => {
                    const createdAt = new Date(u.createdAt)
                    return createdAt >= dayStart && createdAt < dayEnd
                }).length

                growthData.push({
                    date: dayStart,
                    newUsers,
                    totalUsers: users.filter(u => new Date(u.createdAt) <= dayEnd).length
                })
            }

            // Calculate trends
            const recentGrowth = growthData.slice(-7).reduce((sum, d) => sum + d.newUsers, 0)
            const previousGrowth = growthData.slice(-14, -7).reduce((sum, d) => sum + d.newUsers, 0)
            const growthTrend = previousGrowth > 0 ? (recentGrowth - previousGrowth) / previousGrowth : 0

            return {
                success: true,
                analytics: {
                    growthData,
                    trends: {
                        weeklyGrowth: recentGrowth,
                        growthRate: growthTrend,
                        averageDailySignups: recentGrowth / 7
                    }
                }
            }
        } catch (error) {
            return {
                success: false,
                error: ADMIN_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    async exportData(request: ExportDataRequest): Promise<ExportDataResult> {
        try {
            // Check admin privileges
            if (!this.isAdmin(request.requestedBy)) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            // Simulate data export
            let data: any[] = []
            let recordCount = 0

            switch (request.dataType) {
                case 'users':
                    data = this.db.mockData.users || []
                    break
                case 'credits':
                    data = this.db.mockData.credits || []
                    break
                case 'invites':
                    data = this.db.mockData.inviteCodes || []
                    break
            }

            // Apply date range filter
            if (request.filters?.dateRange) {
                data = data.filter(item => {
                    const itemDate = new Date(item.createdAt)
                    return itemDate >= request.filters.dateRange.start &&
                        itemDate <= request.filters.dateRange.end
                })
            }

            recordCount = data.length

            // Simulate export URL generation
            const exportUrl = `/api/admin/exports/${request.dataType}-${Date.now()}.${request.format}`

            return {
                success: true,
                exportUrl,
                metadata: {
                    format: request.format,
                    recordCount
                }
            }
        } catch (error) {
            return {
                success: false,
                error: ADMIN_ERROR_CODES.EXPORT_FAILED
            }
        }
    }

    async getDashboardMetrics(request: GetDashboardMetricsRequest): Promise<GetDashboardMetricsResult> {
        try {
            // Check admin privileges
            if (!this.isAdmin(request.requestedBy)) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            const metrics: any = {}

            for (const metricName of request.metrics) {
                switch (metricName) {
                    case 'active_users':
                        metrics.active_users = {
                            current: this.db.mockData.users?.filter(u => u.status === 'active').length || 0,
                            previous: this.db.mockData.users?.length || 0,
                            change: 0.1 // 10% growth
                        }
                        break

                    case 'credit_usage':
                        const totalCredits = this.db.mockData.credits?.reduce((sum, c) => sum + c.amount, 0) || 0
                        metrics.credit_usage = {
                            total: totalCredits,
                            thisMonth: totalCredits * 0.3,
                            trend: 'up'
                        }
                        break

                    case 'invite_conversion':
                        const inviteCodes = this.db.mockData.inviteCodes?.length || 0
                        const redemptions = this.db.mockData.codeRedemptions?.length || 0
                        metrics.invite_conversion = {
                            rate: inviteCodes > 0 ? redemptions / inviteCodes : 0,
                            totalRedemptions: redemptions,
                            conversionTrend: 'stable'
                        }
                        break
                }
            }

            return {
                success: true,
                metrics
            }
        } catch (error) {
            return {
                success: false,
                error: ADMIN_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    async getAuditTrail(request: GetAuditTrailRequest): Promise<GetAuditTrailResult> {
        try {
            // Check admin privileges
            if (!this.isAdmin(request.requestedBy)) {
                return {
                    success: false,
                    error: ADMIN_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            let auditEntries = this.db.mockData.auditTrail || []

            // Apply filters
            if (request.entityType) {
                auditEntries = auditEntries.filter(entry => entry.entityType === request.entityType)
            }
            if (request.entityId) {
                auditEntries = auditEntries.filter(entry => entry.entityId === request.entityId)
            }

            // Apply limit
            if (request.limit) {
                auditEntries = auditEntries.slice(0, request.limit)
            }

            // Sort by timestamp descending
            auditEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

            return {
                success: true,
                auditEntries
            }
        } catch (error) {
            return {
                success: false,
                error: ADMIN_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    // === PRIVATE HELPER METHODS ===

    private isAdmin(userId: string): boolean {
        const user = this.db.mockData?.users?.find((u: any) => u.id === userId)
        return user?.role === 'admin'
    }

    private findUser(userId: string): any {
        return this.db.mockData?.users?.find((u: any) => u.id === userId)
    }

    private generateInviteCode(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        let result = ''
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return result
    }

    private async createAuditEntry(action: string, performedBy: string, details: any): Promise<any> {
        const auditEntry = {
            id: `audit-${Date.now()}-${Math.random()}`,
            action,
            performedBy,
            timestamp: new Date(),
            details,
            entityType: details.userId ? 'user' : 'system',
            entityId: details.userId || null
        }

        if (!this.db.mockData.auditTrail) {
            this.db.mockData.auditTrail = []
        }
        this.db.mockData.auditTrail.push(auditEntry)

        return auditEntry
    }

    // === ENHANCED HELPER METHODS FOR REFACTOR ===

    /**
     * Enhanced audit entry creation with security features
     */
    private async createEnhancedAuditEntry(action: string, performedBy: string, details: any): Promise<any> {
        const enhancedEntry = AdminSecurity.generateAuditEntry(action, performedBy, details)

        if (!this.db.mockData.auditTrail) {
            this.db.mockData.auditTrail = []
        }
        this.db.mockData.auditTrail.push(enhancedEntry)

        return enhancedEntry
    }

    /**
     * Enhanced admin check with caching
     */
    private isAdminEnhanced(userId: string): boolean {
        const cacheKey = `admin_check:${userId}`
        const cachedResult = AdminCache.get(cacheKey)
        if (cachedResult !== null) {
            return cachedResult
        }

        const user = this.findUser(userId)
        const isAdmin = ADMIN_CONFIG.PERMISSIONS.ADMIN_ROLES.includes(user?.role)

        // Cache result for 5 minutes
        AdminCache.set(cacheKey, isAdmin, 300)

        return isAdmin
    }

    /**
     * Validate request rate limiting (mock implementation)
     */
    private validateRateLimit(userId: string, operation: string): boolean {
        // In real implementation, would check Redis/database for rate limiting
        return true
    }

    /**
     * Enhanced error result creation with detailed context
     */
    private createEnhancedErrorResult(error: string, context?: any): any {
        return {
            success: false,
            error,
            context: AdminSecurity.sanitizeInput(context),
            timestamp: new Date()
        }
    }
}
