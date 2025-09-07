import useSWR from 'swr'

// 通用的 API fetcher
export const fetcher = async (url: string) => {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.json()
}

// 錯誤處理 helper
export const getErrorMessage = (error: any): string => {
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

// 通用的 API hook
export function useApi<T>(url: string | null) {
    const { data, error, isLoading, mutate } = useSWR<T>(url, fetcher)

    return {
        data,
        error: error ? getErrorMessage(error) : null,
        isLoading,
        mutate
    }
}
