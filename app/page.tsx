"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import UploadCard from "@/components/ui/upload-card";
import Image from "next/image";
import useAdaptiveAspect from "@/lib/use-adaptive-aspect";
import { Download, RotateCw, WandSparkles, CircleChevronLeft, CircleChevronRight, X } from "lucide-react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { Toaster, toast } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Me = { id: string; name?: string | null; email?: string | null; image?: string | null } | null;

export default function Home() {
    const aspect = "9 / 16"; // 固定比例 9:16

    // Auth
    const [me, setMe] = useState<Me>(null);
    const [loadingMe, setLoadingMe] = useState(true);

    // Carousel cursor: shows 3 cards at once on md+, 1 card on mobile; moves 1 card per click
    const [cursor, setCursor] = useState<number>(0); // md: 0..3 for 6 items with 3 visible
    const [isMd, setIsMd] = useState<boolean>(false);
    const trackRef = useRef<HTMLDivElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const item0Ref = useRef<HTMLDivElement | null>(null);
    const [stepPx, setStepPx] = useState<number>(0);
    const [itemWidth, setItemWidth] = useState<number>(0);

    useEffect(() => {
        const mq = window.matchMedia("(min-width: 768px)");
        const onChange = () => setIsMd(mq.matches);
        onChange();
        mq.addEventListener?.("change", onChange);
        return () => mq.removeEventListener?.("change", onChange);
    }, []);

    // Step 1/2 uploads
    const [characterFile, setCharacterFile] = useState<File | null>(null); // Step1
    const [selfFile, setSelfFile] = useState<File | null>(null); // Step2

    // Generated keys & UUIDs
    const [stage1Key, setStage1Key] = useState<string | null>(null); // intermediate
    const [stage1Uuid, setStage1Uuid] = useState<string | null>(null);
    const [stage2Key, setStage2Key] = useState<string | null>(null); // outfit
    const [stage2Uuid, setStage2Uuid] = useState<string | null>(null);
    const [stage3Key, setStage3Key] = useState<string | null>(null); // user cosplay
    const [stage3Uuid, setStage3Uuid] = useState<string | null>(null);
    const [stage4Key, setStage4Key] = useState<string | null>(null); // hair swap final
    const [stage4Uuid, setStage4Uuid] = useState<string | null>(null);

    // Loading per stage
    const [loading1, setLoading1] = useState(false);
    const [loading2, setLoading2] = useState(false);
    const [loading3, setLoading3] = useState(false);
    const [loading4, setLoading4] = useState(false);

    // Rerun confirmation dialog control (per step)
    const [confirmRerun, setConfirmRerun] = useState<{ step: 3 | 4 | 5 | 6 | null }>({ step: null });

    // Clear image confirmation (for preview cards)
    const [confirmClear, setConfirmClear] = useState<{ step: 3 | 4 | 5 | 6 | null }>({ step: null });

    // Derived URLs
    const stage1Url = useMemo(() => (stage1Key ? `/api/r2/${stage1Key}` : null), [stage1Key]);
    const stage2Url = useMemo(() => (stage2Key ? `/api/r2/${stage2Key}` : null), [stage2Key]);
    const stage3Url = useMemo(() => (stage3Key ? `/api/r2/${stage3Key}` : null), [stage3Key]);
    const stage4Url = useMemo(() => (stage4Key ? `/api/r2/${stage4Key}` : null), [stage4Key]);

    // Completion flags
    const step1Done = !!characterFile;
    const step2Done = !!selfFile;
    const step3Done = !!stage1Key;
    const step4Done = !!stage2Key;
    const step5Done = !!stage3Key;
    const step6Done = !!stage4Key;

    // Fetch me
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/me", { cache: "no-store" });
                const data = await res.json().catch(() => ({ user: null }));
                if (!cancelled) setMe(data.user ?? null);
            } catch {
                if (!cancelled) setMe(null);
            } finally {
                if (!cancelled) setLoadingMe(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Navigate helpers
    const totalItems = 6;
    const visibleItems = isMd ? 3 : 1;
    const maxCursor = totalItems - visibleItems; // md:3, mobile:5

    const canGoPrev = cursor > 0;
    // 放寬導航：允許自由滑動查看，但操作按鈕仍受前置條件限制（不會跳步執行）
    const allowedMaxCursor = maxCursor;
    const canGoNext = cursor < maxCursor;

    const goPrev = () => { if (canGoPrev) setCursor((c) => Math.max(0, c - 1)); };
    const goNext = () => { if (canGoNext) setCursor((c) => Math.min(allowedMaxCursor, c + 1)); };

    // Measure exact item width to keep full cards visible with gaps
    useEffect(() => {
        const recompute = () => {
            if (!trackRef.current || !containerRef.current) return;
            const containerW = containerRef.current.getBoundingClientRect().width;
            const cs = getComputedStyle(trackRef.current);
            const gapStr = (cs as any).gap || cs.columnGap || cs.rowGap || "0";
            const gap = parseFloat(gapStr) || 0;
            const vis = visibleItems;
            const w = vis > 0 ? Math.max(0, (containerW - gap * (vis - 1)) / vis) : 0;
            setItemWidth(w);
            setStepPx(w + gap);
        };
        recompute();
        const ros: ResizeObserver[] = [];
        if (typeof ResizeObserver !== "undefined") {
            if (containerRef.current) {
                const ro = new ResizeObserver(recompute);
                ro.observe(containerRef.current);
                ros.push(ro);
            }
            if (trackRef.current) {
                const ro2 = new ResizeObserver(recompute);
                ro2.observe(trackRef.current);
                ros.push(ro2);
            }
        }
        window.addEventListener("resize", recompute);
        return () => {
            window.removeEventListener("resize", recompute);
            ros.forEach(r => r.disconnect());
        };
    }, [visibleItems]);

    // Invalidation helpers
    function earliestIncompleteIndex() {
        if (!step1Done) return 0;
        if (!step2Done) return 1;
        if (!step3Done) return 2;
        if (!step4Done) return 3;
        if (!step5Done) return 4;
        if (!step6Done) return 5;
        return 3; // all done → default near end
    }

    function clampCursorForIndex(idx: number) {
        // Ensure target index is visible within current viewport size
        const target = Math.min(Math.max(idx - (visibleItems - 1), 0), maxCursor);
        return Math.min(target, allowedMaxCursor);
    }

    function invalidateFrom(stepIndex: number) {
        if (stepIndex <= 3) { setStage1Key(null); setStage1Uuid(null); }
        if (stepIndex <= 4) { setStage2Key(null); setStage2Uuid(null); }
        if (stepIndex <= 5) { setStage3Key(null); setStage3Uuid(null); }
        if (stepIndex <= 6) { setStage4Key(null); setStage4Uuid(null); }
        const idx = earliestIncompleteIndex();
        setCursor(clampCursorForIndex(idx));
    }

    // Clear handlers
    const onClearStep1 = () => { setCharacterFile(null); invalidateFrom(3); };
    const onClearStep2 = () => { setSelfFile(null); invalidateFrom(5); };
    const onClearStage = (s: 3 | 4 | 5 | 6) => {
        if (s === 3) { setStage1Key(null); setStage1Uuid(null); invalidateFrom(4); }
        if (s === 4) { setStage2Key(null); setStage2Uuid(null); invalidateFrom(5); }
        if (s === 5) { setStage3Key(null); setStage3Uuid(null); invalidateFrom(6); }
        if (s === 6) { setStage4Key(null); setStage4Uuid(null); const idx = earliestIncompleteIndex(); setCursor(clampCursorForIndex(idx)); }
    };

    // API calls
    async function runStage1(rerun = false) {
        if (!me) { toast("請先登入", { description: "請使用右上角 Google 登入" }); return; }
        if (!characterFile) { toast.error("請先上傳角色照"); return; }
        try {
            setLoading1(true);
            const fd = new FormData();
            fd.append("character", characterFile);
            if (rerun && stage1Uuid) fd.append("stepUuid", stage1Uuid);
            const res = await fetch("/api/generate/stage1", { method: "POST", body: fd, cache: "no-store" });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "stage1 失敗");
            setStage1Key(data.key);
            setStage1Uuid(data.stepUuid);
            toast.success(rerun ? "已覆蓋角色扮演照（參考）" : "生成角色扮演照完成");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "stage1 發生錯誤");
        } finally {
            setLoading1(false);
        }
    }

    async function runStage2(rerun = false) {
        if (!me) { toast("請先登入", { description: "請使用右上角 Google 登入" }); return; }
        if (!stage1Key) { toast.error("請先完成：生成角色的扮演照"); return; }
        try {
            setLoading2(true);
            const fd = new FormData();
            fd.append("intermediateKey", stage1Key);
            if (rerun && stage2Uuid) fd.append("stepUuid", stage2Uuid);
            const res = await fetch("/api/generate/stage2", { method: "POST", body: fd, cache: "no-store" });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "stage2 失敗");
            setStage2Key(data.key);
            setStage2Uuid(data.stepUuid);
            toast.success(rerun ? "已覆蓋扮演服（平鋪）" : "生成扮演服完成");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "stage2 發生錯誤");
        } finally {
            setLoading2(false);
        }
    }

    async function runStage3(rerun = false) {
        if (!me) { toast("請先登入", { description: "請使用右上角 Google 登入" }); return; }
        if (!selfFile || !stage2Key) { toast.error("請先完成：上傳扮演者照 與 生成扮演服"); return; }
        try {
            setLoading3(true);
            const fd = new FormData();
            fd.append("user", selfFile);
            fd.append("outfitKey", stage2Key);
            if (rerun && stage3Uuid) fd.append("stepUuid", stage3Uuid);
            const res = await fetch("/api/generate/stage3", { method: "POST", body: fd, cache: "no-store" });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "stage3 失敗");
            setStage3Key(data.key);
            setStage3Uuid(data.stepUuid);
            toast.success(rerun ? "已覆蓋扮演者上身照" : "生成扮演者上身照完成");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "stage3 發生錯誤");
        } finally {
            setLoading3(false);
        }
    }

    async function runStage4(rerun = false) {
        if (!me) { toast("請先登入", { description: "請使用右上角 Google 登入" }); return; }
        if (!stage3Key || !characterFile) { toast.error("請先完成：生成扮演者上身照 與 保持角色照"); return; }
        try {
            setLoading4(true);
            const fd = new FormData();
            fd.append("baseKey", stage3Key);
            fd.append("character", characterFile);
            if (rerun && stage4Uuid) fd.append("stepUuid", stage4Uuid);
            const res = await fetch("/api/generate/stage4", { method: "POST", body: fd, cache: "no-store" });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "stage4 失敗");
            setStage4Key(data.key);
            setStage4Uuid(data.stepUuid);
            toast.success(rerun ? "已覆蓋髮型替換結果" : "髮型替換完成");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "stage4 發生錯誤");
        } finally {
            setLoading4(false);
        }
    }

    // Download helper
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

    // Download originals (step1/2) from File directly
    function downloadFile(file: File | null, name: string | null) {
        if (!file || !name) return;
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        const ext = file.type.includes("png") ? ".png" : file.type.includes("jpeg") ? ".jpg" : "";
        a.href = url; a.download = `${name}${ext}`; a.click();
        URL.revokeObjectURL(url);
    }

    // Rerun flow with alert
    function requestRerun(stepNo: 3 | 4 | 5 | 6) { setConfirmRerun({ step: stepNo }); }
    function confirmRerunNow() {
        if (!confirmRerun.step) return;
        const s = confirmRerun.step;
        setConfirmRerun({ step: null });
        if (s === 3) { runStage1(true); invalidateFrom(4); return; }
        if (s === 4) { runStage2(true); invalidateFrom(5); return; }
        if (s === 5) { runStage3(true); invalidateFrom(6); return; }
        if (s === 6) { runStage4(true); return; }
    }

    // Clear flow with alert
    function requestClear(stepNo: 3 | 4 | 5 | 6) { setConfirmClear({ step: stepNo }); }
    function confirmClearNow() { if (!confirmClear.step) return; const s = confirmClear.step; setConfirmClear({ step: null }); onClearStage(s); }

    // Slide component builders
    const SlideShell: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
        <div className="flex-shrink-0 w-full max-w-6xl">
            <div className="space-y-2">
                {title ? <div className="text-center font-medium">{title}</div> : null}
                {children}
            </div>
        </div>
    );

    return (
        <div className="mx-auto w-full max-w-6xl p-6">
            <Toaster richColors />

            {/* Outer navigation icons */}
            <div className="relative">
                <button
                    type="button"
                    onClick={goPrev}
                    disabled={!canGoPrev}
                    aria-label="上一張"
                    title="上一張"
                    className="absolute -left-12 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-1 disabled:opacity-40"
                >
                    <CircleChevronLeft className="h-7 w-7" />
                </button>
                <button
                    type="button"
                    onClick={goNext}
                    disabled={!canGoNext}
                    aria-label="下一張"
                    title="下一張"
                    className="absolute -right-12 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-1 disabled:opacity-40"
                >
                    <CircleChevronRight className="h-7 w-7" />
                </button>

        {/* Slides container */}
        <div className="overflow-hidden" ref={containerRef}>
                    <div
                        ref={trackRef}
                        className="flex gap-4 transition-transform duration-300 ease-in-out"
                        style={{ transform: stepPx > 0 ? `translateX(${-cursor * stepPx}px)` : undefined }}
                    >
                        {/* Item 0: Step 1 */}
            <div ref={item0Ref} className="shrink-0" style={{ width: itemWidth ? `${itemWidth}px` : undefined }}>
                            <UploadCard label="上傳想扮演的角色照" file={characterFile} onChange={(f) => { setCharacterFile(f); if (!f) onClearStep1(); }} accept="image/*" />
                        </div>

                        {/* Item 1: Step 2 */}
            <div className="shrink-0" style={{ width: itemWidth ? `${itemWidth}px` : undefined }}>
                            <UploadCard label="上傳扮演者的全身照" file={selfFile} onChange={(f) => { setSelfFile(f); if (!f) onClearStep2(); }} accept="image/*" />
                        </div>

                        {/* Item 2: Step 3 */}
            <div className="shrink-0" style={{ width: itemWidth ? `${itemWidth}px` : undefined }}>
                            <div className="space-y-2">
                                <div className="text-center font-medium">生成角色的扮演照</div>
                                <Card className="group relative w-full overflow-hidden rounded-xl border-2 border-muted-foreground/20" style={{ aspectRatio: aspect }}>
                                    {loading1 ? (
                                        <div className="absolute inset-0 grid place-items-center">
                                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground" />
                                        </div>
                                    ) : stage1Url ? (
                                        <>
                                            <Image src={stage1Url} alt="stage1" fill className="object-cover" />
                                            {/* Top-right clear button */}
                                            <button
                                                type="button"
                                                onClick={() => requestClear(3)}
                                                aria-label="清除結果"
                                                className="absolute right-2 top-2 z-10 rounded-full bg-black/60 text-white p-1.5 shadow-sm transition-colors hover:bg-black/75 focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                            <div className="absolute inset-0 z-0 flex items-end p-3 bg-black/30 opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
                                                <div className="w-full grid grid-cols-2 gap-2">
                                                    <Button className="w-full" onClick={() => requestRerun(3)} aria-label="重新生成">
                                                        <RotateCw className="h-4 w-4" />
                                                    </Button>
                                                    <Button className="w-full" onClick={() => downloadByKey(stage1Key, stage1Uuid)} aria-label="下載">
                                                        <Download className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="absolute inset-x-0 bottom-0 p-3">
                                            <div className="w-full grid grid-cols-1 gap-2">
                                                <Button className="w-full" onClick={() => runStage1(false)} disabled={!me || !characterFile} aria-label="生成">
                                                    <WandSparkles className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            </div>
                        </div>

                        {/* Item 3: Step 4 */}
                        <div className="shrink-0" style={{ width: itemWidth ? `${itemWidth}px` : undefined }}>
                            <div className="space-y-2">
                                <div className="text-center font-medium">生成角色的扮演服</div>
                                <Card className="group relative w-full overflow-hidden rounded-xl border-2 border-muted-foreground/20" style={{ aspectRatio: aspect }}>
                                    {loading2 ? (
                                        <div className="absolute inset-0 grid place-items-center">
                                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground" />
                                        </div>
                                    ) : stage2Url ? (
                                        <>
                                            <Image src={stage2Url} alt="stage2" fill className="object-cover" />
                                            {/* Top-right clear button */}
                                            <button
                                                type="button"
                                                onClick={() => requestClear(4)}
                                                aria-label="清除結果"
                                                className="absolute right-2 top-2 z-10 rounded-full bg-black/60 text-white p-1.5 shadow-sm transition-colors hover:bg-black/75 focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                            <div className="absolute inset-0 z-0 flex items-end p-3 bg-black/30 opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
                                                <div className="w-full grid grid-cols-2 gap-2">
                                                    <Button className="w-full" onClick={() => requestRerun(4)} aria-label="重新生成">
                                                        <RotateCw className="h-4 w-4" />
                                                    </Button>
                                                    <Button className="w-full" onClick={() => downloadByKey(stage2Key, stage2Uuid)} aria-label="下載">
                                                        <Download className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="absolute inset-x-0 bottom-0 p-3">
                                            <div className="w-full grid grid-cols-1 gap-2">
                                                <Button className="w-full" onClick={() => runStage2(false)} disabled={!me || !stage1Key} aria-label="生成">
                                                    <WandSparkles className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            </div>
                        </div>

                        {/* Item 4: Step 5 */}
                        <div className="shrink-0" style={{ width: itemWidth ? `${itemWidth}px` : undefined }}>
                            <div className="space-y-2">
                                <div className="text-center font-medium">生成扮演者的角色扮演照</div>
                                <Card className="group relative w-full overflow-hidden rounded-xl border-2 border-muted-foreground/20" style={{ aspectRatio: aspect }}>
                                    {loading3 ? (
                                        <div className="absolute inset-0 grid place-items-center">
                                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground" />
                                        </div>
                                    ) : stage3Url ? (
                                        <>
                                            <Image src={stage3Url} alt="stage3" fill className="object-cover" />
                                            {/* Top-right clear button */}
                                            <button
                                                type="button"
                                                onClick={() => requestClear(5)}
                                                aria-label="清除結果"
                                                className="absolute right-2 top-2 z-10 rounded-full bg-black/60 text-white p-1.5 shadow-sm transition-colors hover:bg-black/75 focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                            <div className="absolute inset-0 z-0 flex items-end p-3 bg-black/30 opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
                                                <div className="w-full grid grid-cols-2 gap-2">
                                                    <Button className="w-full" onClick={() => requestRerun(5)} aria-label="重新生成">
                                                        <RotateCw className="h-4 w-4" />
                                                    </Button>
                                                    <Button className="w-full" onClick={() => downloadByKey(stage3Key, stage3Uuid)} aria-label="下載">
                                                        <Download className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="absolute inset-x-0 bottom-0 p-3">
                                            <div className="w-full grid grid-cols-1 gap-2">
                                                <Button className="w-full" onClick={() => runStage3(false)} disabled={!me || !selfFile || !stage2Key} aria-label="生成">
                                                    <WandSparkles className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            </div>
                        </div>

                        {/* Item 5: Step 6 */}
                        <div className="shrink-0" style={{ width: itemWidth ? `${itemWidth}px` : undefined }}>
                            <div className="space-y-2">
                                <div className="text-center font-medium">更換扮演者的髮型</div>
                                <Card className="group relative w-full overflow-hidden rounded-xl border-2 border-muted-foreground/20" style={{ aspectRatio: aspect }}>
                                    {loading4 ? (
                                        <div className="absolute inset-0 grid place-items-center">
                                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground" />
                                        </div>
                                    ) : stage4Url ? (
                                        <>
                                            <Image src={stage4Url} alt="stage4" fill className="object-cover" />
                                            {/* Top-right clear button */}
                                            <button
                                                type="button"
                                                onClick={() => requestClear(6)}
                                                aria-label="清除結果"
                                                className="absolute right-2 top-2 z-10 rounded-full bg-black/60 text-white p-1.5 shadow-sm transition-colors hover:bg-black/75 focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                            <div className="absolute inset-0 z-0 flex items-end p-3 bg-black/30 opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
                                                <div className="w-full grid grid-cols-2 gap-2">
                                                    <Button className="w-full" onClick={() => requestRerun(6)} aria-label="重新生成">
                                                        <RotateCw className="h-4 w-4" />
                                                    </Button>
                                                    <Button className="w-full" onClick={() => downloadByKey(stage4Key, stage4Uuid)} aria-label="下載">
                                                        <Download className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="absolute inset-x-0 bottom-0 p-3">
                                            <div className="w-full grid grid-cols-1 gap-2">
                                                <Button className="w-full" onClick={() => runStage4(false)} disabled={!me || !stage3Key || !characterFile} aria-label="生成">
                                                    <WandSparkles className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Rerun overwrite dialog */}
            <ConfirmDialog
                open={!!confirmRerun.step}
                title="將覆蓋這一步的現有結果"
                description="此動作會覆蓋本步結果，並使後續步驟的結果失效，需要重新生成。"
                confirmText="覆蓋並重跑"
                cancelText="取消"
                onCancel={() => setConfirmRerun({ step: null })}
                onConfirm={confirmRerunNow}
            />

            {/* Clear dialog */}
            <ConfirmDialog
                open={!!confirmClear.step}
                title="清除這一步的結果？"
                description="此動作無法復原，且會使後續步驟結果失效。"
                confirmText="清除"
                cancelText="取消"
                onCancel={() => setConfirmClear({ step: null })}
                onConfirm={confirmClearNow}
            />
        </div>
    );
}
