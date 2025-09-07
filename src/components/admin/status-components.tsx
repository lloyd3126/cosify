import React from 'react'

interface LoadingSpinnerProps {
    message?: string
}

export function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps) {
    return (
        <div data-testid="loading">
            {message}
        </div>
    )
}

interface ErrorDisplayProps {
    message: string
    onRetry?: () => void
}

export function ErrorDisplay({ message, onRetry }: ErrorDisplayProps) {
    return (
        <div>
            {message}
            {onRetry && (
                <button onClick={onRetry}>重新載入</button>
            )}
        </div>
    )
}

interface SuccessMessageProps {
    message: string
}

export function SuccessMessage({ message }: SuccessMessageProps) {
    return (
        <div data-testid="success-message">
            {message}
        </div>
    )
}
