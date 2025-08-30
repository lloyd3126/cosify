import { NextRequest, NextResponse } from "next/server";
import { r2Get } from "@/server/r2";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ key: string[] }> }
) {
    const { key: keyArr } = await context.params;
    const key = keyArr.join("/");
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
