import React from 'react'
import { Modal } from '../ui/modal'

interface DailyLimitModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: () => void
    limitValue: string
    setLimitValue: (value: string) => void
}

export const DailyLimitModal: React.FC<DailyLimitModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    limitValue,
    setLimitValue
}) => {
    const footer = (
        <>
            <button onClick={onClose}>取消</button>
            <button onClick={onSubmit}>儲存設定</button>
        </>
    )

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="設定每日限制"
            footer={footer}
        >
            <div data-testid="limit-modal">
                <label htmlFor="modal-limit-input">每日積分限制</label>
                <input
                    id="modal-limit-input"
                    data-testid="modal-limit-input"
                    type="number"
                    placeholder="Enter daily limit"
                    value={limitValue}
                    onChange={(e) => setLimitValue(e.target.value)}
                />
            </div>
        </Modal>
    )
}

export default DailyLimitModal
