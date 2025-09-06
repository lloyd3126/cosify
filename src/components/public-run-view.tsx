"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import Lightbox from "@/components/ui/lightbox";
import { getOptimizedImageUrl } from "@/lib/image-utils";

interface PublicRunViewProps {
    runId: string;
    slug: string;
    createdAt: string;
}

interface RunItem {
    r2Key: string;
    createdAt: string;
    stepId: string;
    kind?: string;
}

export function PublicRunView({ runId, slug, createdAt }: PublicRunViewProps) {
    const [items, setItems] = useState<RunItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lbOpen, setLbOpen] = useState(false);
    const [lbKeys, setLbKeys] = useState<string[]>([]);
    const [lbIndex, setLbIndex] = useState(0);
    const [lbSrc, setLbSrc] = useState<string | null>(null);
    const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});

    useEffect(() => {
        loadItems();
    }, [runId]);

    const loadItems = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/runs/public/${runId}/items`);
            if (!response.ok) {
                throw new Error("載入失敗");
            }
            const data = await response.json();
            setItems(data.items || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "載入失敗");
        } finally {
            setLoading(false);
        }
    };

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

    const ensureBlobUrlForKey = async (key: string): Promise<string> => {
        if (blobUrls[key]) return blobUrls[key];

        const res = await fetch(`/api/r2/${key}`, { cache: "no-store" });
        if (!res.ok) throw new Error("下載失敗");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setBlobUrls(prev => ({ ...prev, [key]: url }));
        return url;
    };

    const downloadByKey = async (key: string) => {
        try {
            const url = await ensureBlobUrlForKey(key);
            const a = document.createElement("a");
            a.href = url;
            const base = key.split("/").pop() || "image.png";
            a.download = base.endsWith(".png") ? base : `${base}.png`;
            a.click();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "下載失敗");
        }
    };

    const openLightbox = async (r2Key: string) => {
        try {
            const url = await ensureBlobUrlForKey(r2Key);
            setLbSrc(url);
            setLbKeys(items.map(item => item.r2Key));
            setLbIndex(items.findIndex(item => item.r2Key === r2Key));
            setLbOpen(true);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "載入失敗");
        }
    };

    if (loading) {
        return (
            <div className="mx-auto w-full max-w-6xl p-6">
                <div className="text-center">載入中...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="mx-auto w-full max-w-4xl p-6">
                <div className="text-center text-red-500">{error}</div>
            </div>
        );
    }

    return (
        <>
            <div className="mx-auto w-full max-w-6xl p-6">
                <div className="mb-6 space-y-2">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold">公開執行結果</h1>
                        <Button
                            variant="outline"
                            onClick={() => window.open(`/flows/${encodeURIComponent(slug)}`, '_blank')}
                        >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            查看流程
                        </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        執行時間：{formatDateTime(createdAt)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        執行 ID：{runId}
                    </p>
                </div>

                {items.length === 0 ? (
                    <div className="text-center text-muted-foreground">
                        此執行結果沒有圖片
                    </div>
                ) : (
                    <Card className="p-4">
                        <div className="grid gap-2 grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
                            {items.map((item) => (
                                <div
                                    key={item.r2Key}
                                    className="group relative w-full overflow-hidden rounded-md border cursor-zoom-in"
                                    style={{ aspectRatio: "1 / 1" }}
                                    onClick={() => openLightbox(item.r2Key)}
                                >
                                    <img
                                        src={getOptimizedImageUrl(item.r2Key, { width: 200, quality: 100 })}
                                        alt="result"
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 opacity-0 pointer-events-none transition-opacity bg-black/40 group-hover:opacity-100 group-hover:pointer-events-auto">
                                        <div className="absolute inset-x-0 bottom-0 p-2 pointer-events-auto">
                                            <div className="flex justify-end">
                                                <Button
                                                    size="sm"
                                                    className="bg-black text-white hover:bg-black/90"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        downloadByKey(item.r2Key);
                                                    }}
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
                )}
            </div>

            <Lightbox
                open={lbOpen}
                src={lbSrc}
                onClose={() => {
                    setLbOpen(false);
                    setLbKeys([]);
                    setLbIndex(0);
                    setLbSrc(null);
                }}
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
        </>
    );
}
