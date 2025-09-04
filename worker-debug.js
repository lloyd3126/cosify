addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
    try {
        // 解析 URL 參數
        const url = new URL(request.url)

        // 取得圖片 key
        const imageKey = url.searchParams.get("key")
        if (!imageKey) {
            return new Response('Missing "key" parameter', { status: 400 })
        }

        // 取得轉換參數
        const width = parseInt(url.searchParams.get("w")) || 800
        const quality = parseInt(url.searchParams.get("q")) || 80

        // 驗證檔案副檔名
        if (!/\.(jpe?g|png|gif|webp|avif)$/i.test(imageKey)) {
            return new Response('Unsupported file format', { status: 400 })
        }

        // 構建原始圖片 URL
        const originalImageURL = `https://r2.nien.cc/${imageKey}`

        // 測試：先確認原始圖片是否存在
        const testResponse = await fetch(originalImageURL, { method: 'HEAD' })
        if (!testResponse.ok) {
            return new Response(`Original image not found: ${originalImageURL}`, {
                status: 404,
                headers: { 'Content-Type': 'text/plain' }
            })
        }

        // 設定圖片轉換選項
        const options = {
            cf: {
                image: {
                    width: Math.min(width, 2000), // 限制最大寬度
                    quality: Math.min(Math.max(quality, 1), 100), // 限制品質範圍
                    format: 'auto' // 讓 Cloudflare 自動選擇格式
                }
            }
        }

        // 執行圖片轉換
        const response = await fetch(originalImageURL, options)

        if (!response.ok) {
            // 如果轉換失敗，回傳原始圖片
            console.error(`Image transformation failed, fallback to original`)
            return fetch(originalImageURL)
        }

        // 成功回傳轉換後的圖片
        return response

    } catch (error) {
        console.error('Worker error:', error)
        return new Response(`Worker error: ${error.message}`, {
            status: 500,
            headers: { 'Content-Type': 'text/plain' }
        })
    }
}
