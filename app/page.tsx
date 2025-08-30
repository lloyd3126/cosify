"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Toaster, toast } from "sonner";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Home() {
    const [selfFile, setSelfFile] = useState<File | null>(null);
    const [characterFile, setCharacterFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [resultKey, setResultKey] = useState<string | null>(null);
    const resultUrl = resultKey ? `/api/r2/${resultKey}` : null;
    const [me, setMe] = useState<null | { id: string; name?: string | null; email?: string | null; image?: string | null }>(null);
    const [loadingMe, setLoadingMe] = useState(true);

    // Keys for sessionStorage to preserve file selections across auth redirects
    const REDIRECT_KEY = "cosify_redirect_after_login";
    const SELF_KEY = "cosify_self_dataurl";
    const SELF_META = "cosify_self_meta";
    const CH_KEY = "cosify_character_dataurl";
    const CH_META = "cosify_character_meta";
    const HINT_KEY = "cosify_restore_hint";

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/me", { cache: "no-store" });
                const data = await res.json();
                if (!cancelled) setMe(data.user);
            } catch {
                if (!cancelled) setMe(null);
            } finally {
                if (!cancelled) setLoadingMe(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Sync document title with user identity
    useEffect(() => {
        const base = "Cosify";
        if (typeof document !== "undefined") {
            document.title = me ? `${base} — ${me.name || me.email || "使用者"}` : base;
        }
    }, [me]);

    // Helpers to persist/restore files across redirects
    async function fileToDataURL(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error || new Error("read failed"));
            reader.readAsDataURL(file);
        });
    }

    async function stashSelectedFilesIfAny() {
        try {
            sessionStorage.setItem(REDIRECT_KEY, "1");
            if (selfFile) {
                const dataurl = await fileToDataURL(selfFile);
                sessionStorage.setItem(SELF_KEY, dataurl);
                sessionStorage.setItem(SELF_META, JSON.stringify({ name: selfFile.name, type: selfFile.type }));
            }
            if (characterFile) {
                const dataurl = await fileToDataURL(characterFile);
                sessionStorage.setItem(CH_KEY, dataurl);
                sessionStorage.setItem(CH_META, JSON.stringify({ name: characterFile.name, type: characterFile.type }));
            }
        } catch {
            // Likely quota exceeded (very large images)
            sessionStorage.setItem(HINT_KEY, "1");
        }
    }

    function clearStash() {
        sessionStorage.removeItem(REDIRECT_KEY);
        sessionStorage.removeItem(SELF_KEY);
        sessionStorage.removeItem(SELF_META);
        sessionStorage.removeItem(CH_KEY);
        sessionStorage.removeItem(CH_META);
        sessionStorage.removeItem(HINT_KEY);
    }

    useEffect(() => {
        (async () => {
            try {
                const shouldRestore = sessionStorage.getItem(REDIRECT_KEY) === "1";
                if (!shouldRestore) return;
                const selfUrl = sessionStorage.getItem(SELF_KEY);
                const chUrl = sessionStorage.getItem(CH_KEY);
                const selfMeta = sessionStorage.getItem(SELF_META);
                const chMeta = sessionStorage.getItem(CH_META);

                async function dataURLToFile(dataUrl: string, fallbackName: string, type: string) {
                    const res = await fetch(dataUrl);
                    const blob = await res.blob();
                    return new File([blob], fallbackName, { type: type || blob.type });
                }

                if (selfUrl && selfMeta) {
                    const meta = JSON.parse(selfMeta) as { name: string; type: string };
                    const f = await dataURLToFile(selfUrl, meta.name || "self.png", meta.type || "image/png");
                    setSelfFile(f);
                }
                if (chUrl && chMeta) {
                    const meta = JSON.parse(chMeta) as { name: string; type: string };
                    const f = await dataURLToFile(chUrl, meta.name || "character.png", meta.type || "image/png");
                    setCharacterFile(f);
                }

                if (selfUrl || chUrl) {
                    toast.success("已保留先前選擇的檔案");
                } else if (sessionStorage.getItem(HINT_KEY) === "1") {
                    toast("請重新選擇檔案", { description: "檔案過大無法暫存" });
                }
            } finally {
                clearStash();
            }
        })();
    }, []);

    async function onSubmit() {
        if (!me) {
            // 未登入，先暫存檔案並引導登入
            await signInWithGoogle();
            return;
        }
        if (!selfFile || !characterFile) {
            toast.error("請選擇兩張圖片");
            return;
        }
        setLoading(true);
        setProgress(10);
        try {
            const fd = new FormData();
            fd.append("self", selfFile);
            fd.append("character", characterFile);

            setProgress(35);
            const res = await fetch("/api/generate", { method: "POST", body: fd });
            setProgress(80);
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "生成失敗");
            setResultKey(data.key as string);
            toast.success("生成完成");
            setProgress(100);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "發生錯誤";
            toast.error(msg);
            setProgress(0);
        } finally {
            setLoading(false);
        }
    }

    async function signInWithGoogle() {
        try {
            await stashSelectedFilesIfAny();
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
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.message || "登入端點錯誤");
            }
            const data: { url?: string; redirect?: boolean } = await res.json();
            if (data.redirect && data.url) {
                window.location.href = data.url; // 導向 Google 授權頁
            } else {
                // 萬一未帶回 url，提示手動重試
                toast.error("無法取得授權網址，請重試");
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : "登入失敗";
            toast.error(msg);
        }
    }

    async function signOut() {
        await fetch("/api/auth/sign-out", { method: "POST" });
        window.location.href = "/";
    }

    return (
        <div className="min-h-dvh flex items-center justify-center p-6">
            <Toaster richColors />
            <Card className="w-full max-w-xl">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Cosify 生成</CardTitle>
                        <div className="flex items-center gap-3">
                            {loadingMe ? (
                                <div className="h-8 w-32 bg-muted/50 rounded animate-pulse" />
                            ) : me ? (
                                <>
                                    <div className="flex items-center gap-2">
                                        <Avatar>
                                            <AvatarImage src={me.image ?? undefined} alt={me.name ?? me.email ?? "user"} />
                                            <AvatarFallback>{(me.name || me.email || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="text-sm text-muted-foreground">
                                            <div className="font-medium not-italic text-foreground truncate max-w-[160px]">{me.name || me.email || "使用者"}</div>
                                            {me.email && <div className="truncate max-w-[160px]">{me.email}</div>}
                                        </div>
                                    </div>
                                    <Button variant="ghost" onClick={signOut}>登出</Button>
                                </>
                            ) : (
                                <Button variant="outline" onClick={signInWithGoogle}>使用 Google 登入</Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="self">你的照片</Label>
                        <Input id="self" type="file" accept="image/*" onChange={(e) => setSelfFile(e.target.files?.[0] || null)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ch">角色圖片</Label>
                        <Input id="ch" type="file" accept="image/*" onChange={(e) => setCharacterFile(e.target.files?.[0] || null)} />
                    </div>
                    {loading && <Progress value={progress} />}
                    <div className="flex gap-2">
                        <Button onClick={onSubmit} disabled={loading} className="w-full">
                            {loading ? "生成中…" : "生成 Cosplay 圖片"}
                        </Button>
                    </div>
                    {resultUrl && (
                        <div className="pt-4">
                            <Image src={resultUrl} alt="result" width={512} height={512} className="rounded-md" />
                            <div className="mt-2 text-xs text-muted-foreground break-all">R2 Key：{resultKey}</div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
