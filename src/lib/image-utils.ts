/**
 * 圖片優化工具函數
 * 提供多種圖片處理和預載功能
 */

export interface ImageTransformOptions {
    width?: number
    quality?: number
    fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad'
}

/**
 * 獲取 Cloudflare Workers 優化的圖片 URL
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

    // 🔥 修正：開發環境也使用優化服務，避免載入原始大圖片
    // if (isDevelopment) {
    //     const url = `/api/r2/${r2Key}`
    //     console.log('🔧 開發環境原始 URL:', url)
    //     return url
    // }

    // 生產環境和開發環境都使用 Worker 優化服務
    const params = new URLSearchParams()
    params.set('key', r2Key)
    params.set('w', width.toString())
    params.set('q', quality.toString())

    if (fit) {
        params.set('fit', fit)
    }

    const optimizedUrl = `https://images.nien.cc?${params.toString()}`
    return optimizedUrl
}

/**
 * 獲取 Next.js 優化的圖片 URL（用於預載）
 * 在開發環境下 Next.js 無法優化 /api/r2/ URL，所以直接返回原始 URL
 */
export function getNextjsOptimizedUrl(
    r2Key: string,
    options: ImageTransformOptions = {}
): string {
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (isDevelopment) {
        // 開發環境下，Next.js 無法優化 /api/r2/ URL，直接使用原始 URL 進行預載
        const originalUrl = `/api/r2/${r2Key}`;
        return originalUrl;
    }

    // 生產環境使用 Next.js 優化 URL
    const { width = 200, quality = 80 } = options;
    const baseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://r2.nien.cc';
    const fullUrl = `${baseUrl}/${r2Key}`;
    const optimizedUrl = `/_next/image?url=${encodeURIComponent(fullUrl)}&w=${width}&q=${quality}`;
    return optimizedUrl;
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
): { primary: string; fallback: string } {
    const primary = getOptimizedImageUrl(r2Key, options)
    const fallback = `/api/r2/${r2Key}`

    return { primary, fallback }
}

/**
 * 產生多種尺寸的響應式圖片 URL
 * @param r2Key - R2 儲存的圖片 key
 * @param sizes - 要產生的尺寸陣列
 * @param quality - 圖片品質
 * @returns 包含多種尺寸的 URL 陣列
 */
export function getResponsiveImageUrls(
    r2Key: string,
    sizes: number[] = [400, 800, 1200],
    quality: number = 80
): { width: number; url: string }[] {
    return sizes.map(width => ({
        width,
        url: getOptimizedImageUrl(r2Key, { width, quality })
    }))
}

/**
 * 預載單張圖片
 * @param imageUrl - 圖片 URL
 * @returns Promise，當圖片載入完成時 resolve
 */
export function preloadImage(imageUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            resolve();
        }
        img.onerror = (error) => {
            reject(error);
        }
        img.src = imageUrl
    })
}

/**
 * 批次預載多張圖片
 * @param imageUrls - 圖片 URL 陣列
 */
export async function preloadImages(imageUrls: string[]): Promise<void> {
    await Promise.all(imageUrls.map((url, index) => {
        return preloadImage(url);
    }));
}

/**
 * 🆕 預載優化圖片的便利函數
 * @param r2Keys - R2 儲存的圖片 key 陣列
 * @param options - 圖片轉換選項
 */
export async function preloadOptimizedImages(
    r2Keys: string[],
    options: ImageTransformOptions = {}
): Promise<void> {
    const optimizedUrls = r2Keys.map(key => getNextjsOptimizedUrl(key, options));
    await preloadImages(optimizedUrls);
}
