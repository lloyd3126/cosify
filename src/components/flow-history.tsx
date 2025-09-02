"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { toast, Toaster } from "sonner";
import Lightbox from "@/components/ui/lightbox";
import { Download } from "lucide-react";

type Props = { slug: string; flowName: string };

type RunPreview = { runId: string; createdAt: string; itemsPreview: Array<{ r2Key: string; createdAt: string }>; itemsTotal: number };

export default function FlowHistory({ slug, flowName }: Props) {
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
        if (!confirm("確定刪除這次執行的所有產物？此動作無法復原。")) return;
        try {
            const res = await fetch(`/api/flows/${slug}/history/${runId}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "刪除失敗");
            toast.success("已刪除");
            // 刪除後重新從頭載入目前已載入的頁數量較麻煩，先簡化為重置並重新載入第一頁
            setRuns([]); setCursor(null); setHasMore(true);
            await load(true);
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
        // 展開：若有快取直接展開；否則先載入後展開
        if (expanded[runId]) {
            setExpandedUI((prev) => new Set(prev).add(runId));
            return;
        }
        setExpanding((prev) => new Set(prev).add(runId));
        try {
            const res = await fetch(`/api/flows/${slug}/history/${runId}/items`, { cache: "no-store" });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "讀取失敗");
            setExpanded((m) => ({ ...m, [runId]: (data.items || []) as Array<{ r2Key: string; createdAt: string; kind?: string }> }));
            setExpandedUI((prev) => new Set(prev).add(runId));
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "讀取失敗");
        } finally {
            setExpanding((prev) => { const n = new Set(prev); n.delete(runId); return n; });
        }
    }

    async function openRunLightbox(runId: string, r2Key: string) {
        // 1) 先顯示點擊的圖片（本地快取 blob URL），再處理清單載入
        try {
            const url = await ensureBlobUrlForKey(r2Key);
            setLbSrc(url);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "下載失敗");
            return;
        }

        const items = expanded[runId];
        if (items && items.length) {
            // 已有完整清單：直接更新 keys/index 並開啟
            const keys = items.map((it) => it.r2Key);
            const idx = Math.max(0, keys.indexOf(r2Key));
            setLbKeys(keys);
            setLbIndex(idx);
            setLbOpen(true);
            // 預載相鄰
            const left = idx - 1 >= 0 ? keys[idx - 1] : null;
            const right = idx + 1 < keys.length ? keys[idx + 1] : null;
            if (left) void ensureBlobUrlForKey(left).catch(() => { });
            if (right) void ensureBlobUrlForKey(right).catch(() => { });
            return;
        }

        // 尚未有完整清單：先用單一 key 開啟，背景抓清單
        setLbKeys([r2Key]);
        setLbIndex(0);
        setLbOpen(true);
        setExpanding((prev) => new Set(prev).add(runId));
        (async () => {
            try {
                const res = await fetch(`/api/flows/${slug}/history/${runId}/items`, { cache: "no-store" });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "讀取失敗");
                const itemsLoaded = (data.items || []) as Array<{ r2Key: string; createdAt: string; kind?: string }>;
                setExpanded((m) => ({ ...m, [runId]: itemsLoaded }));
                const keys = itemsLoaded.map((it) => it.r2Key);
                const idx = Math.max(0, keys.indexOf(r2Key));
                setLbKeys(keys);
                setLbIndex(idx);
                // 預載相鄰
                const left = idx - 1 >= 0 ? keys[idx - 1] : null;
                const right = idx + 1 < keys.length ? keys[idx + 1] : null;
                if (left) void ensureBlobUrlForKey(left).catch(() => { });
                if (right) void ensureBlobUrlForKey(right).catch(() => { });
            } catch (e) {
                // 清單失敗不影響已開啟的圖片；必要時可提示
                // toast.error(e instanceof Error ? e.message : "讀取失敗");
            } finally {
                setExpanding((prev) => { const n = new Set(prev); n.delete(runId); return n; });
            }
        })();
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
            <div className="mx-auto max-w-5xl p-6 space-y-6">
                <Toaster richColors />
                <h1 className="text-2xl font-semibold">歷史紀錄 - {flowName}</h1>
                {loading ? <div className="text-sm text-muted-foreground">載入中…</div> : null}
                <div className="space-y-4">
                    {runs.map((r) => (
                        <Card key={r.runId} className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">{`${formatDateTime(r.createdAt)} - ${r.itemsTotal} 張`}</div>
                                <div className="flex items-center gap-2">
                                    {(() => {
                                        const isExpanded = expandedUI.has(r.runId);
                                        const canExpand = r.itemsTotal > cols;
                                        if (!(isExpanded || canExpand)) return null;
                                        return (
                                            <Button variant="secondary" disabled={expanding.has(r.runId)} onClick={() => toggleExpand(r.runId)}>
                                                {isExpanded ? "收合" : expanding.has(r.runId) ? "讀取中…" : "展開全部"}
                                            </Button>
                                        );
                                    })()}
                                    <Button variant="destructive" onClick={() => remove(r.runId)}>刪除</Button>
                                </div>
                            </div>
                            {!expandedUI.has(r.runId) ? (
                                <div className={gridColsClass}>
                                    {r.itemsPreview.slice(0, cols).map((it, i) => (
                                        <div
                                            key={`${it.r2Key}-${i}`}
                                            className="group relative w-full overflow-hidden rounded-md border cursor-zoom-in"
                                            style={{ aspectRatio: "1 / 1" }}
                                            onClick={() => openRunLightbox(r.runId, it.r2Key)}
                                            role="button"
                                            aria-label="預覽"
                                        >
                                            <Image src={`/api/r2/${it.r2Key}`} alt="thumb" fill className="object-cover" />
                                            {/* hover overlay actions */}
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
                            ) : (
                                <div className={gridColsClass}>
                                    {(expanded[r.runId] || []).map((it, i) => (
                                        <div
                                            key={`${it.r2Key}-${i}`}
                                            className="group relative w-full overflow-hidden rounded-md border cursor-zoom-in"
                                            style={{ aspectRatio: "1 / 1" }}
                                            onClick={() => openRunLightbox(r.runId, it.r2Key)}
                                            role="button"
                                            aria-label="預覽"
                                        >
                                            <Image src={`/api/r2/${it.r2Key}`} alt="thumb" fill className="object-cover" />
                                            {/* hover overlay actions */}
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
                                    {(!expanded[r.runId] || expanded[r.runId]!.length === 0) && expanding.has(r.runId) ? (
                                        <div className="text-sm text-muted-foreground">讀取中…</div>
                                    ) : null}
                                </div>
                            )}
                        </Card>
                    ))}
                    {runs.length === 0 && !loading ? <div className="text-sm text-muted-foreground">尚無紀錄</div> : null}
                    {hasMore ? (
                        <div className="flex justify-center pt-2">
                            <Button disabled={loading} onClick={() => load(false)}>載入更多</Button>
                        </div>
                    ) : null}
                </div>
            </div>
            {/* Lightbox：同一個 run 內左右切換；使用本地快取的 blob URL */}
            <Lightbox
                open={lbOpen}
                src={lbSrc}
                onClose={() => { setLbOpen(false); setLbKeys([]); setLbIndex(0); setLbSrc(null); }}
                onPrev={async () => {
                    if (lbIndex <= 0) return;
                    const nextIdx = lbIndex - 1;
                    const key = lbKeys[nextIdx];
                    try {
                        const url = await ensureBlobUrlForKey(key);
                        setLbIndex(nextIdx);
                        setLbSrc(url);
                        // 預載更左邊
                        const moreLeft = nextIdx - 1 >= 0 ? lbKeys[nextIdx - 1] : null;
                        if (moreLeft) void ensureBlobUrlForKey(moreLeft).catch(() => { });
                    } catch { }
                }}
                onNext={async () => {
                    if (lbIndex >= lbKeys.length - 1) return;
                    const nextIdx = lbIndex + 1;
                    const key = lbKeys[nextIdx];
                    try {
                        const url = await ensureBlobUrlForKey(key);
                        setLbIndex(nextIdx);
                        setLbSrc(url);
                        // 預載更右邊
                        const moreRight = nextIdx + 1 < lbKeys.length ? lbKeys[nextIdx + 1] : null;
                        if (moreRight) void ensureBlobUrlForKey(moreRight).catch(() => { });
                    } catch { }
                }}
                canPrev={lbIndex > 0}
                canNext={lbIndex < lbKeys.length - 1}
            />
        </>
    );
}
