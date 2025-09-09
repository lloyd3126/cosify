/**
 * Phase 2.9: 敏感資料遮罩服務
 * 
 * � TDD Refactor Phase: 優化效能和程式碼品質
 * 
 * 企業級功能特色：
 * - 多種遮罩策略 (完全遮罩、部分遮罩、格式保留、雜湊遮罩)
 export class DataMasker {
    private options: MaskingOptions
    private customRules: Map<string, MaskingRule>
    private statistics: MaskingStatistics
    private auditLog: AuditLogEntry[]
    
    // 性能優化：緩存編譯的正則表達式
    private regexCache: Map<string, RegExp>
    // 記憶體管理：限制審計日誌大小
    private readonly MAX_AUDIT_LOG_SIZE = 10000
    private readonly AUDIT_LOG_CLEANUP_SIZE = 5000

  constructor(options: MaskingOptions = {}) {援各類敏感資料 (電子郵件、電話、信用卡、身分證、護照、地址等)
 * - 靈活的自訂遮罩規則和模式配置
 * - 高效能處理大型資料集和並發操作
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
 * 遮罩規則接口
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
 * 遮罩統計接口
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
    performance: {
        averageProcessingTime: number
        totalProcessingTime: number
    }
}

/**
 * 審計日誌接口
 */
export interface AuditLogEntry {
    /** 時間戳記 */
    timestamp: string
    /** 操作動作 */
    action: 'mask' | 'unmask' | 'validate'
    /** 目標欄位 */
    field: string
    /** 遮罩策略 */
    strategy: MaskingStrategy
    /** 原始值雜湊 (用於追蹤但不洩漏敏感資訊) */
    originalHash: string
    /** 處理時間 (毫秒) */
    processingTime: number
}

/**
 * 敏感資料遮罩器
 * 
 * 提供企業級的敏感資料遮罩功能，支援多種遮罩策略和自訂規則
 */
export class DataMasker {
    private options: MaskingOptions
    private customRules: Map<string, MaskingRule>
    private statistics: MaskingStatistics
    private auditLog: AuditLogEntry[]

    constructor(options: MaskingOptions = {}) {
        this.options = {
            emailStrategy: MaskingStrategy.PARTIAL,
            phoneStrategy: MaskingStrategy.PARTIAL,
            preserveFormat: true,
            maskCharacter: '*',
            minVisibleChars: 1,
            maxVisibleChars: 4,
            enableStatistics: true,
            enableAudit: false,
            ...options
        }

        this.customRules = new Map()
        this.regexCache = new Map()
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
            performance: {
                averageProcessingTime: 0,
                totalProcessingTime: 0
            }
        }
        this.auditLog = []
    }

    /**
     * 遮罩電子郵件地址
     */
    maskEmail(email: any): any {
        if (email == null || email === '') return email
        if (typeof email !== 'string') return email

        const startTime = Date.now()

        try {
            const emailRegex = /^([^@]+)@(.+)$/
            const match = email.match(emailRegex)

            if (!match) return email

            const [, username, domain] = match
            const maskedUsername = this.applyMaskingStrategy(
                username,
                this.options.emailStrategy!
            )

            const result = `${maskedUsername}@${domain}`

            this.recordOperation('email', 'mask', email, startTime)
            return result
        } catch {
            return email
        }
    }

    /**
     * 遮罩電話號碼
     */
    maskPhone(phone: any): any {
        if (phone == null || phone === '') return phone
        if (typeof phone !== 'string') return phone

        const startTime = Date.now()

        try {
            // 移除所有非數字字符
            const digits = phone.replace(/\D/g, '')
            const format = phone.replace(/\d/g, 'X')

            if (digits.length < 8) return phone

            let maskedDigits: string
            if (this.options.phoneStrategy === MaskingStrategy.COMPLETE) {
                maskedDigits = this.options.maskCharacter!.repeat(digits.length)
            } else {
                // 保留前3位和後4位
                const visibleStart = digits.slice(0, 3)
                const visibleEnd = digits.slice(-4)
                const maskLength = Math.max(0, digits.length - 7)
                maskedDigits = visibleStart + this.options.maskCharacter!.repeat(maskLength) + visibleEnd
            }

            // 恢復原格式
            let result = format
            let digitIndex = 0
            result = result.replace(/X/g, () => maskedDigits[digitIndex++] || 'X')

            this.recordOperation('phone', 'mask', phone, startTime)
            return result
        } catch {
            return phone
        }
    }

    /**
     * 遮罩信用卡號碼
     */
    maskCreditCard(creditCard: any): any {
        if (creditCard == null || creditCard === '') return creditCard
        if (typeof creditCard !== 'string') return creditCard

        const startTime = Date.now()

        try {
            const digits = creditCard.replace(/\D/g, '')
            if (digits.length < 12 || digits.length > 19) return creditCard

            // 保留最後4位
            const lastFour = digits.slice(-4)
            const maskLength = digits.length - 4
            const maskedPart = this.options.maskCharacter!.repeat(maskLength)

            // 保持原格式
            const format = creditCard.replace(/\d/g, 'X')
            const maskedDigits = maskedPart + lastFour

            let result = format
            let digitIndex = 0
            result = result.replace(/X/g, () => maskedDigits[digitIndex++] || 'X')

            this.recordOperation('creditCard', 'mask', creditCard, startTime)
            return result
        } catch {
            return creditCard
        }
    }

    /**
     * 完全遮罩密碼
     */
    maskPassword(password: any): any {
        if (password == null || password === '') return password

        const startTime = Date.now()
        const result = '***'

        this.recordOperation('password', 'mask', String(password), startTime)
        return result
    }

    /**
     * 遮罩台灣身分證字號
     */
    maskTaiwanId(taiwanId: any): any {
        if (taiwanId == null || taiwanId === '') return taiwanId
        if (typeof taiwanId !== 'string') return taiwanId

        const startTime = Date.now()

        try {
            if (taiwanId.length !== 10) return taiwanId

            // 保留第一個字母和最後兩位數字
            const result = taiwanId[0] + '****' + taiwanId.slice(-2)

            this.recordOperation('taiwanId', 'mask', taiwanId, startTime)
            return result
        } catch {
            return taiwanId
        }
    }

    /**
     * 遮罩護照號碼
     */
    maskPassport(passport: any): any {
        if (passport == null || passport === '') return passport
        if (typeof passport !== 'string') return passport

        const startTime = Date.now()

        try {
            if (passport.length < 6) return passport

            // 保留前2個字符和最後1個字符
            const visibleStart = passport.slice(0, 2)
            const visibleEnd = passport.slice(-1)
            const maskLength = Math.max(0, passport.length - 3)
            const result = visibleStart + this.options.maskCharacter!.repeat(maskLength) + visibleEnd

            this.recordOperation('passport', 'mask', passport, startTime)
            return result
        } catch {
            return passport
        }
    }

    /**
     * 遮罩地址
     */
    maskAddress(address: any): any {
        if (address == null || address === '') return address
        if (typeof address !== 'string') return address

        const startTime = Date.now()

        try {
            // 如果是完整地址格式
            if (address.includes('市') || address.includes('縣')) {
                const result = address.replace(/(市|縣)(.+?)(區|鎮|鄉)(.+?)(路|街|巷)(.+?)(號)(.+?)(樓)/g,
                    '$1***$3***$5***$7***$9')
                this.recordOperation('address', 'mask', address, startTime)
                return result
            }

            // 如果是街道地址或簡單地址  
            if (address.includes('路') || address.includes('街') || address.includes('巷')) {
                const result = address.replace(/(.+?)(路|街|巷)(.+)/, '***$2***')
                this.recordOperation('address', 'mask', address, startTime)
                return result
            }

            // 其他地址格式，使用通用遮罩
            const result = '***' + address.slice(-2)
            this.recordOperation('address', 'mask', address, startTime)
            return result
        } catch {
            return address
        }
    }    /**
     * 遮罩姓名
     */
    maskName(name: any): any {
        if (name == null || name === '') return name
        if (typeof name !== 'string') return name

        const startTime = Date.now()

        try {
            // 中文姓名：保留姓氏
            if (/^[\u4e00-\u9fa5]{2,4}$/.test(name)) {
                const result = name[0] + '*'.repeat(name.length - 1)
                this.recordOperation('name', 'mask', name, startTime)
                return result
            }

            // 英文姓名：保留首字母
            const parts = name.split(' ')
            const result = parts.map(part =>
                part.length > 0 ? part[0] + '*'.repeat(Math.max(0, part.length - 1)) : part
            ).join(' ')

            this.recordOperation('name', 'mask', name, startTime)
            return result
        } catch {
            return name
        }
    }

    /**
     * 遮罩銀行帳戶
     */
    maskBankAccount(account: any): any {
        if (account == null || account === '') return account
        if (typeof account !== 'string') return account

        const startTime = Date.now()

        try {
            const digits = account.replace(/\D/g, '')
            if (digits.length < 6) return account

            // 保留最後3位數字
            const visibleEnd = digits.slice(-3)
            const maskLength = digits.length - 3
            const maskedDigits = this.options.maskCharacter!.repeat(maskLength) + visibleEnd

            // 恢復原格式
            const format = account.replace(/\d/g, 'X')
            let result = format
            let digitIndex = 0
            result = result.replace(/X/g, () => maskedDigits[digitIndex++] || 'X')

            this.recordOperation('bankAccount', 'mask', account, startTime)
            return result
        } catch {
            return account
        }
    }

    /**
     * 遮罩金額
     */
    maskAmount(amount: any): any {
        if (amount == null) return amount

        const startTime = Date.now()
        const result = '***'

        this.recordOperation('amount', 'mask', String(amount), startTime)
        return result
    }

    /**
     * 遮罩貨幣格式
     */
    maskCurrency(currency: any): any {
        if (currency == null || currency === '') return currency
        if (typeof currency !== 'string') return currency

        const startTime = Date.now()

        try {
            // 保留貨幣符號，金額部分遮罩
            const result = currency.replace(/\d/g, '*')

            this.recordOperation('currency', 'mask', currency, startTime)
            return result
        } catch {
            return currency
        }
    }

    /**
     * 遮罩美國社會安全號碼 (SSN)
     */
    maskSsn(ssn: any): any {
        if (ssn == null || ssn === '') return ssn
        if (typeof ssn !== 'string') return ssn

        const startTime = Date.now()

        try {
            // 格式：XXX-XX-XXXX 保留前三位
            const result = ssn.replace(/(\d{3})-(\d{2})-(\d{4})/, '$1-**-****')

            this.recordOperation('ssn', 'mask', ssn, startTime)
            return result
        } catch {
            return ssn
        }
    }    /**
     * 添加自訂遮罩規則
     */
    addRule(rule: MaskingRule): void {
        if (!rule.field || !rule.pattern || rule.replacement == null) {
            throw new Error('Invalid masking rule: field, pattern, and replacement are required')
        }

        this.customRules.set(rule.field, rule)
    }

    /**
     * 應用自訂規則
     */
    applyRule(field: string, value: any): any {
        const rule = this.customRules.get(field)
        if (!rule) return value

        if (value == null || typeof value !== 'string') return value

        const startTime = Date.now()

        try {
            const result = value.replace(rule.pattern, rule.replacement)
            this.recordOperation(field, 'mask', value, startTime)
            return result
        } catch {
            return value
        }
    }

    /**
     * 遮罩物件
     */
    maskObject(obj: any, fields: string[]): any {
        if (obj == null || typeof obj !== 'object') return obj

        const result = { ...obj }

        fields.forEach(field => {
            const value = this.getNestedValue(result, field)
            // 從欄位路徑推斷類型
            const fieldType = this.inferFieldType(field.split('.').pop()!)

            // 如果值是陣列，使用 maskArray 方法
            if (Array.isArray(value)) {
                const maskedValue = this.maskArray(value, fieldType)
                this.setNestedValue(result, field, maskedValue)
            } else {
                const maskedValue = this.maskValue(value, fieldType)
                this.setNestedValue(result, field, maskedValue)
            }
        })

        return result
    }

    /**
     * 遮罩陣列
     */
    maskArray(arr: any[], typeOrFields: string | string[]): any[] {
        if (!Array.isArray(arr)) return arr

        return arr.map(item => {
            if (typeof item === 'string') {
                const type = Array.isArray(typeOrFields) ? typeOrFields[0] : typeOrFields
                return this.maskValue(item, type)
            } else if (typeof item === 'object' && item != null) {
                const fields = Array.isArray(typeOrFields) ? typeOrFields : [typeOrFields]
                return this.maskObject(item, fields)
            }
            return item
        })
    }    /**
     * 遮罩深層嵌套物件
     */
    maskDeepObject(obj: any, fieldPaths: string[]): any {
        if (obj == null || typeof obj !== 'object') return obj

        const result = JSON.parse(JSON.stringify(obj))

        fieldPaths.forEach(path => {
            this.maskDeepPath(result, path)
        })

        return result
    }

    /**
     * 遮罩日誌項目
     */
    maskLogEntry(logEntry: any): any {
        if (typeof logEntry !== 'object' || logEntry == null) return logEntry

        const result = { ...logEntry }

        // 遮罩訊息中的敏感資料
        if (result.message) {
            result.message = this.maskSensitiveInText(result.message)
        }

        // 遮罩用戶ID
        if (result.userId) {
            result.userId = this.maskTaiwanId(result.userId)
        }

        // 遮罩IP地址
        if (result.metadata?.ip) {
            result.metadata.ip = this.maskIpAddress(result.metadata.ip)
        }

        return result
    }

    /**
     * 遮罩API回應
     */
    maskApiResponse(response: any, fieldPaths: string[]): any {
        return this.maskDeepObject(response, fieldPaths)
    }

    /**
     * 獲取遮罩統計
     */
    getStatistics(): MaskingStatistics {
        if (this.statistics.totalMaskedItems > 0) {
            this.statistics.performance.averageProcessingTime =
                this.statistics.performance.totalProcessingTime / this.statistics.totalMaskedItems
        }

        return { ...this.statistics }
    }

    /**
     * 重置統計
     */
    resetStatistics(): void {
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
            performance: {
                averageProcessingTime: 0,
                totalProcessingTime: 0
            }
        }
    }

    /**
     * 獲取審計日誌
     */
    getAuditLog(): AuditLogEntry[] {
        return [...this.auditLog]
    }

    /**
     * 清除審計日誌
     */
    clearAuditLog(): void {
        this.auditLog = []
    }

    // 私有輔助方法

    /**
     * 應用遮罩策略
     */
    private applyMaskingStrategy(text: string, strategy: MaskingStrategy): string {
        switch (strategy) {
            case MaskingStrategy.COMPLETE:
                return this.options.maskCharacter!.repeat(text.length)

            case MaskingStrategy.PARTIAL:
                if (text.length <= 2) return this.options.maskCharacter!.repeat(text.length)
                const visibleStart = Math.min(this.options.maxVisibleChars!, Math.floor(text.length / 3))
                return text.slice(0, visibleStart) +
                    this.options.maskCharacter!.repeat(text.length - visibleStart)

            case MaskingStrategy.HASH:
                return createHash('sha256').update(text).digest('hex').slice(0, 8)

            default:
                return this.applyMaskingStrategy(text, MaskingStrategy.PARTIAL)
        }
    }

    /**
     * 根據類型遮罩值
     */
    private maskValue(value: any, type: string): any {
        switch (type) {
            case 'email': return this.maskEmail(value)
            case 'phone': return this.maskPhone(value)
            case 'creditCard': return this.maskCreditCard(value)
            case 'password': return this.maskPassword(value)
            case 'taiwanId': return this.maskTaiwanId(value)
            case 'passport': return this.maskPassport(value)
            case 'name': return this.maskName(value)
            case 'address': return this.maskAddress(value)
            case 'bankAccount': return this.maskBankAccount(value)
            case 'amount': return this.maskAmount(value)
            case 'currency': return this.maskCurrency(value)
            case 'ssn': return this.maskSsn(value)
            case 'street': return this.maskAddress(value) // 街道地址使用相同邏輯
            default: return value
        }
    }    /**
     * 獲取嵌套屬性值
     */
    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => current?.[key], obj)
    }

    /**
     * 設置嵌套屬性值
     */
    private setNestedValue(obj: any, path: string, value: any): void {
        const keys = path.split('.')
        const lastKey = keys.pop()!
        const target = keys.reduce((current, key) => {
            if (current[key] == null) current[key] = {}
            return current[key]
        }, obj)

        target[lastKey] = value
    }

    /**
     * 遮罩深層路徑
     */
    private maskDeepPath(obj: any, path: string): void {
        if (path.includes('*')) {
            // 處理萬用字符路徑
            const parts = path.split('.')
            let current = obj

            for (let i = 0; i < parts.length; i++) {
                if (parts[i] === '*') {
                    if (Array.isArray(current)) {
                        current.forEach(item => {
                            const remainingPath = parts.slice(i + 1).join('.')
                            if (remainingPath) {
                                this.maskDeepPath(item, remainingPath)
                            }
                        })
                    }
                    return
                } else if (i === parts.length - 1) {
                    // 最後一個部分，進行遮罩
                    const fieldType = this.inferFieldType(parts[i])
                    current[parts[i]] = this.maskValue(current[parts[i]], fieldType)
                } else {
                    current = current[parts[i]]
                    if (current == null) return
                }
            }
        } else {
            // 一般路徑處理
            const fieldType = this.inferFieldType(path.split('.').pop()!)
            const value = this.getNestedValue(obj, path)
            const maskedValue = this.maskValue(value, fieldType)
            this.setNestedValue(obj, path, maskedValue)
        }
    }

    /**
     * 推斷欄位類型
     */
    private inferFieldType(fieldName: string): string {
        const field = fieldName.toLowerCase()

        if (field.includes('email')) return 'email'
        if (field.includes('phone') || field.includes('mobile')) return 'phone'
        if (field.includes('credit') || field.includes('card')) return 'creditCard'
        if (field.includes('password') || field.includes('pwd')) return 'password'
        if (field.includes('id') || field.includes('identification')) return 'taiwanId'
        if (field.includes('passport')) return 'passport'
        if (field.includes('name')) return 'name'
        if (field.includes('address')) return 'address'
        if (field.includes('account') || field.includes('bank')) return 'bankAccount'
        if (field.includes('amount') || field.includes('money')) return 'amount'
        if (field.includes('ssn') || field.includes('social')) return 'ssn'
        if (field.includes('street')) return 'street'

        return 'generic'
    }

    /**
     * 遮罩文字中的敏感資料
     */
    private maskSensitiveInText(text: string): string {
        // 遮罩電子郵件
        text = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
            (email) => this.maskEmail(email))

        // 遮罩電話號碼
        text = text.replace(/\b(\+?886-?)?0?\d{2,3}-?\d{3,4}-?\d{3,4}\b/g,
            (phone) => this.maskPhone(phone))

        return text
    }

    /**
     * 遮罩IP地址
     */
    private maskIpAddress(ip: string): string {
        const parts = ip.split('.')
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.*.*`
        }
        return ip
    }

    /**
     * 記錄操作統計和審計
     */
    private recordOperation(type: string, action: 'mask' | 'unmask' | 'validate',
        originalValue: string, startTime: number): void {
        const endTime = Date.now()
        const processingTime = endTime - startTime

        // 更新統計
        if (this.options.enableStatistics) {
            this.statistics.totalMaskedItems++
            if (this.statistics.maskingTypes[type] !== undefined) {
                this.statistics.maskingTypes[type]++
            } else {
                this.statistics.maskingTypes[type] = 1
            }
            this.statistics.performance.totalProcessingTime += processingTime
        }

        // 記錄審計日誌並管理記憶體使用
        if (this.options.enableAudit) {
            this.auditLog.push({
                timestamp: new Date().toISOString(),
                action,
                field: type,
                strategy: this.options.emailStrategy || MaskingStrategy.PARTIAL,
                originalHash: createHash('sha256').update(originalValue).digest('hex'),
                processingTime
            })

            // 記憶體管理：當審計日誌過大時進行清理
            if (this.auditLog.length > this.MAX_AUDIT_LOG_SIZE) {
                this.auditLog = this.auditLog.slice(-this.AUDIT_LOG_CLEANUP_SIZE)
            }
        }
    }
}
