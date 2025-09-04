"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import { toast, Toaster } from "sonner";
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
    // 🔥 優化：使用三狀態系統 - undefined: 從未載入, true: 載入中, false: 已載入
    const initialImageLoadingState = useMemo(() => {
        const state: Record<string, boolean | undefined> = {};
        runs.forEach(run => {
            // 預設所有圖片為 undefined（從未載入狀態）
            run.itemsPreview.forEach(item => {
                state[item.r2Key] = undefined;
            });
            // 如果有 allItems（如 Introduction 頁面），也設為 undefined
            if (run.allItems) {
                run.allItems.forEach(item => {
                    state[item.r2Key] = undefined;
                });
            }
        });
        return state;
    }, [runs]);

    const [imageLoading, setImageLoading] = useState<Record<string, boolean | undefined>>(initialImageLoadingState);

    // 當 runs 數據變化時，更新圖片載入狀態（但不覆蓋已存在的狀態）
    useEffect(() => {
        setImageLoading(prev => {
            // 只為新的圖片鍵設置 undefined，保留已存在的狀態
            const newState = { ...prev };
            Object.keys(initialImageLoadingState).forEach(key => {
                if (!(key in prev)) {
                    newState[key] = initialImageLoadingState[key];
                }
            });
            return newState;
        });
    }, [initialImageLoadingState]);
    const blobUrlsRef = useRef<Record<string, string>>({});
    useEffect(() => { blobUrlsRef.current = blobUrls; }, [blobUrls]);
    useEffect(() => () => { Object.values(blobUrlsRef.current).forEach((u) => { try { URL.revokeObjectURL(u); } catch { } }); }, []);

    // 優化的圖片載入完成處理
    const handleImageLoad = useCallback((r2Key: string) => {
        setImageLoading(prev => {
            // 總是將載入完成的圖片標記為 false（已載入）
            return { ...prev, [r2Key]: false };
        });
        console.log('✅ 優化圖片載入完成:', {
            r2Key: r2Key.substring(0, 20) + '...'
        });
    }, []);

    const handleImageError = useCallback((r2Key: string) => {
        setImageLoading(prev => {
            // 載入失敗的圖片也標記為 false，避免持續顯示 Skeleton
            return { ...prev, [r2Key]: false };
        });
        console.log('❌ 優化圖片載入失敗:', r2Key.substring(0, 20) + '...');
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
                    cache[item.r2Key] = getOptimizedImageUrl(item.r2Key, { width: 200, quality: 80 });
                }
            });
            // 快取所有圖片的優化 URL（如果已載入）
            if (run.allItems) {
                run.allItems.forEach(item => {
                    if (!cache[item.r2Key]) {
                        cache[item.r2Key] = getOptimizedImageUrl(item.r2Key, { width: 200, quality: 80 });
                    }
                });
            }
        });
        console.log('🎯 優化圖片 URL 快取更新:', {
            totalCachedUrls: Object.keys(cache).length,
            runsCount: runs.length
        });
        return cache;
    }, [runs]);

    // TODO: 移除這個會導致重複載入圖片的 useEffect
    // 原本用於檢查預覽圖片的載入狀態，但會造成不必要的圖片重複載入
    // 改為依賴 Next.js Image 組件的內建載入機制
    /*
    useEffect(() => {
        const preloadAndMarkPreviewImages = () => {
            runs.forEach(run => {
                run.itemsPreview.forEach(item => {
                    // 為預覽圖片建立 Image 對象來檢查是否已快取
                    const img = document.createElement('img');
                    const url = optimizedImageCache[item.r2Key] || getOptimizedImageUrl(item.r2Key, { width: 200, quality: 80 });

                    img.onload = () => {
                        // 圖片載入成功，標記為已載入
                        setImageLoading(prev => ({
                            ...prev,
                            [item.r2Key]: false
                        }));
                    };

                    img.onerror = () => {
                        // 即使載入失敗，也標記為已載入以避免 Skeleton
                        setImageLoading(prev => ({
                            ...prev,
                            [item.r2Key]: false
                        }));
                    };

                    // 如果圖片已在快取中，onload 會立即觸發
                    img.src = url;
                });
            });
        };

        // 延遲執行，避免阻塞初始渲染
        const timer = setTimeout(preloadAndMarkPreviewImages, 100);
        return () => clearTimeout(timer);
    }, [runs, optimizedImageCache]);
    */

    // 監聽 runs 和 currentExpanded 變化，確保預覽圖片不顯示 Skeleton
    useEffect(() => {
        const updates: Record<string, boolean | undefined> = {};

        runs.forEach(run => {
            if (currentExpanded?.[run.runId]) {
                // 當展開狀態時，立即檢查預覽圖片
                const previewKeys = new Set(run.itemsPreview.map(item => item.r2Key));

                console.log('🔄 檢測到展開狀態變化:', {
                    runId: run.runId.substring(0, 8),
                    isExpanded: !!currentExpanded[run.runId],
                    hasAllItems: !!run.allItems,
                    previewCount: run.itemsPreview.length,
                    allItemsCount: run.allItems?.length || 0
                });

                // 無論是否有 allItems，先標記所有預覽圖片為已載入
                run.itemsPreview.forEach(item => {
                    updates[item.r2Key] = false;
                    console.log('🎯 立即標記預覽圖片為已載入:', item.r2Key.substring(0, 20) + '...');
                });

                // 如果有 allItems，也處理其中的預覽圖片
                if (run.allItems) {
                    run.allItems.forEach(item => {
                        if (previewKeys.has(item.r2Key)) {
                            updates[item.r2Key] = false;
                            console.log('🎯 從 allItems 標記預覽圖片為已載入:', item.r2Key.substring(0, 20) + '...');
                        }
                    });
                }
            }
        });

        if (Object.keys(updates).length > 0) {
            console.log('📝 更新圖片載入狀態:', Object.keys(updates).length);
            setImageLoading(prev => ({ ...prev, ...updates }));
        }
    }, [runs, currentExpanded]); // 移除 imageLoading 依賴避免無限循環

    const toggleExpand = onToggleExpand || ((runId: string) => {
        const isExpanding = !expanded[runId];
        console.log('🔄 toggleExpand 被觸發:', {
            runId: runId.substring(0, 8),
            isExpanding,
            currentState: expanded[runId]
        });

        setExpanded(e => ({ ...e, [runId]: !e[runId] }));

        // 🔥 修正：當展開時，使用快取的優化 URL 進行預載
        if (isExpanding) {
            const run = runs.find(r => r.runId === runId);
            console.log('📂 展開處理:', {
                runId: runId.substring(0, 8),
                hasAllItems: !!run?.allItems,
                allItemsCount: run?.allItems?.length
            });

            if (run?.allItems) {
                // 只為新圖片（不在預覽中的）設定 loading 狀態
                const previewKeys = new Set(run.itemsPreview.map(item => item.r2Key));
                const newLoadingState: Record<string, boolean | undefined> = {};
                let hasNewImages = false;

                run.allItems.forEach(item => {
                    // 只有不在預覽中的圖片才設定為載入中
                    if (!previewKeys.has(item.r2Key)) {
                        newLoadingState[item.r2Key] = true;
                        hasNewImages = true;
                    } else {
                        // 確保預覽圖片被明確標記為已載入狀態
                        newLoadingState[item.r2Key] = false;
                    }
                });

                // 只有當確實有變更時才更新狀態
                if (hasNewImages || Object.keys(newLoadingState).length > 0) {
                    setImageLoading(prev => ({ ...prev, ...newLoadingState }));
                }

                // 移除背景預載邏輯 - 讓圖片在需要時才載入
                // 這避免了在開發環境中載入原始大小圖片的問題
                /*
                // 🔥 修正：使用新的預載函數直接處理優化 URL
                const r2Keys = run.allItems.map(item => item.r2Key);

                console.log('🚀 開始預載優化圖片:', {
                    runId: runId.substring(0, 8),
                    keyCount: r2Keys.length,
                    sampleKeys: r2Keys.slice(0, 2).map(k => k.substring(0, 30) + '...')
                });

                preloadOptimizedImages(r2Keys, { width: 200, quality: 80 }).catch((error) => {
                    console.log('優化圖片預載失敗，但不影響正常顯示:', error);
                });
                */
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
                                        {imageLoading[it.r2Key] === true && (
                                            <Skeleton className="absolute inset-0 rounded-md" />
                                        )}
                                        <Image
                                            src={optimizedImageCache[it.r2Key] || getOptimizedImageUrl(it.r2Key, { width: 200, quality: 80 })}
                                            alt="thumb"
                                            fill
                                            sizes="200px"
                                            className={`object-cover transition-opacity duration-200 ${imageLoading[it.r2Key] === true ? 'opacity-0' : 'opacity-100'
                                                }`}
                                            onLoadingComplete={() => handleImageLoad(it.r2Key)}
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
                            return r.itemsPreview.slice(0, cols).map((it, i) => (
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
                                    {imageLoading[it.r2Key] === true && (
                                        <Skeleton className="absolute inset-0 rounded-md" />
                                    )}
                                    <Image
                                        src={optimizedImageCache[it.r2Key] || getOptimizedImageUrl(it.r2Key, { width: 200, quality: 80 })}
                                        alt="thumb"
                                        fill
                                        sizes="200px"
                                        className={`object-cover transition-opacity duration-200 ${imageLoading[it.r2Key] === true ? 'opacity-0' : 'opacity-100'
                                            }`}
                                        onLoadingComplete={() => handleImageLoad(it.r2Key)}
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
