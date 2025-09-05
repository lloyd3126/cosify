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

    const buf = await r2Get(key);
    if (!buf) return new NextResponse("Not found", { status: 404 });

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
