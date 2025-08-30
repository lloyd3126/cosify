import { NextRequest, NextResponse } from "next/server";
import { twoStageGenerate } from "@/server/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const form = await req.formData();
    const self = form.get("self");
    const character = form.get("character");

    if (
        !(self instanceof File) ||
        !(character instanceof File)
    ) {
        return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const [selfBuf, characterBuf] = await Promise.all([
        self.arrayBuffer().then((b) => Buffer.from(b)),
        character.arrayBuffer().then((b) => Buffer.from(b)),
    ]);

    // TODO: 之後導入 session 檢查，取得 userId
    const userId = "anonymous";

    try {
        const { finalKey } = await twoStageGenerate({
            userImage: selfBuf,
            characterImage: characterBuf,
            userId,
        });
        return NextResponse.json({ key: finalKey });
    } catch (e) {
        const message = e instanceof Error ? e.message : "generate failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
