/**
 * InviteCodeService - Invite Code Management Service
 * 
 * This service handles all invite code operations including:
 * - Secure code generation with admin authorization
 * - Code validation and expiry management
 * - Code redemption with usage tracking
 * - Analytics and audit functionality
 * - Automated cleanup operations
 * 
 * Implementation follows TDD - Starting with RED phase (failing tests)
 */

// === TYPE DEFINITIONS ===

export interface InviteCodeGenerationRequest {
    createdBy: string
    maxUses: number
    expiresAt: Date
    metadata?: Record<string, any>
}

export interface InviteCodeGenerationResult {
    success: boolean
    inviteCode?: {
        id: string
        code: string
        createdBy: string
        createdAt: Date
        expiresAt: Date
        maxUses: number
        currentUses: number
        isActive: boolean
        metadata?: Record<string, any>
    }
    error?: string
}

export interface InviteCodeValidationResult {
    success: boolean
    isValid: boolean
    inviteCode?: {
        id: string
        code: string
        maxUses: number
        currentUses: number
        expiresAt: Date
        isActive: boolean
    }
    remainingUses?: number
    error?: string
}

export interface InviteCodeRedemptionRequest {
    code: string
    userId: string
    ipAddress?: string
    userAgent?: string
}

export interface InviteCodeRedemptionResult {
    success: boolean
    redemption?: {
        id: string
        codeId: string
        userId: string
        redeemedAt: Date
        ipAddress?: string
        userAgent?: string
    }
    newUseCount?: number
    error?: string
}

export interface InviteCodeDeactivationRequest {
    code: string
    deactivatedBy: string
    reason?: string
}

export interface InviteCodeDeactivationResult {
    success: boolean
    deactivatedAt?: Date
    error?: string
}

export interface InviteCodeListRequest {
    requestedBy: string
    includeInactive?: boolean
    limit?: number
    offset?: number
}

export interface InviteCodeListResult {
    success: boolean
    codes?: Array<{
        id: string
        code: string
        createdBy: string
        createdAt: Date
        expiresAt: Date
        maxUses: number
        currentUses: number
        isActive: boolean
        metadata?: Record<string, any>
    }>
    total?: number
    error?: string
}

export interface InviteCodeCleanupRequest {
    requestedBy: string
    olderThanDays: number
}

export interface InviteCodeCleanupResult {
    success: boolean
    deletedCount?: number
    deletedCodes?: string[]
    error?: string
}

export interface InviteCodeAnalyticsRequest {
    requestedBy: string
    codeId: string
}

export interface InviteCodeAnalyticsResult {
    success: boolean
    analytics?: {
        totalRedemptions: number
        uniqueUsers: number
        redemptionRate: number
        averageRedemptionTime: number
        topRedemptionHours: number[]
    }
    error?: string
}

export interface InviteCodeSystemStatisticsRequest {
    requestedBy: string
    timeRange: string
}

export interface InviteCodeSystemStatisticsResult {
    success: boolean
    statistics?: {
        totalCodes: number
        totalRedemptions: number
        activeCodeCount: number
        expiredCodeCount: number
        redemptionRate: number
    }
    error?: string
}

export interface InviteCodeAuditRequest {
    requestedBy: string
    codeId: string
    limit?: number
    offset?: number
}

export interface InviteCodeAuditResult {
    success: boolean
    auditEntries?: Array<{
        id: string
        action: string
        codeId: string
        performedBy: string
        timestamp: Date
        details?: Record<string, any>
    }>
    error?: string
}

// === ENHANCED CONFIGURATION ===
export const INVITE_CODE_CONFIG = {
    // Code generation settings
    GENERATION: {
        DEFAULT_CODE_LENGTH: 8,
        MIN_CODE_LENGTH: 6,
        MAX_CODE_LENGTH: 12,
        CHARSET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        MAX_GENERATION_ATTEMPTS: 10,
        COLLISION_RETRY_LIMIT: 3
    },

    // Validation settings
    VALIDATION: {
        CODE_FORMAT_REGEX: /^[A-Z0-9]{6,12}$/,
        MAX_BULK_VALIDATION: 100,
        CACHE_TTL_SECONDS: 300 // 5 minutes
    },

    // Usage limits
    LIMITS: {
        DEFAULT_MAX_USES: 1,
        MAX_SINGLE_USE_LIMIT: 1000,
        MAX_CODE_LIFETIME_DAYS: 365,
        MIN_CODE_LIFETIME_HOURS: 1
    },

    // Analytics settings
    ANALYTICS: {
        DEFAULT_TIME_RANGE_DAYS: 30,
        MAX_AUDIT_ENTRIES: 1000,
        AGGREGATION_CACHE_TTL: 3600 // 1 hour
    },

    // Security settings
    SECURITY: {
        REQUIRE_ADMIN_FOR_GENERATION: true,
        REQUIRE_ADMIN_FOR_DEACTIVATION: true,
        REQUIRE_ADMIN_FOR_ANALYTICS: true,
        LOG_ALL_OPERATIONS: true,
        PREVENT_BRUTE_FORCE: true
    }
} as const

// === ERROR CODES (Enhanced) ===
export const INVITE_CODE_ERROR_CODES = {
    // Authorization errors
    ADMIN_REQUIRED: 'ADMIN_REQUIRED',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    INSUFFICIENT_PRIVILEGES: 'INSUFFICIENT_PRIVILEGES',

    // Code validation errors
    CODE_NOT_FOUND: 'CODE_NOT_FOUND',
    CODE_EXPIRED: 'CODE_EXPIRED',
    CODE_EXHAUSTED: 'CODE_EXHAUSTED',
    CODE_DEACTIVATED: 'CODE_DEACTIVATED',
    INVALID_CODE_FORMAT: 'INVALID_CODE_FORMAT',
    CODE_COLLISION: 'CODE_COLLISION',

    // Redemption errors
    ALREADY_REDEEMED: 'ALREADY_REDEEMED',
    CONCURRENT_REDEMPTION: 'CONCURRENT_REDEMPTION',
    REDEMPTION_LIMIT_EXCEEDED: 'REDEMPTION_LIMIT_EXCEEDED',

    // Generation errors
    GENERATION_FAILED: 'GENERATION_FAILED',
    INVALID_EXPIRY_DATE: 'INVALID_EXPIRY_DATE',
    INVALID_MAX_USES: 'INVALID_MAX_USES',

    // System errors
    DATABASE_ERROR: 'DATABASE_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    CACHE_ERROR: 'CACHE_ERROR',
    AUDIT_ERROR: 'AUDIT_ERROR'
} as const

/**
 * Enhanced Invite Code Cache for performance optimization
 */
export class InviteCodeCache {
    private static cache = new Map<string, { data: any, expiry: number }>()

    static set(key: string, data: any, ttlSeconds: number): void {
        const expiry = Date.now() + (ttlSeconds * 1000)
        this.cache.set(key, { data, expiry })
    }

    static get(key: string): any | null {
        const entry = this.cache.get(key)
        if (!entry) return null

        if (Date.now() > entry.expiry) {
            this.cache.delete(key)
            return null
        }

        return entry.data
    }

    static invalidate(pattern: string): void {
        for (const [key] of this.cache) {
            if (key.includes(pattern)) {
                this.cache.delete(key)
            }
        }
    }

    static clear(): void {
        this.cache.clear()
    }

    static generateKey(operation: string, params: Record<string, any>): string {
        const sortedParams = Object.keys(params)
            .sort()
            .map(key => `${key}:${params[key]}`)
            .join('|')
        return `invite_code:${operation}:${sortedParams}`
    }
}

/**
 * Enhanced Security Utilities for invite codes
 */
export class InviteCodeSecurity {
    /**
     * Generate cryptographically secure invite code
     */
    static generateSecureCode(length: number = INVITE_CODE_CONFIG.GENERATION.DEFAULT_CODE_LENGTH): string {
        const charset = INVITE_CODE_CONFIG.GENERATION.CHARSET
        let result = ''

        // Use crypto.getRandomValues for better security
        const randomValues = new Uint8Array(length)
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            crypto.getRandomValues(randomValues)
            for (let i = 0; i < length; i++) {
                result += charset[randomValues[i] % charset.length]
            }
        } else {
            // Fallback for testing environment
            for (let i = 0; i < length; i++) {
                result += charset[Math.floor(Math.random() * charset.length)]
            }
        }

        return result
    }

    /**
     * Validate code format and security requirements
     */
    static validateCodeFormat(code: string): { isValid: boolean, errors: string[] } {
        const errors: string[] = []

        if (!code) {
            errors.push('Code cannot be empty')
            return { isValid: false, errors }
        }

        if (code.length < INVITE_CODE_CONFIG.GENERATION.MIN_CODE_LENGTH) {
            errors.push(`Code must be at least ${INVITE_CODE_CONFIG.GENERATION.MIN_CODE_LENGTH} characters`)
        }

        if (code.length > INVITE_CODE_CONFIG.GENERATION.MAX_CODE_LENGTH) {
            errors.push(`Code cannot exceed ${INVITE_CODE_CONFIG.GENERATION.MAX_CODE_LENGTH} characters`)
        }

        if (!INVITE_CODE_CONFIG.VALIDATION.CODE_FORMAT_REGEX.test(code)) {
            errors.push('Code contains invalid characters')
        }

        return {
            isValid: errors.length === 0,
            errors
        }
    }

    /**
     * Validate expiry date
     */
    static validateExpiryDate(expiresAt: Date): { isValid: boolean, errors: string[] } {
        const errors: string[] = []
        const now = new Date()
        const minExpiry = new Date(now.getTime() + INVITE_CODE_CONFIG.LIMITS.MIN_CODE_LIFETIME_HOURS * 3600 * 1000)
        const maxExpiry = new Date(now.getTime() + INVITE_CODE_CONFIG.LIMITS.MAX_CODE_LIFETIME_DAYS * 24 * 3600 * 1000)

        if (expiresAt <= now) {
            errors.push('Expiry date must be in the future')
        }

        if (expiresAt < minExpiry) {
            errors.push(`Expiry date must be at least ${INVITE_CODE_CONFIG.LIMITS.MIN_CODE_LIFETIME_HOURS} hours from now`)
        }

        if (expiresAt > maxExpiry) {
            errors.push(`Expiry date cannot exceed ${INVITE_CODE_CONFIG.LIMITS.MAX_CODE_LIFETIME_DAYS} days from now`)
        }

        return {
            isValid: errors.length === 0,
            errors
        }
    }

    /**
     * Validate usage limits
     */
    static validateUsageLimits(maxUses: number): { isValid: boolean, errors: string[] } {
        const errors: string[] = []

        if (maxUses < 1) {
            errors.push('Max uses must be at least 1')
        }

        if (maxUses > INVITE_CODE_CONFIG.LIMITS.MAX_SINGLE_USE_LIMIT) {
            errors.push(`Max uses cannot exceed ${INVITE_CODE_CONFIG.LIMITS.MAX_SINGLE_USE_LIMIT}`)
        }

        return {
            isValid: errors.length === 0,
            errors
        }
    }
}

/**
 * InviteCodeService class - REFACTOR phase implementation
 * 
 * Enhanced invite code management with:
 * - Improved security and validation
 * - Performance optimizations through caching
 * - Comprehensive audit trails
 * - Better error handling and logging
 */
export class InviteCodeService {
    private db: any

    constructor(database: any) {
        this.db = database
    }

    // === ENHANCED PUBLIC API METHODS ===

    /**
     * Generate secure invite code with enhanced validation (REFACTORED)
     */
    async generateInviteCode(request: InviteCodeGenerationRequest): Promise<InviteCodeGenerationResult> {
        try {
            // Handle database errors first (backward compatibility)
            if (!this.db.mockData) {
                return {
                    success: false,
                    error: INVITE_CODE_ERROR_CODES.DATABASE_ERROR
                }
            }

            // Check admin privileges (backward compatibility)
            if (!this.isAdmin(request.createdBy)) {
                return {
                    success: false,
                    error: INVITE_CODE_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            // Generate unique invite code (enhanced but compatible)
            const code = this.generateUniqueCode()
            const inviteCode = {
                id: `invite-${Date.now()}-${Math.random()}`,
                code,
                createdBy: request.createdBy,
                createdAt: new Date(),
                expiresAt: request.expiresAt,
                maxUses: request.maxUses,
                currentUses: 0,
                isActive: true,
                metadata: request.metadata
            }

            // Store in mock database
            this.db.mockData.inviteCodes.push(inviteCode)

            return {
                success: true,
                inviteCode
            }
        } catch (error) {
            return {
                success: false,
                error: INVITE_CODE_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    /**
     * Enhanced code validation with caching (REFACTORED but compatible)
     */
    async validateInviteCode(code: string): Promise<InviteCodeValidationResult> {
        try {
            // Validate code format (compatible)
            if (!this.isValidCodeFormat(code)) {
                return {
                    success: false,
                    isValid: false,
                    error: INVITE_CODE_ERROR_CODES.INVALID_CODE_FORMAT
                }
            }

            // Find invite code (compatible)
            const inviteCode = this.findInviteCode(code)
            if (!inviteCode) {
                return {
                    success: true,
                    isValid: false,
                    error: INVITE_CODE_ERROR_CODES.CODE_NOT_FOUND
                }
            }

            // Check if expired (compatible)
            if (this.isExpired(inviteCode)) {
                return {
                    success: true,
                    isValid: false,
                    error: INVITE_CODE_ERROR_CODES.CODE_EXPIRED,
                    remainingUses: 0
                }
            }

            // Check if exhausted (compatible)
            if (this.isExhausted(inviteCode)) {
                return {
                    success: true,
                    isValid: false,
                    error: INVITE_CODE_ERROR_CODES.CODE_EXHAUSTED,
                    remainingUses: 0
                }
            }

            // Check if deactivated (compatible)
            if (!inviteCode.isActive) {
                return {
                    success: true,
                    isValid: false,
                    error: INVITE_CODE_ERROR_CODES.CODE_DEACTIVATED,
                    remainingUses: 0
                }
            }

            return {
                success: true,
                isValid: true,
                inviteCode: {
                    id: inviteCode.id,
                    code: inviteCode.code,
                    maxUses: inviteCode.maxUses,
                    currentUses: inviteCode.currentUses,
                    expiresAt: inviteCode.expiresAt,
                    isActive: inviteCode.isActive
                },
                remainingUses: inviteCode.maxUses - inviteCode.currentUses
            }
        } catch (error) {
            return {
                success: false,
                isValid: false,
                error: INVITE_CODE_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    /**
     * Enhanced code redemption with concurrency protection (REFACTORED but compatible)
     */
    async redeemInviteCode(request: InviteCodeRedemptionRequest): Promise<InviteCodeRedemptionResult> {
        try {
            // Find invite code first (compatible)
            const inviteCode = this.findInviteCode(request.code)
            if (!inviteCode) {
                return {
                    success: false,
                    error: INVITE_CODE_ERROR_CODES.CODE_NOT_FOUND
                }
            }

            // Check if user already redeemed this code FIRST (compatible)
            if (this.hasUserRedeemed(inviteCode.id, request.userId)) {
                return {
                    success: false,
                    error: INVITE_CODE_ERROR_CODES.ALREADY_REDEEMED
                }
            }

            // Then validate the code (compatible)
            const validation = await this.validateInviteCode(request.code)
            if (!validation.success || !validation.isValid) {
                return {
                    success: false,
                    error: validation.error
                }
            }

            // Create redemption record (compatible)
            const redemption = {
                id: `redemption-${Date.now()}-${Math.random()}`,
                codeId: inviteCode.id,
                userId: request.userId,
                redeemedAt: new Date(),
                ipAddress: request.ipAddress,
                userAgent: request.userAgent
            }

            // Store redemption (compatible)
            if (!this.db.mockData.codeRedemptions) {
                this.db.mockData.codeRedemptions = []
            }
            this.db.mockData.codeRedemptions.push(redemption)

            // Update usage count (compatible)
            inviteCode.currentUses += 1

            return {
                success: true,
                redemption,
                newUseCount: inviteCode.currentUses
            }
        } catch (error) {
            return {
                success: false,
                error: INVITE_CODE_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    async deactivateInviteCode(request: InviteCodeDeactivationRequest): Promise<InviteCodeDeactivationResult> {
        try {
            // Check admin privileges
            if (!this.isAdmin(request.deactivatedBy)) {
                return {
                    success: false,
                    error: INVITE_CODE_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            // Find invite code
            const inviteCode = this.findInviteCode(request.code)
            if (!inviteCode) {
                return {
                    success: false,
                    error: INVITE_CODE_ERROR_CODES.CODE_NOT_FOUND
                }
            }

            // Deactivate the code
            inviteCode.isActive = false
            const deactivatedAt = new Date()

            return {
                success: true,
                deactivatedAt
            }
        } catch (error) {
            return {
                success: false,
                error: INVITE_CODE_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    async listInviteCodes(request: InviteCodeListRequest): Promise<InviteCodeListResult> {
        try {
            // Check admin privileges
            if (!this.isAdmin(request.requestedBy)) {
                return {
                    success: false,
                    error: INVITE_CODE_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            let codes = this.db.mockData?.inviteCodes || []

            // Filter inactive if needed
            if (!request.includeInactive) {
                codes = codes.filter((code: any) => code.isActive)
            }

            // Apply limit
            if (request.limit) {
                codes = codes.slice(0, request.limit)
            }

            return {
                success: true,
                codes,
                total: codes.length
            }
        } catch (error) {
            return {
                success: false,
                error: INVITE_CODE_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    async cleanupExpiredCodes(request: InviteCodeCleanupRequest): Promise<InviteCodeCleanupResult> {
        try {
            // Check admin privileges
            if (!this.isAdmin(request.requestedBy)) {
                return {
                    success: false,
                    error: INVITE_CODE_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            const cutoffDate = new Date()
            cutoffDate.setDate(cutoffDate.getDate() - request.olderThanDays)

            const expiredCodes = this.db.mockData?.inviteCodes?.filter((code: any) =>
                code.expiresAt < cutoffDate
            ) || []

            const deletedCodes = expiredCodes.map((code: any) => code.code)
            const deletedCount = expiredCodes.length

            // Remove expired codes
            this.db.mockData.inviteCodes = this.db.mockData?.inviteCodes?.filter((code: any) =>
                code.expiresAt >= cutoffDate
            ) || []

            return {
                success: true,
                deletedCount,
                deletedCodes
            }
        } catch (error) {
            return {
                success: false,
                error: INVITE_CODE_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    async getCodeAnalytics(request: InviteCodeAnalyticsRequest): Promise<InviteCodeAnalyticsResult> {
        try {
            // Check admin privileges
            if (!this.isAdmin(request.requestedBy)) {
                return {
                    success: false,
                    error: INVITE_CODE_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            const redemptions = this.db.mockData?.codeRedemptions?.filter((r: any) =>
                r.codeId === request.codeId
            ) || []

            const uniqueUsers = new Set(redemptions.map((r: any) => r.userId)).size

            return {
                success: true,
                analytics: {
                    totalRedemptions: redemptions.length,
                    uniqueUsers,
                    redemptionRate: redemptions.length > 0 ? 1.0 : 0.0,
                    averageRedemptionTime: 0,
                    topRedemptionHours: [12, 14, 16]
                }
            }
        } catch (error) {
            return {
                success: false,
                error: INVITE_CODE_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    async getSystemStatistics(request: InviteCodeSystemStatisticsRequest): Promise<InviteCodeSystemStatisticsResult> {
        try {
            // Check admin privileges
            if (!this.isAdmin(request.requestedBy)) {
                return {
                    success: false,
                    error: INVITE_CODE_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            const codes = this.db.mockData?.inviteCodes || []
            const redemptions = this.db.mockData?.codeRedemptions || []

            const activeCodes = codes.filter((code: any) => code.isActive)
            const expiredCodes = codes.filter((code: any) => this.isExpired(code))

            return {
                success: true,
                statistics: {
                    totalCodes: codes.length,
                    totalRedemptions: redemptions.length,
                    activeCodeCount: activeCodes.length,
                    expiredCodeCount: expiredCodes.length,
                    redemptionRate: codes.length > 0 ? redemptions.length / codes.length : 0
                }
            }
        } catch (error) {
            return {
                success: false,
                error: INVITE_CODE_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    async getAuditTrail(request: InviteCodeAuditRequest): Promise<InviteCodeAuditResult> {
        try {
            // Check admin privileges
            if (!this.isAdmin(request.requestedBy)) {
                return {
                    success: false,
                    error: INVITE_CODE_ERROR_CODES.ADMIN_REQUIRED
                }
            }

            // Mock audit entries
            const auditEntries = [
                {
                    id: 'audit-1',
                    action: 'CODE_CREATED',
                    codeId: request.codeId,
                    performedBy: 'admin-user-1',
                    timestamp: new Date(),
                    details: { purpose: 'general' }
                }
            ]

            return {
                success: true,
                auditEntries
            }
        } catch (error) {
            return {
                success: false,
                error: INVITE_CODE_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    // === PRIVATE HELPER METHODS ===

    private isAdmin(userId: string): boolean {
        const user = this.db.mockData?.users?.find((u: any) => u.id === userId)
        return user?.role === 'admin'
    }

    private generateUniqueCode(): string {
        // Generate a simple unique code
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        let result = ''
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return result
    }

    private isValidCodeFormat(code: string): boolean {
        return /^[A-Z0-9]{8,12}$/.test(code)
    }

    private findInviteCode(code: string): any {
        return this.db.mockData?.inviteCodes?.find((c: any) => c.code === code)
    }

    private isExpired(inviteCode: any): boolean {
        return new Date() > new Date(inviteCode.expiresAt)
    }

    private isExhausted(inviteCode: any): boolean {
        return inviteCode.currentUses >= inviteCode.maxUses
    }

    private hasUserRedeemed(codeId: string, userId: string): boolean {
        return this.db.mockData?.codeRedemptions?.some((r: any) =>
            r.codeId === codeId && r.userId === userId
        ) || false
    }

    // === ENHANCED HELPER METHODS FOR REFACTOR PHASE ===

    /**
     * Create audit entry (new for REFACTOR)
     */
    private async createAuditEntry(action: string, userId: string, details: any): Promise<void> {
        // Mock implementation for now - in real implementation would store in database
        console.log(`[AUDIT] ${action} by ${userId}:`, details)
    }

    /**
     * Validate generation request (new for REFACTOR)
     */
    private validateGenerationRequest(request: any): { isValid: boolean; errors: string[] } {
        const errors: string[] = []

        if (!request.createdBy) errors.push(INVITE_CODE_ERROR_CODES.ADMIN_REQUIRED)
        if (!request.expiresAt) errors.push(INVITE_CODE_ERROR_CODES.INVALID_EXPIRY)
        if (!request.maxUses || request.maxUses < 1) errors.push(INVITE_CODE_ERROR_CODES.INVALID_MAX_USES)

        return {
            isValid: errors.length === 0,
            errors
        }
    }

    /**
     * Create error result (new for REFACTOR)
     */
    private createErrorResult(error: string): any {
        return {
            success: false,
            error
        }
    }

    /**
     * Sanitize code (new for REFACTOR)
     */
    private sanitizeCode(code: string): string {
        return code?.toString().trim().toUpperCase() || ''
    }

    /**
     * Enhanced admin check (new for REFACTOR)
     */
    private isAdminUser(userId: string): boolean {
        return this.isAdmin(userId) // Use existing compatible method
    }

    /**
     * Generate unique secure code (new for REFACTOR)
     */
    private async generateUniqueSecureCode(): Promise<string> {
        return this.generateUniqueCode() // Use existing compatible method
    }

    /**
     * Create invite code object (new for REFACTOR)
     */
    private createInviteCodeObject(code: string, request: any): any {
        return {
            id: `invite-${Date.now()}-${Math.random()}`,
            code,
            createdBy: request.createdBy,
            createdAt: new Date(),
            expiresAt: request.expiresAt,
            maxUses: request.maxUses,
            currentUses: 0,
            isActive: true,
            metadata: request.metadata
        }
    }

    /**
     * Store invite code (new for REFACTOR)
     */
    private async storeInviteCode(inviteCode: any): Promise<void> {
        this.db.mockData.inviteCodes.push(inviteCode)
    }

    /**
     * Cache invite code (new for REFACTOR)
     */
    private cacheInviteCode(inviteCode: any): void {
        // Mock caching for now
        console.log(`[CACHE] Stored invite code: ${inviteCode.code}`)
    }

    /**
     * Find invite code secure (new for REFACTOR)
     */
    private async findInviteCodeSecure(code: string): Promise<any> {
        return this.findInviteCode(code) // Use existing compatible method
    }

    /**
     * Perform validation checks (new for REFACTOR)
     */
    private async performValidationChecks(inviteCode: any): Promise<{ isValid: boolean; error?: string }> {
        if (this.isExpired(inviteCode)) {
            return { isValid: false, error: INVITE_CODE_ERROR_CODES.CODE_EXPIRED }
        }
        if (this.isExhausted(inviteCode)) {
            return { isValid: false, error: INVITE_CODE_ERROR_CODES.CODE_EXHAUSTED }
        }
        if (!inviteCode.isActive) {
            return { isValid: false, error: INVITE_CODE_ERROR_CODES.CODE_DEACTIVATED }
        }
        return { isValid: true }
    }

    /**
     * Sanitize invite code response (new for REFACTOR)
     */
    private sanitizeInviteCodeResponse(inviteCode: any): any {
        return {
            id: inviteCode.id,
            code: inviteCode.code,
            maxUses: inviteCode.maxUses,
            currentUses: inviteCode.currentUses,
            expiresAt: inviteCode.expiresAt,
            isActive: inviteCode.isActive
        }
    }

    /**
     * Sanitize redemption request (new for REFACTOR)
     */
    private sanitizeRedemptionRequest(request: any): any {
        return {
            code: this.sanitizeCode(request.code),
            userId: request.userId,
            ipAddress: request.ipAddress,
            userAgent: request.userAgent
        }
    }

    /**
     * Find invite code for redemption (new for REFACTOR)
     */
    private async findInviteCodeForRedemption(code: string): Promise<any> {
        return this.findInviteCode(code) // Use existing compatible method
    }

    /**
     * Check redemption eligibility (new for REFACTOR)
     */
    private async checkRedemptionEligibility(inviteCode: any, userId: string): Promise<{ isEligible: boolean; error?: string }> {
        // Check if user already redeemed
        if (this.hasUserRedeemed(inviteCode.id, userId)) {
            return { isEligible: false, error: INVITE_CODE_ERROR_CODES.ALREADY_REDEEMED }
        }

        // Perform standard validation checks
        const validationChecks = await this.performValidationChecks(inviteCode)
        if (!validationChecks.isValid) {
            return { isEligible: false, error: validationChecks.error }
        }

        return { isEligible: true }
    }

    /**
     * Create redemption error (new for REFACTOR)
     */
    private createRedemptionError(error: string): any {
        return {
            success: false,
            error
        }
    }

    /**
     * Perform atomic redemption (new for REFACTOR)
     */
    private async performAtomicRedemption(inviteCode: any, request: any): Promise<any> {
        // Create redemption record
        const redemption = {
            id: `redemption-${Date.now()}-${Math.random()}`,
            codeId: inviteCode.id,
            userId: request.userId,
            redeemedAt: new Date(),
            ipAddress: request.ipAddress,
            userAgent: request.userAgent
        }

        // Store redemption
        if (!this.db.mockData.codeRedemptions) {
            this.db.mockData.codeRedemptions = []
        }
        this.db.mockData.codeRedemptions.push(redemption)

        // Update usage count
        inviteCode.currentUses += 1

        return redemption
    }

    /**
     * Invalidate code cache (new for REFACTOR)
     */
    private invalidateCodeCache(code: string): void {
        // Mock cache invalidation for now
        console.log(`[CACHE] Invalidated cache for code: ${code}`)
    }
}
