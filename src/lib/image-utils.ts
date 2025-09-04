/**
 * 圖片 URL 產生器 - 使用 Cloudflare Images Worker
 */

export interface ImageTransformOptions {
    width?: number
    quality?: number
    fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad'
}

/**
 * 產生優化後的圖片 URL
 * @param r2Key - R2 儲存的圖片 key
 * @param options - 圖片轉換選項
 * @returns 優化後的圖片 URL
 */
export function getOptimizedImageUrl(
    r2Key: string,
    options: ImageTransformOptions = {}
): string {
    const { width = 800, quality = 80, fit } = options

    // 🔧 開發環境檢測 - 使用 NODE_ENV 避免 hydration mismatch
    const isDevelopment = process.env.NODE_ENV === 'development'

    // 在開發環境中，直接使用本地 API 路徑，讓 Next.js Image 組件自動處理優化
    if (isDevelopment) {
        return `/api/r2/${r2Key}`
    }

    // 生產環境：優先使用 Worker 優化服務
    const params = new URLSearchParams()
    params.set('key', r2Key)
    params.set('w', width.toString())
    params.set('q', quality.toString())

    if (fit) {
        params.set('fit', fit)
    }

    return `https://images.nien.cc?${params.toString()}`
}

/**
 * 產生優化後的圖片 URL，包含降級機制
 * @param r2Key - R2 儲存的圖片 key
 * @param options - 圖片轉換選項
 * @returns 包含主要和降級 URL 的物件
 */
export function getImageUrlWithFallback(
    r2Key: string,
    options: ImageTransformOptions = {}
) {
    return {
        optimized: getOptimizedImageUrl(r2Key, options),
        fallback: `https://r2.nien.cc/${r2Key}`,  // 直接從 R2 取得
        local: `/api/r2/${r2Key}`  // 本地 API 降級
    }
}

/**
 * 產生不同尺寸的圖片 URL
 * @param r2Key - R2 儲存的圖片 key
 * @returns 包含不同尺寸的圖片 URL 物件
 */
export function getResponsiveImageUrls(r2Key: string) {
    return {
        thumbnail: getOptimizedImageUrl(r2Key, { width: 200, quality: 70 }),
        small: getOptimizedImageUrl(r2Key, { width: 400, quality: 80 }),
        medium: getOptimizedImageUrl(r2Key, { width: 800, quality: 80 }),
        large: getOptimizedImageUrl(r2Key, { width: 1200, quality: 90 }),
        original: `/api/r2/${r2Key}` // 備用的原始圖片
    }
}

/**
 * 預載圖片到瀏覽器快取
 * @param imageUrl - 圖片 URL
 */
export function preloadImage(imageUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve()
        img.onerror = reject
        img.src = imageUrl
    })
}

/**
 * 批次預載多張圖片
 * @param imageUrls - 圖片 URL 陣列
 */
export async function preloadImages(imageUrls: string[]): Promise<void> {
    await Promise.all(imageUrls.map(preloadImage))
}
