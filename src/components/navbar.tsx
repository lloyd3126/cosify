"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Me = {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
} | null;

export function Navbar() {
    const [me, setMe] = useState<Me>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/me", { cache: "no-store" });
                const data = await res.json().catch(() => ({ user: null }));
                if (!cancelled) setMe(data.user ?? null);
            } catch {
                if (!cancelled) setMe(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    async function signInWithGoogle() {
        try {
            const backPath = window.location.pathname + window.location.search;
            const back = `${window.location.origin}${backPath}`;
            const res = await fetch("/api/auth/sign-in/social", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    provider: "google",
                    callbackURL: back,
                    errorCallbackURL: `${window.location.origin}/auth/error`,
                }),
            });
            if (!res.ok) {
                // simple fallback
                return alert("登入失敗，請稍後再試");
            }
            const data: { url?: string; redirect?: boolean } = await res.json();
            if (data.redirect && data.url) {
                window.location.href = data.url;
            }
        } catch {
            alert("登入發生錯誤");
        }
    }

    async function signOut() {
        await fetch("/api/auth/sign-out", { method: "POST" });
        window.location.href = "/";
    }

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
                <div className="flex h-14 items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="font-semibold tracking-tight">
                            Cosify
                        </Link>
                    </div>
                    <div className="flex items-center gap-3">
                        {loading ? (
                            <div className="h-8 w-24 rounded bg-muted/50 animate-pulse" />
                        ) : me ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <Avatar>
                                        <AvatarImage src={me.image ?? undefined} alt={me.name ?? me.email ?? "user"} />
                                        <AvatarFallback>
                                            {(me.name || me.email || "?").slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="text-sm text-muted-foreground">
                                        <div className="font-medium not-italic text-foreground truncate max-w-[160px]">
                                            {me.name || me.email || "使用者"}
                                        </div>
                                        {me.email && (
                                            <div className="truncate max-w-[160px]">{me.email}</div>
                                        )}
                                    </div>
                                </div>
                                <Button variant="ghost" onClick={signOut}>
                                    登出
                                </Button>
                            </>
                        ) : (
                            <Button variant="outline" onClick={signInWithGoogle}>
                                使用 Google 登入
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}

export default Navbar;
