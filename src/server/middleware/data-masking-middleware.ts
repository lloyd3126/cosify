/**
 * Phase 2.9: 敏感資料遮罩中間件
 * 
 * 🟢 TDD Green Phase: 實作 Next.js API 路由遮罩中間件
 * 
 * 功能特色：
 * - Next.js API 路由整合
 * - 請求/回應資料自動遮罩
 * - 基於角色的條件遮罩
 * - 審計日誌和統計
 * - 高效能處理
 */

import { NextRequest, NextResponse } from 'next/server'
import { DataMasker, MaskingOptions, MaskingStrategy } from '../services/data-masker'

/**
 * 中間件選項配置
 */
export interface DataMaskingMiddlewareOptions {
    /** 是否遮罩請求資料 */
    maskRequest?: boolean
    /** 是否遮罩回應資料 */
    maskResponse?: boolean
    /** 需要遮罩的請求欄位 */
    requestFields?: string[]
    /** 需要遮罩的回應欄位 */
    responseFields?: string[]
    /** 跳過遮罩的角色 */
    skipForRoles?: string[]
    /** 是否啟用審計 */
    enableAudit?: boolean
    /** 遮罩選項 */
    maskingOptions?: MaskingOptions
    /** 錯誤處理選項 */
    skipOnError?: boolean
}

/**
 * 審計日誌項目
 */
export interface MiddlewareAuditLog {
    /** 時間戳記 */
    timestamp: string
    /** 請求ID */
    requestId: string
    /** 操作動作 */
    action: 'mask' | 'skip' | 'error'
    /** 目標欄位 */
    field: string
    /** 用戶角色 */
    userRole?: string
    /** 處理時間 */
    processingTime: number
    /** 錯誤信息 */
    error?: string
}

/**
 * 敏感資料遮罩中間件
 * 
 * 提供 Next.js API 路由的自動敏感資料遮罩功能
 */
export class DataMaskingMiddleware {
    private dataMasker: DataMasker
    private auditLog: MiddlewareAuditLog[]
    private requestCounter: number

    constructor() {
        this.dataMasker = new DataMasker({
            enableStatistics: true,
            enableAudit: true
        })
        this.auditLog = []
        this.requestCounter = 0
    }

    /**
     * 建立遮罩中間件函數
     */
    createMiddleware(options: DataMaskingMiddlewareOptions = {}) {
        return async (req: any, res: any, next: Function) => {
            const startTime = Date.now()
            const requestId = this.generateRequestId()

            try {
                // 檢查是否應跳過遮罩
                const userRole = req.user?.role
                if (options.skipForRoles && userRole && options.skipForRoles.includes(userRole)) {
                    this.logAudit({
                        timestamp: new Date().toISOString(),
                        requestId,
                        action: 'skip',
                        field: 'all',
                        userRole,
                        processingTime: Date.now() - startTime
                    })
                    return next()
                }

                // 遮罩請求資料
                if (options.maskRequest && options.requestFields && req.body) {
                    req.body = this.maskRequestData(req.body, options.requestFields, requestId)
                }

                // 包裝回應以遮罩回應資料
                if (options.maskResponse && options.responseFields) {
                    const originalJson = res.json.bind(res)
                    res.json = (data: any) => {
                        try {
                            const maskedData = this.maskResponseData(data, options.responseFields!)
                            return originalJson(maskedData)
                        } catch (error) {
                            if (options.skipOnError) {
                                this.logAudit({
                                    timestamp: new Date().toISOString(),
                                    requestId,
                                    action: 'error',
                                    field: 'response',
                                    userRole: userRole,
                                    processingTime: Date.now() - startTime,
                                    error: error instanceof Error ? error.message : String(error)
                                })
                                return originalJson(data)
                            }
                            throw error
                        }
                    }
                }

                next()
            } catch (error) {
                this.logAudit({
                    timestamp: new Date().toISOString(),
                    requestId,
                    action: 'error',
                    field: 'middleware',
                    userRole,
                    processingTime: Date.now() - startTime,
                    error: error instanceof Error ? error.message : String(error)
                })

                if (options.skipOnError) {
                    next()
                } else {
                    throw error
                }
            }
        }
    }

    /**
     * 遮罩請求資料
     */
    maskRequestData(data: any, fields: string[], requestId: string): any {
        const startTime = Date.now()

        try {
            const result = this.dataMasker.maskObject(data, fields)

            fields.forEach(field => {
                this.logAudit({
                    timestamp: new Date().toISOString(),
                    requestId,
                    action: 'mask',
                    field: `request.${field}`,
                    processingTime: Date.now() - startTime
                })
            })

            return result
        } catch (error) {
            this.logAudit({
                timestamp: new Date().toISOString(),
                requestId,
                action: 'error',
                field: 'request',
                processingTime: Date.now() - startTime,
                error: error instanceof Error ? error.message : String(error)
            })
            return data
        }
    }

    /**
     * 遮罩回應資料
     */
    maskResponseData(data: any, fields: string[]): any {
        const startTime = Date.now()
        const requestId = this.generateRequestId()

        try {
            const result = this.dataMasker.maskDeepObjectSync(data, fields)

            fields.forEach(field => {
                this.logAudit({
                    timestamp: new Date().toISOString(),
                    requestId,
                    action: 'mask',
                    field: `response.${field}`,
                    processingTime: Date.now() - startTime
                })
            })

            return result
        } catch (error) {
            this.logAudit({
                timestamp: new Date().toISOString(),
                requestId,
                action: 'error',
                field: 'response',
                processingTime: Date.now() - startTime,
                error: error instanceof Error ? error.message : String(error)
            })
            throw error
        }
    }

    /**
     * 預配置的中間件：遮罩用戶資料
     */
    maskUserData() {
        return this.createMiddleware({
            maskRequest: true,
            maskResponse: true,
            requestFields: ['email', 'phone', 'name'],
            responseFields: ['user.email', 'user.phone', 'user.name'],
            enableAudit: true
        })
    }

    /**
     * 預配置的中間件：遮罩金融資料
     */
    maskFinancialData() {
        return this.createMiddleware({
            maskRequest: true,
            maskResponse: true,
            requestFields: ['creditCard', 'bankAccount', 'amount'],
            responseFields: ['payment.creditCard', 'account.number', 'transaction.amount'],
            enableAudit: true
        })
    }

    /**
     * 預配置的中間件：管理員跳過遮罩
     */
    adminSkipMasking() {
        return this.createMiddleware({
            maskRequest: true,
            maskResponse: true,
            requestFields: ['email', 'phone', 'name'],
            responseFields: ['user.email', 'user.phone', 'user.name'],
            skipForRoles: ['admin'],
            enableAudit: true
        })
    }

    /**
     * 獲取審計日誌
     */
    getAuditLog(): MiddlewareAuditLog[] {
        return [...this.auditLog]
    }

    /**
     * 清除審計日誌
     */
    clearAuditLog(): void {
        this.auditLog = []
    }

    /**
     * 獲取遮罩統計
     */
    getStatistics() {
        return this.dataMasker.getStatistics()
    }

    /**
     * 重置統計資料
     */
    resetStatistics(): void {
        this.dataMasker.resetStatistics()
        this.auditLog = []
    }

    // 私有方法

    /**
     * 生成請求ID
     */
    private generateRequestId(): string {
        this.requestCounter++
        return `mask_${Date.now()}_${this.requestCounter}`
    }

    /**
     * 記錄審計日誌
     */
    private logAudit(entry: MiddlewareAuditLog): void {
        this.auditLog.push(entry)

        // 保持審計日誌大小在合理範圍
        if (this.auditLog.length > 10000) {
            this.auditLog = this.auditLog.slice(-5000)
        }
    }
}

/**
 * 全域中間件實例
 */
export const globalMaskingMiddleware = new DataMaskingMiddleware()

/**
 * 便利函數：快速建立用戶資料遮罩中間件
 */
export function withUserDataMasking() {
    return globalMaskingMiddleware.maskUserData()
}

/**
 * 便利函數：快速建立金融資料遮罩中間件
 */
export function withFinancialDataMasking() {
    return globalMaskingMiddleware.maskFinancialData()
}

/**
 * 便利函數：建立自訂遮罩中間件
 */
export function withDataMasking(options: DataMaskingMiddlewareOptions) {
    return globalMaskingMiddleware.createMiddleware(options)
}
