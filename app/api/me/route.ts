import { NextResponse } from "next/server";
import { auth } from "@/server/auth";

export async function GET(request: Request) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ user: null });
    const { id, name, email, image } = session.user;
    return NextResponse.json({ user: { id, name, email, image } });
}
