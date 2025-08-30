"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import UploadCard from "@/components/ui/upload-card";
import Image from "next/image";
import useAdaptiveAspect from "@/lib/use-adaptive-aspect";
import { Toaster, toast } from "sonner";
import { useEffect, useMemo, useState } from "react";

type Me = { id: string; name?: string | null; email?: string | null; image?: string | null } | null;

export default function Home() {
    const [selfFile, setSelfFile] = useState<File | null>(null);
    const [characterFile, setCharacterFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [, setProgress] = useState(0);
    const [resultKey, setResultKey] = useState<string | null>(null);
    const [me, setMe] = useState<Me>(null);
    const [loadingMe, setLoadingMe] = useState(true);

    const resultUrl = useMemo(() => (resultKey ? `/api/r2/${resultKey}` : null), [resultKey]);
    const canGenerate = !!me && !!selfFile && !!characterFile && !loading;
    const aspect = useAdaptiveAspect();

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
                if (!cancelled) setLoadingMe(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    async function onGenerate() {
        if (!me) {
            toast("請先登入", { description: "請使用右上角 Google 登入" });
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

    async function onDownload() {
        if (!resultUrl) return;
        try {
            const res = await fetch(resultUrl, { cache: "no-store" });
            if (!res.ok) throw new Error("下載失敗");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            const ts = new Date();
            const pad = (n: number) => n.toString().padStart(2, "0");
            const name = `cosify-${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.png`;
            a.href = url; a.download = name; a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "下載失敗");
        }
    }

    return (
        <div className="mx-auto w-full max-w-6xl p-6">
            <Toaster richColors />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <UploadCard label="上傳想扮演的角色照" file={characterFile} onChange={setCharacterFile} accept="image/*" />
                <UploadCard label="上傳扮演者的全身照" file={selfFile} onChange={setSelfFile} accept="image/*" />
                <div className="space-y-2">
                    <div className="text-center font-medium">生成模擬扮演的成果</div>
                    <Card className="relative w-full overflow-hidden rounded-xl border-2 border-muted-foreground/20 grid place-items-center" style={{ aspectRatio: aspect }}>
                        {loading ? (
                            <div className="flex flex-col items-center gap-3">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground" />
                                <div className="text-sm text-muted-foreground">生成中…請稍候</div>
                            </div>
                        ) : resultUrl ? (
                            <Image src={resultUrl} alt="result" fill className="object-cover" />
                        ) : (
                            <div className="text-5xl text-muted-foreground"> </div>
                        )}
                    </Card>
                    <div className="flex items-center gap-2">
                        <Button className="flex-1 min-w-0" onClick={onGenerate} disabled={!canGenerate}>生成</Button>
                        <Button className="flex-1 min-w-0" onClick={onDownload} disabled={!resultUrl || loading}>下載</Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
