import React from 'react'
import { GenerateInviteForm } from '@/hooks/use-invite-codes-management'

interface GenerateInviteModalProps {
    show: boolean
    form: GenerateInviteForm
    errorMessage: string
    onClose: () => void
    onSubmit: () => void
    onFormChange: (form: GenerateInviteForm) => void
}

export function GenerateInviteModal({
    show,
    form,
    errorMessage,
    onClose,
    onSubmit,
    onFormChange
}: GenerateInviteModalProps) {
    if (!show) return null

    return (
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
                value={form.creditsValue}
                onChange={(e) => onFormChange({
                    ...form,
                    creditsValue: e.target.value
                })}
            />
            <label htmlFor="expires-at-input">有效期限</label>
            <input
                id="expires-at-input"
                data-testid="expires-at-input"
                type="date"
                value={form.expiresAt}
                onChange={(e) => onFormChange({
                    ...form,
                    expiresAt: e.target.value
                })}
            />
            <button onClick={onClose}>取消</button>
            <button onClick={onSubmit}>生成</button>
        </div>
    )
}
