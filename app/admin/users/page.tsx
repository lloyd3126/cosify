'use client'

import React, { useState, useEffect } from 'react'
import useSWR from 'swr'

// TDD Green Phase: 最小可用實現
const fetcher = async (url: string) => {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.json()
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

    // SWR data fetching - 會被 MSW 攔截
    const { data, error, isLoading, mutate } = useSWR(
        `/api/admin/users?page=${page}&search=${emailFilter}&role=${roleFilter}&trigger=${searchTrigger}`,
        fetcher
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

        // Validation
        const amount = parseInt(modalCreditAmount)
        if (isNaN(amount) || amount < -100000 || amount > 100000) {
            setErrorMessage('調整數量不能超過限制')
            return
        }

        try {
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
        // 檢查錯誤類型 - Green 階段簡化版本
        let errorMessage = '網路連線發生問題' // 默認為網路錯誤

        // 500 錯誤為服務器錯誤
        if (error.message && error.message.includes('status: 500')) {
            errorMessage = '載入用戶資料時發生錯誤'
        }
        // 400 錯誤為網路連線錯誤
        if (error.message && error.message.includes('status: 400')) {
            errorMessage = '網路連線發生問題'
        }

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
            {showCreditModal && (
                <div data-testid="credit-modal">
                    <h2>調整用戶積分</h2>
                    {errorMessage && (
                        <div data-testid="error-message">
                            {errorMessage}
                        </div>
                    )}
                    <label htmlFor="modal-credit-input">調整數量</label>
                    <input
                        id="modal-credit-input"
                        data-testid="modal-credit-input"
                        type="number"
                        placeholder="Enter credit amount"
                        value={modalCreditAmount}
                        onChange={(e) => setModalCreditAmount(e.target.value)}
                    />
                    <label htmlFor="modal-credit-reason">調整原因</label>
                    <input
                        id="modal-credit-reason"
                        data-testid="modal-credit-reason"
                        type="text"
                        placeholder="Enter reason"
                        value={modalCreditReason}
                        onChange={(e) => setModalCreditReason(e.target.value)}
                    />
                    <button onClick={() => setShowCreditModal(false)}>取消</button>
                    <button onClick={handleCreditModalSubmit}>確認調整</button>
                </div>
            )}

            {/* Daily Limit Modal */}
            {showLimitModal && (
                <div data-testid="limit-modal">
                    <h2>設定每日限制</h2>
                    <label htmlFor="modal-limit-input">每日積分限制</label>
                    <input
                        id="modal-limit-input"
                        data-testid="modal-limit-input"
                        type="number"
                        placeholder="Enter daily limit"
                        value={modalLimitValue}
                        onChange={(e) => setModalLimitValue(e.target.value)}
                    />
                    <button onClick={() => setShowLimitModal(false)}>取消</button>
                    <button onClick={handleLimitModalSubmit}>儲存設定</button>
                </div>
            )}
        </div>
    )
}
