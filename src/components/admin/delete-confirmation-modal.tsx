import React from 'react'

interface DeleteConfirmationModalProps {
    show: boolean
    selectedCode: string
    onClose: () => void
    onConfirm: () => void
}

export function DeleteConfirmationModal({
    show,
    selectedCode,
    onClose,
    onConfirm
}: DeleteConfirmationModalProps) {
    if (!show) return null

    return (
        <div data-testid="delete-confirmation-modal">
            <h2>確認刪除</h2>
            <p>確定要刪除邀請碼 {selectedCode} 嗎？</p>
            <button onClick={onClose}>取消</button>
            <button onClick={onConfirm}>確認</button>
        </div>
    )
}
