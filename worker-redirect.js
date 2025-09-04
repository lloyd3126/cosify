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

        // 獲取轉換參數
        const width = parseInt(url.searchParams.get("w")) || 800
        const quality = parseInt(url.searchParams.get("q")) || 80

        // 使用 Cloudflare Images 的 URL-based transformation
        // 格式: https://domain/cdn-cgi/image/options/source-url
        const transformedURL = `https://nien.cc/cdn-cgi/image/width=${width},quality=${quality},format=auto/${originalImageURL}`

        // 直接重導向到轉換後的 URL
        return Response.redirect(transformedURL, 302)

    } catch (error) {
        console.error('Worker error:', error)
        return new Response(`Worker error: ${error.message}`, {
            status: 500,
            headers: { 'Content-Type': 'text/plain' }
        })
    }
}
