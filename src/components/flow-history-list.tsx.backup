"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import Lightbox from "@/components/ui/lightbox";
import { Download, Play, ChevronsDownUp, ChevronsUpDown, Eye, EyeOff, Trash, Link2, Settings } from "lucide-react";
import { getOptimizedImageUrl, getResponsiveImageUrls, preloadOptimizedImages } from "@/lib/image-utils";

export type FlowHistoryListRun = {
    runId: string;
    createdAt: string;
    itemsPreview: Array<{ r2Key: string; createdAt: string }>;
    itemsTotal: number;
    allItems?: Array<{ r2Key: string; createdAt: string }>;
};

export function FlowHistoryList({
    runs,
    showDelete = true,
    onToggleExpand,
    currentExpanded,
    onImageClick
}: {
    runs: FlowHistoryListRun[],
    showDelete?: boolean,
    onToggleExpand?: (runId: string) => void,
    currentExpanded?: Record<string, boolean>,
    onImageClick?: (runId: string, r2Key: string) => void
}) {
    const [cols, setCols] = useState(3);
    const [lbOpen, setLbOpen] = useState(false);
    const [lbKeys, setLbKeys] = useState<string[]>([]);
    const [lbIndex, setLbIndex] = useState(0);
    const [lbSrc, setLbSrc] = useState<string | null>(null);
    const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
    // 🔥 完全分離預覽圖片和新圖片的載入狀態管理
    // 預覽圖片永遠不應該顯示 Skeleton，因為它們在初始載入時就應該可見
    const [newItemsLoading, setNewItemsLoading] = useState<Record<string, boolean>>({});
    const previewKeysRef = useRef<Set<string>>(new Set());

    // 更新預覽圖片的 keys 引用
    useEffect(() => {
        const newPreviewKeys = new Set<string>();
        runs.forEach(run => {
            run.itemsPreview.forEach(item => {
                newPreviewKeys.add(item.r2Key);
            });
        });
        previewKeysRef.current = newPreviewKeys;
    }, [runs]);

    // 🔥 移除複雜的 imageLoading 狀態管理，改用簡單的判斷邏輯
    const isImageLoading = useCallback((r2Key: string) => {
        // 預覽圖片永遠不顯示 loading
        if (previewKeysRef.current.has(r2Key)) {
            return false;
        }
        // 只有新圖片才可能顯示 loading
        return newItemsLoading[r2Key] === true;
    }, [newItemsLoading]);

    const blobUrlsRef = useRef<Record<string, string>>({});
    useEffect(() => { blobUrlsRef.current = blobUrls; }, [blobUrls]);
    useEffect(() => () => { Object.values(blobUrlsRef.current).forEach((u) => { try { URL.revokeObjectURL(u); } catch { } }); }, []);

    // 優化的圖片載入完成處理
    const handleImageLoad = useCallback((r2Key: string) => {
        // 只處理新圖片的載入完成事件
        if (!previewKeysRef.current.has(r2Key)) {
            setNewItemsLoading(prev => {
                const { [r2Key]: _, ...rest } = prev;
                return rest; // 移除載入中狀態
            });
        }
    }, []);

    const handleImageError = useCallback((r2Key: string) => {
        // 只處理新圖片的載入錯誤事件
        if (!previewKeysRef.current.has(r2Key)) {
            setNewItemsLoading(prev => {
                const { [r2Key]: _, ...rest } = prev;
                return rest; // 移除載入中狀態
            });
        }
    }, []);

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

    // 展開/收合/載入/刪除/顯示狀態/設定展開按鈕
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    // 使用外部狀態或內部狀態
    const currentExpandedState = currentExpanded || expanded;

    // 🔥 修正：使用 useMemo 快取優化 URL，避免重複計算
    const optimizedImageCache = useMemo(() => {
        const cache: Record<string, string> = {};
        runs.forEach(run => {
            // 快取預覽圖片的優化 URL
            run.itemsPreview.forEach(item => {
                if (!cache[item.r2Key]) {
                    cache[item.r2Key] = getOptimizedImageUrl(item.r2Key, { width: 200, quality: 100 });
                }
            });
            // 快取所有圖片的優化 URL（如果已載入）
            if (run.allItems) {
                run.allItems.forEach(item => {
                    if (!cache[item.r2Key]) {
                        cache[item.r2Key] = getOptimizedImageUrl(item.r2Key, { width: 200, quality: 100 });
                    }
                });
            }
        });
        return cache;
    }, [runs]);

    const toggleExpand = onToggleExpand || ((runId: string) => {
        const isExpanding = !expanded[runId];

        // 🔥 關鍵修正：先更新展開狀態，但不立即修改圖片載入狀態
        setExpanded(e => ({ ...e, [runId]: !e[runId] }));

        // 🔥 修正：當展開時，使用延遲來避免狀態競爭
        if (isExpanding) {
            const run = runs.find(r => r.runId === runId);

            if (run?.allItems) {
                // 使用 requestAnimationFrame 確保在下一個渲染週期才更新載入狀態
                requestAnimationFrame(() => {
                    setNewItemsLoading(prev => {
                        const previewKeys = previewKeysRef.current;
                        const newLoadingState: Record<string, boolean> = {};
                        let hasNewImages = false;

                        run.allItems!.forEach(item => {
                            // 🔥 關鍵：只為真正的新圖片（非預覽圖片）設定載入狀態
                            if (!previewKeys.has(item.r2Key)) {
                                newLoadingState[item.r2Key] = true;
                                hasNewImages = true;
                            }
                        });

                        // 只有當確實有新圖片時才更新狀態
                        if (hasNewImages) {
                            return { ...prev, ...newLoadingState };
                        }
                        return prev; // 沒有變化時返回原狀態
                    });
                });
            }
        }
    });
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [deleted, setDeleted] = useState<Record<string, boolean>>({});
    const [visible, setVisible] = useState<Record<string, boolean>>({});
    const [settingsOpen, setSettingsOpen] = useState<Record<string, boolean>>({});

    return (
        <div className="space-y-4">
            <Toaster richColors />
            {runs.map((r) => (
                <Card key={r.runId} className="p-4 space-y-3 rounded-md gap-3">
                    <div className="flex items-center justify-between m-0">
                        <div className="text-sm text-black">{`${formatDateTime(r.createdAt)} - ${r.itemsTotal} 張`}</div>
                        <div className="flex items-center gap-2">
                            {/* 只有 showDelete=true 才顯示 Settings 與展開內容 */}
                            {showDelete && (
                                <>
                                    {settingsOpen[r.runId] && (
                                        <>
                                            {!visible[r.runId] && (
                                                <Button
                                                    size="icon"
                                                    variant="outline"
                                                    aria-label="連結"
                                                >
                                                    <Link2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button
                                                size="icon"
                                                variant="outline"
                                                onClick={() => setVisible(v => ({ ...v, [r.runId]: !v[r.runId] }))}
                                                aria-label={visible[r.runId] ? "隱藏" : "顯示"}
                                            >
                                                {visible[r.runId] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="outline"
                                                className="bg-white text-black border hover:bg-white/90"
                                                onClick={() => setDeleted(d => ({ ...d, [r.runId]: true }))}
                                                aria-label="刪除"
                                            >
                                                <Trash className="h-4 w-4 text-black" />
                                            </Button>
                                        </>
                                    )}
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        aria-label="設定"
                                        onClick={() => setSettingsOpen(o => ({ ...o, [r.runId]: !o[r.runId] }))}
                                        className={settingsOpen[r.runId] ? "bg-muted text-black border" : ""}
                                    >
                                        <Settings className="h-4 w-4" />
                                    </Button>
                                </>
                            )}
                            {/* 展開/收合按鈕（icon） */}
                            <Button
                                size="icon"
                                variant="outline"
                                onClick={() => toggleExpand(r.runId)}
                                aria-label={currentExpandedState[r.runId] ? "收合" : "展開"}
                            >
                                {currentExpandedState[r.runId] ? (
                                    <ChevronsDownUp className="h-4 w-4" />
                                ) : (
                                    <ChevronsUpDown className="h-4 w-4" />
                                )}
                            </Button>
                            {/* 載入按鈕（Play icon） */}
                            <Button
                                size="icon"
                                variant="outline"
                                disabled={loading[r.runId]}
                                onClick={() => setLoading(l => ({ ...l, [r.runId]: true }))}
                                aria-label="載入"
                            >
                                <Play className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <div className={gridColsClass}>
                        {(() => {
                            // 如果展開且有完整資料，顯示所有圖片
                            if (currentExpandedState[r.runId] && r.allItems) {
                                return r.allItems.map((it, i) => (
                                    <div
                                        key={it.r2Key} // 使用 r2Key 作為穩定的 key
                                        className="group relative w-full overflow-hidden rounded-md border cursor-zoom-in"
                                        style={{ aspectRatio: "1 / 1" }}
                                        onClick={async () => {
                                            if (onImageClick) {
                                                onImageClick(r.runId, it.r2Key);
                                                return;
                                            }
                                            // 使用內建的 lightbox 邏輯
                                            try {
                                                const url = await ensureBlobUrlForKey(it.r2Key);
                                                setLbSrc(url);
                                                const allItemsForLightbox = r.allItems || r.itemsPreview;
                                                setLbKeys(allItemsForLightbox.map((item) => item.r2Key));
                                                setLbIndex(allItemsForLightbox.findIndex(item => item.r2Key === it.r2Key));
                                                setLbOpen(true);
                                            } catch (e) {
                                                toast.error(e instanceof Error ? e.message : "下載失敗");
                                            }
                                        }}
                                        role="button"
                                        aria-label="預覽"
                                    >
                                        {/* Skeleton 載入佔位符 - 只在明確載入中時顯示 */}
                                        {isImageLoading(it.r2Key) && (
                                            <Skeleton className="absolute inset-0 rounded-md" />
                                        )}
                                        <img
                                            src={optimizedImageCache[it.r2Key] || getOptimizedImageUrl(it.r2Key, { width: 200, quality: 100 })}
                                            alt="thumb"
                                            className={`w-full h-full object-cover transition-opacity duration-200 ${isImageLoading(it.r2Key) ? 'opacity-0' : 'opacity-100'
                                                }`}
                                            onLoad={() => handleImageLoad(it.r2Key)}
                                            onError={() => handleImageError(it.r2Key)}
                                        />
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
                                ));
                            }

                            // 如果展開但還沒有完整資料，顯示 skeleton 佔位符
                            if (currentExpandedState[r.runId] && !r.allItems) {
                                const skeletonCount = r.itemsTotal || 12; // 如果沒有 itemsTotal，預設 12 個
                                return Array.from({ length: skeletonCount }, (_, i) => (
                                    <div
                                        key={`skeleton-${r.runId}-${i}`}
                                        className="relative w-full overflow-hidden rounded-md border"
                                        style={{ aspectRatio: "1 / 1" }}
                                    >
                                        <Skeleton className="h-full w-full" />
                                    </div>
                                ));
                            }

                            // 預覽模式：顯示前幾張圖片
                            return r.itemsPreview.slice(0, cols).map((it, i) => {
                                const imageUrl = optimizedImageCache[it.r2Key] || getOptimizedImageUrl(it.r2Key, { width: 200, quality: 100 });

                                return (
                                    <div
                                        key={it.r2Key} // 使用 r2Key 作為穩定的 key
                                        className="group relative w-full overflow-hidden rounded-md border cursor-zoom-in"
                                        style={{ aspectRatio: "1 / 1" }}
                                        onClick={async () => {
                                            if (onImageClick) {
                                                onImageClick(r.runId, it.r2Key);
                                                return;
                                            }
                                            // 使用內建的 lightbox 邏輯
                                            try {
                                                const url = await ensureBlobUrlForKey(it.r2Key);
                                                setLbSrc(url);
                                                const allItemsForLightbox = r.allItems || r.itemsPreview;
                                                setLbKeys(allItemsForLightbox.map((item) => item.r2Key));
                                                setLbIndex(allItemsForLightbox.findIndex(item => item.r2Key === it.r2Key));
                                                setLbOpen(true);
                                            } catch (e) {
                                                toast.error(e instanceof Error ? e.message : "下載失敗");
                                            }
                                        }}
                                        role="button"
                                        aria-label="預覽"
                                    >
                                        {/* Skeleton 載入佔位符 - 只在明確載入中時顯示 */}
                                        {isImageLoading(it.r2Key) && (
                                            <Skeleton className="absolute inset-0 rounded-md" />
                                        )}
                                        <img
                                            src={imageUrl}
                                            alt="thumb"
                                            className={`w-full h-full object-cover transition-opacity duration-200 ${isImageLoading(it.r2Key) ? 'opacity-0' : 'opacity-100'
                                                }`}
                                            onLoad={() => handleImageLoad(it.r2Key)}
                                            onError={() => handleImageError(it.r2Key)}
                                        />
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
                                );
                            });
                        })()}
                    </div>
                </Card>
            ))}
            {/* 只有在沒有外部 lightbox 處理時才顯示內建 lightbox */}
            {!onImageClick && (
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
            )}
        </div>
    );
}
