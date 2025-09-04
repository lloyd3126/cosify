addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
    try {
        const url = new URL(request.url)

        // 取得圖片 key
        const imageKey = url.searchParams.get("key")
        if (!imageKey) {
            return new Response('Missing "key" parameter', { status: 400 })
        }

        // 驗證檔案副檔名
        if (!/\.(jpe?g|png|gif|webp|avif)$/i.test(imageKey)) {
            return new Response('Unsupported file format', { status: 400 })
        }

        // 構建原始圖片 URL
        const originalImageURL = `https://r2.nien.cc/${imageKey}`

        // 🔧 暫時跳過 Cloudflare Images，先測試基本功能
        // 直接回傳原始圖片，加上一些基本的 headers
        const response = await fetch(originalImageURL, {
            headers: request.headers
        })

        if (!response.ok) {
            return new Response(`Image not found: ${imageKey}`, {
                status: response.status,
                headers: { 'Content-Type': 'text/plain' }
            })
        }

        // 回傳圖片，加上優化的 cache headers
        const optimizedResponse = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: {
                ...response.headers,
                'Cache-Control': 'public, max-age=31536000, immutable',
                'X-Served-By': 'Cloudflare Worker',
                'X-Original-Size': response.headers.get('content-length') || 'unknown'
            }
        })

        return optimizedResponse

    } catch (error) {
        console.error('Worker error:', error)
        return new Response(`Worker error: ${error.message}`, {
            status: 500,
            headers: { 'Content-Type': 'text/plain' }
        })
    }
}
