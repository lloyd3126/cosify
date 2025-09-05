"use client";
import React from "react";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import Lightbox from "@/components/ui/lightbox";
import { Download, Play, ChevronsDownUp, ChevronsUpDown, Trash, Settings } from "lucide-react";
import { getOptimizedImageUrl } from "@/lib/image-utils";
import { ToggleRunPublicButton } from "@/components/toggle-run-public-button";
import { ShareRunIdButton } from "@/components/share-runid-button";
import { RunSettingsModal } from "@/components/ui/run-settings-modal";

export type RunImageGridItem = {
    r2Key: string;
    createdAt: string;
    stepId?: string;
};

export type RunImageGridRun = {
    runId: string;
    createdAt: string;
    itemsPreview: RunImageGridItem[];
    itemsTotal: number;
    allItems?: RunImageGridItem[];
};

export interface RunImageGridConfig {
    // 功能開關 (所有預設為 false，需要時明確啟用)
    showShare?: boolean;          // 預設: false - 顯示分享按鈕
    showDelete?: boolean;         // 預設: false - 顯示刪除功能
    showSettings?: boolean;       // 預設: false - 顯示設定選單
    showDownload?: boolean;       // 預設: false - 顯示下載按鈕
    showExpand?: boolean;         // 預設: false - 支援展開/收合
    showLightbox?: boolean;       // 預設: false - 支援 lightbox 預覽
    showPlay?: boolean;           // 預設: false - 顯示播放按鈕
    showTogglePublic?: boolean;   // 預設: false - 顯示公開/私密切換

    // 顯示配置
    maxPreviewItems?: number;     // 預設: 5 - 預覽時顯示的最大圖片數
    gridCols?: {                  // 預設: mobile:3, tablet:5, desktop:6
        mobile: number;
        tablet: number;
        desktop: number;
    };

    // 樣式配置
    cardClassName?: string;       // 預設: "" - 卡片額外 CSS 類名
    imageClassName?: string;      // 預設: "" - 圖片額外 CSS 類名
    showTimestamp?: boolean;      // 預設: false - 顯示時間戳

    // 回調函數
    onImageClick?: (runId: string, r2Key: string) => void;
    onToggleExpand?: (runId: string) => void;
    onPlay?: (runId: string) => void;
    onDelete?: (runId: string) => void;
}

export function RunImageGrid({
    runs,
    config = {},
    currentExpanded
}: {
    runs: RunImageGridRun[];
    config?: RunImageGridConfig;
    currentExpanded?: Record<string, boolean>;
}) {
    // 預設配置 - 所有功能預設為 false，需要時明確啟用
    const {
        showShare = false,
        showDelete = false,
        showSettings = false,
        showDownload = false,
        showExpand = false,
        showLightbox = false,
        showPlay = false,
        showTogglePublic = false,
        maxPreviewItems = 5,
        gridCols = {
            mobile: 3,
            tablet: 5,
            desktop: 6
        },
        cardClassName = "",
        imageClassName = "",
        showTimestamp = false,
        onImageClick,
        onToggleExpand,
        onPlay,
        onDelete
    } = config;

    const [cols, setCols] = useState(gridCols.mobile);
    const [lbOpen, setLbOpen] = useState(false);
    const [lbKeys, setLbKeys] = useState<string[]>([]);
    const [lbIndex, setLbIndex] = useState(0);
    const [lbSrc, setLbSrc] = useState<string | null>(null);
    const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
    const [newItemsLoading, setNewItemsLoading] = useState<Record<string, boolean>>({});
    const previewKeysRef = useRef<Set<string>>(new Set());

    // 內部狀態
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [deleted, setDeleted] = useState<Record<string, boolean>>({});
    const [settingsOpen, setSettingsOpen] = useState<Record<string, boolean>>({});

    // 使用外部狀態或內部狀態
    const currentExpandedState = currentExpanded || expanded;

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

    const isImageLoading = useCallback((r2Key: string) => {
        if (previewKeysRef.current.has(r2Key)) {
            return false;
        }
        return newItemsLoading[r2Key] === true;
    }, [newItemsLoading]);

    const blobUrlsRef = useRef<Record<string, string>>({});
    useEffect(() => { blobUrlsRef.current = blobUrls; }, [blobUrls]);
    useEffect(() => () => { Object.values(blobUrlsRef.current).forEach((u) => { try { URL.revokeObjectURL(u); } catch { } }); }, []);

    const handleImageLoad = useCallback((r2Key: string) => {
        if (!previewKeysRef.current.has(r2Key)) {
            setNewItemsLoading(prev => {
                const { [r2Key]: _, ...rest } = prev;
                return rest;
            });
        }
    }, []);

    const handleImageError = useCallback((r2Key: string) => {
        if (!previewKeysRef.current.has(r2Key)) {
            setNewItemsLoading(prev => {
                const { [r2Key]: _, ...rest } = prev;
                return rest;
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

    // 響應式網格設置
    useEffect(() => {
        if (typeof window === "undefined") return;
        const mMd = window.matchMedia("(min-width: 768px)");
        const mLg = window.matchMedia("(min-width: 1024px)");
        const update = () => setCols(mLg.matches ? gridCols.desktop : mMd.matches ? gridCols.tablet : gridCols.mobile);
        update();
        mMd.addEventListener?.("change", update);
        mLg.addEventListener?.("change", update);
        return () => {
            mMd.removeEventListener?.("change", update);
            mLg.removeEventListener?.("change", update);
        };
    }, [gridCols]);

    const gridColsClass = useMemo(() => {
        return `grid gap-2 grid-cols-${gridCols.mobile} md:grid-cols-${gridCols.tablet} lg:grid-cols-${gridCols.desktop}`;
    }, [gridCols]);

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

    const toggleExpand = onToggleExpand || ((runId: string) => {
        const isExpanding = !expanded[runId];
        setExpanded(e => ({ ...e, [runId]: !e[runId] }));

        if (isExpanding) {
            const run = runs.find(r => r.runId === runId);
            if (run?.allItems) {
                requestAnimationFrame(() => {
                    setNewItemsLoading(prev => {
                        const previewKeys = previewKeysRef.current;
                        const newLoadingState: Record<string, boolean> = {};
                        let hasNewImages = false;

                        run.allItems!.forEach(item => {
                            if (!previewKeys.has(item.r2Key)) {
                                newLoadingState[item.r2Key] = true;
                                hasNewImages = true;
                            }
                        });

                        if (hasNewImages) {
                            return { ...prev, ...newLoadingState };
                        }
                        return prev;
                    });
                });
            }
        }
    });

    const optimizedImageCache = useMemo(() => {
        const cache: Record<string, string> = {};
        runs.forEach(run => {
            run.itemsPreview.forEach(item => {
                if (!cache[item.r2Key]) {
                    cache[item.r2Key] = getOptimizedImageUrl(item.r2Key, { width: 200, quality: 100 });
                }
            });
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

    const renderActionButtons = (runId: string) => {
        const buttons = [];

        // 主要操作按鈕（移除分享按鈕，只保留在 modal 內）
        if (showSettings) {
            buttons.push(
                <Button
                    key="settings"
                    size="icon"
                    variant="outline"
                    onClick={() => setSettingsOpen(o => ({ ...o, [runId]: true }))}
                    aria-label="設定"
                >
                    <Settings className="h-4 w-4" />
                </Button>
            );
        }

        if (showExpand) {
            buttons.push(
                <Button
                    key="expand"
                    size="icon"
                    variant="outline"
                    onClick={() => toggleExpand(runId)}
                    aria-label={currentExpandedState[runId] ? "收合" : "展開"}
                >
                    {currentExpandedState[runId] ? (
                        <ChevronsDownUp className="h-4 w-4" />
                    ) : (
                        <ChevronsUpDown className="h-4 w-4" />
                    )}
                </Button>
            );
        }

        if (showPlay) {
            buttons.push(
                <Button
                    key="play"
                    size="icon"
                    variant="outline"
                    disabled={loading[runId]}
                    onClick={() => {
                        setLoading(l => ({ ...l, [runId]: true }));
                        onPlay?.(runId);
                    }}
                    aria-label="載入"
                >
                    <Play className="h-4 w-4" />
                </Button>
            );
        }

        return buttons;
    };

    const renderImages = (run: RunImageGridRun) => {
        // 如果展開且有完整資料，顯示所有圖片
        if (currentExpandedState[run.runId] && run.allItems) {
            return run.allItems.map((item) => renderImageItem(run.runId, item));
        }

        // 如果展開但還沒有完整資料，顯示 skeleton 佔位符
        if (currentExpandedState[run.runId] && !run.allItems) {
            const skeletonCount = run.itemsTotal || 12;
            return Array.from({ length: skeletonCount }, (_, i) => (
                <div
                    key={`skeleton-${run.runId}-${i}`}
                    className="relative w-full overflow-hidden rounded-md border"
                    style={{ aspectRatio: "1 / 1" }}
                >
                    <Skeleton className="h-full w-full" />
                </div>
            ));
        }

        // 預覽模式：顯示限定數量的圖片
        return run.itemsPreview.slice(0, showExpand ? cols : maxPreviewItems).map((item) =>
            renderImageItem(run.runId, item)
        );
    };

    const renderImageItem = (runId: string, item: RunImageGridItem) => {
        const imageUrl = optimizedImageCache[item.r2Key] || getOptimizedImageUrl(item.r2Key, { width: 200, quality: 100 });

        return (
            <div
                key={item.r2Key}
                className={`group relative w-full overflow-hidden rounded-md border cursor-zoom-in ${imageClassName}`}
                style={{ aspectRatio: "1 / 1" }}
                onClick={async () => {
                    if (onImageClick) {
                        onImageClick(runId, item.r2Key);
                        return;
                    }

                    if (showLightbox) {
                        try {
                            const url = await ensureBlobUrlForKey(item.r2Key);
                            setLbSrc(url);
                            const run = runs.find(r => r.runId === runId);
                            const allItemsForLightbox = run?.allItems || run?.itemsPreview || [];
                            setLbKeys(allItemsForLightbox.map((i) => i.r2Key));
                            setLbIndex(allItemsForLightbox.findIndex(i => i.r2Key === item.r2Key));
                            setLbOpen(true);
                        } catch (e) {
                            toast.error(e instanceof Error ? e.message : "下載失敗");
                        }
                    }
                }}
                role="button"
                aria-label="預覽"
            >
                {isImageLoading(item.r2Key) && (
                    <Skeleton className="absolute inset-0 rounded-md" />
                )}
                <img
                    src={imageUrl}
                    alt="thumb"
                    className={`w-full h-full object-cover transition-opacity duration-200 ${isImageLoading(item.r2Key) ? 'opacity-0' : 'opacity-100'
                        }`}
                    onLoad={() => handleImageLoad(item.r2Key)}
                    onError={() => handleImageError(item.r2Key)}
                />
                {showDownload && (
                    <div className="absolute inset-0 opacity-0 pointer-events-none transition-opacity bg-black/40 group-hover:opacity-100 group-hover:pointer-events-auto">
                        <div className="absolute inset-x-0 bottom-0 p-2 pointer-events-auto">
                            <div className="flex justify-end">
                                <Button
                                    size="sm"
                                    className="bg-black text-white hover:bg-black/90"
                                    onClick={(e) => { e.stopPropagation(); downloadByKey(item.r2Key); }}
                                    aria-label="下載"
                                >
                                    <Download className="h-4 w-4 text-white" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <Toaster richColors />
            {runs
                .filter(run => !deleted[run.runId])
                .map((run) => (
                    <Card key={run.runId} className={`p-4 space-y-3 rounded-md gap-3 ${cardClassName}`}>
                        <div className="flex items-center justify-between m-0">
                            {showTimestamp && (
                                <div className="text-sm text-black">
                                    {`${formatDateTime(run.createdAt)} - ${run.itemsTotal} 張`}
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                {renderActionButtons(run.runId)}
                            </div>
                        </div>
                        <div className={gridColsClass}>
                            {renderImages(run)}
                        </div>
                    </Card>
                ))}

            {/* Lightbox */}
            {showLightbox && !onImageClick && (
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

            {/* 設定 Modal */}
            {runs.map(run => (
                <RunSettingsModal
                    key={`settings-${run.runId}`}
                    open={settingsOpen[run.runId] || false}
                    onClose={() => setSettingsOpen(o => ({ ...o, [run.runId]: false }))}
                    title={`執行設定 - ${run.runId.slice(-8)}`}
                >
                    <div className="space-y-3">
                        {showShare && (
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <span className="text-sm font-medium">分享</span>
                                <ShareRunIdButton runId={run.runId} />
                            </div>
                        )}

                        {showTogglePublic && (
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <span className="text-sm font-medium">公開設定</span>
                                <ToggleRunPublicButton runId={run.runId} />
                            </div>
                        )}

                        {showDelete && (
                            <div className="flex items-center justify-between p-3 border rounded-lg border-red-200 bg-red-50">
                                <span className="text-sm font-medium text-red-700">刪除執行</span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-red-300 text-red-700 hover:bg-red-100"
                                    onClick={() => {
                                        setDeleted(d => ({ ...d, [run.runId]: true }));
                                        setSettingsOpen(o => ({ ...o, [run.runId]: false }));
                                        onDelete?.(run.runId);
                                    }}
                                >
                                    <Trash className="h-4 w-4 mr-1" />
                                    刪除
                                </Button>
                            </div>
                        )}
                    </div>
                </RunSettingsModal>
            ))}
        </div>
    );
}
