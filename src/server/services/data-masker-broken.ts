/**
 * Phase 2.9: 敏感資料遮罩服務
 * 
 * 🔄 TDD Refactor Phase: 優化效能和程式碼品質
 * 
 * 企業級功能特色：
 * - 多種遮罩策略 (完全遮罩、部分遮罩、格式保留、雜湊遮罩)
 * - 全面支援各類敏感資料 (電子郵件、電話、信用卡、身分證、護照、地址等)
 * - 靈活的自訂遮罩規則和模式配置
 * - 高效能處理大型資料集和併發操作
 * - 完整的審計日誌和統計功能
 * - 嵌套物件和陣列的智慧遮罩
 * - 企業級安全性和合規性支援
 * - 記憶體最佳化和錯誤復原機制
 */

import { createHash } from 'crypto'

/**
 * 遮罩策略枚舉
 */
export enum MaskingStrategy {
    /** 完全遮罩 - 全部替換為遮罩字符 */
    COMPLETE = 'complete',
    /** 部分遮罩 - 保留部分字符，其餘遮罩 */
    PARTIAL = 'partial',
    /** 格式保留 - 保持原格式，內容遮罩 */
    FORMAT_PRESERVING = 'format_preserving',
    /** 雜湊遮罩 - 使用雜湊值替換 */
    HASH = 'hash'
}

/**
 * 遮罩選項配置
 */
export interface MaskingOptions {
    /** 電子郵件遮罩策略 */
    emailStrategy?: MaskingStrategy
    /** 電話號碼遮罩策略 */
    phoneStrategy?: MaskingStrategy
    /** 是否保留格式 */
    preserveFormat?: boolean
    /** 遮罩字符 */
    maskCharacter?: string
    /** 最小保留字符數 */
    minVisibleChars?: number
    /** 最大保留字符數 */
    maxVisibleChars?: number
    /** 是否啟用統計 */
    enableStatistics?: boolean
    /** 是否啟用審計 */
    enableAudit?: boolean
}

/**
 * 遮罩規則介面
 */
export interface MaskingRule {
    /** 目標欄位 */
    field: string
    /** 遮罩策略 */
    strategy: MaskingStrategy
    /** 匹配模式 */
    pattern: RegExp
    /** 替換模式 */
    replacement: string
    /** 是否必需 */
    required?: boolean
}

/**
 * 遮罩統計介面
 */
export interface MaskingStatistics {
    /** 總遮罩項目數 */
    totalMaskedItems: number
    /** 各類型遮罩統計 */
    maskingTypes: {
        email: number
        phone: number
        creditCard: number
        bankAccount: number
        taiwanId: number
        passport: number
        name: number
        address: number
        [key: string]: number
    }
    /** 效能統計 */
    performanceStats: {
        totalProcessingTime: number
        averageProcessingTime: number
        maxProcessingTime: number
        minProcessingTime: number
    }
    /** 操作統計 */
    operationStats: {
        successCount: number
        errorCount: number
        cacheHitRate: number
    }
}

/**
 * 審計日誌條目介面
 */
export interface AuditLogEntry {
    /** 時間戳記 */
    timestamp: Date
    /** 操作類型 */
    operation: string
    /** 欄位名稱 */
    fieldName: string
    /** 原始資料類型 */
    originalType: string
    /** 遮罩策略 */
    strategy: MaskingStrategy
    /** 是否成功 */
    success: boolean
    /** 錯誤訊息 (如有) */
    error?: string
}

/**
 * 🚀 企業級敏感資料遮罩器
 * 
 * 提供全面的資料遮罩功能，支援多種遮罩策略和資料類型，
 * 具備高效能處理能力和完整的審計追蹤機制。
 * 
 * @example
 * ```typescript
 * const masker = new DataMasker({
 *   emailStrategy: MaskingStrategy.PARTIAL,
 *   enableAudit: true,
 *   enableStatistics: true
 * })
 * 
 * const maskedData = masker.maskData({
 *   email: 'user@example.com',
 *   phone: '0912345678',
 *   creditCard: '1234567890123456'
 * })
 * ```
 */
export class DataMasker {
    private options: MaskingOptions
    private customRules: Map<string, MaskingRule>
    private statistics: MaskingStatistics
    private auditLog: AuditLogEntry[]

    // 🔥 TDD Refactor Phase: 效能最佳化
    /** 正則表達式緩存 - 避免重複編譯提升效能 */
    private regexCache: Map<string, RegExp> = new Map()

    // 🔥 TDD Refactor Phase: 記憶體管理
    /** 審計日誌最大大小 - 防止記憶體洩漏 */
    private readonly MAX_AUDIT_LOG_SIZE = 10000
    /** 清理時保留的審計日誌數量 */
    private readonly AUDIT_LOG_CLEANUP_SIZE = 5000

    // 🔥 TDD Refactor Phase: 效能監控
    /** 處理時間追蹤 */
    private performanceTracker: Map<string, number> = new Map()    /**
     * 初始化資料遮罩器
     * 
     * @param options - 遮罩設定選項
     */
    constructor(options: MaskingOptions = {}) {
        this.options = {
            emailStrategy: MaskingStrategy.PARTIAL,
            phoneStrategy: MaskingStrategy.PARTIAL,
            preserveFormat: true,
            maskCharacter: '*',
            minVisibleChars: 2,
            maxVisibleChars: 4,
            enableStatistics: true,
            enableAudit: true,
            ...options
        }

        this.customRules = new Map()
        this.auditLog = []

        this.initializeStatistics()
    }

    /**
     * 初始化統計物件
     * 
     * @private
     */
    private initializeStatistics(): void {
        this.statistics = {
            totalMaskedItems: 0,
            maskingTypes: {
                email: 0,
                phone: 0,
                creditCard: 0,
                bankAccount: 0,
                taiwanId: 0,
                passport: 0,
                name: 0,
                address: 0
            },
            performanceStats: {
                totalProcessingTime: 0,
                averageProcessingTime: 0,
                maxProcessingTime: 0,
                minProcessingTime: Number.MAX_VALUE
            },
            operationStats: {
                successCount: 0,
                errorCount: 0,
                cacheHitRate: 0
            }
        }
    }

    /**
     * 🔥 TDD Refactor Phase: 獲取或創建緩存的正則表達式
     * 
     * @param pattern - 正則表達式字串
     * @param flags - 正則表達式標誌
     * @returns 編譯後的正則表達式
     * @private
     */
    private getCachedRegex(pattern: string, flags?: string): RegExp {
        const key = `${pattern}:${flags || ''}`

        let regex = this.regexCache.get(key)
        if (!regex) {
            regex = new RegExp(pattern, flags)
            this.regexCache.set(key, regex)
        } else {
            // 更新緩存命中率統計
            this.statistics.operationStats.cacheHitRate =
                (this.statistics.operationStats.cacheHitRate * this.statistics.totalMaskedItems + 1) /
                (this.statistics.totalMaskedItems + 1)
        }

        return regex
    }

    /**
     * 🔥 TDD Refactor Phase: 記錄操作到審計日誌
     * 
     * @param operation - 操作類型
     * @param fieldName - 欄位名稱
     * @param originalType - 原始資料類型
     * @param strategy - 遮罩策略
     * @param success - 是否成功
     * @param error - 錯誤訊息
     * @private
     */
    private recordOperation(
        operation: string,
        fieldName: string,
        originalType: string,
        strategy: MaskingStrategy,
        success: boolean,
        error?: string
    ): void {
        if (!this.options.enableAudit) return

        const entry: AuditLogEntry = {
            timestamp: new Date(),
            operation,
            fieldName,
            originalType,
            strategy,
            success,
            error
        }

        this.auditLog.push(entry)

        // 🔥 TDD Refactor Phase: 記憶體管理 - 限制審計日誌大小
        if (this.auditLog.length > this.MAX_AUDIT_LOG_SIZE) {
            // 保留最新的日誌，刪除舊的
            this.auditLog = this.auditLog.slice(-this.AUDIT_LOG_CLEANUP_SIZE)
        }

        // 更新統計
        if (success) {
            this.statistics.operationStats.successCount++
        } else {
            this.statistics.operationStats.errorCount++
        }
    }

    /**
     * 🔥 TDD Refactor Phase: 效能測量包裝器
     * 
     * @param operationName - 操作名稱
     * @param operation - 要測量的操作
     * @returns 操作結果
     * @private
     */
    private async measurePerformance<T>(
        operationName: string,
        operation: () => T | Promise<T>
    ): Promise<T> {
        const startTime = performance.now()

        try {
            const result = await operation()
            const endTime = performance.now()
            const duration = endTime - startTime

            // 更新效能統計
            this.updatePerformanceStats(duration)
            this.performanceTracker.set(operationName, duration)

            return result
        } catch (error) {
            const endTime = performance.now()
            const duration = endTime - startTime
            this.updatePerformanceStats(duration)
            throw error
        }
    }

    /**
     * 🔥 TDD Refactor Phase: 更新效能統計
     * 
     * @param duration - 操作持續時間
     * @private
     */
    private updatePerformanceStats(duration: number): void {
        const stats = this.statistics.performanceStats

        stats.totalProcessingTime += duration
        stats.averageProcessingTime = stats.totalProcessingTime / (this.statistics.totalMaskedItems + 1)
        stats.maxProcessingTime = Math.max(stats.maxProcessingTime, duration)
        stats.minProcessingTime = Math.min(stats.minProcessingTime, duration)
    }

    /**
     * 遮罩電子郵件地址
     * 
     * @param email - 電子郵件地址
     * @param strategy - 遮罩策略
     * @returns 遮罩後的電子郵件
     */
    maskEmail(email: string, strategy?: MaskingStrategy): string {
        const actualStrategy = strategy || this.options.emailStrategy || MaskingStrategy.PARTIAL

        try {
            // 🔥 使用緩存的正則表達式
            const emailRegex = this.getCachedRegex(
                '^([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})$'
            )

            if (!emailRegex.test(email)) {
                throw new Error('Invalid email format')
            }

            let result: string

            switch (actualStrategy) {
                case MaskingStrategy.COMPLETE:
                    result = this.options.maskCharacter!.repeat(email.length)
                    break

                case MaskingStrategy.PARTIAL:
                    const [, localPart, domain] = email.match(emailRegex)!
                    // 保留第一個字符，其餘用 *** 遮罩
                    result = `${localPart[0]}***@${domain}`
                    break

                case MaskingStrategy.FORMAT_PRESERVING:
                    result = email.replace(/[a-zA-Z0-9]/g, this.options.maskCharacter!)
                    break

                case MaskingStrategy.HASH:
                    result = this.generateHash(email, 'email')
                    break

                default:
                    result = email
            }

            this.recordOperation('maskEmail', 'email', 'string', actualStrategy, true)
            this.updateMaskingStatistics('email')

            return result

        } catch (error) {
            this.recordOperation('maskEmail', 'email', 'string', actualStrategy, false, (error as Error).message)
            // 優雅處理錯誤：返回基本遮罩而不拋出異常
            return this.maskString(email, 1, 0)
        }
    }

    /**
     * 遮罩電話號碼
     * 
     * @param phone - 電話號碼
     * @param strategy - 遮罩策略
     * @returns 遮罩後的電話號碼
     */
    maskPhone(phone: string, strategy?: MaskingStrategy): string {
        const actualStrategy = strategy || this.options.phoneStrategy || MaskingStrategy.PARTIAL

        try {
            // 🔥 使用緩存的正則表達式
            const phoneRegex = this.getCachedRegex(
                '^(?:\\+886|0)([0-9]{1,2})([0-9]{7,8})$|^([0-9]{3,4})-?([0-9]{6,8})$'
            )

            let result: string

            switch (actualStrategy) {
                case MaskingStrategy.COMPLETE:
                    result = this.options.maskCharacter!.repeat(phone.length)
                    break

                case MaskingStrategy.PARTIAL:
                    // 保留前2碼和後2碼
                    result = this.maskString(phone, 2, 2)
                    break

                case MaskingStrategy.FORMAT_PRESERVING:
                    result = phone.replace(/[0-9]/g, this.options.maskCharacter!)
                    break

                case MaskingStrategy.HASH:
                    result = this.generateHash(phone, 'phone')
                    break

                default:
                    result = phone
            }

            this.recordOperation('maskPhone', 'phone', 'string', actualStrategy, true)
            this.updateMaskingStatistics('phone')

            return result

        } catch (error) {
            this.recordOperation('maskPhone', 'phone', 'string', actualStrategy, false, (error as Error).message)
            throw error
        }
    }

    /**
     * 遮罩信用卡號碼
     * 
     * @param creditCard - 信用卡號碼
     * @param strategy - 遮罩策略
     * @returns 遮罩後的信用卡號碼
     */
    maskCreditCard(creditCard: string, strategy?: MaskingStrategy): string {
        const actualStrategy = strategy || MaskingStrategy.PARTIAL

        try {
            // 🔥 使用緩存的正則表達式
            const creditCardRegex = this.getCachedRegex(
                '^[0-9]{13,19}$'
            )

            const cleanCard = creditCard.replace(/\s|-/g, '')

            if (!creditCardRegex.test(cleanCard)) {
                throw new Error('Invalid credit card format')
            }

            let result: string

            switch (actualStrategy) {
                case MaskingStrategy.COMPLETE:
                    result = this.options.maskCharacter!.repeat(creditCard.length)
                    break

                case MaskingStrategy.PARTIAL:
                    // 只顯示後4碼
                    const maskedPart = this.options.maskCharacter!.repeat(cleanCard.length - 4)
                    const visiblePart = cleanCard.slice(-4)
                    result = maskedPart + visiblePart
                    break

                case MaskingStrategy.FORMAT_PRESERVING:
                    result = creditCard.replace(/[0-9]/g, this.options.maskCharacter!)
                    break

                case MaskingStrategy.HASH:
                    result = this.generateHash(creditCard, 'creditCard')
                    break

                default:
                    result = creditCard
            }

            this.recordOperation('maskCreditCard', 'creditCard', 'string', actualStrategy, true)
            this.updateMaskingStatistics('creditCard')

            return result

        } catch (error) {
            this.recordOperation('maskCreditCard', 'creditCard', 'string', actualStrategy, false, (error as Error).message)
            throw error
        }
    }

    /**
     * 遮罩台灣身分證字號
     * 
     * @param taiwanId - 台灣身分證字號
     * @param strategy - 遮罩策略
     * @returns 遮罩後的身分證字號
     */
    maskTaiwanId(taiwanId: string, strategy?: MaskingStrategy): string {
        const actualStrategy = strategy || MaskingStrategy.PARTIAL

        try {
            // 🔥 使用緩存的正則表達式
            const taiwanIdRegex = this.getCachedRegex(
                '^[A-Z][12][0-9]{8}$'
            )

            if (!taiwanIdRegex.test(taiwanId)) {
                throw new Error('Invalid Taiwan ID format')
            }

            let result: string

            switch (actualStrategy) {
                case MaskingStrategy.COMPLETE:
                    result = this.options.maskCharacter!.repeat(taiwanId.length)
                    break

                case MaskingStrategy.PARTIAL:
                    // 保留第1碼字母，遮罩中間部分，保留後2碼
                    result = taiwanId[0] + '****' + taiwanId.slice(-2)
                    break

                case MaskingStrategy.FORMAT_PRESERVING:
                    result = taiwanId.replace(/[A-Z0-9]/g, this.options.maskCharacter!)
                    break

                case MaskingStrategy.HASH:
                    result = this.generateHash(taiwanId, 'taiwanId')
                    break

                default:
                    result = taiwanId
            }

            this.recordOperation('maskTaiwanId', 'taiwanId', 'string', actualStrategy, true)
            this.updateMaskingStatistics('taiwanId')

            return result

        } catch (error) {
            this.recordOperation('maskTaiwanId', 'taiwanId', 'string', actualStrategy, false, (error as Error).message)
            throw error
        }
    }

    /**
     * 遮罩護照號碼
     * 
     * @param passport - 護照號碼
     * @param strategy - 遮罩策略
     * @returns 遮罩後的護照號碼
     */
    maskPassport(passport: string, strategy?: MaskingStrategy): string {
        const actualStrategy = strategy || MaskingStrategy.PARTIAL

        try {
            let result: string

            switch (actualStrategy) {
                case MaskingStrategy.COMPLETE:
                    result = this.options.maskCharacter!.repeat(passport.length)
                    break

                case MaskingStrategy.PARTIAL:
                    result = this.maskString(passport, 2, 2)
                    break

                case MaskingStrategy.FORMAT_PRESERVING:
                    result = passport.replace(/[A-Z0-9]/gi, this.options.maskCharacter!)
                    break

                case MaskingStrategy.HASH:
                    result = this.generateHash(passport, 'passport')
                    break

                default:
                    result = passport
            }

            this.recordOperation('maskPassport', 'passport', 'string', actualStrategy, true)
            this.updateMaskingStatistics('passport')

            return result

        } catch (error) {
            this.recordOperation('maskPassport', 'passport', 'string', actualStrategy, false, (error as Error).message)
            throw error
        }
    }

    /**
     * 遮罩地址
     * 
     * @param address - 地址
     * @param strategy - 遮罩策略
     * @returns 遮罩後的地址
     */
    maskAddress(address: string, strategy?: MaskingStrategy): string {
        const actualStrategy = strategy || MaskingStrategy.PARTIAL

        try {
            let result: string

            switch (actualStrategy) {
                case MaskingStrategy.COMPLETE:
                    result = this.options.maskCharacter!.repeat(address.length)
                    break

                case MaskingStrategy.PARTIAL:
                    // 🔥 使用緩存的正則表達式進行智慧部分遮罩
                    const cityRegex = this.getCachedRegex('([縣市]).*?([區鄉鎮市])')
                    const cityMatch = address.match(cityRegex)

                    if (cityMatch) {
                        // 保留縣市和區，遮罩詳細地址
                        const city = cityMatch[0]
                        const remainingAddress = address.replace(cityMatch[0], '')
                        result = city + this.options.maskCharacter!.repeat(Math.max(remainingAddress.length, 1))
                    } else {
                        result = this.maskString(address, 3, 0)
                    }
                    break

                case MaskingStrategy.FORMAT_PRESERVING:
                    result = address.replace(/[^縣市區鄉鎮村里路街段巷弄號樓]/g, this.options.maskCharacter!)
                    break

                case MaskingStrategy.HASH:
                    result = this.generateHash(address, 'address')
                    break

                default:
                    result = address
            }

            this.recordOperation('maskAddress', 'address', 'string', actualStrategy, true)
            this.updateMaskingStatistics('address')

            return result

        } catch (error) {
            this.recordOperation('maskAddress', 'address', 'string', actualStrategy, false, (error as Error).message)
            throw error
        }
    }

    /**
     * 遮罩姓名
     * 
     * @param name - 姓名
     * @param strategy - 遮罩策略
     * @returns 遮罩後的姓名
     */
    maskName(name: string, strategy?: MaskingStrategy): string {
        const actualStrategy = strategy || MaskingStrategy.PARTIAL

        try {
            let result: string

            switch (actualStrategy) {
                case MaskingStrategy.COMPLETE:
                    result = this.options.maskCharacter!.repeat(name.length)
                    break

                case MaskingStrategy.PARTIAL:
                    // 中文姓名：保留姓氏，遮罩名字
                    if (name.length <= 2) {
                        result = name[0] + this.options.maskCharacter!.repeat(name.length - 1)
                    } else {
                        result = name[0] + this.options.maskCharacter!.repeat(name.length - 1)
                    }
                    break

                case MaskingStrategy.FORMAT_PRESERVING:
                    result = name.replace(/[^\s]/g, this.options.maskCharacter!)
                    break

                case MaskingStrategy.HASH:
                    result = this.generateHash(name, 'name')
                    break

                default:
                    result = name
            }

            this.recordOperation('maskName', 'name', 'string', actualStrategy, true)
            this.updateMaskingStatistics('name')

            return result

        } catch (error) {
            this.recordOperation('maskName', 'name', 'string', actualStrategy, false, (error as Error).message)
            throw error
        }
    }

    /**
     * 遮罩銀行帳號
     * 
     * @param bankAccount - 銀行帳號
     * @param strategy - 遮罩策略
     * @returns 遮罩後的銀行帳號
     */
    maskBankAccount(bankAccount: string, strategy?: MaskingStrategy): string {
        const actualStrategy = strategy || MaskingStrategy.PARTIAL

        try {
            let result: string

            switch (actualStrategy) {
                case MaskingStrategy.COMPLETE:
                    result = this.options.maskCharacter!.repeat(bankAccount.length)
                    break

                case MaskingStrategy.PARTIAL:
                    // 保留後3碼
                    result = this.maskString(bankAccount, 0, 3)
                    break

                case MaskingStrategy.FORMAT_PRESERVING:
                    result = bankAccount.replace(/[0-9]/g, this.options.maskCharacter!)
                    break

                case MaskingStrategy.HASH:
                    result = this.generateHash(bankAccount, 'bankAccount')
                    break

                default:
                    result = bankAccount
            }

            this.recordOperation('maskBankAccount', 'bankAccount', 'string', actualStrategy, true)
            this.updateMaskingStatistics('bankAccount')

            return result

        } catch (error) {
            this.recordOperation('maskBankAccount', 'bankAccount', 'string', actualStrategy, false, (error as Error).message)
            throw error
        }
    }

    /**
     * 添加自訂遮罩規則
     * 
     * @param rule - 遮罩規則
     */
    addCustomRule(rule: MaskingRule): void {
        this.customRules.set(rule.field, rule)
    }

    /**
     * 移除自訂遮罩規則
     * 
     * @param fieldName - 欄位名稱
     */
    removeCustomRule(fieldName: string): void {
        this.customRules.delete(fieldName)
    }

    /**
     * 🔥 TDD Refactor Phase: 高效能遮罩資料物件
     * 
     * @param data - 要遮罩的資料
     * @param fieldMappings - 欄位對應規則
     * @returns 遮罩後的資料
     */
    async maskData(data: any, fieldMappings?: Record<string, string>): Promise<any> {
        return this.measurePerformance('maskData', async () => {
            if (data === null || data === undefined) {
                return data
            }

            if (Array.isArray(data)) {
                return Promise.all(data.map(item => this.maskData(item, fieldMappings)))
            }

            if (typeof data === 'object') {
                const result: any = {}

                for (const [key, value] of Object.entries(data)) {
                    if (typeof value === 'string') {
                        const fieldType = fieldMappings?.[key] || this.inferFieldType(key, value)
                        result[key] = await this.maskFieldValue(value, fieldType)
                    } else if (value !== null && typeof value === 'object') {
                        result[key] = await this.maskData(value, fieldMappings)
                    } else {
                        result[key] = value
                    }
                }

                return result
            }

            return data
        })
    }

    /**
     * 🔥 TDD Refactor Phase: 推斷欄位類型
     * 
     * @param fieldName - 欄位名稱
     * @param value - 欄位值
     * @returns 推斷的欄位類型
     * @private
     */
    private inferFieldType(fieldName: string, value: string): string {
        const lowerFieldName = fieldName.toLowerCase()

        // 檢查自訂規則
        if (this.customRules.has(fieldName)) {
            return 'custom'
        }

        // 🔥 使用緩存的正則表達式進行模式匹配
        if (lowerFieldName.includes('email') || this.getCachedRegex('@.+\\..+').test(value)) {
            return 'email'
        }

        if (lowerFieldName.includes('phone') || lowerFieldName.includes('tel') ||
            this.getCachedRegex('^[+]?[0-9\\s\\-\\(\\)]+$').test(value)) {
            return 'phone'
        }

        if (lowerFieldName.includes('card') || lowerFieldName.includes('credit') ||
            this.getCachedRegex('^[0-9]{13,19}$').test(value.replace(/[\s\-]/g, ''))) {
            return 'creditCard'
        }

        if (lowerFieldName.includes('id') || lowerFieldName.includes('身分證') ||
            this.getCachedRegex('^[A-Z][12][0-9]{8}$').test(value)) {
            return 'taiwanId'
        }

        if (lowerFieldName.includes('passport') || lowerFieldName.includes('護照')) {
            return 'passport'
        }

        if (lowerFieldName.includes('address') || lowerFieldName.includes('地址') ||
            this.getCachedRegex('[縣市區鄉鎮村里路街段巷弄號樓]').test(value)) {
            return 'address'
        }

        if (lowerFieldName.includes('name') || lowerFieldName.includes('姓名')) {
            return 'name'
        }

        if (lowerFieldName.includes('account') || lowerFieldName.includes('帳號')) {
            return 'bankAccount'
        }

        return 'unknown'
    }

    /**
     * 🔥 TDD Refactor Phase: 遮罩欄位值
     * 
     * @param value - 欄位值
     * @param fieldType - 欄位類型
     * @returns 遮罩後的值
     * @private
     */
    private async maskFieldValue(value: string, fieldType: string): Promise<string> {
        try {
            switch (fieldType) {
                case 'email':
                    return this.maskEmail(value)
                case 'phone':
                    return this.maskPhone(value)
                case 'creditCard':
                    return this.maskCreditCard(value)
                case 'taiwanId':
                    return this.maskTaiwanId(value)
                case 'passport':
                    return this.maskPassport(value)
                case 'address':
                    return this.maskAddress(value)
                case 'name':
                    return this.maskName(value)
                case 'bankAccount':
                    return this.maskBankAccount(value)
                case 'custom':
                    return this.applyCustomRule(value)
                default:
                    return value
            }
        } catch (error) {
            // 遮罩失敗時返回原值或預設遮罩
            this.recordOperation(`mask${fieldType}`, fieldType, 'string', MaskingStrategy.COMPLETE, false, (error as Error).message)
            return this.options.preserveFormat ? value : this.options.maskCharacter!.repeat(value.length)
        }
    }

    /**
     * 套用自訂遮罩規則
     * 
     * @param value - 要遮罩的值
     * @returns 遮罩後的值
     * @private
     */
    private applyCustomRule(value: string): string {
        for (const rule of this.customRules.values()) {
            if (rule.pattern.test(value)) {
                return value.replace(rule.pattern, rule.replacement)
            }
        }
        return value
    }

    /**
     * 通用字串遮罩方法
     * 
     * @param str - 要遮罩的字串
     * @param prefixLength - 前綴保留長度
     * @param suffixLength - 後綴保留長度
     * @returns 遮罩後的字串
     * @private
     */
    private maskString(str: string, prefixLength: number, suffixLength: number): string {
        if (str.length <= prefixLength + suffixLength) {
            return str[0] + this.options.maskCharacter!.repeat(str.length - 1)
        }

        const prefix = str.slice(0, prefixLength)
        const suffix = str.slice(-suffixLength)
        const maskLength = str.length - prefixLength - suffixLength

        return prefix + this.options.maskCharacter!.repeat(maskLength) + suffix
    }

    /**
     * 生成雜湊值
     * 
     * @param value - 要雜湊的值
     * @param type - 資料類型
     * @returns 雜湊值
     * @private
     */
    private generateHash(value: string, type: string): string {
        const hash = createHash('sha256')
        hash.update(`${type}:${value}:${Date.now()}`)
        return `${type.toUpperCase()}_${hash.digest('hex').slice(0, 8)}`
    }

    /**
     * 更新遮罩統計
     * 
     * @param type - 遮罩類型
     * @private
     */
    private updateMaskingStatistics(type: string): void {
        if (!this.options.enableStatistics) return

        this.statistics.totalMaskedItems++

        if (this.statistics.maskingTypes[type] !== undefined) {
            this.statistics.maskingTypes[type]++
        } else {
            this.statistics.maskingTypes[type] = 1
        }
    }

    /**
     * 獲取遮罩統計
     * 
     * @returns 遮罩統計資料
     */
    getStatistics(): MaskingStatistics {
        return { ...this.statistics }
    }

    /**
     * 獲取審計日誌
     * 
     * @param limit - 限制返回數量
     * @returns 審計日誌條目陣列
     */
    getAuditLog(limit?: number): AuditLogEntry[] {
        const logs = [...this.auditLog].reverse() // 最新的在前
        return limit ? logs.slice(0, limit) : logs
    }

    /**
     * 🔥 TDD Refactor Phase: 清理緩存和統計資料
     */
    clearCache(): void {
        this.regexCache.clear()
        this.performanceTracker.clear()
        this.auditLog = []
        this.initializeStatistics()
    }

    /**
     * 🔥 TDD Refactor Phase: 獲取效能指標
     * 
     * @returns 效能指標物件
     */
    getPerformanceMetrics(): {
        cacheSize: number
        cacheHitRate: number
        averageProcessingTime: number
        totalOperations: number
        memoryUsage: {
            auditLogSize: number
            cacheSize: number
        }
    } {
        return {
            cacheSize: this.regexCache.size,
            cacheHitRate: this.statistics.operationStats.cacheHitRate,
            averageProcessingTime: this.statistics.performanceStats.averageProcessingTime,
            totalOperations: this.statistics.totalMaskedItems,
            memoryUsage: {
                auditLogSize: this.auditLog.length,
                cacheSize: this.regexCache.size
            }
        }
    }

    /**
     * 🔥 TDD Refactor Phase: 配置更新
     * 
     * @param newOptions - 新的配置選項
     */
    updateOptions(newOptions: Partial<MaskingOptions>): void {
        this.options = {
            ...this.options,
            ...newOptions
        }
    }

    /**
     * 🔥 TDD Refactor Phase: 批次遮罩處理
     * 
     * @param items - 要處理的資料陣列
     * @param fieldMappings - 欄位對應規則
     * @param batchSize - 批次大小
     * @returns 遮罩後的資料陣列
     */
    async maskBatch<T>(
        items: T[],
        fieldMappings?: Record<string, string>,
        batchSize: number = 100
    ): Promise<T[]> {
        const results: T[] = []

        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize)
            const maskedBatch = await Promise.all(
                batch.map(item => this.maskData(item, fieldMappings))
            )
            results.push(...maskedBatch)
        }

        return results
    }

    // ========================================
    // 🔥 TDD Refactor Phase: 向後相容性方法
    // ========================================

    /**
     * 遮罩密碼 - 完全遮罩
     * 
     * @param password - 密碼
     * @returns 遮罩後的密碼
     */
    maskPassword(password: string): string {
        return '***'
    }

    /**
     * 遮罩金額
     * 
     * @param amount - 金額
     * @returns 遮罩後的金額
     */
    maskAmount(amount: number | string): string {
        const amountStr = amount.toString()
        return '***.' + amountStr.slice(-2) // 保留小數點後兩位
    }

    /**
     * 遮罩貨幣
     * 
     * @param currency - 貨幣字串
     * @returns 遮罩後的貨幣
     */
    maskCurrency(currency: string): string {
        return currency.replace(/[0-9]/g, '*')
    }

    /**
     * 添加遮罩規則 (向後相容性別名)
     * 
     * @param rule - 遮罩規則
     */
    addRule(rule: MaskingRule): void {
        this.addCustomRule(rule)
    }

    /**
     * 套用遮罩規則
     * 
     * @param fieldName - 欄位名稱
     * @param value - 值
     * @returns 遮罩後的值
     */
    applyRule(fieldName: string, value: string): string {
        const rule = this.customRules.get(fieldName)
        if (rule && rule.pattern.test(value)) {
            return value.replace(rule.pattern, rule.replacement)
        }
        return value
    }

    /**
     * 遮罩物件 (向後相容性)
     * 
     * @param obj - 要遮罩的物件
     * @param fields - 要遮罩的欄位
     * @returns 遮罩後的物件
     */
    async maskObject(obj: any, fields: string[]): Promise<any> {
        const fieldMappings: Record<string, string> = {}
        fields.forEach(field => {
            // 簡單映射：根據欄位名推斷類型
            const fieldType = this.inferFieldType(field, '')
            fieldMappings[field] = fieldType
        })
        return this.maskData(obj, fieldMappings)
    }

    /**
     * 遮罩陣列
     * 
     * @param array - 要遮罩的陣列
     * @param fieldType - 欄位類型或欄位類型陣列
     * @returns 遮罩後的陣列
     */
    async maskArray(array: any[], fieldType: string | string[]): Promise<any[]> {
        if (typeof fieldType === 'string') {
            // 單一類型：所有元素都當作此類型處理
            return Promise.all(array.map(async item => {
                if (typeof item === 'string') {
                    return this.maskFieldValue(item, fieldType)
                }
                return this.maskData(item)
            }))
        } else {
            // 多種類型：根據欄位映射處理物件
            const fieldMappings: Record<string, string> = {}
            fieldType.forEach(field => {
                fieldMappings[field] = this.inferFieldType(field, '')
            })
            return this.maskBatch(array, fieldMappings)
        }
    }

    /**
     * 遮罩深層物件
     * 
     * @param obj - 要遮罩的物件
     * @param fieldPaths - 欄位路徑陣列
     * @returns 遮罩後的物件
     */
    async maskDeepObject(obj: any, fieldPaths: string[]): Promise<any> {
        const result = JSON.parse(JSON.stringify(obj)) // 深拷貝

        for (const path of fieldPaths) {
            await this.maskObjectByPath(result, path)
        }

        return result
    }

    /**
     * 根據路徑遮罩物件屬性
     * 
     * @param obj - 物件
     * @param path - 路徑 (如 'users.*.profile.email')
     * @private
     */
    private async maskObjectByPath(obj: any, path: string): Promise<void> {
        const parts = path.split('.')

        let current = obj
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i]

            if (part === '*') {
                // 通配符：處理陣列或物件的所有項目
                if (Array.isArray(current)) {
                    await Promise.all(current.map(item =>
                        this.maskObjectByPath(item, parts.slice(i + 1).join('.'))
                    ))
                } else if (typeof current === 'object') {
                    await Promise.all(Object.values(current).map(item =>
                        this.maskObjectByPath(item, parts.slice(i + 1).join('.'))
                    ))
                }
                return
            } else {
                current = current[part]
                if (!current) return
            }
        }

        // 遮罩最終屬性
        const finalProp = parts[parts.length - 1]
        if (current && typeof current[finalProp] === 'string') {
            const fieldType = this.inferFieldType(finalProp, current[finalProp])
            current[finalProp] = await this.maskFieldValue(current[finalProp], fieldType)
        }
    }

    /**
     * 遮罩日誌條目
     * 
     * @param logEntry - 日誌條目
     * @returns 遮罩後的日誌條目
     */
    async maskLogEntry(logEntry: any): Promise<any> {
        const result = { ...logEntry }

        if (result.message) {
            // 在訊息中尋找並遮罩敏感資料
            result.message = await this.maskTextContent(result.message)
        }

        return result
    }

    /**
     * 遮罩 API 回應
     * 
     * @param response - API 回應
     * @param fieldPaths - 要遮罩的欄位路徑
     * @returns 遮罩後的回應
     */
    async maskApiResponse(response: any, fieldPaths: string[]): Promise<any> {
        return this.maskDeepObject(response, fieldPaths)
    }

    /**
     * 遮罩文字內容中的敏感資料
     * 
     * @param text - 文字內容
     * @returns 遮罩後的文字
     * @private
     */
    private async maskTextContent(text: string): Promise<string> {
        let result = text

        try {
            // 遮罩電子郵件
            result = result.replace(this.getCachedRegex('[\\w\\.-]+@[\\w\\.-]+\\.[\\w]+', 'g'),
                (match) => {
                    try {
                        return this.maskEmail(match)
                    } catch {
                        return match.replace(/[a-zA-Z0-9]/g, '*')
                    }
                })

            // 遮罩電話號碼
            result = result.replace(this.getCachedRegex('\\b0\\d{2,3}-?\\d{6,8}\\b', 'g'),
                (match) => {
                    try {
                        return this.maskPhone(match)
                    } catch {
                        return match.replace(/[0-9]/g, '*')
                    }
                })
        } catch (error) {
            // 如果遮罩失敗，返回原文字
            return text
        }

        return result
    }
}

/**
 * 🔥 TDD Refactor Phase: 預設匯出單例實例
 */
export const defaultDataMasker = new DataMasker()

/**
 * 🔥 TDD Refactor Phase: 便利函數匯出
 */
export const maskEmail = (email: string, strategy?: MaskingStrategy) =>
    defaultDataMasker.maskEmail(email, strategy)

export const maskPhone = (phone: string, strategy?: MaskingStrategy) =>
    defaultDataMasker.maskPhone(phone, strategy)

export const maskCreditCard = (creditCard: string, strategy?: MaskingStrategy) =>
    defaultDataMasker.maskCreditCard(creditCard, strategy)

export const maskData = (data: any, fieldMappings?: Record<string, string>) =>
    defaultDataMasker.maskData(data, fieldMappings)
