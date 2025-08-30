import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { generateCosplayer } from "@/server/generate";
import { r2Get, r2Put } from "@/server/r2";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const form = await req.formData();
    const character = form.get("character");
    const characterKey = form.get("characterKey");
    const stepUuidRaw = form.get("stepUuid");
    const stepUuid = typeof stepUuidRaw === "string" && stepUuidRaw.length > 0 ? stepUuidRaw : randomUUID();

    let characterBuf: Buffer | null = null;
    if (character instanceof File) {
        characterBuf = Buffer.from(await character.arrayBuffer());
    } else if (typeof characterKey === "string" && characterKey) {
        characterBuf = await r2Get(characterKey);
    }
    if (!characterBuf) return NextResponse.json({ error: "Invalid input: character or characterKey required" }, { status: 400 });

    try {
        const cosplayerBuf = await generateCosplayer(characterBuf);
        const key = `intermediate/${stepUuid}.png`;
        await r2Put(key, cosplayerBuf, "image/png");
        return NextResponse.json({ key, stepUuid });
    } catch (e) {
        const message = e instanceof Error ? e.message : "stage1 failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
