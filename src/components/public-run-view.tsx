"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Play, Lock } from "lucide-react";
import { toast } from "sonner";
import Lightbox from "@/components/ui/lightbox";
import { getOptimizedImageUrl } from "@/lib/image-utils";

interface PublicRunViewProps {
    runId: string;
    slug: string;
    createdAt: string;
    flowName: string;
    userName: string;
    userId: string; // 新增：作者的 userId
}

interface RunItem {
    r2Key: string;
    createdAt: string;
    stepId: string;
    kind?: string;
}

export function PublicRunView({ runId, slug, createdAt, flowName, userName, userId }: PublicRunViewProps) {
    const [items, setItems] = useState<RunItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lbOpen, setLbOpen] = useState(false);
    const [lbKeys, setLbKeys] = useState<string[]>([]);
    const [lbIndex, setLbIndex] = useState(0);
    const [lbSrc, setLbSrc] = useState<string | null>(null);
    const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [checkingAuth, setCheckingAuth] = useState(true);

    useEffect(() => {
        loadItems();
        checkCurrentUser();
    }, [runId, slug]);

    const checkCurrentUser = async () => {
        try {
            const response = await fetch('/api/me', { cache: "no-store" });
            if (response.ok) {
                const data = await response.json();
                setCurrentUserId(data.user?.id || null);
            } else {
                setCurrentUserId(null);
            }
        } catch (error) {
            console.error("檢查使用者身份錯誤:", error);
            setCurrentUserId(null);
        } finally {
            setCheckingAuth(false);
        }
    };

    const isAuthor = currentUserId === userId;

    const loadItems = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/runs/public/${runId}/items`);
            if (!response.ok) {
                throw new Error("載入失敗");
            }
            const data = await response.json();
            const allItems = data.items || [];

            // 只保留第一個和最後一個步驟的圖片
            if (allItems.length > 0) {
                const firstItem = allItems[0];
                const lastItem = allItems[allItems.length - 1];

                // 如果只有一個步驟，就只顯示一張圖
                const filteredItems = allItems.length === 1 ? [firstItem] : [firstItem, lastItem];
                setItems(filteredItems);
            } else {
                setItems([]);
            }
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
                        <h1 className="text-2xl font-bold">{flowName}</h1>
                        {!checkingAuth && (
                            <Button
                                variant="outline"
                                disabled={!currentUserId && !isAuthor}
                                onClick={async () => {
                                    if (isAuthor) {
                                        // 作者本人 - 直接編輯
                                        window.location.href = `/flows/${encodeURIComponent(slug)}?runId=${encodeURIComponent(runId)}`;
                                        return;
                                    }

                                    if (!currentUserId) {
                                        // 未登入 - 引導到登入頁面
                                        window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
                                        return;
                                    }

                                    // 已登入非作者 - 建立副本
                                    try {
                                        const response = await fetch(`/api/runs/${runId}/fork`, {
                                            method: "POST",
                                            headers: {
                                                "Content-Type": "application/json"
                                            }
                                        });

                                        if (response.ok) {
                                            const data = await response.json();
                                            toast.success("已建立副本");
                                            // 導向新的 run
                                            window.location.href = `/flows/${encodeURIComponent(slug)}?runId=${encodeURIComponent(data.newRunId)}`;
                                        } else {
                                            const errorData = await response.json();
                                            toast.error(errorData.error || "建立副本失敗");
                                        }
                                    } catch (error) {
                                        console.error("建立副本錯誤:", error);
                                        toast.error("建立副本失敗");
                                    }
                                }}
                            >
                                {isAuthor ? (
                                    <>
                                        <Play className="h-4 w-4" />
                                        繼續編輯
                                    </>
                                ) : !currentUserId ? (
                                    <>
                                        <Lock className="h-4 w-4" />
                                        登入以建立副本
                                    </>
                                ) : (
                                    <>
                                        <Play className="h-4 w-4" />
                                        建立副本
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                    <p className="text-lg text-muted-foreground">by {userName}</p>
                </div>

                {items.length === 0 ? (
                    <div className="text-center text-muted-foreground">
                        此執行結果沒有圖片
                    </div>
                ) : (
                    <Card className="p-4">
                        <div className={`grid gap-4 ${items.length === 1 ? 'grid-cols-1 max-w-md mx-auto' : 'grid-cols-2'}`}>
                            {items.map((item, index) => (
                                <div key={item.r2Key} className="space-y-2">
                                    <div className="text-sm font-medium text-center">
                                        {items.length === 1 ? "執行結果" : (index === 0 ? "Before" : "After")}
                                    </div>
                                    <div
                                        className="group relative w-full overflow-hidden rounded-md border cursor-zoom-in"
                                        style={{ aspectRatio: "1 / 1" }}
                                        onClick={() => openLightbox(item.r2Key)}
                                    >
                                        <img
                                            src={getOptimizedImageUrl(item.r2Key, { width: 400, quality: 100 })}
                                            alt={items.length === 1 ? "執行結果" : (index === 0 ? "第一步驟結果" : "最後步驟結果")}
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
