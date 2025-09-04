addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
    // 解析 URL 參數
    const url = new URL(request.url)

    // 設定預設的圖片轉換選項
    const options = { cf: { image: {} } }

    // 1. 參數驗證和限制
    const allowedWidths = [200, 400, 600, 800, 1200, 1600]
    const allowedQualities = [60, 70, 80, 90]

    // 取得並驗證 width 參數
    let width = parseInt(url.searchParams.get("w")) || 800
    if (!allowedWidths.includes(width)) {
        width = 800 // 預設值
    }
    options.cf.image.width = width

    // 取得並驗證 quality 參數
    let quality = parseInt(url.searchParams.get("q")) || 80
    if (!allowedQualities.includes(quality)) {
        quality = 80 // 預設值
    }
    options.cf.image.quality = quality

    // 其他支援的參數
    const fit = url.searchParams.get("fit")
    if (fit && ["scale-down", "contain", "cover", "crop", "pad"].includes(fit)) {
        options.cf.image.fit = fit
    }

    // 2. 根據 Accept header 選擇最佳格式
    const accept = request.headers.get("Accept") || ""
    if (/image\/avif/.test(accept)) {
        options.cf.image.format = 'avif'
    } else if (/image\/webp/.test(accept)) {
        options.cf.image.format = 'webp'
    } else {
        options.cf.image.format = 'jpeg'
    }

    // 3. 取得圖片 key (隱藏完整 R2 URL)
    const imageKey = url.searchParams.get("key")
    if (!imageKey) {
        return new Response('Missing "key" parameter', { status: 400 })
    }

    // 4. 簡單的 Referer 檢查 (基本安全防護)
    const referer = request.headers.get("Referer") || ""
    // 在測試期間放寬限制
    if (referer && !referer.includes("nien.cc") && !referer.includes("localhost")) {
        return new Response('Forbidden', { status: 403 })
    }

    // 5. 驗證檔案副檔名
    if (!/\.(jpe?g|png|gif|webp|avif)$/i.test(imageKey)) {
        return new Response('Unsupported file format', { status: 400 })
    }

    // 6. 構建原始圖片的完整 URL
    const originalImageURL = `https://nien.cc/api/r2/${imageKey}`

    try {
        // 7. 建立帶有原始 headers 的請求
        const imageRequest = new Request(originalImageURL, {
            headers: request.headers
        })

        // 8. 透過 Cloudflare Images 處理並回傳
        const response = await fetch(imageRequest, options)

        // 9. 改善錯誤處理
        if (!response.ok) {
            console.error(`Failed to fetch image: ${originalImageURL}, Status: ${response.status}`)
            return new Response(`Image not found: ${imageKey}`, {
                status: response.status,
                headers: {
                    'Content-Type': 'text/plain'
                }
            })
        }

        return response
    } catch (error) {
        console.error('Image processing error:', error)
        return new Response(`Image processing failed: ${error.message}`, {
            status: 500,
            headers: {
                'Content-Type': 'text/plain'
            }
        })
    }
}
