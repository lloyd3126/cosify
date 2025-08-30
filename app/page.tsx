"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import UploadCard from "@/components/ui/upload-card";
import Image from "next/image";
import useAdaptiveAspect from "@/lib/use-adaptive-aspect";
import { X, Download, WandSparkles, RotateCw } from "lucide-react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
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
    const [confirmClearResult, setConfirmClearResult] = useState(false);
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

    function onClearResult() {
        setResultKey(null);
    }

    return (
        <div className="mx-auto w-full max-w-6xl p-6">
            <Toaster richColors />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <UploadCard label="上傳想扮演的角色照" file={characterFile} onChange={setCharacterFile} accept="image/*" />
                <UploadCard label="上傳扮演者的全身照" file={selfFile} onChange={setSelfFile} accept="image/*" />
                <div className="space-y-2">
                    <div className="text-center font-medium">生成模擬扮演的成果</div>
                    <Card className="group relative w-full overflow-hidden rounded-xl border-2 border-muted-foreground/20" style={{ aspectRatio: aspect }} tabIndex={0}>
                        {loading ? (
                            <div className="absolute inset-0 grid place-items-center">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground" />
                                    {/* <div className="text-sm text-muted-foreground">生成中…請稍候</div> */}
                                </div>
                            </div>
                        ) : resultUrl ? (
                            <>
                                <Image src={resultUrl} alt="result" fill className="object-cover" />
                                {/* Top-right clear button for result */}
                                <button
                                    type="button"
                                    onClick={() => setConfirmClearResult(true)}
                                    aria-label="清除結果"
                                    className="absolute right-2 top-2 z-10 rounded-full bg-black/60 text-white p-1.5 shadow-sm transition-colors hover:bg-black/75 focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
                                    disabled={loading}
                                >
                                    <X className="h-4 w-4" />
                                </button>
                                <ConfirmDialog
                                    open={confirmClearResult}
                                    title="清除這張結果？"
                                    description="此動作無法復原。"
                                    confirmText="清除"
                                    cancelText="取消"
                                    onCancel={() => setConfirmClearResult(false)}
                                    onConfirm={() => { setConfirmClearResult(false); onClearResult(); }}
                                />
                                {/* Overlay controls: show on hover/focus when image exists */}
                                <div className="absolute inset-0 z-0 flex items-end p-3 bg-black/30 opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
                                    <div className="w-full grid grid-cols-2 gap-2">
                                        <Button className="w-full" onClick={onGenerate} disabled={!canGenerate} aria-label="重新生成">
                                            <RotateCw className="h-4 w-4" />
                                        </Button>
                                        <Button className="w-full" onClick={onDownload} disabled={!resultUrl || loading} aria-label="下載">
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="absolute inset-0" />
                                {/* No image: buttons are directly visible inside the card */}
                                <div className="absolute inset-x-0 bottom-0 p-3">
                                    <div className="w-full grid grid-cols-1 gap-2">
                                        <Button className="w-full" onClick={onGenerate} disabled={!canGenerate} aria-label="生成">
                                            <WandSparkles className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
