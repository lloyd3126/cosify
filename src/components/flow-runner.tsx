"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Flow, FlowStep } from "@/server/flows";
import { Button } from "@/components/ui/button";
import UploadCard from "@/components/ui/upload-card";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";
import { Toaster, toast } from "sonner";
import { Download, X, WandSparkles, Grid3X3, BookmarkCheck, List, History } from "lucide-react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import HorizontalCarousel from "@/components/ui/horizontal-carousel";
import Lightbox from "@/components/ui/lightbox";

type Props = { slug: string; flow: Flow; runIdFromUrl?: string | null; hasHistory?: boolean };

export default function FlowRunner({ slug, flow, runIdFromUrl, hasHistory }: Props) {
    const [runId, setRunId] = useState<string | null>(null);
    const [files, setFiles] = useState<Record<string, File | null>>({});
    const [keys, setKeys] = useState<Record<string, string | null>>({});
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [lightbox, setLightbox] = useState<{ open: boolean; src: string | null; alt: string | null; index: number | null }>({ open: false, src: null, alt: null, index: null });
    // Lightbox 模式：若從 Modal 開啟，左右僅在該 Modal 圖片內導覽
    const [modalNav, setModalNav] = useState<{ stepId: string; keys: string[]; index: number } | null>(null);
    // Blob URL cache keyed by R2 key to avoid re-downloading images for lightbox
    const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
    const inFlight = useRef<Map<string, Promise<string>>>(new Map());
    const blobUrlsRef = useRef<Record<string, string>>({});
    useEffect(() => { blobUrlsRef.current = blobUrls; }, [blobUrls]);
    useEffect(() => () => { (Object.values(blobUrlsRef.current) as string[]).forEach((u) => { try { URL.revokeObjectURL(u); } catch { } }); }, []);

    // Local uploader object URLs to include in global lightbox navigation
    const [uploaderUrls, setUploaderUrls] = useState<Record<string, string>>({}); // stepId -> objectURL
    const uploaderUrlsRef = useRef<Record<string, string>>({});
    const prevFilesRef = useRef<Record<string, File | null>>({});
    useEffect(() => { uploaderUrlsRef.current = uploaderUrls; }, [uploaderUrls]);
    // Keep uploader object URLs in sync with files, revoke old ones
    useEffect(() => {
        const next: Record<string, string> = {};
        const toRevoke: string[] = [];
        for (const s of flow.steps) {
            if (s.type !== "uploader") continue;
            const f = files[s.id] ?? null;
            const prevFile = prevFilesRef.current[s.id] ?? null;
            const prevUrl = uploaderUrlsRef.current[s.id];
            if (f) {
                if (prevFile === f && prevUrl) {
                    next[s.id] = prevUrl;
                } else {
                    if (prevUrl) toRevoke.push(prevUrl);
                    try {
                        const url = URL.createObjectURL(f);
                        next[s.id] = url;
                    } catch { /* no-op */ }
                }
            } else {
                if (prevUrl) toRevoke.push(prevUrl);
            }
        }
        prevFilesRef.current = files;
        setUploaderUrls(next);
        for (const url of toRevoke) {
            try { URL.revokeObjectURL(url); } catch { }
        }
    }, [files, flow.steps]);
    // Cleanup on unmount
    useEffect(() => () => { (Object.values(uploaderUrlsRef.current) as string[]).forEach((u) => { try { URL.revokeObjectURL(u); } catch { } }); }, []);

    const aspect = "9 / 16";

    // 生成隊列（用於 Modal 預留卡位與狀態）
    type GenStatus = "queued" | "running" | "done" | "error";
    type GenEntry = { id: string; status: GenStatus; key?: string; temperature?: number; error?: string };
    const [generationQueue, setGenerationQueue] = useState<Record<string, GenEntry[]>>({});
    // DB 資產（done）
    type StepAsset = { id: string; r2Key: string; temperature: number | null; createdAt?: string };
    const [stepAssets, setStepAssets] = useState<Record<string, StepAsset[]>>({});
    const [assetsLoading, setAssetsLoading] = useState<Record<string, boolean>>({});
    // 穩定顯示順序：依生成先後（第一個出現者排前），key 陣列
    const [stepOrder, setStepOrder] = useState<Record<string, string[]>>({});
    const stepOpSeqRef = useRef<Record<string, number>>({});
    const nextOpId = (stepId: string) => {
        const v = (stepOpSeqRef.current[stepId] || 0) + 1;
        stepOpSeqRef.current[stepId] = v;
        return v;
    };
    const isCurrentOp = (stepId: string, opId: number) => stepOpSeqRef.current[stepId] === opId;
    const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    function queueAdd(stepId: string, entries: GenEntry[]) {
        setGenerationQueue((prev) => ({ ...prev, [stepId]: [...(prev[stepId] || []), ...entries] }));
    }
    function queueUpdate(stepId: string, entryId: string, updater: (e: GenEntry) => GenEntry) {
        setGenerationQueue((prev) => ({ ...prev, [stepId]: (prev[stepId] || []).map((e) => (e.id === entryId ? updater(e) : e)) }));
    }
    function queueClear(stepId: string) {
        setGenerationQueue((prev) => { const n = { ...prev }; delete n[stepId]; return n; });
    }

    // 是否忙碌：當前步驟存在載入或佇列中有 queued/running
    function isStepBusy(stepId: string) {
        if (loading[stepId]) return true;
        const q = generationQueue[stepId] || [];
        return q.some((e) => e.status === "queued" || e.status === "running");
    }

    // 找出上游相依（祖先）
    function getAllAncestors(startId: string): Set<string> {
        const visited = new Set<string>();
        const pushRefs = (id: string) => {
            const s = flow.steps.find((x) => x.id === id);
            if (s && s.type === "imgGenerator") {
                for (const ref of s.data.referenceImgs) {
                    if (!visited.has(ref)) { visited.add(ref); pushRefs(ref); }
                }
            }
        };
        pushRefs(startId);
        return visited;
    }

    // 鏈上忙碌：自身或上游/下游有 busy 即視為忙碌
    function isChainBusy(stepId: string) {
        if (isStepBusy(stepId)) return true;
        const ups = getAllAncestors(stepId);
        for (const u of ups) if (isStepBusy(u)) return true;
        const downs = getAllDependents(stepId);
        for (const d of downs) if (isStepBusy(d)) return true;
        return false;
    }

    // Confirm dialogs
    const [confirmRerun, setConfirmRerun] = useState<{ stepId: string | null }>({ stepId: null });
    const [confirmClear, setConfirmClear] = useState<{ stepId: string | null }>({ stepId: null });

    // 初始化：若帶入 runId 則恢復狀態；否則建立新 run
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                if (runIdFromUrl) {
                    if (!cancelled) setRunId(runIdFromUrl);
                    // 取回各步驟狀態並恢復 keys
                    try {
                        const res = await fetch(`/api/flows/${slug}/runs/${encodeURIComponent(runIdFromUrl)}/state`, { cache: "no-store" });
                        const data = await res.json();
                        if (res.ok && Array.isArray(data?.steps)) {
                            const map: Record<string, string | null> = {};
                            for (const s of data.steps as Array<{ stepId: string; r2Key: string | null }>) {
                                if (s && s.stepId) map[s.stepId] = s.r2Key ?? null;
                            }
                            setKeys((prev) => ({ ...prev, ...map }));
                        }
                    } catch { /* ignore */ }
                    return;
                }
                const res = await fetch(`/api/flows/${slug}/run`, { method: "POST", cache: "no-store" });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "建立執行失敗");
                if (!cancelled) setRunId(data.runId);
            } catch (e) {
                toast.error(e instanceof Error ? e.message : "建立執行失敗");
            }
        })();
        return () => {
            // 元件卸載時嘗試條件清理：若未生成任何圖片就移除 run
            // 恢復既有 run（runIdFromUrl 存在）時不進行清理
            if (runId && !runIdFromUrl) {
                const url = `/api/flows/${slug}/runs/${encodeURIComponent(runId)}/cleanup-if-empty`;
                try {
                    const blob = new Blob([JSON.stringify({})], { type: "application/json" });
                    navigator.sendBeacon?.(url, blob);
                } catch {
                    // 後備方案：fire-and-forget
                    fetch(url, { method: "POST" }).catch(() => { });
                }
            }
            cancelled = true;
        };
    }, [slug, runIdFromUrl]);

    // 頁面關閉/導航時也嘗試清理
    useEffect(() => {
        if (!runId || runIdFromUrl) return;
        const handler = () => {
            try {
                const url = `/api/flows/${slug}/runs/${encodeURIComponent(runId)}/cleanup-if-empty`;
                const blob = new Blob([JSON.stringify({})], { type: "application/json" });
                navigator.sendBeacon?.(url, blob);
            } catch { }
        };
        window.addEventListener("pagehide", handler);
        window.addEventListener("beforeunload", handler);
        return () => {
            window.removeEventListener("pagehide", handler);
            window.removeEventListener("beforeunload", handler);
        };
    }, [runId, slug, runIdFromUrl]);

    // 使用共用 HorizontalCarousel 取代內建輪播

    // 上傳（uploader）
    async function uploadStep(step: FlowStep, file: File) {
        if (!runId) return;
        const fd = new FormData();
        fd.append("runId", runId);
        fd.append("file", file);
        setLoading((s) => ({ ...s, [step.id]: true }));
        try {
            const res = await fetch(`/api/flows/${slug}/steps/${step.id}/upload`, { method: "POST", body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "上傳失敗");
            setKeys((k) => ({ ...k, [step.id]: data.key }));
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "上傳失敗");
        } finally {
            setLoading((s) => ({ ...s, [step.id]: false }));
        }
    }

    // 生成（imgGenerator）
    async function generateStep(step: Extract<FlowStep, { type: "imgGenerator" }>) {
        if (!runId) return;
        const refs = step.data.referenceImgs;
        const inputKeys: string[] = [];
        for (const ref of refs) {
            const key = keys[ref];
            if (!key) {
                toast.error(`缺少前置結果，無法執行步驟：${step.name}`);
                return;
            }
            inputKeys.push(key);
        }
        setLoading((s) => ({ ...s, [step.id]: true }));
        try {
            const res = await fetch(`/api/flows/${slug}/steps/${step.id}/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ runId, model: step.data.model, prompt: step.data.prompt, temperature: step.data.temperature, inputKeys }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "生成失敗");
            setKeys((k) => ({ ...k, [step.id]: data.key }));
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "生成失敗");
        } finally {
            setLoading((s) => ({ ...s, [step.id]: false }));
        }
    }

    // 依賴處理：找出某步驟所有下游相依（用 referenceImgs 反向圖）
    const downstreamOf = useMemo(() => {
        const map = new Map<string, Set<string>>(); // ref -> set of stepId that depend on ref
        for (const s of flow.steps) {
            if (s.type === "imgGenerator") {
                for (const ref of s.data.referenceImgs) {
                    if (!map.has(ref)) map.set(ref, new Set());
                    map.get(ref)!.add(s.id);
                }
            }
        }
        return map;
    }, [flow.steps]);

    function getAllDependents(startId: string): Set<string> {
        const visited = new Set<string>();
        const stack = [startId];
        while (stack.length) {
            const id = stack.pop()!;
            const deps = downstreamOf.get(id);
            if (!deps) continue;
            for (const d of deps) {
                if (!visited.has(d)) {
                    visited.add(d);
                    stack.push(d);
                }
            }
        }
        return visited;
    }

    // 清除/失效處理
    function invalidateFrom(stepId: string) {
        const affected = getAllDependents(stepId);
        // Revoke blob URLs for current keys of stepId and its dependents
        const ids = new Set<string>([stepId, ...affected]);
        for (const id of ids) {
            const k = keys[id];
            if (typeof k === "string" && k && blobUrlsRef.current[k]) {
                const url = blobUrlsRef.current[k];
                try { URL.revokeObjectURL(url); } catch { }
                setBlobUrls((prev) => { const n = { ...prev }; delete n[k]; return n; });
                inFlight.current.delete(k);
            }
        }
        setKeys((k) => {
            const next = { ...k };
            next[stepId] = null;
            for (const id of affected) next[id] = null;
            return next;
        });
    }

    async function ensureBlobUrlForKey(key: string): Promise<string> {
        if (blobUrlsRef.current[key]) return blobUrlsRef.current[key];
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

    // Prefetch blob URLs as soon as keys for imgGenerator steps become available
    useEffect(() => {
        for (const s of flow.steps) {
            if (s.type !== "imgGenerator") continue;
            const key = keys[s.id];
            if (typeof key === "string" && key) {
                void ensureBlobUrlForKey(key);
            }
        }
    }, [keys, flow.steps]);

    function onRequestRerun(stepId: string) { setConfirmRerun({ stepId }); }
    function onConfirmRerun() {
        const id = confirmRerun.stepId; if (!id) return; setConfirmRerun({ stepId: null });
        const step = flow.steps.find(s => s.id === id && s.type === "imgGenerator");
        if (step && step.type === "imgGenerator") {
            invalidateFrom(id);
            void generateStep(step);
        }
    }

    function onRequestClear(stepId: string) { setConfirmClear({ stepId }); }
    function onConfirmClear() {
        const id = confirmClear.stepId; if (!id) return; setConfirmClear({ stepId: null });
        const step = flow.steps.find(s => s.id === id);
        if (!step) return;
        if (step.type === "uploader") {
            setFiles((f) => ({ ...f, [id]: null }));
            invalidateFrom(id);
        } else if (step.type === "imgGenerator") {
            invalidateFrom(id);
            // Plan A: 保留生成佇列（含已完成/佔位），僅使當前結果與下游失效
        }
    }

    // 下載
    async function downloadByKey(key: string | null, name: string | null) {
        if (!key || !name) return;
        try {
            const res = await fetch(`/api/r2/${key}`, { cache: "no-store" });
            if (!res.ok) throw new Error("下載失敗");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `${name}.png`; a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "下載失敗");
        }
    }

    // 參考是否就緒
    function refsReady(step: Extract<FlowStep, { type: "imgGenerator" }>) {
        return step.data.referenceImgs.every(ref => !!keys[ref]);
    }

    // 候選清單（僅本次會話）
    const [candidates, setCandidates] = useState<Record<string, string[]>>({}); // stepId -> keys[]
    function addCandidate(stepId: string, key: string) {
        setCandidates((prev) => {
            const arr = prev[stepId] ? [...prev[stepId]] : [];
            if (!arr.includes(key)) arr.push(key);
            return { ...prev, [stepId]: arr };
        });
        void ensureBlobUrlForKey(key).catch(() => { });
    }

    // 已生成 Modal（候選檢視）
    const [openModalFor, setOpenModalFor] = useState<string | null>(null);
    // 當 Modal 開啟，抓取 DB 中的 done 資產清單
    useEffect(() => {
        if (!openModalFor || !runId) return;
        const stepId = openModalFor;
        setAssetsLoading((s) => ({ ...s, [stepId]: true }));
        fetch(`/api/runs/${encodeURIComponent(runId)}/steps/${encodeURIComponent(stepId)}/assets`)
            .then(async (res) => {
                if (!res.ok) throw new Error("無法取得資產");
                const data: { assets: Array<{ id: string; r2Key: string; temperature: number | null; createdAt?: string }>; adoptedKey?: string | null } = await res.json();
                setStepAssets((prev) => ({ ...prev, [stepId]: data.assets || [] }));
                // 將 DB 資產依 createdAt 由舊到新記入穩定順序
                if (Array.isArray(data.assets) && data.assets.length) {
                    const sortedAsc = [...data.assets].sort((a, b) => (new Date(a.createdAt || 0).getTime()) - (new Date(b.createdAt || 0).getTime()));
                    setStepOrder((prev) => {
                        const curr = prev[stepId] || [];
                        const seen = new Set(curr);
                        const appended = [...curr];
                        for (const a of sortedAsc) {
                            if (!seen.has(a.r2Key)) { appended.push(a.r2Key); seen.add(a.r2Key); }
                        }
                        if (appended.length === curr.length) return prev;
                        return { ...prev, [stepId]: appended };
                    });
                }
                if (data.adoptedKey) {
                    setKeys((k) => ({ ...k, [stepId]: data.adoptedKey! }));
                }
            })
            .catch(() => { /* 靜默失敗，維持本地資料 */ })
            .finally(() => setAssetsLoading((s) => ({ ...s, [stepId]: false })));
    }, [openModalFor, runId]);

    // 監控佇列：當某項首次成為 done 且有 key，立刻加入穩定順序尾端
    useEffect(() => {
        for (const [sid, list] of Object.entries(generationQueue)) {
            for (const e of list) {
                if (e.status === "done" && e.key) {
                    setStepOrder((prev) => {
                        const curr = prev[sid] || [];
                        if (curr.includes(e.key!)) return prev;
                        return { ...prev, [sid]: [...curr, e.key!] };
                    });
                }
            }
        }
    }, [generationQueue]);
    // 當燈箱開啟時，鎖定 Modal 寬度（px）以避免 viewport 變化導致寬度跳動
    const modalRef = useRef<HTMLDivElement | null>(null);
    const [modalLockedWidth, setModalLockedWidth] = useState<number | null>(null);
    useEffect(() => {
        if (openModalFor && lightbox.open) {
            const w = modalRef.current?.offsetWidth ?? null;
            if (w && w > 0) setModalLockedWidth(w);
        } else {
            setModalLockedWidth(null);
        }
    }, [openModalFor, lightbox.open]);

    return (
        <div className="mx-auto w-full max-w-6xl p-6 pb-12">
            <Toaster richColors />

            <div className="mt-8 mb-12">
                <h1 className="text-4xl font-semibold text-center tracking-wide">{flow.name}</h1>
                {flow.metadata?.description ? (
                    <p className="text-1xl text-muted-foreground mt-3 text-center tracking-widest">{flow.metadata.description}</p>
                ) : null}
                <div className="mt-4 flex justify-center gap-2">
                    <Link
                        href={`/flows`}
                        className="inline-flex items-center rounded-md border p-2 text-sm hover:bg-muted"
                        aria-label="返回工具清單"
                    >
                        <List className="h-4 w-4" />
                    </Link>
                    {hasHistory ? (
                        <Link
                            href={`/flows/${encodeURIComponent(slug)}/history`}
                            className="inline-flex items-center rounded-md border p-2 text-sm hover:bg-muted"
                            aria-label="前往歷史紀錄"
                        >
                            <History className="h-4 w-4" />
                        </Link>
                    ) : null}
                </div>
            </div>

            {!runId ? (
                <div className="text-sm text-muted-foreground">正在建立執行…</div>
            ) : (
                <HorizontalCarousel
                    className=""
                    items={flow.steps}
                    renderItem={(step, itemWidthPx) => (
                        <div className="space-y-2">
                            {step.type === "uploader" ? (
                                // 直接使用 UploadCard（內含標題與 Card），避免外層再包 Card 造成雙外框
                                <UploadCard
                                    label={step.name}
                                    file={files[step.id] ?? null}
                                    onChange={(f) => {
                                        setFiles((s) => ({ ...s, [step.id]: f }));
                                        if (f) uploadStep(step, f);
                                    }}
                                    accept="image/*"
                                    previewUrl={typeof keys[step.id] === "string" && keys[step.id] ? `/api/r2/${keys[step.id]}` : null}
                                    onOpen={() => {
                                        const idx = flow.steps.findIndex((s) => s.id === step.id);
                                        const localUrl = uploaderUrls[step.id];
                                        if (localUrl) {
                                            setLightbox({ open: true, src: localUrl, alt: step.name, index: idx });
                                            return;
                                        }
                                        const key = keys[step.id];
                                        if (typeof key === "string" && key) {
                                            ensureBlobUrlForKey(key)
                                                .then((url) => setLightbox({ open: true, src: url, alt: step.name, index: idx }))
                                                .catch(() => { /* ignore */ });
                                        }
                                    }}
                                />
                            ) : (
                                <>
                                    <div className="text-center font-medium">{step.name}</div>
                                    <Card
                                        className="group relative w-full overflow-hidden rounded-xl border-2 border-muted-foreground/20"
                                        style={{ aspectRatio: aspect }}
                                        onClick={() => {
                                            const key = keys[step.id];
                                            if (step.type === "imgGenerator" && key && !loading[step.id]) {
                                                const idx = flow.steps.findIndex((s) => s.id === step.id);
                                                ensureBlobUrlForKey(key)
                                                    .then((url) => { setModalNav(null); setLightbox({ open: true, src: url, alt: step.name, index: idx }); })
                                                    .catch((e) => toast.error(e instanceof Error ? e.message : "下載失敗"));
                                            }
                                        }}
                                    >
                                        {loading[step.id] ? (
                                            <>
                                                <div className="absolute inset-0 grid place-items-center">
                                                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground" />
                                                </div>
                                                {/* 載入中：底部全寬的已生成按鈕（可重開 Modal） */}
                                                <div className="absolute inset-x-0 bottom-0 p-3 z-10">
                                                    <Button
                                                        className="w-full bg-black text-white hover:bg-black/90"
                                                        onClick={(e) => { e.stopPropagation(); setOpenModalFor(step.id); }}
                                                        aria-label="已生成"
                                                    >
                                                        <Grid3X3 className="h-4 w-4 text-white" />
                                                    </Button>
                                                </div>
                                            </>
                                        ) : step.type === "imgGenerator" ? (
                                            keys[step.id] ? (
                                                <>
                                                    <Image src={`/api/r2/${keys[step.id]}`} alt={step.name} fill className="object-cover" />
                                                    {/* Top-right clear */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); onRequestClear(step.id); }}
                                                        aria-label="清除結果"
                                                        className="absolute right-2 top-2 z-10 rounded-full bg-black/60 text-white p-1.5 shadow-sm transition-colors hover:bg-black/75 focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                    {/* Bottom overlay actions */}
                                                    <div className="absolute inset-0 z-0 flex items-end p-3 bg-black/30 opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
                                                        <div className="w-full grid grid-cols-3 gap-2">
                                                            {/* 生成（存為變體並採用，會使下游失效） */}
                                                            <Button
                                                                className="w-full"
                                                                disabled={!refsReady(step) || isChainBusy(step.id)}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (!runId) return;
                                                                    invalidateFrom(step.id);
                                                                    // 先加入隊列占位（單次一張）
                                                                    const entryId = uid();
                                                                    queueAdd(step.id, [{ id: entryId, status: "queued", temperature: step.data.temperature }]);
                                                                    setLoading((s) => ({ ...s, [step.id]: true }));
                                                                    const opId = nextOpId(step.id);
                                                                    (async () => {
                                                                        try {
                                                                            const refs = step.data.referenceImgs.map((r) => keys[r]).filter((k): k is string => !!k);
                                                                            // 標記為 running
                                                                            queueUpdate(step.id, entryId, (e) => ({ ...e, status: "running" }));
                                                                            const res = await fetch(`/api/flows/${slug}/steps/${step.id}/generate`, {
                                                                                method: "POST",
                                                                                headers: { "Content-Type": "application/json" },
                                                                                body: JSON.stringify({ runId, model: step.data.model, prompt: step.data.prompt, temperature: step.data.temperature, inputKeys: refs, asVariant: true }),
                                                                            });
                                                                            const data = await res.json();
                                                                            if (!res.ok) throw new Error(data?.error || "生成失敗");
                                                                            if (!isCurrentOp(step.id, opId)) return;
                                                                            setKeys((k) => ({ ...k, [step.id]: data.key }));
                                                                            queueUpdate(step.id, entryId, (e) => ({ ...e, status: "done", key: data.key }));
                                                                            void ensureBlobUrlForKey(data.key).catch(() => { });
                                                                        } catch (err) {
                                                                            const msg = err instanceof Error ? err.message : "生成失敗";
                                                                            queueUpdate(step.id, entryId, (e) => ({ ...e, status: "error", error: msg }));
                                                                            toast.error(msg);
                                                                        } finally {
                                                                            setLoading((s) => ({ ...s, [step.id]: false }));
                                                                        }
                                                                    })();
                                                                }}
                                                                aria-label="生成"
                                                            >
                                                                <WandSparkles className="h-4 w-4" />
                                                            </Button>
                                                            {/* 3x 生成（0.0/0.5/1.0 串行；三張皆為變體，最後一張採用） */}
                                                            <Button
                                                                className="w-full"
                                                                disabled={!refsReady(step) || isChainBusy(step.id)}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (!runId) return;
                                                                    invalidateFrom(step.id);
                                                                    setOpenModalFor(step.id);
                                                                    setLoading((s) => ({ ...s, [step.id]: true }));
                                                                    const opId = nextOpId(step.id);
                                                                    (async () => {
                                                                        try {
                                                                            const refs = step.data.referenceImgs.map((r) => keys[r]).filter((k): k is string => !!k);
                                                                            const temps = [0.0, 0.5, 1.0];
                                                                            let lastKey: string | null = null;
                                                                            // 預先加入三個 queued 占位
                                                                            const entries = temps.map((t) => ({ id: uid(), status: "queued" as const, temperature: t }));
                                                                            queueAdd(step.id, entries);
                                                                            for (let i = 0; i < temps.length; i++) {
                                                                                const t = temps[i];
                                                                                const asVariant = true; // 全部存為變體，避免覆寫
                                                                                // 標記第 i 個為 running
                                                                                queueUpdate(step.id, entries[i].id, (e) => ({ ...e, status: "running" }));
                                                                                const res = await fetch(`/api/flows/${slug}/steps/${step.id}/generate`, {
                                                                                    method: "POST",
                                                                                    headers: { "Content-Type": "application/json" },
                                                                                    body: JSON.stringify({ runId, model: step.data.model, prompt: step.data.prompt, temperature: t, inputKeys: refs, asVariant }),
                                                                                });
                                                                                const data = await res.json();
                                                                                if (!res.ok) throw new Error(data?.error || "生成失敗");
                                                                                if (!isCurrentOp(step.id, opId)) return;
                                                                                queueUpdate(step.id, entries[i].id, (e) => ({ ...e, status: "done", key: data.key }));
                                                                                void ensureBlobUrlForKey(data.key).catch(() => { });
                                                                                lastKey = data.key as string;
                                                                            }
                                                                            if (lastKey) setKeys((k) => ({ ...k, [step.id]: lastKey }));
                                                                        } catch (err) {
                                                                            const msg = err instanceof Error ? err.message : "生成失敗";
                                                                            // 標記所有未完成為 error
                                                                            setGenerationQueue((prev) => {
                                                                                const list = prev[step.id] || [];
                                                                                const next = list.map((e): GenEntry => (e.status === "queued" || e.status === "running")
                                                                                    ? { ...e, status: "error" as GenStatus, error: msg }
                                                                                    : e
                                                                                );
                                                                                return { ...prev, [step.id]: next };
                                                                            });
                                                                            toast.error(msg);
                                                                        } finally {
                                                                            setLoading((s) => ({ ...s, [step.id]: false }));
                                                                        }
                                                                    })();
                                                                }}
                                                                aria-label="3x 生成"
                                                            >
                                                                <WandSparkles className="h-4 w-4" /> 3
                                                            </Button>
                                                            {/* 已生成（開啟候選 Modal） */}
                                                            <Button
                                                                className="w-full bg-black text-white hover:bg-black/90"
                                                                onClick={(e) => { e.stopPropagation(); setOpenModalFor(step.id); }}
                                                                aria-label="已生成"
                                                            >
                                                                <Grid3X3 className="h-4 w-4 text-white" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="absolute inset-x-0 bottom-0 p-3">
                                                    <div className="w-full grid grid-cols-3 gap-2">
                                                        {/* 生成（初次；存為變體並採用） */}
                                                        <Button
                                                            className="w-full"
                                                            onClick={() => {
                                                                if (!runId) return;
                                                                // 先加入隊列占位
                                                                const entryId = uid();
                                                                queueAdd(step.id, [{ id: entryId, status: "queued", temperature: step.data.temperature }]);
                                                                setLoading((s) => ({ ...s, [step.id]: true }));
                                                                const opId = nextOpId(step.id);
                                                                (async () => {
                                                                    try {
                                                                        const refs = step.data.referenceImgs.map((r) => keys[r]).filter((k): k is string => !!k);
                                                                        queueUpdate(step.id, entryId, (e) => ({ ...e, status: "running" }));
                                                                        const res = await fetch(`/api/flows/${slug}/steps/${step.id}/generate`, {
                                                                            method: "POST",
                                                                            headers: { "Content-Type": "application/json" },
                                                                            body: JSON.stringify({ runId, model: step.data.model, prompt: step.data.prompt, temperature: step.data.temperature, inputKeys: refs, asVariant: true }),
                                                                        });
                                                                        const data = await res.json();
                                                                        if (!res.ok) throw new Error(data?.error || "生成失敗");
                                                                        if (!isCurrentOp(step.id, opId)) return;
                                                                        setKeys((k) => ({ ...k, [step.id]: data.key }));
                                                                        queueUpdate(step.id, entryId, (e) => ({ ...e, status: "done", key: data.key }));
                                                                        void ensureBlobUrlForKey(data.key).catch(() => { });
                                                                    } catch (err) {
                                                                        const msg = err instanceof Error ? err.message : "生成失敗";
                                                                        queueUpdate(step.id, entryId, (e) => ({ ...e, status: "error", error: msg }));
                                                                        toast.error(msg);
                                                                    } finally {
                                                                        setLoading((s) => ({ ...s, [step.id]: false }));
                                                                    }
                                                                })();
                                                            }}
                                                            disabled={!refsReady(step) || isChainBusy(step.id)}
                                                            aria-label="生成"
                                                        >
                                                            <WandSparkles className="h-4 w-4" />
                                                        </Button>
                                                        {/* 3x 生成（初次；三張皆為變體，最後一張採用） */}
                                                        <Button
                                                            className="w-full"
                                                            disabled={!refsReady(step) || isChainBusy(step.id)}
                                                            onClick={() => {
                                                                if (!runId) return;
                                                                setOpenModalFor(step.id);
                                                                setLoading((s) => ({ ...s, [step.id]: true }));
                                                                const opId = nextOpId(step.id);
                                                                (async () => {
                                                                    try {
                                                                        const refs = step.data.referenceImgs.map((r) => keys[r]).filter((k): k is string => !!k);
                                                                        const temps = [0.0, 0.5, 1.0];
                                                                        let lastKey: string | null = null;
                                                                        const entries = temps.map((t) => ({ id: uid(), status: "queued" as const, temperature: t }));
                                                                        queueAdd(step.id, entries);
                                                                        for (let i = 0; i < temps.length; i++) {
                                                                            const t = temps[i];
                                                                            const asVariant = true; // 全部存為變體，避免覆寫，同時可在 Modal 顯示 4 張
                                                                            queueUpdate(step.id, entries[i].id, (e) => ({ ...e, status: "running" }));
                                                                            const res = await fetch(`/api/flows/${slug}/steps/${step.id}/generate`, {
                                                                                method: "POST",
                                                                                headers: { "Content-Type": "application/json" },
                                                                                body: JSON.stringify({ runId, model: step.data.model, prompt: step.data.prompt, temperature: t, inputKeys: refs, asVariant }),
                                                                            });
                                                                            const data = await res.json();
                                                                            if (!res.ok) throw new Error(data?.error || "生成失敗");
                                                                            if (!isCurrentOp(step.id, opId)) return;
                                                                            queueUpdate(step.id, entries[i].id, (e) => ({ ...e, status: "done", key: data.key }));
                                                                            void ensureBlobUrlForKey(data.key).catch(() => { });
                                                                            lastKey = data.key as string;
                                                                        }
                                                                        if (lastKey) setKeys((k) => ({ ...k, [step.id]: lastKey }));
                                                                    } catch (err) {
                                                                        const msg = err instanceof Error ? err.message : "生成失敗";
                                                                        setGenerationQueue((prev) => {
                                                                            const list = prev[step.id] || [];
                                                                            const next = list.map((e): GenEntry => (e.status === "queued" || e.status === "running")
                                                                                ? { ...e, status: "error" as GenStatus, error: msg }
                                                                                : e
                                                                            );
                                                                            return { ...prev, [step.id]: next };
                                                                        });
                                                                        toast.error(msg);
                                                                    } finally {
                                                                        setLoading((s) => ({ ...s, [step.id]: false }));
                                                                    }
                                                                })();
                                                            }}
                                                            aria-label="3x 生成"
                                                        >
                                                            <WandSparkles className="h-4 w-4" /> 3
                                                        </Button>
                                                        {/* 已生成 */}
                                                        <Button
                                                            className="w-full bg-black text-white hover:bg-black/90"
                                                            onClick={() => setOpenModalFor(step.id)}
                                                            aria-label="已生成"
                                                        >
                                                            <Grid3X3 className="h-4 w-4 text-white" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )
                                        ) : (
                                            <div className="absolute inset-0 grid place-items-center text-sm text-red-600">不支援的步驟類型</div>
                                        )}
                                    </Card>
                                    {/* 常駐「已生成」按鈕（卡片下方） */}
                                    {/* 移除卡片下方的常駐按鈕，僅在載入時顯示絕對定位的按鈕 */}
                                </>
                            )}
                        </div>
                    )}
                />
            )}

            {/* Rerun dialog */}
            <ConfirmDialog
                open={!!confirmRerun.stepId}
                title="將覆蓋這一步的現有結果"
                description="此動作會覆蓋本步結果，並使後續步驟的結果失效，需要重新生成。"
                confirmText="覆蓋並重跑"
                cancelText="取消"
                onCancel={() => setConfirmRerun({ stepId: null })}
                onConfirm={onConfirmRerun}
            />

            {/* Clear dialog */}
            <ConfirmDialog
                open={!!confirmClear.stepId}
                title="清除這一步的結果？"
                description="此動作無法復原，且會使後續步驟結果失效。"
                confirmText="清除"
                cancelText="取消"
                onCancel={() => setConfirmClear({ stepId: null })}
                onConfirm={onConfirmClear}
            />

            {/* Global Lightbox for uploader & imgGenerator preview */}
            <Lightbox
                open={lightbox.open}
                src={lightbox.src}
                alt={lightbox.alt ?? undefined}
                onClose={() => { setLightbox({ open: false, src: null, alt: null, index: null }); setModalNav(null); }}
                onPrev={() => {
                    if (modalNav) {
                        if (modalNav.index <= 0) return;
                        const newIdx = modalNav.index - 1;
                        const key = modalNav.keys[newIdx];
                        ensureBlobUrlForKey(key).then((url) => {
                            setLightbox({ open: true, src: url, alt: flow.steps.find(s => s.id === modalNav.stepId)?.name ?? "", index: null });
                            setModalNav({ ...modalNav, index: newIdx });
                        });
                        return;
                    }
                    if (lightbox.index == null) return;
                    for (let i = lightbox.index - 1; i >= 0; i--) {
                        const s = flow.steps[i];
                        if (s.type === "uploader") {
                            if (files[s.id]) {
                                const url = uploaderUrlsRef.current[s.id];
                                if (url) { setLightbox({ open: true, src: url, alt: s.name, index: i }); }
                                break;
                            }
                        } else if (s.type === "imgGenerator") {
                            const key = keys[s.id];
                            if (typeof key === "string" && key) {
                                ensureBlobUrlForKey(key).then((url) => setLightbox({ open: true, src: url, alt: s.name, index: i }));
                                break;
                            }
                        }
                    }
                }}
                onNext={() => {
                    if (modalNav) {
                        if (modalNav.index >= modalNav.keys.length - 1) return;
                        const newIdx = modalNav.index + 1;
                        const key = modalNav.keys[newIdx];
                        ensureBlobUrlForKey(key).then((url) => {
                            setLightbox({ open: true, src: url, alt: flow.steps.find(s => s.id === modalNav.stepId)?.name ?? "", index: null });
                            setModalNav({ ...modalNav, index: newIdx });
                        });
                        return;
                    }
                    if (lightbox.index == null) return;
                    for (let i = lightbox.index + 1; i < flow.steps.length; i++) {
                        const s = flow.steps[i];
                        if (s.type === "uploader") {
                            if (files[s.id]) {
                                const url = uploaderUrlsRef.current[s.id];
                                if (url) { setLightbox({ open: true, src: url, alt: s.name, index: i }); }
                                break;
                            }
                        } else if (s.type === "imgGenerator") {
                            const key = keys[s.id];
                            if (typeof key === "string" && key) {
                                ensureBlobUrlForKey(key).then((url) => setLightbox({ open: true, src: url, alt: s.name, index: i }));
                                break;
                            }
                        }
                    }
                }}
                canPrev={(() => {
                    if (modalNav) return modalNav.index > 0;
                    if (lightbox.index == null) return false;
                    for (let i = lightbox.index - 1; i >= 0; i--) {
                        const s = flow.steps[i];
                        if (s.type === "uploader") {
                            if (files[s.id]) return true;
                        } else if (s.type === "imgGenerator") {
                            const key = keys[s.id];
                            if (typeof key === "string" && key) return true;
                        }
                    }
                    return false;
                })()}
                canNext={(() => {
                    if (modalNav) return modalNav.index < modalNav.keys.length - 1;
                    if (lightbox.index == null) return false;
                    for (let i = lightbox.index + 1; i < flow.steps.length; i++) {
                        const s = flow.steps[i];
                        if (s.type === "uploader") {
                            if (files[s.id]) return true;
                        } else if (s.type === "imgGenerator") {
                            const key = keys[s.id];
                            if (typeof key === "string" && key) return true;
                        }
                    }
                    return false;
                })()}
            />

            {/* 候選 Modal */}
            {openModalFor && (
                <div className={`fixed inset-0 z-50 flex items-center justify-center ${lightbox.open ? "pointer-events-none" : ""}`}>
                    <div
                        className={`absolute inset-0 ${lightbox.open ? "bg-transparent" : "bg-black/60"}`}
                        onClick={() => setOpenModalFor(null)}
                    />
                    <div
                        ref={modalRef}
                        className="relative z-10 w-[96vw] max-w-4xl max-h-[90vh] rounded-lg bg-background shadow-lg border"
                        style={modalLockedWidth ? { width: `${modalLockedWidth}px` } : undefined}
                    >
                        <div className="flex items-center justify-between p-4 border-b">
                            <div className="font-medium">已生成</div>
                            <button className="rounded p-1 hover:bg-muted" aria-label="關閉" onClick={() => setOpenModalFor(null)}>
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="p-4 overflow-auto" style={{ maxHeight: "70vh" }}>
                            {(() => {
                                const stepId = openModalFor;
                                const q = generationQueue[stepId] || [];
                                const db = stepAssets[stepId] || [];
                                // 合併 done（DB 與 Queue）並以 key 去重，確保 queue 的 done 立即可見
                                const doneMap = new Map<string, GenEntry>();
                                for (const a of db) {
                                    doneMap.set(a.r2Key, { id: a.id, status: "done", key: a.r2Key, temperature: a.temperature ?? undefined });
                                }
                                for (const e of q) {
                                    if (e.status === "done" && e.key) {
                                        if (!doneMap.has(e.key)) doneMap.set(e.key, e);
                                    }
                                }
                                let doneMerged = Array.from(doneMap.values());
                                // 依穩定順序排序（先出現者在前），未知者置後但保持相對順序
                                const order = stepOrder[stepId] || [];
                                const idxMap = new Map(order.map((k, i) => [k, i] as const));
                                doneMerged.sort((a, b) => {
                                    const ai = a.key ? (idxMap.get(a.key) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
                                    const bi = b.key ? (idxMap.get(b.key) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
                                    return ai - bi;
                                });
                                const nonDoneFromQueue = q.filter((e) => e.status !== "done");
                                const queueItems: Array<GenEntry> = [...doneMerged, ...nonDoneFromQueue];
                                if (queueItems.length === 0) return <div className="text-sm text-muted-foreground">尚無生成結果</div>;
                                const adopted = keys[stepId] || null;
                                return (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {queueItems.map((item, idx) => (
                                            <div
                                                key={item.id}
                                                className="group relative w-full overflow-hidden rounded-md border"
                                                style={{ aspectRatio: "9 / 16" }}
                                                onClick={() => {
                                                    if (item.status === "done" && item.key) {
                                                        const doneKeys = queueItems.filter((q) => q.status === "done" && q.key).map((q) => q.key!)
                                                        const selIndex = doneKeys.indexOf(item.key);
                                                        ensureBlobUrlForKey(item.key).then((url) => {
                                                            setLightbox({ open: true, src: url, alt: openModalFor, index: null });
                                                            setModalNav({ stepId: openModalFor!, keys: doneKeys, index: selIndex >= 0 ? selIndex : 0 });
                                                        });
                                                    }
                                                }}
                                            >
                                                {item.status === "done" && item.key ? (
                                                    <Image src={`/api/r2/${item.key}`} alt={openModalFor} fill className="object-cover" />
                                                ) : (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background">
                                                        {item.status === "running" ? (
                                                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground" />
                                                        ) : (
                                                            <div className="h-8 w-8 rounded-full border-2 border-dashed border-muted-foreground/30" />
                                                        )}
                                                        <div className="mt-2 text-xs text-muted-foreground">
                                                            {item.status === "queued" ? "排隊中" : item.status === "running" ? "生成中" : item.status === "error" ? "失敗" : ""}
                                                            {typeof item.temperature === "number" ? ` · T=${item.temperature}` : ""}
                                                        </div>
                                                    </div>
                                                )}
                                                {item.status === "done" && item.key && adopted === item.key ? (
                                                    <div className="absolute left-2 top-2 z-10 rounded bg-emerald-600 text-white p-1" aria-label="已採用">
                                                        <BookmarkCheck className="h-4 w-4 text-white" />
                                                    </div>
                                                ) : null}
                                                {item.status === "done" && item.key ? (
                                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 pointer-events-none z-0">
                                                        <div className="absolute inset-x-0 bottom-0 p-2 pointer-events-auto">
                                                            <div className={`grid ${adopted === item.key ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
                                                                {adopted === item.key ? null : (
                                                                    <Button
                                                                        size="sm"
                                                                        className="bg-black text-white hover:bg-black/90"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const sid = stepId;
                                                                            const key = item.key!;
                                                                            // 立即更新 UI
                                                                            setKeys((s) => ({ ...s, [sid]: key }));
                                                                            setOpenModalFor(null);
                                                                            // 以 item.id 當作 assetId（若為 DB 來源）
                                                                            const assetId = item.id;
                                                                            const tryAdopt = (aid: string) => fetch(`/api/runs/${encodeURIComponent(runId!)}/steps/${encodeURIComponent(sid)}/adopt`, {
                                                                                method: "POST",
                                                                                headers: { "Content-Type": "application/json" },
                                                                                body: JSON.stringify({ assetId: aid }),
                                                                            }).then((res) => res.ok ? null : res.json().then((d) => Promise.reject(new Error(d?.error || "採用失敗"))));
                                                                            if (assetId && assetId.length > 0) {
                                                                                void tryAdopt(assetId).catch((err) => toast.error(err.message));
                                                                            } else {
                                                                                // 從 DB 清單嘗試以 key 對應 assetId
                                                                                const assets = stepAssets[sid] || [];
                                                                                const found = assets.find((a) => a.r2Key === key);
                                                                                if (found) {
                                                                                    void tryAdopt(found.id).catch((err) => toast.error(err.message));
                                                                                } else {
                                                                                    // 稍後重取一次資產再嘗試
                                                                                    setTimeout(() => {
                                                                                        fetch(`/api/runs/${encodeURIComponent(runId!)}/steps/${encodeURIComponent(sid)}/assets`)
                                                                                            .then((r) => r.ok ? r.json() : null)
                                                                                            .then((data) => {
                                                                                                const again = data?.assets?.find((a: any) => a.r2Key === key);
                                                                                                if (again) void tryAdopt(again.id).catch((err) => toast.error(err.message));
                                                                                            })
                                                                                            .catch(() => { /* ignore */ });
                                                                                    }, 500);
                                                                                }
                                                                            }
                                                                        }}
                                                                        aria-label="設為本步結果"
                                                                    >
                                                                        <BookmarkCheck className="h-4 w-4 text-white" />
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    size="sm"
                                                                    className="bg-black text-white hover:bg-black/90"
                                                                    onClick={(e) => { e.stopPropagation(); downloadByKey(item.key!, openModalFor); }}
                                                                    aria-label="下載"
                                                                >
                                                                    <Download className="h-4 w-4 text-white" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                        <div className="flex items-center justify-between p-4 border-t text-sm text-muted-foreground">
                            {(() => {
                                const stepId = openModalFor;
                                const q = generationQueue[stepId] || [];
                                const db = stepAssets[stepId] || [];
                                // 僅計入 done：DB 資產 + 佇列中的 done（以 key 去重）
                                const doneSet = new Set<string>();
                                for (const a of db) doneSet.add(a.r2Key);
                                for (const e of q) if (e.status === "done" && e.key) doneSet.add(e.key);
                                const count = doneSet.size;
                                return <div>已生成 {count} 張{assetsLoading[stepId] ? " · 載入中" : ""}</div>;
                            })()}
                            {(() => {
                                const step = flow.steps.find((s) => s.id === openModalFor && s.type === "imgGenerator");
                                if (!step || step.type !== "imgGenerator") return null;
                                const disabled = !refsReady(step) || isChainBusy(step.id);
                                return (
                                    <div className="flex items-center gap-2 text-foreground">
                                        {/* 單張生成（存為變體並採用）*/}
                                        <Button
                                            size="sm"
                                            className="w-16 justify-center"
                                            disabled={disabled}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!runId) return;
                                                // 與卡片一致：使下游失效
                                                invalidateFrom(step.id);
                                                // 先加入隊列占位（單次一張）
                                                const entryId = uid();
                                                queueAdd(step.id, [{ id: entryId, status: "queued", temperature: step.data.temperature }]);
                                                setLoading((s) => ({ ...s, [step.id]: true }));
                                                const opId = nextOpId(step.id);
                                                (async () => {
                                                    try {
                                                        const refs = step.data.referenceImgs.map((r) => keys[r]).filter((k): k is string => !!k);
                                                        // 標記為 running
                                                        queueUpdate(step.id, entryId, (e) => ({ ...e, status: "running" }));
                                                        const res = await fetch(`/api/flows/${slug}/steps/${step.id}/generate`, {
                                                            method: "POST",
                                                            headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({ runId, model: step.data.model, prompt: step.data.prompt, temperature: step.data.temperature, inputKeys: refs, asVariant: true }),
                                                        });
                                                        const data = await res.json();
                                                        if (!res.ok) throw new Error(data?.error || "生成失敗");
                                                        if (!isCurrentOp(step.id, opId)) return;
                                                        setKeys((k) => ({ ...k, [step.id]: data.key }));
                                                        queueUpdate(step.id, entryId, (e) => ({ ...e, status: "done", key: data.key }));
                                                        void ensureBlobUrlForKey(data.key).catch(() => { });
                                                    } catch (err) {
                                                        const msg = err instanceof Error ? err.message : "生成失敗";
                                                        queueUpdate(step.id, entryId, (e) => ({ ...e, status: "error", error: msg }));
                                                        toast.error(msg);
                                                    } finally {
                                                        setLoading((s) => ({ ...s, [step.id]: false }));
                                                    }
                                                })();
                                            }}
                                            aria-label="生成"
                                        >
                                            <WandSparkles className="h-4 w-4" />
                                        </Button>
                                        {/* 3x 生成（0.0/0.5/1.0；三張皆為變體，最後一張採用） */}
                                        <Button
                                            size="sm"
                                            className="w-16 justify-center"
                                            disabled={disabled}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!runId) return;
                                                // 與卡片一致：使下游失效
                                                invalidateFrom(step.id);
                                                setLoading((s) => ({ ...s, [step.id]: true }));
                                                const opId = nextOpId(step.id);
                                                (async () => {
                                                    try {
                                                        const refs = step.data.referenceImgs.map((r) => keys[r]).filter((k): k is string => !!k);
                                                        const temps = [0.0, 0.5, 1.0];
                                                        let lastKey: string | null = null;
                                                        // 預先加入三個 queued 占位
                                                        const entries = temps.map((t) => ({ id: uid(), status: "queued" as const, temperature: t }));
                                                        queueAdd(step.id, entries);
                                                        for (let i = 0; i < temps.length; i++) {
                                                            const t = temps[i];
                                                            const asVariant = true; // 全部存為變體
                                                            // 標記第 i 個為 running
                                                            queueUpdate(step.id, entries[i].id, (e) => ({ ...e, status: "running" }));
                                                            const res = await fetch(`/api/flows/${slug}/steps/${step.id}/generate`, {
                                                                method: "POST",
                                                                headers: { "Content-Type": "application/json" },
                                                                body: JSON.stringify({ runId, model: step.data.model, prompt: step.data.prompt, temperature: t, inputKeys: refs, asVariant }),
                                                            });
                                                            const data = await res.json();
                                                            if (!res.ok) throw new Error(data?.error || "生成失敗");
                                                            if (!isCurrentOp(step.id, opId)) return;
                                                            queueUpdate(step.id, entries[i].id, (e) => ({ ...e, status: "done", key: data.key }));
                                                            void ensureBlobUrlForKey(data.key).catch(() => { });
                                                            lastKey = data.key as string;
                                                        }
                                                        if (lastKey) setKeys((k) => ({ ...k, [step.id]: lastKey }));
                                                    } catch (err) {
                                                        const msg = err instanceof Error ? err.message : "生成失敗";
                                                        // 標記所有未完成為 error
                                                        setGenerationQueue((prev) => {
                                                            const list = prev[step.id] || [];
                                                            const next = list.map((e): GenEntry => (e.status === "queued" || e.status === "running")
                                                                ? { ...e, status: "error" as GenStatus, error: msg }
                                                                : e
                                                            );
                                                            return { ...prev, [step.id]: next };
                                                        });
                                                        toast.error(msg);
                                                    } finally {
                                                        setLoading((s) => ({ ...s, [step.id]: false }));
                                                    }
                                                })();
                                            }}
                                            aria-label="3x 生成"
                                        >
                                            <WandSparkles className="h-4 w-4" /> 3
                                        </Button>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
