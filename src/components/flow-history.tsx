"use client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { toast, Toaster } from "sonner";

type Props = { slug: string; flowName: string };

type RunPreview = { runId: string; createdAt: string; itemsPreview: Array<{ r2Key: string; createdAt: string }>; itemsTotal: number };

export default function FlowHistory({ slug, flowName }: Props) {
    const PAGE_SIZE = 5;
    const [runs, setRuns] = useState<RunPreview[]>([]);
    const [loading, setLoading] = useState(false);
    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const [expanded, setExpanded] = useState<Record<string, Array<{ r2Key: string; createdAt: string; kind?: string }>>>({});
    const [expanding, setExpanding] = useState<Set<string>>(new Set());
    const [cols, setCols] = useState(3); // xs 預設 3 欄

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
        if (expanded[runId]) {
            setExpanded((m) => { const n = { ...m }; delete n[runId]; return n; });
            return;
        }
        setExpanding((prev) => new Set(prev).add(runId));
        try {
            const res = await fetch(`/api/flows/${slug}/history/${runId}/items`, { cache: "no-store" });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "讀取失敗");
            setExpanded((m) => ({ ...m, [runId]: (data.items || []) as Array<{ r2Key: string; createdAt: string; kind?: string }> }));
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "讀取失敗");
        } finally {
            setExpanding((prev) => { const n = new Set(prev); n.delete(runId); return n; });
        }
    }

    return (
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
                                    const isExpanded = !!expanded[r.runId];
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
                        {!expanded[r.runId] ? (
                            <div className={gridColsClass}>
                                {r.itemsPreview.slice(0, cols).map((it, i) => (
                                    <div key={`${it.r2Key}-${i}`} className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
                                        <Image src={`/api/r2/${it.r2Key}`} alt="thumb" fill className="object-cover rounded-md border" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className={gridColsClass}>
                                {expanded[r.runId]!.map((it, i) => (
                                    <div key={`${it.r2Key}-${i}`} className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
                                        <Image src={`/api/r2/${it.r2Key}`} alt="thumb" fill className="object-cover rounded-md border" />
                                    </div>
                                ))}
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
    );
}
