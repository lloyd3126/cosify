import { NextRequest, NextResponse } from "next/server";
import { r2Get } from "@/server/r2";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ key: string[] }> }
) {
    const { key: keyArr } = await context.params;
    const key = keyArr.join("/");

    // 獲取查詢參數，用於圖片優化請求識別
    const searchParams = req.nextUrl.searchParams;
    const width = searchParams.get('w');
    const quality = searchParams.get('q');
    const fit = searchParams.get('fit');

    // 獲取請求來源
    const userAgent = req.headers.get('user-agent');
    const referer = req.headers.get('referer');
    const isNextImageRequest = userAgent?.includes('Next.js') || req.headers.get('x-nextjs-cache');

    console.log('� R2 API 請求:', {
        key: key.substring(0, 50) + '...',
        params: { width, quality, fit },
        isNextImageRequest,
        referer: referer?.substring(0, 80),
        userAgent: userAgent?.substring(0, 50)
    });

    const buf = await r2Get(key);
    if (!buf) return new NextResponse("Not found", { status: 404 });

    console.log('📁 R2 檔案大小:', {
        key: key.substring(0, 30) + '...',
        size: `${(buf.byteLength / 1024 / 1024).toFixed(2)} MB`,
        bytes: buf.byteLength
    });

    return new NextResponse(buf, {
        headers: {
            "Content-Type": "image/png",
            // 避免下載舊檔，按規劃使用 no-store
            "Cache-Control": "no-store, no-cache, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
        },
    });
}
