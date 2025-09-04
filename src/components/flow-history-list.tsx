"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { toast, Toaster } from "sonner";
import Lightbox from "@/components/ui/lightbox";
import { Download } from "lucide-react";

export type FlowHistoryListRun = {
    runId: string;
    createdAt: string;
    itemsPreview: Array<{ r2Key: string; createdAt: string }>;
    itemsTotal: number;
};

export function FlowHistoryList({ runs }: { runs: FlowHistoryListRun[] }) {
    const [cols, setCols] = useState(3);
    const [lbOpen, setLbOpen] = useState(false);
    const [lbKeys, setLbKeys] = useState<string[]>([]);
    const [lbIndex, setLbIndex] = useState(0);
    const [lbSrc, setLbSrc] = useState<string | null>(null);
    const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
    const blobUrlsRef = useRef<Record<string, string>>({});
    useEffect(() => { blobUrlsRef.current = blobUrls; }, [blobUrls]);
    useEffect(() => () => { Object.values(blobUrlsRef.current).forEach((u) => { try { URL.revokeObjectURL(u); } catch { } }); }, []);

    async function ensureBlobUrlForKey(key: string): Promise<string> {
        const cached = blobUrlsRef.current[key];
        if (cached) return cached;
        const res = await fetch(`/api/r2/${key}`, { cache: "no-store" });
        if (!res.ok) throw new Error("下載失敗");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setBlobUrls((prev) => ({ ...prev, [key]: url }));
        return url;
    }

    async function downloadByKey(key: string, filename?: string) {
        try {
            const url = await ensureBlobUrlForKey(key);
            const a = document.createElement("a");
            a.href = url;
            const base = filename ?? (key.split("/").pop() || "image.png");
            a.download = base.endsWith(".png") ? base : `${base}.png`;
            a.click();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "下載失敗");
        }
    }

    useEffect(() => {
        if (typeof window === "undefined") return;
        const mMd = window.matchMedia("(min-width: 768px)");
        const mLg = window.matchMedia("(min-width: 1024px)");
        const update = () => setCols(mLg.matches ? 6 : mMd.matches ? 5 : 3);
        update();
        mMd.addEventListener?.("change", update);
        mLg.addEventListener?.("change", update);
        return () => {
            mMd.removeEventListener?.("change", update);
            mLg.removeEventListener?.("change", update);
        };
    }, []);

    const gridColsClass = useMemo(() => {
        return "grid gap-2 grid-cols-3 md:grid-cols-5 lg:grid-cols-6";
    }, []);

    const formatDateTime = (iso: string) => {
        const d = new Date(iso);
        const pad = (n: number) => n.toString().padStart(2, "0");
        const y = d.getFullYear();
        const m = pad(d.getMonth() + 1);
        const day = pad(d.getDate());
        const hh = pad(d.getHours());
        const mm = pad(d.getMinutes());
        const ss = pad(d.getSeconds());
        return `${y}/${m}/${day} ${hh}:${mm}:${ss}`;
    };

    return (
        <div className="space-y-4">
            <Toaster richColors />
            {runs.map((r) => (
                <Card key={r.runId} className="p-4 space-y-3 rounded-md gap-3">
                    <div className="flex items-center justify-between m-0">
                        <div className="text-sm text-black">{`${formatDateTime(r.createdAt)} - ${r.itemsTotal} 張`}</div>
                    </div>
                    <div className={gridColsClass}>
                        {r.itemsPreview.slice(0, cols).map((it, i) => (
                            <div
                                key={`${it.r2Key}-${i}`}
                                className="group relative w-full overflow-hidden rounded-md border cursor-zoom-in"
                                style={{ aspectRatio: "1 / 1" }}
                                onClick={async () => {
                                    try {
                                        const url = await ensureBlobUrlForKey(it.r2Key);
                                        setLbSrc(url);
                                        setLbKeys(r.itemsPreview.map((item) => item.r2Key));
                                        setLbIndex(i);
                                        setLbOpen(true);
                                    } catch (e) {
                                        toast.error(e instanceof Error ? e.message : "下載失敗");
                                    }
                                }}
                                role="button"
                                aria-label="預覽"
                            >
                                <Image src={`/api/r2/${it.r2Key}`} alt="thumb" fill className="object-cover" />
                                <div className="absolute inset-0 opacity-0 pointer-events-none transition-opacity bg-black/40 group-hover:opacity-100 group-hover:pointer-events-auto">
                                    <div className="absolute inset-x-0 bottom-0 p-2 pointer-events-auto">
                                        <div className="flex justify-end">
                                            <Button
                                                size="sm"
                                                className="bg-black text-white hover:bg-black/90"
                                                onClick={(e) => { e.stopPropagation(); downloadByKey(it.r2Key); }}
                                                aria-label="下載"
                                            >
                                                <Download className="h-4 w-4 text-white" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            ))}
            <Lightbox
                open={lbOpen}
                src={lbSrc}
                onClose={() => { setLbOpen(false); setLbKeys([]); setLbIndex(0); setLbSrc(null); }}
                onPrev={async () => {
                    const total = lbKeys.length;
                    if (total <= 1) return;
                    const nextIdx = lbIndex <= 0 ? (total - 1) : (lbIndex - 1);
                    const key = lbKeys[nextIdx];
                    try {
                        const url = await ensureBlobUrlForKey(key);
                        setLbIndex(nextIdx);
                        setLbSrc(url);
                    } catch { }
                }}
                onNext={async () => {
                    const total = lbKeys.length;
                    if (total <= 1) return;
                    const nextIdx = lbIndex >= total - 1 ? 0 : (lbIndex + 1);
                    const key = lbKeys[nextIdx];
                    try {
                        const url = await ensureBlobUrlForKey(key);
                        setLbIndex(nextIdx);
                        setLbSrc(url);
                    } catch { }
                }}
                canPrev={lbKeys.length > 1}
                canNext={lbKeys.length > 1}
            />
        </div>
    );
}
