import React from 'react'

interface StatusFilterProps {
    statusFilter: string
    onStatusChange: (status: string) => void
}

export function StatusFilter({ statusFilter, onStatusChange }: StatusFilterProps) {
    return (
        <div data-testid="status-filters">
            <label htmlFor="status-filter-select">狀態篩選</label>
            <select
                id="status-filter-select"
                data-testid="status-filter"
                value={statusFilter}
                onChange={(e) => onStatusChange(e.target.value)}
            >
                <option value="all">全部狀態</option>
                <option value="active">未使用</option>
                <option value="used">已使用</option>
                <option value="expired">已過期</option>
            </select>
        </div>
    )
}
