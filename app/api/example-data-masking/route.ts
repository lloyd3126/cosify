/**
 * Phase 2.9: 敏感資料遮罩 - API 範例
 * 
 * 展示 DataMasking 系統的實際應用
 * 
 * 功能展示：
 * - 用戶註冊時的敏感資料遮罩
 * - 管理員角色跳過遮罩
 * - 多種遮罩策略展示
 * - 審計日誌記錄
 */

import { NextRequest, NextResponse } from 'next/server'
import { withDataMasking } from '../../../src/server/middleware/data-masking-middleware'

// 模擬用戶資料庫
const users = [
    {
        id: 'A123456789',
        name: '王小明',
        email: 'wang.xiaoming@example.com',
        phone: '0912-345-678',
        creditCard: '4532-1234-5678-9012',
        address: '台北市大安區忠孝東路四段123號5樓',
        bankAccount: '123-45-67890123',
        role: 'user'
    },
    {
        id: 'B234567890',
        name: 'John Smith',
        email: 'john.smith@company.com',
        phone: '+1-555-123-4567',
        creditCard: '5555-5555-5555-4444',
        address: '123 Main St, New York, NY 10001',
        bankAccount: '987-65-43210987',
        role: 'admin'
    }
]

/**
 * GET - 獲取用戶列表 (帶遮罩)
 */
export async function GET(request: NextRequest) {
    try {
        // 模擬認證用戶
        const authHeader = request.headers.get('authorization')
        const userRole = authHeader === 'Bearer admin_token' ? 'admin' : 'user'

        // 模擬請求物件
        const req = {
            user: { role: userRole },
            body: {},
            query: {},
            headers: {}
        }

        // 模擬回應物件
        let responseData: any = null
        const res = {
            json: (data: any) => {
                responseData = data
                return data
            },
            status: (code: number) => ({ json: (data: any) => data })
        }

        // 套用遮罩中間件
        const maskingMiddleware = withDataMasking({
            maskResponse: true,
            responseFields: [
                'data.*.name',
                'data.*.email',
                'data.*.phone',
                'data.*.creditCard',
                'data.*.address',
                'data.*.bankAccount'
            ],
            skipForRoles: ['admin'],
            enableAudit: true
        })

        // 執行中間件
        await new Promise<void>((resolve) => {
            maskingMiddleware(req, res, () => resolve())
        })

        // 準備回應資料
        const response = {
            success: true,
            message: '用戶列表獲取成功',
            data: users,
            maskingInfo: {
                appliedForRole: userRole,
                maskedFields: userRole === 'admin' ? [] : [
                    'name', 'email', 'phone', 'creditCard', 'address', 'bankAccount'
                ]
            }
        }

        // 執行回應遮罩
        const maskedResponse = res.json(response)

        return NextResponse.json(maskedResponse)
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: '獲取用戶列表失敗',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 })
    }
}

/**
 * POST - 創建用戶 (遮罩請求和回應)
 */
export async function POST(request: NextRequest) {
    try {
        const requestBody = await request.json()

        // 模擬認證用戶
        const authHeader = request.headers.get('authorization')
        const userRole = authHeader === 'Bearer admin_token' ? 'admin' : 'user'

        // 模擬請求物件
        const req = {
            user: { role: userRole },
            body: requestBody,
            query: {},
            headers: {}
        }

        // 模擬回應物件
        let responseData: any = null
        let requestProcessed = false
        const res = {
            json: (data: any) => {
                responseData = data
                return data
            },
            status: (code: number) => ({ json: (data: any) => data })
        }

        // 套用遮罩中間件
        const maskingMiddleware = withDataMasking({
            maskRequest: true,
            maskResponse: true,
            requestFields: [
                'email',
                'phone',
                'creditCard',
                'bankAccount',
                'taiwanId'
            ],
            responseFields: [
                'user.email',
                'user.phone',
                'user.creditCard',
                'user.bankAccount',
                'user.taiwanId'
            ],
            skipForRoles: ['admin'],
            enableAudit: true
        })

        // 執行中間件
        await new Promise<void>((resolve) => {
            maskingMiddleware(req, res, () => {
                requestProcessed = true
                resolve()
            })
        })

        // 驗證必要欄位
        if (!req.body.name || !req.body.email) {
            return NextResponse.json({
                success: false,
                error: '姓名和電子郵件為必填欄位'
            }, { status: 400 })
        }

        // 創建新用戶
        const newUser = {
            id: `U${Date.now()}`,
            ...req.body,
            role: 'user',
            createdAt: new Date().toISOString()
        }

        users.push(newUser)

        // 準備回應資料
        const response = {
            success: true,
            message: '用戶創建成功',
            user: newUser,
            maskingInfo: {
                appliedForRole: userRole,
                maskedRequestFields: userRole === 'admin' ? [] : [
                    'email', 'phone', 'creditCard', 'bankAccount', 'taiwanId'
                ],
                maskedResponseFields: userRole === 'admin' ? [] : [
                    'user.email', 'user.phone', 'user.creditCard', 'user.bankAccount', 'user.taiwanId'
                ]
            }
        }

        // 執行回應遮罩
        const maskedResponse = res.json(response)

        return NextResponse.json(maskedResponse, { status: 201 })
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: '創建用戶失敗',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 })
    }
}

/**
 * PUT - 展示不同遮罩策略
 */
export async function PUT(request: NextRequest) {
    try {
        const requestBody = await request.json()
        const { maskingStrategy = 'partial' } = requestBody

        // 測試資料
        const testData = {
            email: 'test.user@example.com',
            phone: '0912-345-678',
            creditCard: '4532-1234-5678-9012',
            taiwanId: 'A123456789',
            name: '王小明',
            address: '台北市大安區忠孝東路四段123號5樓',
            bankAccount: '123-45-67890123',
            passport: 'AB1234567'
        }

        // 根據策略遮罩資料
        const DataMasker = (await import('../../../src/server/services/data-masker')).DataMasker
        const MaskingStrategy = (await import('../../../src/server/services/data-masker')).MaskingStrategy

        const masker = new DataMasker({
            emailStrategy: MaskingStrategy[maskingStrategy.toUpperCase() as keyof typeof MaskingStrategy] || MaskingStrategy.PARTIAL,
            phoneStrategy: MaskingStrategy[maskingStrategy.toUpperCase() as keyof typeof MaskingStrategy] || MaskingStrategy.PARTIAL,
            enableStatistics: true
        })

        const maskedData = {
            email: masker.maskEmail(testData.email),
            phone: masker.maskPhone(testData.phone),
            creditCard: masker.maskCreditCard(testData.creditCard),
            taiwanId: masker.maskTaiwanId(testData.taiwanId),
            name: masker.maskName(testData.name),
            address: masker.maskAddress(testData.address),
            bankAccount: masker.maskBankAccount(testData.bankAccount),
            passport: masker.maskPassport(testData.passport)
        }

        return NextResponse.json({
            success: true,
            message: `${maskingStrategy} 遮罩策略展示`,
            original: testData,
            masked: maskedData,
            statistics: masker.getStatistics(),
            strategy: maskingStrategy
        })
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: '遮罩策略展示失敗',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 })
    }
}
