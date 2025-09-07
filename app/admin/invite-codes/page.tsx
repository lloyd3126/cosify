'use client'

import React, { useState } from 'react'
import useSWR from 'swr'

// TDD Green Phase: 最小可用實現
const fetcher = async (url: string) => {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.json()
}

interface InviteCode {
    code: string
    creditsValue: number
    creditsExpiresAt: string
    usedBy: string | null
    usedAt: string | null
    expiresAt: string
    createdAt: string
    createdByAdminId: string
    status: 'active' | 'used' | 'expired'
}

interface InviteCodesResponse {
    codes: InviteCode[]
    pagination: {
        currentPage: number
        totalPages: number
        totalItems: number
        itemsPerPage: number
    }
}

export default function InviteCodesManagementPage() {
    const [page, setPage] = useState(1)
    const [statusFilter, setStatusFilter] = useState('all')
    const [showGenerateModal, setShowGenerateModal] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [selectedCode, setSelectedCode] = useState<string>('')
    const [generateForm, setGenerateForm] = useState({
        creditsValue: '',
        expiresAt: ''
    })
    const [successMessage, setSuccessMessage] = useState('')
    const [errorMessage, setErrorMessage] = useState('')

    // SWR data fetching
    const { data, error, isLoading, mutate } = useSWR<InviteCodesResponse>(
        `/api/admin/invite-codes?page=${page}&status=${statusFilter}&limit=10`,
        fetcher
    )

    // Error handling helper
    const getErrorMessage = (error: any): string => {
        if (!error?.message) return '網路連線發生問題'

        // API 伺服器錯誤 (5xx)
        if (error.message.includes('status: 500')) {
            return '載入邀請碼資料時發生錯誤'
        }

        // 網路連線錯誤 (4xx)
        if (error.message.includes('status: 400')) {
            return '網路連線發生問題'
        }

        return '網路連線發生問題'
    }

    // Generate invite code handler
    const handleGenerateSubmit = async () => {
        // Clear previous messages
        setSuccessMessage('')
        setErrorMessage('')

        // Validation
        const creditsValue = parseInt(generateForm.creditsValue)
        if (isNaN(creditsValue) || creditsValue <= 0) {
            setErrorMessage('點數值必須大於 0')
            return
        }

        if (!generateForm.expiresAt) {
            setErrorMessage('請選擇有效期限')
            return
        }

        try {
            const response = await fetch('/api/admin/invite-codes/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    creditsValue: creditsValue,
                    creditsExpiresAt: generateForm.expiresAt + 'T23:59:59.000Z',
                    expiresAt: generateForm.expiresAt + 'T23:59:59.000Z'
                })
            })

            if (response.ok) {
                setSuccessMessage('邀請碼生成成功')
                setShowGenerateModal(false)
                setGenerateForm({ creditsValue: '', expiresAt: '' })
                mutate() // Refresh data
            } else {
                setErrorMessage('生成邀請碼失敗')
            }
        } catch (error) {
            setErrorMessage('生成邀請碼失敗')
        }
    }

    // Delete invite code handler
    const handleDeleteConfirm = async () => {
        try {
            const response = await fetch(`/api/admin/invite-codes?id=${selectedCode}`, {
                method: 'DELETE'
            })

            if (response.ok) {
                setSuccessMessage('邀請碼刪除成功')
                setShowDeleteModal(false)
                setSelectedCode('')
                mutate() // Refresh data
            } else {
                setErrorMessage('刪除邀請碼失敗')
            }
        } catch (error) {
            setErrorMessage('刪除邀請碼失敗')
        }
    }

    // Status translation
    const getStatusDisplayName = (status: string) => {
        switch (status) {
            case 'active': return '未使用'
            case 'used': return '已使用'
            case 'expired': return '已過期'
            default: return status
        }
    }

    // Date formatter
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('zh-TW')
    }

    // Error handling
    if (error) {
        const errorMessage = getErrorMessage(error)

        return (
            <div data-testid="invite-codes-management-page">
                <h1>邀請碼管理</h1>
                <div data-testid="status-filters">
                    <label htmlFor="status-filter-select">狀態篩選</label>
                    <select
                        id="status-filter-select"
                        data-testid="status-filter"
                        value=""
                    >
                        <option value="all">全部狀態</option>
                        <option value="active">未使用</option>
                        <option value="used">已使用</option>
                        <option value="expired">已過期</option>
                    </select>
                </div>
                <div data-testid="invite-codes-table" />
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

    const inviteCodes: InviteCode[] = data?.codes || []
    const totalPages = data?.pagination?.totalPages || 1

    return (
        <div data-testid="invite-codes-management-page">
            <h1>邀請碼管理</h1>

            {/* Header with Generate Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div></div>
                <button onClick={() => setShowGenerateModal(true)}>
                    生成邀請碼
                </button>
            </div>

            {/* Status Filters */}
            <div data-testid="status-filters">
                <label htmlFor="status-filter-select">狀態篩選</label>
                <select
                    id="status-filter-select"
                    data-testid="status-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">全部狀態</option>
                    <option value="active">未使用</option>
                    <option value="used">已使用</option>
                    <option value="expired">已過期</option>
                </select>
            </div>

            {/* Loading state */}
            {isLoading && <div data-testid="loading">Loading...</div>}

            {/* Invite Codes Table */}
            <div data-testid="invite-codes-table">
                {inviteCodes.map((inviteCode) => (
                    <div key={inviteCode.code} data-testid={`invite-code-row-${inviteCode.code}`}>
                        <span data-testid={`code-${inviteCode.code}`}>{inviteCode.code}</span>
                        <span data-testid={`credits-value-${inviteCode.code}`}>{inviteCode.creditsValue} 點</span>
                        <span data-testid={`status-${inviteCode.code}`}>{getStatusDisplayName(inviteCode.status)}</span>
                        <span data-testid={`used-by-${inviteCode.code}`}>
                            {inviteCode.usedBy || '-'}
                        </span>
                        <span data-testid={`expires-at-${inviteCode.code}`}>
                            {formatDate(inviteCode.expiresAt)}
                        </span>

                        {/* Delete Button - only for unused codes */}
                        {inviteCode.status === 'active' && (
                            <button
                                aria-label="刪除邀請碼"
                                onClick={() => {
                                    setSelectedCode(inviteCode.code)
                                    setShowDeleteModal(true)
                                }}
                            >
                                刪除
                            </button>
                        )}
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
                <span data-testid="current-page">Page {page} of {totalPages}</span>
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

            {/* Generate Invite Code Modal */}
            {showGenerateModal && (
                <div data-testid="generate-invite-modal">
                    <h2>生成新邀請碼</h2>
                    {errorMessage && (
                        <div data-testid="error-message">
                            {errorMessage}
                        </div>
                    )}
                    <label htmlFor="credits-value-input">點數值</label>
                    <input
                        id="credits-value-input"
                        data-testid="credits-value-input"
                        type="number"
                        placeholder="Enter credits value"
                        value={generateForm.creditsValue}
                        onChange={(e) => setGenerateForm(prev => ({ ...prev, creditsValue: e.target.value }))}
                    />
                    <label htmlFor="expires-at-input">有效期限</label>
                    <input
                        id="expires-at-input"
                        data-testid="expires-at-input"
                        type="date"
                        value={generateForm.expiresAt}
                        onChange={(e) => setGenerateForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                    />
                    <button onClick={() => setShowGenerateModal(false)}>取消</button>
                    <button onClick={handleGenerateSubmit}>生成</button>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div data-testid="delete-confirmation-modal">
                    <h2>確認刪除</h2>
                    <p>確定要刪除邀請碼 {selectedCode} 嗎？</p>
                    <button onClick={() => setShowDeleteModal(false)}>取消</button>
                    <button onClick={handleDeleteConfirm}>確認</button>
                </div>
            )}
        </div>
    )
}
