import { useState } from 'react'
import { useApi } from './use-api'

// 邀請碼類型定義
export interface InviteCode {
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

export interface InviteCodesResponse {
    codes: InviteCode[]
    pagination: {
        currentPage: number
        totalPages: number
        totalItems: number
        itemsPerPage: number
    }
}

export interface GenerateInviteForm {
    creditsValue: string
    expiresAt: string
}

// 狀態管理和 API 操作的自定義 hook
export function useInviteCodesManagement() {
    const [page, setPage] = useState(1)
    const [statusFilter, setStatusFilter] = useState('all')
    const [showGenerateModal, setShowGenerateModal] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [selectedCode, setSelectedCode] = useState<string>('')
    const [generateForm, setGenerateForm] = useState<GenerateInviteForm>({
        creditsValue: '',
        expiresAt: ''
    })
    const [successMessage, setSuccessMessage] = useState('')
    const [errorMessage, setErrorMessage] = useState('')

    // SWR data fetching
    const { data, error, isLoading, mutate } = useApi<InviteCodesResponse>(
        `/api/admin/invite-codes?page=${page}&status=${statusFilter}&limit=10`
    )

    // 清除訊息
    const clearMessages = () => {
        setSuccessMessage('')
        setErrorMessage('')
    }

    // 生成邀請碼
    const handleGenerateSubmit = async () => {
        clearMessages()

        // 驗證
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

    // 刪除邀請碼
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

    // 處理刪除請求
    const handleDeleteRequest = (code: string) => {
        setSelectedCode(code)
        setShowDeleteModal(true)
    }

    // 狀態翻譯
    const getStatusDisplayName = (status: string) => {
        switch (status) {
            case 'active': return '未使用'
            case 'used': return '已使用'
            case 'expired': return '已過期'
            default: return status
        }
    }

    // 日期格式化
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('zh-TW')
    }

    return {
        // 數據
        inviteCodes: data?.codes || [],
        totalPages: data?.pagination?.totalPages || 1,
        isLoading,
        error,
        
        // 狀態
        page,
        statusFilter,
        showGenerateModal,
        showDeleteModal,
        selectedCode,
        generateForm,
        successMessage,
        errorMessage,
        
        // 狀態更新
        setPage,
        setStatusFilter,
        setShowGenerateModal,
        setShowDeleteModal,
        setGenerateForm,
        clearMessages,
        
        // 操作
        handleGenerateSubmit,
        handleDeleteConfirm,
        handleDeleteRequest,
        
        // 工具函數
        getStatusDisplayName,
        formatDate,
        
        // SWR
        mutate
    }
}
