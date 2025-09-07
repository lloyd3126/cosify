import React from 'react'
import { Modal } from '../ui/modal'

interface CreditAdjustmentModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: () => void
    creditAmount: string
    setCreditAmount: (value: string) => void
    reason: string
    setReason: (value: string) => void
    errorMessage?: string
}

export const CreditAdjustmentModal: React.FC<CreditAdjustmentModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    creditAmount,
    setCreditAmount,
    reason,
    setReason,
    errorMessage
}) => {
    const footer = (
        <>
            <button onClick={onClose}>取消</button>
            <button onClick={onSubmit}>確認調整</button>
        </>
    )

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="調整用戶積分"
            footer={footer}
        >
            <div data-testid="credit-modal">
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
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                />
                <label htmlFor="modal-credit-reason">調整原因</label>
                <input
                    id="modal-credit-reason"
                    data-testid="modal-credit-reason"
                    type="text"
                    placeholder="Enter reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                />
            </div>
        </Modal>
    )
}

export default CreditAdjustmentModal
