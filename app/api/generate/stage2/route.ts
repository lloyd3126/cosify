import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { generateOutfit } from "@/server/generate";
import { r2Get, r2Put } from "@/server/r2";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const form = await req.formData();
    const intermediate = form.get("intermediate");
    const intermediateKey = form.get("intermediateKey");
    const stepUuidRaw = form.get("stepUuid");
    const stepUuid = typeof stepUuidRaw === "string" && stepUuidRaw.length > 0 ? stepUuidRaw : randomUUID();

    let cosplayerBuf: Buffer | null = null;
    if (intermediate instanceof File) {
        cosplayerBuf = Buffer.from(await intermediate.arrayBuffer());
    } else if (typeof intermediateKey === "string" && intermediateKey) {
        cosplayerBuf = await r2Get(intermediateKey);
    }
    if (!cosplayerBuf) return NextResponse.json({ error: "Invalid input: intermediate or intermediateKey required" }, { status: 400 });

    try {
        const outfitBuf = await generateOutfit(cosplayerBuf);
        const key = `outfit/${stepUuid}.png`;
        await r2Put(key, outfitBuf, "image/png");
        return NextResponse.json({ key, stepUuid });
    } catch (e) {
        const message = e instanceof Error ? e.message : "stage2 failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
