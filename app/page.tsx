"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import UploadCard from "@/components/ui/upload-card";
import Image from "next/image";
import { Download, RotateCw, WandSparkles, X } from "lucide-react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { Toaster, toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import HorizontalCarousel from "@/components/ui/horizontal-carousel";

// Home page carousel using shared HorizontalCarousel
// Steps: 1) upload character, 2) upload self, 3) generate cosplay ref, 4) generate outfit, 5) generate user cosplay, 6) hair swap

type Me = { id: string; name?: string | null; email?: string | null; image?: string | null } | null;

export default function Home() {
    const aspect = "9 / 16";

    // Auth
    const [me, setMe] = useState<Me>(null);
    const [loadingMe, setLoadingMe] = useState(true);

    // Uploads
    const [characterFile, setCharacterFile] = useState<File | null>(null);
    const [selfFile, setSelfFile] = useState<File | null>(null);

    // Generated keys & uuids
    const [stage1Key, setStage1Key] = useState<string | null>(null);
    const [stage1Uuid, setStage1Uuid] = useState<string | null>(null);
    const [stage2Key, setStage2Key] = useState<string | null>(null);
    const [stage2Uuid, setStage2Uuid] = useState<string | null>(null);
    const [stage3Key, setStage3Key] = useState<string | null>(null);
    const [stage3Uuid, setStage3Uuid] = useState<string | null>(null);
    const [stage4Key, setStage4Key] = useState<string | null>(null);
    const [stage4Uuid, setStage4Uuid] = useState<string | null>(null);

    // Loading flags
    const [loading1, setLoading1] = useState(false);
    const [loading2, setLoading2] = useState(false);
    const [loading3, setLoading3] = useState(false);
    const [loading4, setLoading4] = useState(false);

    // Confirm dialogs
    const [confirmRerun, setConfirmRerun] = useState<{ step: 3 | 4 | 5 | 6 | null }>({ step: null });
    const [confirmClear, setConfirmClear] = useState<{ step: 3 | 4 | 5 | 6 | null }>({ step: null });

    const stage1Url = useMemo(() => (stage1Key ? `/api/r2/${stage1Key}` : null), [stage1Key]);
    const stage2Url = useMemo(() => (stage2Key ? `/api/r2/${stage2Key}` : null), [stage2Key]);
    const stage3Url = useMemo(() => (stage3Key ? `/api/r2/${stage3Key}` : null), [stage3Key]);
    const stage4Url = useMemo(() => (stage4Key ? `/api/r2/${stage4Key}` : null), [stage4Key]);

    // Fetch current user
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

    // Invalidation helpers
    function invalidateFrom(stepIndex: number) {
        if (stepIndex <= 3) { setStage1Key(null); setStage1Uuid(null); }
        if (stepIndex <= 4) { setStage2Key(null); setStage2Uuid(null); }
        if (stepIndex <= 5) { setStage3Key(null); setStage3Uuid(null); }
        if (stepIndex <= 6) { setStage4Key(null); setStage4Uuid(null); }
    }
    const onClearStep1 = () => { setCharacterFile(null); invalidateFrom(3); };
    const onClearStep2 = () => { setSelfFile(null); invalidateFrom(5); };

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
        if (!stage1Key) { toast.error("請先完成前一步"); return; }
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
            toast.success(rerun ? "已覆蓋扮演服" : "生成角色的扮演服完成");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "stage2 發生錯誤");
        } finally {
            setLoading2(false);
        }
    }

    async function runStage3(rerun = false) {
        if (!me) { toast("請先登入", { description: "請使用右上角 Google 登入" }); return; }
        if (!selfFile || !stage2Key) { toast.error("請先完成前一步"); return; }
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
            toast.success(rerun ? "已覆蓋扮演者角色照" : "生成扮演者角色照完成");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "stage3 發生錯誤");
        } finally {
            setLoading3(false);
        }
    }

    async function runStage4(rerun = false) {
        if (!me) { toast("請先登入", { description: "請使用右上角 Google 登入" }); return; }
        if (!stage3Key || !characterFile) { toast.error("請先完成前一步"); return; }
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
            toast.success(rerun ? "已覆蓋髮型替換" : "髮型替換完成");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "stage4 發生錯誤");
        } finally {
            setLoading4(false);
        }
    }

    // Rerun/Clear flows
    function requestRerun(step: 3 | 4 | 5 | 6) { setConfirmRerun({ step }); }
    function confirmRerunNow() {
        const s = confirmRerun.step; if (!s) return; setConfirmRerun({ step: null });
        if (s === 3) { setStage1Key(null); runStage1(true); }
        if (s === 4) { setStage2Key(null); runStage2(true); }
        if (s === 5) { setStage3Key(null); runStage3(true); }
        if (s === 6) { setStage4Key(null); runStage4(true); }
    }
    function requestClear(step: 3 | 4 | 5 | 6) { setConfirmClear({ step }); }
    function confirmClearNow() {
        const s = confirmClear.step; if (!s) return; setConfirmClear({ step: null });
        if (s === 3) { setStage1Key(null); invalidateFrom(4); }
        if (s === 4) { setStage2Key(null); invalidateFrom(5); }
        if (s === 5) { setStage3Key(null); invalidateFrom(6); }
        if (s === 6) { setStage4Key(null); }
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

    return (
        <div className="mx-auto w-full max-w-6xl p-6">
            <Toaster richColors />

            <HorizontalCarousel
                items={[0, 1, 2, 3, 4, 5]}
                renderItem={(idx) => {
                    if (idx === 0) {
                        return (
                            <UploadCard label="上傳想扮演的角色照" file={characterFile} onChange={(f) => { setCharacterFile(f); if (!f) onClearStep1(); }} accept="image/*" />
                        );
                    }
                    if (idx === 1) {
                        return (
                            <UploadCard label="上傳扮演者的全身照" file={selfFile} onChange={(f) => { setSelfFile(f); if (!f) onClearStep2(); }} accept="image/*" />
                        );
                    }
                    if (idx === 2) {
                        return (
                            <div className="space-y-2">
                                <div className="text-center font-medium">生成角色的扮演照</div>
                                <Card className="group relative w-full overflow-hidden rounded-xl border-2 border-muted-foreground/20" style={{ aspectRatio: aspect }}>
                                    {loading1 ? (
                                        <div className="absolute inset-0 grid place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground" /></div>
                                    ) : stage1Url ? (
                                        <>
                                            <Image src={stage1Url} alt="stage1" fill className="object-cover" />
                                            <button type="button" onClick={() => requestClear(3)} aria-label="清除結果" className="absolute right-2 top-2 z-10 rounded-full bg-black/60 text-white p-1.5 shadow-sm transition-colors hover:bg-black/75 focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"><X className="h-4 w-4" /></button>
                                            <div className="absolute inset-0 z-0 flex items-end p-3 bg-black/30 opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"><div className="w-full grid grid-cols-2 gap-2"><Button className="w-full" onClick={() => requestRerun(3)} aria-label="重新生成"><RotateCw className="h-4 w-4" /></Button><Button className="w-full" onClick={() => downloadByKey(stage1Key, stage1Uuid)} aria-label="下載"><Download className="h-4 w-4" /></Button></div></div>
                                        </>
                                    ) : (
                                        <div className="absolute inset-x-0 bottom-0 p-3"><div className="w-full grid grid-cols-1 gap-2"><Button className="w-full" onClick={() => runStage1(false)} disabled={!me || !characterFile} aria-label="生成"><WandSparkles className="h-4 w-4" /></Button></div></div>
                                    )}
                                </Card>
                            </div>
                        );
                    }
                    if (idx === 3) {
                        return (
                            <div className="space-y-2">
                                <div className="text-center font-medium">生成角色的扮演服</div>
                                <Card className="group relative w-full overflow-hidden rounded-xl border-2 border-muted-foreground/20" style={{ aspectRatio: aspect }}>
                                    {loading2 ? (
                                        <div className="absolute inset-0 grid place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground" /></div>
                                    ) : stage2Url ? (
                                        <>
                                            <Image src={stage2Url} alt="stage2" fill className="object-cover" />
                                            <button type="button" onClick={() => requestClear(4)} aria-label="清除結果" className="absolute right-2 top-2 z-10 rounded-full bg-black/60 text-white p-1.5 shadow-sm transition-colors hover:bg-black/75 focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"><X className="h-4 w-4" /></button>
                                            <div className="absolute inset-0 z-0 flex items-end p-3 bg-black/30 opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"><div className="w-full grid grid-cols-2 gap-2"><Button className="w-full" onClick={() => requestRerun(4)} aria-label="重新生成"><RotateCw className="h-4 w-4" /></Button><Button className="w-full" onClick={() => downloadByKey(stage2Key, stage2Uuid)} aria-label="下載"><Download className="h-4 w-4" /></Button></div></div>
                                        </>
                                    ) : (
                                        <div className="absolute inset-x-0 bottom-0 p-3"><div className="w-full grid grid-cols-1 gap-2"><Button className="w-full" onClick={() => runStage2(false)} disabled={!me || !stage1Key} aria-label="生成"><WandSparkles className="h-4 w-4" /></Button></div></div>
                                    )}
                                </Card>
                            </div>
                        );
                    }
                    if (idx === 4) {
                        return (
                            <div className="space-y-2">
                                <div className="text-center font-medium">生成扮演者的角色扮演照</div>
                                <Card className="group relative w-full overflow-hidden rounded-xl border-2 border-muted-foreground/20" style={{ aspectRatio: aspect }}>
                                    {loading3 ? (
                                        <div className="absolute inset-0 grid place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground" /></div>
                                    ) : stage3Url ? (
                                        <>
                                            <Image src={stage3Url} alt="stage3" fill className="object-cover" />
                                            <button type="button" onClick={() => requestClear(5)} aria-label="清除結果" className="absolute right-2 top-2 z-10 rounded-full bg-black/60 text-white p-1.5 shadow-sm transition-colors hover:bg-black/75 focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"><X className="h-4 w-4" /></button>
                                            <div className="absolute inset-0 z-0 flex items-end p-3 bg-black/30 opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"><div className="w-full grid grid-cols-2 gap-2"><Button className="w-full" onClick={() => requestRerun(5)} aria-label="重新生成"><RotateCw className="h-4 w-4" /></Button><Button className="w-full" onClick={() => downloadByKey(stage3Key, stage3Uuid)} aria-label="下載"><Download className="h-4 w-4" /></Button></div></div>
                                        </>
                                    ) : (
                                        <div className="absolute inset-x-0 bottom-0 p-3"><div className="w-full grid grid-cols-1 gap-2"><Button className="w-full" onClick={() => runStage3(false)} disabled={!me || !selfFile || !stage2Key} aria-label="生成"><WandSparkles className="h-4 w-4" /></Button></div></div>
                                    )}
                                </Card>
                            </div>
                        );
                    }
                    // idx === 5
                    return (
                        <div className="space-y-2">
                            <div className="text-center font-medium">更換扮演者的髮型</div>
                            <Card className="group relative w-full overflow-hidden rounded-xl border-2 border-muted-foreground/20" style={{ aspectRatio: aspect }}>
                                {loading4 ? (
                                    <div className="absolute inset-0 grid place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground" /></div>
                                ) : stage4Url ? (
                                    <>
                                        <Image src={stage4Url} alt="stage4" fill className="object-cover" />
                                        <button type="button" onClick={() => requestClear(6)} aria-label="清除結果" className="absolute right-2 top-2 z-10 rounded-full bg-black/60 text-white p-1.5 shadow-sm transition-colors hover:bg-black/75 focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"><X className="h-4 w-4" /></button>
                                        <div className="absolute inset-0 z-0 flex items-end p-3 bg-black/30 opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"><div className="w-full grid grid-cols-2 gap-2"><Button className="w-full" onClick={() => requestRerun(6)} aria-label="重新生成"><RotateCw className="h-4 w-4" /></Button><Button className="w-full" onClick={() => downloadByKey(stage4Key, stage4Uuid)} aria-label="下載"><Download className="h-4 w-4" /></Button></div></div>
                                    </>
                                ) : (
                                    <div className="absolute inset-x-0 bottom-0 p-3"><div className="w-full grid grid-cols-1 gap-2"><Button className="w-full" onClick={() => runStage4(false)} disabled={!me || !stage3Key || !characterFile} aria-label="生成"><WandSparkles className="h-4 w-4" /></Button></div></div>
                                )}
                            </Card>
                        </div>
                    );
                }}
            />

            {/* Rerun dialog */}
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
