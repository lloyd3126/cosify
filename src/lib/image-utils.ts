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

    console.log('🖼️ getOptimizedImageUrl called:', {
        r2Key: r2Key.substring(0, 50) + '...',
        options,
        isDevelopment
    })

    // 🔥 修正：在開發環境中，返回原始 API URL 讓 Next.js Image 組件處理
    if (isDevelopment) {
        const url = `/api/r2/${r2Key}`
        console.log('🔧 開發環境原始 URL:', url)
        return url
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
        console.log('🔧 開發環境預載 URL（原始）:', originalUrl);
        return originalUrl;
    }

    // 生產環境使用 Next.js 優化 URL
    const { width = 200, quality = 80 } = options;
    const baseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://r2.nien.cc';
    const fullUrl = `${baseUrl}/${r2Key}`;
    const optimizedUrl = `/_next/image?url=${encodeURIComponent(fullUrl)}&w=${width}&q=${quality}`;
    console.log('🎯 生產環境預載 URL（優化）:', optimizedUrl);
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
        console.log('🖼️ 開始預載圖片:', imageUrl.substring(0, 80) + '...');
        const img = new Image()
        img.onload = () => {
            console.log('✅ 圖片預載成功:', imageUrl.substring(0, 50) + '...');
            resolve();
        }
        img.onerror = (error) => {
            console.log('❌ 圖片預載失敗:', imageUrl.substring(0, 50) + '...', error);
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
    console.log('🚀 preloadImages 開始:', {
        count: imageUrls.length,
        sampleUrls: imageUrls.slice(0, 3)
    });

    await Promise.all(imageUrls.map((url, index) => {
        console.log(`📥 預載圖片 ${index + 1}/${imageUrls.length}:`, url.substring(0, 80) + '...');
        return preloadImage(url);
    }));

    console.log('✅ preloadImages 完成:', imageUrls.length);
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
    console.log('🎯 預載優化圖片:', {
        keyCount: r2Keys.length,
        options,
        sampleUrls: optimizedUrls.slice(0, 2)
    });
    return preloadImages(optimizedUrls);
}
