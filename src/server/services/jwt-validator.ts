/**
 * JWT Token Validator Service
 * 
 * 依照 Plan 10 和 NextAuth.js 最佳實作的 JWT 驗證服務
 * 支援：
 * - JWT 格式驗證
 * - Token 過期檢查  
 * - Token 簽名驗證
 * - Token 黑名單機制
 * - Token 刷新機制
 * - 安全性和效能優化
 */

import jwt from 'jsonwebtoken'
import { AUTH_ERROR_CODES } from './auth-service'

// === 介面定義 ===
export interface JwtValidationResult {
    success: boolean
    payload?: any
    error?: string
    tokenType?: string
    expiresAt?: Date
    issuedAt?: Date
}

export interface JwtRefreshResult {
    success: boolean
    newToken?: string
    error?: string
    expiresAt?: Date
}

export interface JwtValidatorConfig {
    secret: string
    algorithm?: jwt.Algorithm
    expiresIn?: string | number
    issuer?: string
    audience?: string
    clockTolerance?: number
}

export interface TokenPayload {
    userId: string
    role?: string
    permissions?: string[]
    sessionId?: string
    [key: string]: any
}

// === JWT 黑名單管理 ===
class TokenBlacklist {
    private blacklistedTokens = new Set<string>()
    private tokenHashes = new Map<string, Date>() // 存儲 token hash 和加入時間

    /**
     * 將 token 加入黑名單
     */
    add(token: string): void {
        const tokenHash = this.hashToken(token)
        this.blacklistedTokens.add(tokenHash)
        this.tokenHashes.set(tokenHash, new Date())
    }

    /**
     * 檢查 token 是否在黑名單中
     */
    isBlacklisted(token: string): boolean {
        const tokenHash = this.hashToken(token)
        return this.blacklistedTokens.has(tokenHash)
    }

    /**
     * 從黑名單移除 token
     */
    remove(token: string): void {
        const tokenHash = this.hashToken(token)
        this.blacklistedTokens.delete(tokenHash)
        this.tokenHashes.delete(tokenHash)
    }

    /**
     * 清理過期的黑名單項目
     */
    cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
        const now = Date.now()
        for (const [hash, addedAt] of this.tokenHashes.entries()) {
            if (now - addedAt.getTime() > maxAge) {
                this.blacklistedTokens.delete(hash)
                this.tokenHashes.delete(hash)
            }
        }
    }

    /**
     * 獲取黑名單大小
     */
    size(): number {
        return this.blacklistedTokens.size
    }

    /**
     * 清空黑名單
     */
    clear(): void {
        this.blacklistedTokens.clear()
        this.tokenHashes.clear()
    }

    /**
     * 生成 token hash（用於隱私保護）
     */
    private hashToken(token: string): string {
        // 使用簡單的 hash 函數（生產環境應使用更強的算法）
        let hash = 0
        for (let i = 0; i < token.length; i++) {
            const char = token.charCodeAt(i)
            hash = ((hash << 5) - hash) + char
            hash = hash & hash // 轉換為 32-bit 整數
        }
        return hash.toString(36)
    }
}

/**
 * JWT Token Validator 主類
 */
export class JwtTokenValidator {
    private config: JwtValidatorConfig
    private blacklist: TokenBlacklist

    constructor(config: JwtValidatorConfig) {
        this.config = {
            algorithm: 'HS256',
            expiresIn: '24h',
            clockTolerance: 10, // 10 秒時鐘容差
            ...config
        }
        this.blacklist = new TokenBlacklist()

        // 驗證設定
        this.validateConfig()

        // 啟動定期清理
        this.startCleanupSchedule()
    }

    /**
     * 驗證 JWT token
     */
    async validateToken(token: string): Promise<JwtValidationResult> {
        try {
            // 1. 基本格式檢查
            if (!this.isValidTokenFormat(token)) {
                return {
                    success: false,
                    error: AUTH_ERROR_CODES.INVALID_TOKEN_FORMAT
                }
            }

            // 2. 檢查黑名單
            if (await this.isTokenBlacklisted(token)) {
                return {
                    success: false,
                    error: AUTH_ERROR_CODES.TOKEN_BLACKLISTED
                }
            }

            // 3. JWT 驗證
            const verifyOptions: any = {
                algorithms: [this.config.algorithm!],
                clockTolerance: this.config.clockTolerance
            }

            // 只在配置有設定時才驗證 issuer 和 audience
            if (this.config.issuer) {
                verifyOptions.issuer = this.config.issuer
            }

            if (this.config.audience) {
                verifyOptions.audience = this.config.audience
            }

            const payload = jwt.verify(token, this.config.secret, verifyOptions) as any

            // 4. 提取重要資訊
            const result: JwtValidationResult = {
                success: true,
                payload,
                tokenType: 'JWT'
            }

            if (payload.exp) {
                result.expiresAt = new Date(payload.exp * 1000)
            }

            if (payload.iat) {
                result.issuedAt = new Date(payload.iat * 1000)
            }

            return result

        } catch (error: any) {
            // 處理不同類型的錯誤
            if (error.name === 'TokenExpiredError') {
                return {
                    success: false,
                    error: AUTH_ERROR_CODES.TOKEN_EXPIRED
                }
            }

            if (error.name === 'JsonWebTokenError') {
                return {
                    success: false,
                    error: AUTH_ERROR_CODES.INVALID_TOKEN
                }
            }

            if (error.name === 'NotBeforeError') {
                return {
                    success: false,
                    error: AUTH_ERROR_CODES.INVALID_TOKEN
                }
            }

            // 其他錯誤
            return {
                success: false,
                error: AUTH_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    /**
     * 生成 JWT token
     */
    async generateToken(payload: TokenPayload, expiresIn?: string | number): Promise<string> {
        const tokenPayload: any = {
            ...payload,
            iat: Math.floor(Date.now() / 1000),
            jti: this.generateJti() // JWT ID for tracking
        }

        const options: any = {
            algorithm: this.config.algorithm
        }

        // 處理過期時間
        const expiry = expiresIn || this.config.expiresIn
        if (expiry) {
            // 如果是負數時間（用於測試過期 token），直接設置過期時間
            if (typeof expiry === 'string' && expiry.startsWith('-')) {
                const duration = this.parseExpiresIn(expiry.substring(1))
                tokenPayload.exp = Math.floor((Date.now() - duration) / 1000)
            } else {
                options.expiresIn = expiry
            }
        }

        // 只在配置有設定時才加入 issuer 和 audience
        if (this.config.issuer) {
            options.issuer = this.config.issuer
        }

        if (this.config.audience) {
            options.audience = this.config.audience
        }

        return jwt.sign(tokenPayload, this.config.secret, options)
    }

    /**
     * 刷新 token
     */
    async refreshToken(token: string): Promise<JwtRefreshResult> {
        try {
            // 先驗證原始 token（允許過期）
            const verifyOptions: any = {
                algorithms: [this.config.algorithm!],
                ignoreExpiration: true // 允許過期 token 進行刷新
            }

            // 只在配置有設定時才驗證 issuer 和 audience
            if (this.config.issuer) {
                verifyOptions.issuer = this.config.issuer
            }

            if (this.config.audience) {
                verifyOptions.audience = this.config.audience
            }

            const decoded = jwt.verify(token, this.config.secret, verifyOptions) as any

            // 檢查是否在黑名單
            if (await this.isTokenBlacklisted(token)) {
                return {
                    success: false,
                    error: AUTH_ERROR_CODES.TOKEN_BLACKLISTED
                }
            }

            // 檢查 token 是否太舊（超過最大刷新期限）
            const maxRefreshAge = 7 * 24 * 60 * 60 // 7 天
            const tokenAge = Date.now() / 1000 - decoded.iat
            if (tokenAge > maxRefreshAge) {
                return {
                    success: false,
                    error: AUTH_ERROR_CODES.TOKEN_EXPIRED
                }
            }

            // 額外檢查：如果 token 沒有設置過期時間但是已經很舊了也拒絕
            if (decoded.exp && Date.now() / 1000 > decoded.exp + 24 * 60 * 60) { // 過期超過24小時
                return {
                    success: false,
                    error: AUTH_ERROR_CODES.TOKEN_EXPIRED
                }
            }

            // 生成新 token
            const newPayload: TokenPayload = {
                userId: decoded.userId,
                role: decoded.role,
                permissions: decoded.permissions,
                sessionId: decoded.sessionId
            }

            const newToken = await this.generateToken(newPayload)

            // 將舊 token 加入黑名單
            await this.blacklistToken(token)

            return {
                success: true,
                newToken,
                expiresAt: new Date(Date.now() + this.parseExpiresIn(this.config.expiresIn))
            }

        } catch (error: any) {
            if (error.name === 'JsonWebTokenError') {
                return {
                    success: false,
                    error: AUTH_ERROR_CODES.INVALID_TOKEN
                }
            }

            return {
                success: false,
                error: AUTH_ERROR_CODES.DATABASE_ERROR
            }
        }
    }

    /**
     * 將 token 加入黑名單
     */
    async blacklistToken(token: string): Promise<void> {
        this.blacklist.add(token)
    }

    /**
     * 從黑名單移除 token
     */
    async removeFromBlacklist(token: string): Promise<void> {
        this.blacklist.remove(token)
    }

    /**
     * 檢查 token 是否在黑名單中
     */
    async isTokenBlacklisted(token: string): Promise<boolean> {
        return this.blacklist.isBlacklisted(token)
    }

    /**
     * 獲取黑名單統計
     */
    getBlacklistStats(): { size: number } {
        return {
            size: this.blacklist.size()
        }
    }

    /**
     * 清空黑名單（慎用）
     */
    clearBlacklist(): void {
        this.blacklist.clear()
    }

    // === 私有方法 ===

    /**
     * 驗證 token 格式
     */
    private isValidTokenFormat(token: string): boolean {
        if (!token || typeof token !== 'string') {
            return false
        }

        const trimmedToken = token.trim()

        // 基本長度檢查
        if (trimmedToken.length < 10) {
            return false
        }

        // JWT 格式檢查：header.payload.signature
        const parts = trimmedToken.split('.')
        if (parts.length !== 3) {
            return false
        }

        // 檢查每個部分是否為 base64
        return parts.every(part => this.isValidBase64(part))
    }

    /**
     * 檢查是否為有效的 base64 字符串
     */
    private isValidBase64(str: string): boolean {
        // 檢查基本格式
        if (!str || str.length === 0) {
            return false
        }

        // JWT 使用 base64url 編碼，允許 - 和 _，以及標準 base64 字符
        const base64urlRegex = /^[A-Za-z0-9_-]+$/
        return base64urlRegex.test(str)
    }

    /**
     * 生成唯一的 JWT ID
     */
    private generateJti(): string {
        return Math.random().toString(36).substring(2) + Date.now().toString(36)
    }

    /**
     * 解析過期時間字符串為毫秒
     */
    private parseExpiresIn(expiresIn: string | number | undefined): number {
        if (typeof expiresIn === 'number') {
            return expiresIn * 1000
        }

        if (typeof expiresIn === 'string') {
            const units: { [key: string]: number } = {
                's': 1000,
                'm': 60 * 1000,
                'h': 60 * 60 * 1000,
                'd': 24 * 60 * 60 * 1000
            }

            const match = expiresIn.match(/^(\d+)([smhd])$/)
            if (match) {
                const value = parseInt(match[1])
                const unit = match[2]
                return value * units[unit]
            }
        }

        // 預設 24 小時
        return 24 * 60 * 60 * 1000
    }

    /**
     * 驗證設定
     */
    private validateConfig(): void {
        if (!this.config.secret || this.config.secret.length < 32) {
            throw new Error('JWT secret must be at least 32 characters long')
        }

        const supportedAlgorithms = ['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512']
        if (!supportedAlgorithms.includes(this.config.algorithm!)) {
            throw new Error(`Unsupported algorithm: ${this.config.algorithm}`)
        }
    }

    /**
     * 啟動定期清理程序
     */
    private startCleanupSchedule(): void {
        // 每小時清理一次過期的黑名單項目
        setInterval(() => {
            this.blacklist.cleanup()
        }, 60 * 60 * 1000)
    }
}

// === 預設實例 ===
let defaultValidator: JwtTokenValidator | null = null

/**
 * 獲取預設的 JWT 驗證器實例
 */
export function getDefaultJwtValidator(): JwtTokenValidator {
    if (!defaultValidator) {
        throw new Error('JWT Validator not initialized. Call initializeJwtValidator first.')
    }
    return defaultValidator
}

/**
 * 初始化預設的 JWT 驗證器
 */
export function initializeJwtValidator(config: JwtValidatorConfig): void {
    defaultValidator = new JwtTokenValidator(config)
}

/**
 * 驗證 JWT token（便利函數）
 */
export async function validateJwtToken(token: string): Promise<JwtValidationResult> {
    return getDefaultJwtValidator().validateToken(token)
}

/**
 * 生成 JWT token（便利函數）
 */
export async function generateJwtToken(payload: TokenPayload, expiresIn?: string | number): Promise<string> {
    return getDefaultJwtValidator().generateToken(payload, expiresIn)
}
