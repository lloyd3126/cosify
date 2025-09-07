import React from 'react'
import { InviteCode } from '@/hooks/use-invite-codes-management'

interface InviteCodesTableProps {
    inviteCodes: InviteCode[]
    onDeleteRequest: (code: string) => void
    getStatusDisplayName: (status: string) => string
    formatDate: (dateString: string) => string
}

export function InviteCodesTable({ 
    inviteCodes, 
    onDeleteRequest, 
    getStatusDisplayName, 
    formatDate 
}: InviteCodesTableProps) {
    return (
        <div data-testid="invite-codes-table">
            {inviteCodes.map((inviteCode) => (
                <div key={inviteCode.code} data-testid={`invite-code-row-${inviteCode.code}`}>
                    <span data-testid={`code-${inviteCode.code}`}>{inviteCode.code}</span>
                    <span data-testid={`credits-value-${inviteCode.code}`}>
                        {inviteCode.creditsValue} 點
                    </span>
                    <span data-testid={`status-${inviteCode.code}`}>
                        {getStatusDisplayName(inviteCode.status)}
                    </span>
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
                            onClick={() => onDeleteRequest(inviteCode.code)}
                        >
                            刪除
                        </button>
                    )}
                </div>
            ))}
        </div>
    )
}
