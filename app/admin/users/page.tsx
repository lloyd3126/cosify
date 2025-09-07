'use client'

import React, { useState, useEffect } from 'react'
import useSWR from 'swr'
import { CreditAdjustmentModal } from '@/components/admin/credit-adjustment-modal'
import { DailyLimitModal } from '@/components/admin/daily-limit-modal'

// TDD Green Phase: 最小可用實現
const fetcher = async (url: string) => {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.json()
}

// Refactor: 改進錯誤類型識別
const getErrorMessage = (error: any): string => {
    if (!error?.message) {
        return '網路連線發生問題'
    }

    // API 伺服器錯誤 (5xx)
    if (error.message.includes('status: 500') ||
        error.message.includes('status: 502') ||
        error.message.includes('status: 503') ||
        error.message.includes('status: 504')) {
        return '載入用戶資料時發生錯誤'
    }

    // 客戶端錯誤 (4xx) 或網路錯誤
    if (error.message.includes('status: 400') ||
        error.message.includes('status: 401') ||
        error.message.includes('status: 403') ||
        error.message.includes('status: 404') ||
        error.message.includes('NetworkError') ||
        error.message.includes('Failed to fetch')) {
        return '網路連線發生問題'
    }

    // 其他未知錯誤
    return '網路連線發生問題'
}

// Refactor: 改進表單驗證
const validateCreditAmount = (amount: string): { isValid: boolean; errorMessage: string } => {
    if (!amount.trim()) {
        return { isValid: false, errorMessage: '請輸入調整數量' }
    }

    const numAmount = parseInt(amount)
    if (isNaN(numAmount)) {
        return { isValid: false, errorMessage: '請輸入有效的數字' }
    }

    if (numAmount < -100000 || numAmount > 100000) {
        return { isValid: false, errorMessage: '調整數量不能超過限制' }
    }

    return { isValid: true, errorMessage: '' }
}

const validateDailyLimit = (limit: string): { isValid: boolean; errorMessage: string } => {
    if (!limit.trim()) {
        return { isValid: false, errorMessage: '請輸入每日限制' }
    }

    const numLimit = parseInt(limit)
    if (isNaN(numLimit) || numLimit < 0) {
        return { isValid: false, errorMessage: '請輸入有效的正數' }
    }

    return { isValid: true, errorMessage: '' }
}

interface User {
    id: string
    name: string
    email: string
    role: string
    credits: number
    validCredits: number
    dailyLimit: number
    hasApiKey: boolean
    createdAt: string
}

export default function UsersManagementPage() {
    const [page, setPage] = useState(1)
    const [emailFilter, setEmailFilter] = useState('')
    const [roleFilter, setRoleFilter] = useState('')
    const [creditAdjustment, setCreditAdjustment] = useState('')

    // Search trigger state
    const [searchTrigger, setSearchTrigger] = useState(0)

    // Modal states
    const [showCreditModal, setShowCreditModal] = useState(false)
    const [showLimitModal, setShowLimitModal] = useState(false)
    const [selectedUserId, setSelectedUserId] = useState('')

    // Modal form states
    const [modalCreditAmount, setModalCreditAmount] = useState('')
    const [modalCreditReason, setModalCreditReason] = useState('')
    const [modalLimitValue, setModalLimitValue] = useState('')

    // Success and error message states
    const [successMessage, setSuccessMessage] = useState('')
    const [errorMessage, setErrorMessage] = useState('')

    // SWR data fetching with improved configuration
    const { data, error, isLoading, mutate } = useSWR(
        `/api/admin/users?page=${page}&search=${emailFilter}&role=${roleFilter}&trigger=${searchTrigger}`,
        fetcher,
        {
            // Refactor: 改進 SWR 配置
            revalidateOnFocus: false, // 避免不必要的重新獲取
            revalidateOnReconnect: true, // 網路重連時重新獲取
            retry: (error: any, key: string, config: any, revalidate: any, { retryCount }: { retryCount: number }) => {
                // 只在網路錯誤時重試，最多 3 次
                if (retryCount >= 3) return false
                if (error?.message?.includes('status: 5')) return false // 不重試服務器錯誤
                return true
            },
            retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000), // 指數退避
            dedupingInterval: 2000, // 2秒內相同請求去重
            errorRetryInterval: 5000, // 錯誤後 5 秒重試
        }
    )

    // Handle search button click
    const handleSearch = async () => {
        // 搜尋時重置角色篩選，避免過度篩選
        setRoleFilter('')
        setSearchTrigger(prev => prev + 1)
    }

    // Handle credit adjustment modal
    const handleCreditModalSubmit = async () => {
        // Clear previous messages
        setSuccessMessage('')
        setErrorMessage('')

        // Refactor: 使用改進的驗證
        const validation = validateCreditAmount(modalCreditAmount)
        if (!validation.isValid) {
            setErrorMessage(validation.errorMessage)
            return
        }

        try {
            const amount = parseInt(modalCreditAmount) // 從驗證後獲取數值
            const response = await fetch(`/api/admin/users/${selectedUserId}/adjust-credits`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: amount,
                    reason: modalCreditReason
                })
            })

            if (response.ok) {
                setSuccessMessage('積分調整成功')
                setShowCreditModal(false)
                setModalCreditAmount('')
                setModalCreditReason('')
                mutate() // Refresh data
            }
        } catch (error) {
            console.error('Credit adjustment failed:', error)
        }
    }

    // Handle daily limit modal
    const handleLimitModalSubmit = async () => {
        try {
            const response = await fetch(`/api/admin/users/${selectedUserId}/update-limits`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dailyLimit: parseInt(modalLimitValue)
                })
            })

            if (response.ok) {
                setSuccessMessage('每日限制設定成功')
                setShowLimitModal(false)
                setModalLimitValue('')
                mutate() // Refresh data
            }
        } catch (error) {
            console.error('Limit update failed:', error)
        }
    }

    const users: User[] = data?.users || []
    const totalPages = data?.totalPages || 1

    // Role translation
    const getRoleDisplayName = (role: string) => {
        switch (role) {
            case 'free_user': return '免費用戶'
            case 'admin': return '管理員'
            case 'premium_user': return '付費用戶'
            default: return role
        }
    }

    // API Key status
    const getApiKeyStatus = (hasApiKey: boolean) => {
        return hasApiKey ? '已設定' : '未設定'
    }

    // Credit adjustment handler
    const handleCreditAdjustment = async (userId: string, amount: string) => {
        // Clear previous messages and open modal
        setSuccessMessage('')
        setErrorMessage('')
        setSelectedUserId(userId)
        setShowCreditModal(true)
    }

    // Daily limit adjustment handler
    const handleDailyLimitAdjustment = async (userId: string, limit: string) => {
        // Open modal instead of direct adjustment
        setSelectedUserId(userId)
        setShowLimitModal(true)
    }

    // Error handling
    if (error) {
        const errorMessage = getErrorMessage(error)

        return (
            <div data-testid="users-management-page">
                <h1>用戶管理</h1>
                <div data-testid="user-filters">
                    <input
                        type="text"
                        placeholder="Filter by email"
                        data-testid="email-filter"
                        value=""
                    />
                    <label htmlFor="role-filter-select">角色篩選</label>
                    <select
                        id="role-filter-select"
                        data-testid="role-filter"
                    >
                        <option value="">All Roles</option>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <div data-testid="users-table" />
                <div data-testid="pagination">
                    <button data-testid="prev-page" disabled>Previous</button>
                    <span data-testid="current-page">Page 1 of 1</span>
                    <button data-testid="next-page" disabled>Next</button>
                </div>
                <div>
                    {errorMessage}
                    <button onClick={() => mutate()}>重新載入</button>
                </div>
            </div>
        )
    }

    return (
        <div data-testid="users-management-page">
            <h1>用戶管理</h1>

            {/* Filters */}
            <div data-testid="user-filters">
                <input
                    type="text"
                    placeholder="搜尋用戶名稱或郵箱"
                    data-testid="email-filter"
                    value={emailFilter}
                    onChange={(e) => setEmailFilter(e.target.value)}
                />
                <button onClick={handleSearch}>搜尋</button>
                <label htmlFor="role-filter-select">角色篩選</label>
                <select
                    id="role-filter-select"
                    data-testid="role-filter"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                >
                    <option value="">All Roles</option>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                </select>
            </div>

            {/* Loading state */}
            {isLoading && <div data-testid="loading">Loading...</div>}

            {/* Users Table */}
            <div data-testid="users-table">
                {users.map((user) => (
                    <div key={user.id} data-testid={`user-row-${user.id}`}>
                        <span data-testid={`user-name-${user.id}`}>{user.name}</span>
                        <span data-testid={`user-email-${user.id}`}>{user.email}</span>
                        <span data-testid={`user-role-${user.id}`}>{getRoleDisplayName(user.role)}</span>
                        <span data-testid={`user-credits-${user.id}`}>{user.credits}</span>
                        <span data-testid={`user-valid-credits-${user.id}`}>{user.validCredits}</span>
                        <span data-testid={`user-daily-limit-${user.id}`}>{user.dailyLimit}</span>
                        <span data-testid={`user-api-key-status-${user.id}`}>{getApiKeyStatus(user.hasApiKey)}</span>

                        {/* Credit Adjustment */}
                        <div data-testid={`credit-adjustment-${user.id}`}>
                            <input
                                data-testid={`credit-input-${user.id}`}
                                type="number"
                                placeholder="Adjust credits"
                                value={creditAdjustment}
                                onChange={(e) => setCreditAdjustment(e.target.value)}
                            />
                            <button
                                data-testid={`adjust-credits-btn-${user.id}`}
                                onClick={() => handleCreditAdjustment(user.id, creditAdjustment)}
                            >
                                調整積分
                            </button>
                        </div>

                        {/* Daily Limit Adjustment */}
                        <div data-testid={`daily-limit-adjustment-${user.id}`}>
                            <input
                                data-testid={`daily-limit-input-${user.id}`}
                                type="number"
                                placeholder="Daily limit"
                            />
                            <button
                                data-testid={`update-daily-limit-btn-${user.id}`}
                                onClick={() => handleDailyLimitAdjustment(user.id, '200')}
                            >
                                設定限制
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination */}
            <div data-testid="pagination">
                <button
                    data-testid="prev-page"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                >
                    Previous
                </button>
                <span data-testid="current-page">第 {page} 頁，共 {totalPages} 頁</span>
                <button
                    data-testid="next-page"
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                >
                    Next
                </button>
            </div>

            {/* Success Message */}
            {successMessage && (
                <div data-testid="success-message">
                    {successMessage}
                </div>
            )}

            {/* Credit Adjustment Modal */}
            <CreditAdjustmentModal
                isOpen={showCreditModal}
                onClose={() => setShowCreditModal(false)}
                onSubmit={handleCreditModalSubmit}
                creditAmount={modalCreditAmount}
                setCreditAmount={setModalCreditAmount}
                reason={modalCreditReason}
                setReason={setModalCreditReason}
                errorMessage={errorMessage}
            />

            {/* Daily Limit Modal */}
            <DailyLimitModal
                isOpen={showLimitModal}
                onClose={() => setShowLimitModal(false)}
                onSubmit={handleLimitModalSubmit}
                limitValue={modalLimitValue}
                setLimitValue={setModalLimitValue}
            />
        </div>
    )
}
