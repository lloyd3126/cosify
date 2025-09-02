"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Flow, FlowStep } from "@/server/flows";
import { Button } from "@/components/ui/button";
import UploadCard from "@/components/ui/upload-card";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { Toaster, toast } from "sonner";
import { Download, X, WandSparkles, Grid3X3 } from "lucide-react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import HorizontalCarousel from "@/components/ui/horizontal-carousel";
import Lightbox from "@/components/ui/lightbox";

type Props = { slug: string; flow: Flow };

export default function FlowRunner({ slug, flow }: Props) {
    const [runId, setRunId] = useState<string | null>(null);
    const [files, setFiles] = useState<Record<string, File | null>>({});
    const [keys, setKeys] = useState<Record<string, string | null>>({});
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [lightbox, setLightbox] = useState<{ open: boolean; src: string | null; alt: string | null; index: number | null }>({ open: false, src: null, alt: null, index: null });
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

    // Confirm dialogs
    const [confirmRerun, setConfirmRerun] = useState<{ stepId: string | null }>({ stepId: null });
    const [confirmClear, setConfirmClear] = useState<{ stepId: string | null }>({ stepId: null });

    // 初始化建立 run
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/flows/${slug}/run`, { method: "POST", cache: "no-store" });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "建立執行失敗");
                if (!cancelled) setRunId(data.runId);
            } catch (e) {
                toast.error(e instanceof Error ? e.message : "建立執行失敗");
            }
        })();
        return () => { cancelled = true; };
    }, [slug]);

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

    return (
        <div className="mx-auto w-full max-w-6xl p-6 pb-12">
            <Toaster richColors />

            <div className="mt-8 mb-12">
                <h1 className="text-4xl font-semibold text-center tracking-wide">{flow.name}</h1>
                {flow.metadata?.description ? (
                    <p className="text-1xl text-muted-foreground mt-3 text-center tracking-widest">{flow.metadata.description}</p>
                ) : null}
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
                                    onOpen={() => {
                                        const idx = flow.steps.findIndex((s) => s.id === step.id);
                                        const url = uploaderUrls[step.id];
                                        if (url) setLightbox({ open: true, src: url, alt: step.name, index: idx });
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
                                                    .then((url) => setLightbox({ open: true, src: url, alt: step.name, index: idx }))
                                                    .catch((e) => toast.error(e instanceof Error ? e.message : "下載失敗"));
                                            }
                                        }}
                                    >
                                        {loading[step.id] ? (
                                            <div className="absolute inset-0 grid place-items-center">
                                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground" />
                                            </div>
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
                                                                disabled={!refsReady(step) || !!loading[step.id]}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (!runId) return;
                                                                    invalidateFrom(step.id);
                                                                    setLoading((s) => ({ ...s, [step.id]: true }));
                                                                    (async () => {
                                                                        try {
                                                                            const refs = step.data.referenceImgs.map((r) => keys[r]).filter((k): k is string => !!k);
                                                                            const res = await fetch(`/api/flows/${slug}/steps/${step.id}/generate`, {
                                                                                method: "POST",
                                                                                headers: { "Content-Type": "application/json" },
                                                                                body: JSON.stringify({ runId, model: step.data.model, prompt: step.data.prompt, temperature: step.data.temperature, inputKeys: refs, asVariant: true }),
                                                                            });
                                                                            const data = await res.json();
                                                                            if (!res.ok) throw new Error(data?.error || "生成失敗");
                                                                            setKeys((k) => ({ ...k, [step.id]: data.key }));
                                                                            addCandidate(step.id, data.key);
                                                                        } catch (err) {
                                                                            toast.error(err instanceof Error ? err.message : "生成失敗");
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
                                                                disabled={!refsReady(step) || !!loading[step.id]}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (!runId) return;
                                                                    invalidateFrom(step.id);
                                                                    setOpenModalFor(step.id);
                                                                    setLoading((s) => ({ ...s, [step.id]: true }));
                                                                    (async () => {
                                                                        try {
                                                                            const refs = step.data.referenceImgs.map((r) => keys[r]).filter((k): k is string => !!k);
                                                                            const temps = [0.0, 0.5, 1.0];
                                                                            let lastKey: string | null = null;
                                                                            for (let i = 0; i < temps.length; i++) {
                                                                                const t = temps[i];
                                                                                const asVariant = true; // 全部存為變體，避免覆寫，同時可在 Modal 顯示 4 張
                                                                                const res = await fetch(`/api/flows/${slug}/steps/${step.id}/generate`, {
                                                                                    method: "POST",
                                                                                    headers: { "Content-Type": "application/json" },
                                                                                    body: JSON.stringify({ runId, model: step.data.model, prompt: step.data.prompt, temperature: t, inputKeys: refs, asVariant }),
                                                                                });
                                                                                const data = await res.json();
                                                                                if (!res.ok) throw new Error(data?.error || "生成失敗");
                                                                                addCandidate(step.id, data.key);
                                                                                lastKey = data.key as string;
                                                                            }
                                                                            if (lastKey) setKeys((k) => ({ ...k, [step.id]: lastKey }));
                                                                        } catch (err) {
                                                                            toast.error(err instanceof Error ? err.message : "生成失敗");
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
                                                                setLoading((s) => ({ ...s, [step.id]: true }));
                                                                (async () => {
                                                                    try {
                                                                        const refs = step.data.referenceImgs.map((r) => keys[r]).filter((k): k is string => !!k);
                                                                        const res = await fetch(`/api/flows/${slug}/steps/${step.id}/generate`, {
                                                                            method: "POST",
                                                                            headers: { "Content-Type": "application/json" },
                                                                            body: JSON.stringify({ runId, model: step.data.model, prompt: step.data.prompt, temperature: step.data.temperature, inputKeys: refs, asVariant: true }),
                                                                        });
                                                                        const data = await res.json();
                                                                        if (!res.ok) throw new Error(data?.error || "生成失敗");
                                                                        setKeys((k) => ({ ...k, [step.id]: data.key }));
                                                                        addCandidate(step.id, data.key);
                                                                    } catch (err) {
                                                                        toast.error(err instanceof Error ? err.message : "生成失敗");
                                                                    } finally {
                                                                        setLoading((s) => ({ ...s, [step.id]: false }));
                                                                    }
                                                                })();
                                                            }}
                                                            disabled={!refsReady(step) || !!loading[step.id]}
                                                            aria-label="生成"
                                                        >
                                                            <WandSparkles className="h-4 w-4" />
                                                        </Button>
                                                        {/* 3x 生成（初次；三張皆為變體，最後一張採用） */}
                                                        <Button
                                                            className="w-full"
                                                            disabled={!refsReady(step) || !!loading[step.id]}
                                                            onClick={() => {
                                                                if (!runId) return;
                                                                setOpenModalFor(step.id);
                                                                setLoading((s) => ({ ...s, [step.id]: true }));
                                                                (async () => {
                                                                    try {
                                                                        const refs = step.data.referenceImgs.map((r) => keys[r]).filter((k): k is string => !!k);
                                                                        const temps = [0.0, 0.5, 1.0];
                                                                        let lastKey: string | null = null;
                                                                        for (let i = 0; i < temps.length; i++) {
                                                                            const t = temps[i];
                                                                            const asVariant = true; // 全部存為變體，避免覆寫，同時可在 Modal 顯示 4 張
                                                                            const res = await fetch(`/api/flows/${slug}/steps/${step.id}/generate`, {
                                                                                method: "POST",
                                                                                headers: { "Content-Type": "application/json" },
                                                                                body: JSON.stringify({ runId, model: step.data.model, prompt: step.data.prompt, temperature: t, inputKeys: refs, asVariant }),
                                                                            });
                                                                            const data = await res.json();
                                                                            if (!res.ok) throw new Error(data?.error || "生成失敗");
                                                                            addCandidate(step.id, data.key);
                                                                            lastKey = data.key as string;
                                                                        }
                                                                        if (lastKey) setKeys((k) => ({ ...k, [step.id]: lastKey }));
                                                                    } catch (err) {
                                                                        toast.error(err instanceof Error ? err.message : "生成失敗");
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
                onClose={() => setLightbox({ open: false, src: null, alt: null, index: null })}
                onPrev={() => {
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
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setOpenModalFor(null)} />
                    <div className="relative z-10 w-[96vw] max-w-4xl max-h-[90vh] rounded-lg bg-background shadow-lg border">
                        <div className="flex items-center justify-between p-4 border-b">
                            <div className="font-medium">已生成</div>
                            <button className="rounded p-1 hover:bg-muted" aria-label="關閉" onClick={() => setOpenModalFor(null)}>
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="p-4 overflow-auto" style={{ maxHeight: "70vh" }}>
                            {(() => {
                                const list = candidates[openModalFor] || [];
                                if (list.length === 0) return <div className="text-sm text-muted-foreground">尚無生成結果</div>;
                                const adopted = keys[openModalFor] || null;
                                return (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {list.map((k) => (
                                            <div key={k} className="group relative w-full overflow-hidden rounded-md border" style={{ aspectRatio: "9 / 16" }}>
                                                <Image src={`/api/r2/${k}`} alt={openModalFor} fill className="object-cover" />
                                                {adopted === k ? (
                                                    <div className="absolute left-2 top-2 rounded bg-emerald-600 text-white text-[11px] px-2 py-0.5">已採用</div>
                                                ) : null}
                                                <div className="absolute inset-x-0 bottom-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <Button size="sm" onClick={() => { setKeys((s) => ({ ...s, [openModalFor]: k })); setOpenModalFor(null); }} aria-label="設為本步結果">採用</Button>
                                                        <Button size="sm" variant="secondary" onClick={() => downloadByKey(k, openModalFor)} aria-label="下載">下載</Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                        <div className="flex items-center justify-between p-4 border-t text-sm text-muted-foreground">
                            <div>已生成 {(candidates[openModalFor]?.length ?? 0)} 張</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
