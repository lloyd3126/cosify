import { NextRequest, NextResponse } from "next/server";
import { twoStageGenerate } from "@/server/generate";
import { auth } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const userId = session.user.id;

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
