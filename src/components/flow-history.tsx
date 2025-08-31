"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { toast, Toaster } from "sonner";

type Props = { slug: string; flowName: string };

type Run = { runId: string; createdAt: string; steps: Array<{ stepId: string; r2Key: string | null }> };

export default function FlowHistory({ slug, flowName }: Props) {
    const [runs, setRuns] = useState<Run[]>([]);
    const [loading, setLoading] = useState(false);

    async function load() {
        setLoading(true);
        try {
            const res = await fetch(`/api/flows/${slug}/history`, { cache: "no-store" });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "讀取歷史失敗");
            setRuns(data.runs || []);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "讀取歷史失敗");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load(); // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug]);

    async function remove(runId: string) {
        if (!confirm("確定刪除這次執行的所有產物？此動作無法復原。")) return;
        try {
            const res = await fetch(`/api/flows/${slug}/history/${runId}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "刪除失敗");
            toast.success("已刪除");
            await load();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "刪除失敗");
        }
    }

    return (
        <div className="mx-auto max-w-5xl p-6 space-y-6">
            <Toaster richColors />
            <h1 className="text-2xl font-semibold">歷史紀錄 - {flowName}</h1>
            {loading ? <div className="text-sm text-muted-foreground">載入中…</div> : null}
            <div className="space-y-4">
                {runs.map((r) => (
                    <Card key={r.runId} className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</div>
                            <Button variant="destructive" onClick={() => remove(r.runId)}>刪除</Button>
                        </div>
                        <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
                            {r.steps.filter(s => !!s.r2Key).map((s) => (
                                <div key={s.stepId} className="relative w-full" style={{ aspectRatio: "9 / 16" }}>
                                    <Image src={`/api/r2/${s.r2Key!}`} alt={s.stepId} fill className="object-cover rounded" />
                                </div>
                            ))}
                        </div>
                    </Card>
                ))}
                {runs.length === 0 ? <div className="text-sm text-muted-foreground">尚無紀錄</div> : null}
            </div>
        </div>
    );
}
