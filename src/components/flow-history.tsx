"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RunImageGrid, type RunImageGridRun, type RunImageGridConfig } from "@/components/run-image-grid";
import Image from "next/image";
import { toast, Toaster } from "sonner";
import Lightbox from "@/components/ui/lightbox";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { Download, ArrowLeftFromLine, ChevronsUpDown, ChevronsDownUp, Trash, ArchiveRestore, FilePlus2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getOptimizedImageUrl } from "@/lib/image-utils";

type Props = { slug: string; flowName: string; currentRunId?: string | null; fromSource?: string | null };

type RunPreview = {
    runId: string;
    createdAt: string;
    itemsPreview: Array<{ r2Key: string; createdAt: string }>;
    allItems?: Array<{ r2Key: string; createdAt: string }>; // 新增：所有項目
    itemsTotal: number
};

export default function FlowHistory({ slug, flowName, currentRunId, fromSource }: Props) {
    const router = useRouter();
    const PAGE_SIZE = 5;
    const [runs, setRuns] = useState<RunPreview[]>([]);
    const [loading, setLoading] = useState(false);
    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState<boolean>(true);
    // items 快取（runId -> items）；不等同於 UI 是否展開
    const [expanded, setExpanded] = useState<Record<string, Array<{ r2Key: string; createdAt: string; kind?: string }>>>({});
    // UI 展開狀態（runId 集合）
    const [expandedUI, setExpandedUI] = useState<Set<string>>(new Set());
    const [expanding, setExpanding] = useState<Set<string>>(new Set());
    const [cols, setCols] = useState(3); // xs 預設 3 欄
    // Lightbox 狀態（同一個 run 左右切換）
    const [lbOpen, setLbOpen] = useState(false);
    const [lbKeys, setLbKeys] = useState<string[]>([]);
    const [lbIndex, setLbIndex] = useState(0);
    const [lbSrc, setLbSrc] = useState<string | null>(null); // 使用本地 blob URL，避免重複下載
    // 刪除確認對話框
    const [confirmDelete, setConfirmDelete] = useState<{ runId: string | null }>({ runId: null });

    // 簡單的 blob URL 快取：r2Key -> objectURL；並去重並行請求
    const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
    const blobUrlsRef = useRef<Record<string, string>>({});
    const inFlight = useRef<Map<string, Promise<string>>>(new Map());
    useEffect(() => { blobUrlsRef.current = blobUrls; }, [blobUrls]);
    // 卸載時釋放所有 object URL
    useEffect(() => () => { Object.values(blobUrlsRef.current).forEach((u) => { try { URL.revokeObjectURL(u); } catch { } }); }, []);

    async function ensureBlobUrlForKey(key: string): Promise<string> {
        const cached = blobUrlsRef.current[key];
        if (cached) return cached;
        const existing = inFlight.current.get(key);
        if (existing) return existing;
        const p = (async () => {
            const res = await fetch(`/api/r2/${key}`, { cache: "no-store" });
            if (!res.ok) throw new Error("下載失敗");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setBlobUrls((prev) => ({ ...prev, [key]: url }));
            return url;
        })().finally(() => { inFlight.current.delete(key); });
        inFlight.current.set(key, p);
        return p;
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

    // 依 Tailwind 斷點偵測（md ~768px=5 欄，lg ~1024px=6 欄）
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

    async function load(reset = false) {
        setLoading(true);
        try {
            const qs = new URLSearchParams();
            if (!reset && cursor) qs.set("cursor", cursor);
            qs.set("limit", String(PAGE_SIZE));
            const res = await fetch(`/api/flows/${slug}/history${qs.size ? `?${qs.toString()}` : ""}`, { cache: "no-store" });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "讀取歷史失敗");
            const page: RunPreview[] = data.runs || [];
            setRuns((prev) => reset ? page : [...prev, ...page]);
            setCursor(data.nextCursor || null);
            setHasMore(!!data.nextCursor);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "讀取歷史失敗");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        // 初次載入
        setRuns([]); setCursor(null); setHasMore(true);
        load(true); // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug]);

    async function remove(runId: string) {
        try {
            const res = await fetch(`/api/flows/${slug}/history/${runId}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "刪除失敗");
            toast.success("已刪除");
            // 就地刪除，保留已載入的其他 run 與游標/hasMore 狀態
            setRuns((prev) => prev.filter((r) => r.runId !== runId));
            setExpanded((m) => { const n = { ...m }; delete n[runId]; return n; });
            setExpandedUI((prev) => { const n = new Set(prev); n.delete(runId); return n; });
            setExpanding((prev) => { const n = new Set(prev); n.delete(runId); return n; });
            setConfirmDelete({ runId: null });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "刪除失敗");
        }
    }

    async function toggleExpand(runId: string) {
        // 若目前是展開 -> 收合
        if (expandedUI.has(runId)) {
            setExpandedUI((prev) => { const n = new Set(prev); n.delete(runId); return n; });
            return;
        }

        // 立即展開 UI，不管是否有快取
        setExpandedUI((prev) => new Set(prev).add(runId));

        // 若有快取直接使用
        if (expanded[runId]) {
            return;
        }

        // 沒有快取時，背景載入資料
        setExpanding((prev) => new Set(prev).add(runId));
        try {
            const res = await fetch(`/api/flows/${slug}/history/${runId}/items`, { cache: "no-store" });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "讀取失敗");
            const items = (data.items || []) as Array<{ r2Key: string; createdAt: string; kind?: string }>;
            setExpanded((m) => ({ ...m, [runId]: items }));

        } catch (e) {
            toast.error(e instanceof Error ? e.message : "讀取失敗");
            // 載入失敗時收合 UI
            setExpandedUI((prev) => { const n = new Set(prev); n.delete(runId); return n; });
        } finally {
            setExpanding((prev) => { const n = new Set(prev); n.delete(runId); return n; });
        }
    }

    async function openRunLightbox(runId: string, r2Key: string) {
        // 1) 先顯示點擊的圖片（本地快取 blob URL）
        try {
            const url = await ensureBlobUrlForKey(r2Key);
            setLbSrc(url);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "下載失敗");
            return;
        }

        // 2) 找到對應的 run 和目前顯示的預覽圖片
        const run = runs.find(r => r.runId === runId);
        if (!run) return;

        // 使用目前頁面顯示的預覽圖片作為燈箱切換範圍
        const currentDisplayItems = expandedUI.has(runId) && expanded[runId]
            ? expanded[runId] // 如果已展開，使用完整清單
            : run.itemsPreview; // 否則使用預覽清單

        const keys = currentDisplayItems.map((it) => it.r2Key);
        const idx = Math.max(0, keys.indexOf(r2Key));

        setLbKeys(keys);
        setLbIndex(idx);
        setLbOpen(true);

        // 預載相鄰圖片
        const left = idx - 1 >= 0 ? keys[idx - 1] : null;
        const right = idx + 1 < keys.length ? keys[idx + 1] : null;
        if (left) void ensureBlobUrlForKey(left).catch(() => { });
        if (right) void ensureBlobUrlForKey(right).catch(() => { });
    }

    // 當燈箱索引變更時，預載相鄰圖片
    useEffect(() => {
        if (!lbOpen || !lbKeys.length) return;
        const left = lbIndex - 1 >= 0 ? lbKeys[lbIndex - 1] : null;
        const right = lbIndex + 1 < lbKeys.length ? lbKeys[lbIndex + 1] : null;
        if (left) void ensureBlobUrlForKey(left).catch(() => { });
        if (right) void ensureBlobUrlForKey(right).catch(() => { });
    }, [lbOpen, lbIndex, lbKeys]);

    return (
        <>
            <div className="mx-auto w-full max-w-6xl p-6 pb-12">
                <Toaster richColors />
                <div className="flex items-center justify-between mb-6">
                    <Link
                        href={
                            currentRunId
                                ? `/flows/${encodeURIComponent(slug)}?runId=${encodeURIComponent(currentRunId)}`
                                : fromSource === 'introduction'
                                    ? `/flows/${encodeURIComponent(slug)}/introduction`
                                    : `/flows/${encodeURIComponent(slug)}/new`
                        }
                        className="inline-flex items-center rounded-md border p-2 hover:bg-muted"
                        aria-label="返回"
                    >
                        <ArrowLeftFromLine className="h-5 w-5" />
                    </Link>
                    <div className="flex-1" />
                    <Link
                        href={`/flows/${encodeURIComponent(slug)}/new`}
                        className="inline-flex items-center rounded-md border p-2 hover:bg-muted"
                        aria-label="開起新的任務"
                        title="開起新的任務"
                    >
                        <FilePlus2 className="h-5 w-5" />
                    </Link>
                </div>
                {loading ? <div className="text-sm text-muted-foreground">載入中…</div> : null}
                <RunImageGrid
                    runs={runs.map(run => ({
                        runId: run.runId,
                        createdAt: run.createdAt,
                        itemsPreview: run.itemsPreview,
                        itemsTotal: run.itemsTotal,
                        allItems: expanded[run.runId] || undefined
                    })) as RunImageGridRun[]}
                    slug={slug}
                    config={{
                        showShare: true,
                        showTogglePublic: true,
                        showDelete: true,
                        showSettings: true,
                        showDownload: true,
                        showExpand: false, // 移除展開功能
                        showLightbox: false, // 使用自訂 lightbox
                        showPlay: true,
                        showTimestamp: true,
                        maxPreviewItems: 20, // 🔑 新增：顯示更多項目（每步驟一張圖）
                        gridCols: {
                            mobile: 3,
                            tablet: 5,
                            desktop: 6
                        },
                        onToggleExpand: toggleExpand,
                        onImageClick: openRunLightbox,
                        onDelete: (runId) => setConfirmDelete({ runId })
                    }}
                    currentExpanded={Object.fromEntries(Array.from(expandedUI).map(runId => [runId, true]))}
                />
                {runs.length === 0 && !loading ? <div className="text-sm text-muted-foreground">尚無紀錄</div> : null}
                {hasMore ? (
                    <div className="pt-2">
                        <Button className="w-full" disabled={loading} onClick={() => load(false)}>載入更多</Button>
                    </div>
                ) : null}
            </div>
            {/* Lightbox */}
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
            {/* 刪除確認對話框 */}
            <ConfirmDialog
                open={!!confirmDelete.runId}
                title="刪除這次執行？"
                description="此動作無法復原，將刪除這次執行的所有產物。"
                confirmText="刪除"
                cancelText="取消"
                onCancel={() => setConfirmDelete({ runId: null })}
                onConfirm={() => { const id = confirmDelete.runId; if (id) void remove(id); }}
            />
        </>
    );
}
