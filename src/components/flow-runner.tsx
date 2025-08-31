"use client";
import { useEffect, useMemo, useState } from "react";
import type { Flow, FlowStep } from "@/server/flows";
import { Button } from "@/components/ui/button";
import UploadCard from "@/components/ui/upload-card";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { Toaster, toast } from "sonner";
import { Download, RotateCw, X, WandSparkles } from "lucide-react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import HorizontalCarousel from "@/components/ui/horizontal-carousel";

type Props = { slug: string; flow: Flow };

export default function FlowRunner({ slug, flow }: Props) {
    const [runId, setRunId] = useState<string | null>(null);
    const [files, setFiles] = useState<Record<string, File | null>>({});
    const [keys, setKeys] = useState<Record<string, string | null>>({});
    const [loading, setLoading] = useState<Record<string, boolean>>({});

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
        setKeys((k) => {
            const next = { ...k };
            next[stepId] = null;
            for (const id of affected) next[id] = null;
            return next;
        });
    }

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

    return (
        <div className="mx-auto w-full max-w-6xl p-6">
            <Toaster richColors />

            <div className="mb-4">
                <h1 className="text-2xl font-semibold">{flow.name}</h1>
                {flow.metadata?.description ? (
                    <p className="text-sm text-muted-foreground mt-1">{flow.metadata.description}</p>
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
                                />
                            ) : (
                                <>
                                    <div className="text-center font-medium">{step.name}</div>
                                    <Card className="group relative w-full overflow-hidden rounded-xl border-2 border-muted-foreground/20" style={{ aspectRatio: aspect }}>
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
                                                        onClick={() => onRequestClear(step.id)}
                                                        aria-label="清除結果"
                                                        className="absolute right-2 top-2 z-10 rounded-full bg-black/60 text-white p-1.5 shadow-sm transition-colors hover:bg-black/75 focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                    {/* Bottom overlay actions */}
                                                    <div className="absolute inset-0 z-0 flex items-end p-3 bg-black/30 opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
                                                        <div className="w-full grid grid-cols-2 gap-2">
                                                            <Button className="w-full" onClick={() => onRequestRerun(step.id)} aria-label="重新生成">
                                                                <RotateCw className="h-4 w-4" />
                                                            </Button>
                                                            <Button className="w-full" onClick={() => downloadByKey(keys[step.id] ?? null, step.id)} aria-label="下載">
                                                                <Download className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="absolute inset-x-0 bottom-0 p-3">
                                                    <div className="w-full grid grid-cols-1 gap-2">
                                                        <Button className="w-full" onClick={() => generateStep(step)} disabled={!refsReady(step) || !!loading[step.id]} aria-label="生成">
                                                            <WandSparkles className="h-4 w-4" />
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
        </div>
    );
}
