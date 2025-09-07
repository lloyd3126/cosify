'use client'

import React from 'react'
import { useInviteCodesManagement } from '@/hooks/use-invite-codes-management'
import { StatusFilter } from '@/components/admin/status-filter'
import { InviteCodesTable } from '@/components/admin/invite-codes-table'
import { Pagination } from '@/components/admin/pagination'
import { GenerateInviteModal } from '@/components/admin/generate-invite-modal'
import { DeleteConfirmationModal } from '@/components/admin/delete-confirmation-modal'
import { LoadingSpinner, ErrorDisplay, SuccessMessage } from '@/components/admin/status-components'

export default function InviteCodesManagementPage() {
    const {
        // 數據
        inviteCodes,
        totalPages,
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
        
        // 操作
        handleGenerateSubmit,
        handleDeleteConfirm,
        handleDeleteRequest,
        
        // 工具函數
        getStatusDisplayName,
        formatDate,
        
        // SWR
        mutate
    } = useInviteCodesManagement()

    // 錯誤狀態處理
    if (error) {
        return (
            <div data-testid="invite-codes-management-page">
                <h1>邀請碼管理</h1>
                <StatusFilter 
                    statusFilter=""
                    onStatusChange={() => {}}
                />
                <div data-testid="invite-codes-table" />
                <Pagination
                    currentPage={1}
                    totalPages={1}
                    onPageChange={() => {}}
                />
                <ErrorDisplay 
                    message={error}
                    onRetry={() => mutate()}
                />
            </div>
        )
    }

    return (
        <div data-testid="invite-codes-management-page">
            <h1>邀請碼管理</h1>

            {/* Header with Generate Button */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '20px' 
            }}>
                <div></div>
                <button onClick={() => setShowGenerateModal(true)}>
                    生成邀請碼
                </button>
            </div>

            {/* Status Filters */}
            <StatusFilter 
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
            />

            {/* Loading state */}
            {isLoading && <LoadingSpinner />}

            {/* Invite Codes Table */}
            <InviteCodesTable
                inviteCodes={inviteCodes}
                onDeleteRequest={handleDeleteRequest}
                getStatusDisplayName={getStatusDisplayName}
                formatDate={formatDate}
            />

            {/* Pagination */}
            <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
            />

            {/* Success Message */}
            {successMessage && (
                <SuccessMessage message={successMessage} />
            )}

            {/* Generate Invite Code Modal */}
            <GenerateInviteModal
                show={showGenerateModal}
                form={generateForm}
                errorMessage={errorMessage}
                onClose={() => setShowGenerateModal(false)}
                onSubmit={handleGenerateSubmit}
                onFormChange={setGenerateForm}
            />

            {/* Delete Confirmation Modal */}
            <DeleteConfirmationModal
                show={showDeleteModal}
                selectedCode={selectedCode}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
            />
        </div>
    )
}
