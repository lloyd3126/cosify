/**
 * 🔴 RED Phase: Admin Users Management Page Tests
 * 
 * Testing admin user management functionality with TDD approach
 * Following Red-Green-Refactor cycle
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import UsersManagementPage from '../../app/admin/users/page'
import { TestWrapper } from '../helpers/test-wrapper'

// Mock API responses
const mockUsers = [
    {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'free_user',
        credits: 150,
        validCredits: 120,
        dailyLimit: 100,
        hasApiKey: false,
        createdAt: '2024-01-01T00:00:00Z'
    },
    {
        id: 'user-2',
        name: 'Jane Admin',
        email: 'jane@example.com',
        role: 'admin',
        credits: 1000,
        validCredits: 950,
        dailyLimit: 500,
        hasApiKey: true,
        createdAt: '2024-01-02T00:00:00Z'
    }
]

// Setup MSW server for API mocking
const server = setupServer(
    http.get('/api/admin/users', ({ request }) => {
        const url = new URL(request.url)
        const page = url.searchParams.get('page') || '1'
        const limit = url.searchParams.get('limit') || '20'
        const search = url.searchParams.get('search') || ''
        const role = url.searchParams.get('role') || ''

        let filteredUsers = mockUsers
        if (search) {
            filteredUsers = mockUsers.filter(user =>
                user.email.toLowerCase().includes(search.toLowerCase()) ||
                user.name.toLowerCase().includes(search.toLowerCase())
            )
        }
        if (role) {
            filteredUsers = filteredUsers.filter(user => user.role === role)
        }

        return HttpResponse.json({
            success: true,
            users: filteredUsers,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: filteredUsers.length,
                totalPages: Math.ceil(filteredUsers.length / parseInt(limit))
            }
        })
    }),

    http.post('/api/admin/users/:id/adjust-credits', () => {
        return HttpResponse.json({
            success: true,
            message: 'Credits adjusted successfully'
        })
    }),

    http.post('/api/admin/users/:id/update-limits', () => {
        return HttpResponse.json({
            success: true,
            message: 'Daily limits updated successfully'
        })
    })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('🔴 RED: Admin Users Management Page', () => {

    describe('User List Display', () => {
        test('should display users with pagination', async () => {
            // 🔴 Red: 定義期望行為 - 顯示用戶列表
            render(
                <TestWrapper>
                    <UsersManagementPage />
                </TestWrapper>
            )

            // 等待數據載入
            await waitFor(() => {
                expect(screen.getByText('用戶管理')).toBeInTheDocument()
            })

            // 驗證用戶資料顯示
            expect(screen.getByText('John Doe')).toBeInTheDocument()
            expect(screen.getByText('john@example.com')).toBeInTheDocument()
            expect(screen.getByText('Jane Admin')).toBeInTheDocument()
            expect(screen.getByText('jane@example.com')).toBeInTheDocument()

            // 驗證分頁功能
            expect(screen.getByText('第 1 頁，共 1 頁')).toBeInTheDocument()
        })

        test('should filter users by role and email', async () => {
            // 🔴 Red: 定義期望行為 - 篩選功能
            render(
                <TestWrapper>
                    <UsersManagementPage />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(screen.getByText('用戶管理')).toBeInTheDocument()
            })

            // 測試角色篩選
            const roleFilter = screen.getByLabelText('角色篩選')
            fireEvent.change(roleFilter, { target: { value: 'admin' } })

            await waitFor(() => {
                expect(screen.getByText('Jane Admin')).toBeInTheDocument()
                expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
            })

            // 測試搜尋功能
            const searchInput = screen.getByPlaceholderText('搜尋用戶名稱或郵箱')
            fireEvent.change(searchInput, { target: { value: 'john' } })
            fireEvent.click(screen.getByText('搜尋'))

            await waitFor(() => {
                expect(screen.getByText('John Doe')).toBeInTheDocument()
                expect(screen.queryByText('Jane Admin')).not.toBeInTheDocument()
            })
        })

        test('should display user credits and status correctly', async () => {
            // 🔴 Red: 定義期望行為 - 用戶狀態顯示
            render(
                <TestWrapper>
                    <UsersManagementPage />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(screen.getByText('用戶管理')).toBeInTheDocument()
            })

            // 驗證積分顯示
            expect(screen.getByText('150')).toBeInTheDocument() // John's total credits
            expect(screen.getByText('120')).toBeInTheDocument() // John's valid credits
            expect(screen.getByText('1000')).toBeInTheDocument() // Jane's total credits
            expect(screen.getByText('950')).toBeInTheDocument() // Jane's valid credits
            expect(screen.getByText('500')).toBeInTheDocument() // Jane's daily limit

            // 驗證 API Key 狀態
            expect(screen.getByText('未設定')).toBeInTheDocument() // John's API key status
            expect(screen.getByText('已設定')).toBeInTheDocument() // Jane's API key status

            // 驗證角色標籤
            expect(screen.getByText('免費用戶')).toBeInTheDocument()
            expect(screen.getByText('管理員')).toBeInTheDocument()
        })
    })

    describe('Credit Adjustment', () => {
        test('should adjust user credits with validation', async () => {
            // 🔴 Red: 定義期望行為 - 積分調整
            render(
                <TestWrapper>
                    <UsersManagementPage />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(screen.getByText('用戶管理')).toBeInTheDocument()
            })

            // 點擊調整積分按鈕
            const adjustButtons = screen.getAllByText('調整積分')
            fireEvent.click(adjustButtons[0])

            // 驗證模態框開啟
            await waitFor(() => {
                expect(screen.getByText('調整用戶積分')).toBeInTheDocument()
            })

            // 填寫積分調整表單
            const amountInput = screen.getByLabelText('調整數量')
            const reasonInput = screen.getByLabelText('調整原因')

            fireEvent.change(amountInput, { target: { value: '50' } })
            fireEvent.change(reasonInput, { target: { value: '獎勵積分' } })

            // 點擊確認調整
            fireEvent.click(screen.getByText('確認調整'))

            // 驗證成功訊息
            await waitFor(() => {
                expect(screen.getByText('積分調整成功')).toBeInTheDocument()
            })
        })

        test('should validate credit adjustment input', async () => {
            // 🔴 Red: 定義期望行為 - 輸入驗證
            render(
                <TestWrapper>
                    <UsersManagementPage />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(screen.getByText('用戶管理')).toBeInTheDocument()
            })

            const adjustButtons = screen.getAllByText('調整積分')
            fireEvent.click(adjustButtons[0])

            await waitFor(() => {
                expect(screen.getByText('調整用戶積分')).toBeInTheDocument()
            })

            // 測試無效輸入
            const amountInput = screen.getByLabelText('調整數量')
            fireEvent.change(amountInput, { target: { value: '-999999' } })
            fireEvent.click(screen.getByText('確認調整'))

            // 驗證錯誤訊息
            await waitFor(() => {
                expect(screen.getByText('調整數量不能超過限制')).toBeInTheDocument()
            })
        })
    })

    describe('Daily Limit Management', () => {
        test('should update user daily limits', async () => {
            // 🔴 Red: 定義期望行為 - 每日限制管理
            render(
                <TestWrapper>
                    <UsersManagementPage />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(screen.getByText('用戶管理')).toBeInTheDocument()
            })

            // 點擊設定限制按鈕
            const limitButtons = screen.getAllByText('設定限制')
            fireEvent.click(limitButtons[0])

            await waitFor(() => {
                expect(screen.getByText('設定每日限制')).toBeInTheDocument()
            })

            // 調整每日限制
            const limitInput = screen.getByLabelText('每日積分限制')
            fireEvent.change(limitInput, { target: { value: '200' } })
            fireEvent.click(screen.getByText('儲存設定'))

            await waitFor(() => {
                expect(screen.getByText('每日限制設定成功')).toBeInTheDocument()
            })
        })
    })

    describe('Error Handling', () => {
        test('should handle API errors gracefully', async () => {
            // 🔴 Red: 定義期望行為 - 錯誤處理
            server.use(
                http.get('/api/admin/users', () => {
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
                    <UsersManagementPage />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(screen.getByText('載入用戶資料時發生錯誤')).toBeInTheDocument()
            })

            // 驗證重試按鈕
            expect(screen.getByText('重新載入')).toBeInTheDocument()
        })

        test('should handle network connection errors', async () => {
            // 🔴 Red: 定義期望行為 - 網路錯誤處理
            server.use(
                http.get('/api/admin/users', () => {
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
                    <UsersManagementPage />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(screen.getByText('網路連線發生問題')).toBeInTheDocument()
            })
        })
    })
})
