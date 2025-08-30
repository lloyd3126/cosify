import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { generateUserCosplay } from "@/server/generate";
import { r2Get, r2Put } from "@/server/r2";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const form = await req.formData();
    const user = form.get("user");
    const userKey = form.get("userKey");
    const outfit = form.get("outfit");
    const outfitKey = form.get("outfitKey");
    const stepUuidRaw = form.get("stepUuid");
    const stepUuid = typeof stepUuidRaw === "string" && stepUuidRaw.length > 0 ? stepUuidRaw : randomUUID();

    let userBuf: Buffer | null = null;
    if (user instanceof File) userBuf = Buffer.from(await user.arrayBuffer());
    else if (typeof userKey === "string" && userKey) userBuf = await r2Get(userKey);

    let outfitBuf: Buffer | null = null;
    if (outfit instanceof File) outfitBuf = Buffer.from(await outfit.arrayBuffer());
    else if (typeof outfitKey === "string" && outfitKey) outfitBuf = await r2Get(outfitKey);

    if (!userBuf || !outfitBuf) return NextResponse.json({ error: "Invalid input: user(+key) and outfit(+key) required" }, { status: 400 });

    try {
        const stage3Buf = await generateUserCosplay(userBuf, outfitBuf);
        const key = `final_stage3/${stepUuid}.png`;
        await r2Put(key, stage3Buf, "image/png");
        return NextResponse.json({ key, stepUuid });
    } catch (e) {
        const message = e instanceof Error ? e.message : "stage3 failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
