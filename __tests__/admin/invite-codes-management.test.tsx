import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { TestWrapper } from '../helpers/test-wrapper'
import InviteCodesManagementPage from '../../app/admin/invite-codes/page'

// Mock 邀請碼資料
const mockInviteCodes = [
    {
        code: 'WELCOME100',
        creditsValue: 100,
        creditsExpiresAt: '2025-12-31T23:59:59.000Z',
        usedBy: null,
        usedAt: null,
        expiresAt: '2025-12-31T23:59:59.000Z',
        createdAt: '2025-09-07T10:00:00.000Z',
        createdByAdminId: 'admin-1',
        status: 'active'
    },
    {
        code: 'PROMO50',
        creditsValue: 50,
        creditsExpiresAt: '2025-11-30T23:59:59.000Z',
        usedBy: 'user-123',
        usedAt: '2025-09-05T14:30:00.000Z',
        expiresAt: '2025-11-30T23:59:59.000Z',
        createdAt: '2025-09-01T09:00:00.000Z',
        createdByAdminId: 'admin-1',
        status: 'used'
    },
    {
        code: 'EXPIRED10',
        creditsValue: 10,
        creditsExpiresAt: '2025-08-31T23:59:59.000Z',
        usedBy: null,
        usedAt: null,
        expiresAt: '2025-08-31T23:59:59.000Z',
        createdAt: '2025-08-01T08:00:00.000Z',
        createdByAdminId: 'admin-1',
        status: 'expired'
    }
]

// MSW handlers for invite codes API
const inviteCodesHandlers = [
    // 獲取邀請碼列表
    http.get('/api/admin/invite-codes', ({ request }) => {
        const url = new URL(request.url)
        const status = url.searchParams.get('status')
        const page = parseInt(url.searchParams.get('page') || '1')
        const limit = parseInt(url.searchParams.get('limit') || '10')

        let filteredCodes = mockInviteCodes
        if (status && status !== 'all') {
            filteredCodes = mockInviteCodes.filter(code => code.status === status)
        }

        // 簡單分頁邏輯
        const start = (page - 1) * limit
        const end = start + limit
        const paginatedCodes = filteredCodes.slice(start, end)

        return HttpResponse.json({
            codes: paginatedCodes,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(filteredCodes.length / limit),
                totalItems: filteredCodes.length,
                itemsPerPage: limit
            }
        })
    }),

    // 生成新邀請碼
    http.post('/api/admin/invite-codes/generate', async ({ request }) => {
        const body = await request.json() as any
        const newCode = {
            code: 'NEWCODE' + Date.now(),
            creditsValue: body.creditsValue,
            creditsExpiresAt: body.creditsExpiresAt,
            usedBy: null,
            usedAt: null,
            expiresAt: body.expiresAt,
            createdAt: new Date().toISOString(),
            createdByAdminId: 'admin-1',
            status: 'active'
        }

        mockInviteCodes.unshift(newCode)

        return HttpResponse.json({
            success: true,
            inviteCode: newCode
        })
    }),

    // 刪除邀請碼
    http.delete('/api/admin/invite-codes', ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get('id')

        if (!code) {
            return HttpResponse.json({
                error: 'Missing code ID'
            }, { status: 400 })
        }

        const index = mockInviteCodes.findIndex(c => c.code === code)

        if (index === -1) {
            return HttpResponse.json({
                error: 'Invite code not found'
            }, { status: 404 })
        }

        // 檢查是否已使用
        if (mockInviteCodes[index].status === 'used') {
            return HttpResponse.json({
                error: 'Cannot delete used invite code'
            }, { status: 400 })
        }

        mockInviteCodes.splice(index, 1)

        return HttpResponse.json({
            success: true
        })
    })
]

// 設置 MSW 測試服務器
const server = setupServer(...inviteCodesHandlers)

// 測試生命周期設置
beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' })
})

beforeEach(() => {
    // 重置模擬數據
    mockInviteCodes.length = 0
    mockInviteCodes.push(
        {
            code: 'WELCOME100',
            creditsValue: 100,
            creditsExpiresAt: '2026-01-01T00:00:00.000Z',
            usedBy: null,
            usedAt: null,
            expiresAt: '2026-01-01T00:00:00.000Z',
            createdAt: '2025-12-01T00:00:00.000Z',
            createdByAdminId: 'admin-1',
            status: 'active'
        },
        {
            code: 'PROMO50',
            creditsValue: 50,
            creditsExpiresAt: '2025-12-01T00:00:00.000Z',
            usedBy: 'user-123',
            usedAt: '2025-11-01T00:00:00.000Z',
            expiresAt: '2025-12-01T00:00:00.000Z',
            createdAt: '2025-11-01T00:00:00.000Z',
            createdByAdminId: 'admin-1',
            status: 'used'
        },
        {
            code: 'EXPIRED10',
            creditsValue: 10,
            creditsExpiresAt: '2025-09-01T00:00:00.000Z',
            usedBy: null,
            usedAt: null,
            expiresAt: '2025-09-01T00:00:00.000Z',
            createdAt: '2025-08-01T00:00:00.000Z',
            createdByAdminId: 'admin-1',
            status: 'expired'
        }
    )
    server.resetHandlers()
})

afterEach(() => {
    server.resetHandlers()
})

afterAll(() => {
    server.close()
})

describe('🔴 RED: Admin Invite Codes Management Page', () => {
    beforeEach(() => {
        // 重設 MSW handlers
        server.use(...inviteCodesHandlers)
    })

    describe('Invite Codes List Display', () => {
        test('should display invite codes with pagination', async () => {
            // 🔴 Red: 定義期望行為 - 邀請碼列表顯示
            render(
                <TestWrapper>
                    <InviteCodesManagementPage />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(screen.getByText('邀請碼管理')).toBeInTheDocument()
            })

            // 驗證邀請碼列表顯示
            await waitFor(() => {
                expect(screen.getByText('WELCOME100')).toBeInTheDocument()
                expect(screen.getByText('PROMO50')).toBeInTheDocument()
                expect(screen.getByText('EXPIRED10')).toBeInTheDocument()
            })

            // 驗證狀態顯示 - 使用 data-testid 來避免重複文字
            expect(screen.getByTestId('status-WELCOME100')).toHaveTextContent('未使用')
            expect(screen.getByTestId('status-PROMO50')).toHaveTextContent('已使用')
            expect(screen.getByTestId('status-EXPIRED10')).toHaveTextContent('已過期')

            // 驗證分頁控制
            expect(screen.getByTestId('pagination')).toBeInTheDocument()
            expect(screen.getByTestId('prev-page')).toBeInTheDocument()
            expect(screen.getByTestId('next-page')).toBeInTheDocument()
        })

        test('should filter invite codes by status', async () => {
            // 🔴 Red: 定義期望行為 - 狀態篩選
            render(
                <TestWrapper>
                    <InviteCodesManagementPage />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(screen.getByText('邀請碼管理')).toBeInTheDocument()
            })

            // 測試狀態篩選
            const statusFilter = screen.getByLabelText('狀態篩選')
            fireEvent.change(statusFilter, { target: { value: 'active' } })

            await waitFor(() => {
                expect(screen.getByText('WELCOME100')).toBeInTheDocument()
                expect(screen.queryByText('PROMO50')).not.toBeInTheDocument()
                expect(screen.queryByText('EXPIRED10')).not.toBeInTheDocument()
            })
        })

        test('should display invite code details correctly', async () => {
            // 🔴 Red: 定義期望行為 - 邀請碼詳細資訊顯示
            render(
                <TestWrapper>
                    <InviteCodesManagementPage />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(screen.getByText('邀請碼管理')).toBeInTheDocument()
            })

            // 驗證邀請碼詳細資訊
            await waitFor(() => {
                // 點數值顯示
                expect(screen.getByText('100 點')).toBeInTheDocument()
                expect(screen.getByText('50 點')).toBeInTheDocument()

                // 使用者資訊
                expect(screen.getByText('user-123')).toBeInTheDocument()

                // 日期顯示 - 使用實際格式
                expect(screen.getByText('2026/1/1')).toBeInTheDocument()
                expect(screen.getByText('2025/12/1')).toBeInTheDocument()
                expect(screen.getByText('2025/9/1')).toBeInTheDocument()
            })
        })
    })

    describe('Invite Code Generation', () => {
        test('should generate new invite code with validation', async () => {
            // 🔴 Red: 定義期望行為 - 新邀請碼生成
            render(
                <TestWrapper>
                    <InviteCodesManagementPage />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(screen.getByText('邀請碼管理')).toBeInTheDocument()
            })

            // 點擊生成邀請碼按鈕
            const generateButton = screen.getByText('生成邀請碼')
            fireEvent.click(generateButton)

            // 驗證 Modal 打開
            await waitFor(() => {
                expect(screen.getByTestId('generate-invite-modal')).toBeInTheDocument()
                expect(screen.getByText('生成新邀請碼')).toBeInTheDocument()
            })

            // 填寫表單
            const creditsInput = screen.getByLabelText('點數值')
            const expiryInput = screen.getByLabelText('有效期限')

            fireEvent.change(creditsInput, { target: { value: '200' } })
            fireEvent.change(expiryInput, { target: { value: '2025-12-31' } })

            // 提交表單
            const submitButton = screen.getByText('生成')
            fireEvent.click(submitButton)

            // 驗證成功訊息
            await waitFor(() => {
                expect(screen.getByText('邀請碼生成成功')).toBeInTheDocument()
            })

            // 驗證 Modal 關閉
            expect(screen.queryByTestId('generate-invite-modal')).not.toBeInTheDocument()
        })

        test('should validate invite code generation input', async () => {
            // 🔴 Red: 定義期望行為 - 輸入驗證
            render(
                <TestWrapper>
                    <InviteCodesManagementPage />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(screen.getByText('邀請碼管理')).toBeInTheDocument()
            })

            // 打開生成 Modal
            const generateButton = screen.getByText('生成邀請碼')
            fireEvent.click(generateButton)

            await waitFor(() => {
                expect(screen.getByTestId('generate-invite-modal')).toBeInTheDocument()
            })

            // 測試無效輸入
            const creditsInput = screen.getByLabelText('點數值')
            fireEvent.change(creditsInput, { target: { value: '0' } })

            const submitButton = screen.getByText('生成')
            fireEvent.click(submitButton)

            // 驗證錯誤訊息
            await waitFor(() => {
                expect(screen.getByText('點數值必須大於 0')).toBeInTheDocument()
            })
        })
    })

    describe('Invite Code Management', () => {
        test('should delete unused invite codes', async () => {
            // 🔴 Red: 定義期望行為 - 刪除邀請碼
            render(
                <TestWrapper>
                    <InviteCodesManagementPage />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(screen.getByText('邀請碼管理')).toBeInTheDocument()
            })

            // 找到未使用的邀請碼的刪除按鈕
            const deleteButtons = screen.getAllByText('刪除')
            const deleteButton = deleteButtons[0] // WELCOME100 的刪除按鈕

            fireEvent.click(deleteButton)

            // 驗證確認對話框
            await waitFor(() => {
                expect(screen.getByText('確認刪除')).toBeInTheDocument()
                // 使用 partial match 來檢查確認文字，因為 code 可能是動態生成的
                expect(screen.getByText(/確定要刪除邀請碼.*嗎？/)).toBeInTheDocument()
            })

            // 確認刪除
            const confirmButton = screen.getByText('確認')
            fireEvent.click(confirmButton)

            // 驗證成功訊息
            await waitFor(() => {
                expect(screen.getByText('邀請碼刪除成功')).toBeInTheDocument()
            })

            // 等待一段時間讓 SWR mutate 生效
            await waitFor(() => {
                // 驗證邀請碼從列表中移除 - 使用更精確的選擇器
                expect(screen.queryByTestId('invite-code-row-WELCOME100')).not.toBeInTheDocument()
            }, { timeout: 3000 })
        })

        test('should not allow deleting used invite codes', async () => {
            // 🔴 Red: 定義期望行為 - 不允許刪除已使用的邀請碼
            render(
                <TestWrapper>
                    <InviteCodesManagementPage />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(screen.getByText('邀請碼管理')).toBeInTheDocument()
            })

            // 已使用的邀請碼應該沒有刪除按鈕
            await waitFor(() => {
                expect(screen.getByText('PROMO50')).toBeInTheDocument()
            })

            // 找到已使用邀請碼的行，應該沒有刪除按鈕
            const usedCodeRow = screen.getByText('PROMO50').closest('[data-testid^="invite-code-row"]')
            expect(usedCodeRow).toBeInTheDocument()

            // 在該行中不應該有刪除按鈕
            const deleteButton = usedCodeRow?.querySelector('button[aria-label="刪除邀請碼"]')
            expect(deleteButton).not.toBeInTheDocument()
        })
    })

    describe('Error Handling', () => {
        test('should handle API errors gracefully', async () => {
            // 🔴 Red: 定義期望行為 - API 錯誤處理
            server.use(
                http.get('/api/admin/invite-codes', () => {
                    return HttpResponse.json(
                        {
                            success: false,
                            error: 'Internal server error'
                        },
                        { status: 500 }
                    )
                })
            )

            render(
                <TestWrapper>
                    <InviteCodesManagementPage />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(screen.getByText('載入邀請碼資料時發生錯誤')).toBeInTheDocument()
            })

            // 驗證重試按鈕
            expect(screen.getByText('重新載入')).toBeInTheDocument()
        })

        test('should handle network connection errors', async () => {
            // 🔴 Red: 定義期望行為 - 網路錯誤處理
            server.use(
                http.get('/api/admin/invite-codes', () => {
                    return HttpResponse.json(
                        {
                            success: false,
                            error: 'Network connection failed'
                        },
                        { status: 400 }
                    )
                })
            )

            render(
                <TestWrapper>
                    <InviteCodesManagementPage />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(screen.getByText('網路連線發生問題')).toBeInTheDocument()
            })
        })
    })
})
