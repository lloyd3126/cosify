"use client";
import React from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { ToggleRunPublicButton } from "@/components/toggle-run-public-button";
import { ShareRunIdButton } from "@/components/share-runid-button";
import { getOptimizedImageUrl } from "@/lib/image-utils";

const DemoRunPreview = dynamic(() => import("@/components/demo-run-preview").then(mod => ({ default: mod.DemoRunPreview })), { ssr: false });

export function IntroductionDemoList({ demoRunIds }: { demoRunIds: string[] }) {
    console.log('IntroductionDemoList demoRunIds:', demoRunIds);
    const [itemsByRun, setItemsByRun] = React.useState<Record<string, Array<{ r2Key: string; createdAt: string; stepId: string }>>>({});
    const [loading, setLoading] = React.useState(true);
    React.useEffect(() => {
        if (!demoRunIds.length) return;
        setLoading(true);
        fetch("/api/runs/public/items-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ runIds: demoRunIds })
        })
            .then(res => res.json())
            .then(data => {
                setItemsByRun(data.itemsByRun || {});
            })
            .finally(() => setLoading(false));
    }, [demoRunIds]);

    const validRunIds = demoRunIds.filter(runId => Array.isArray(itemsByRun[runId]) && itemsByRun[runId].length > 0);

    if (loading) {
        return <div className="text-sm text-muted-foreground">載入中…</div>;
    }
    if (!validRunIds.length) {
        return <div className="text-sm text-muted-foreground">尚無範例</div>;
    }
    return (
        <div className="space-y-4">
            {validRunIds.map(runId => (
                <div key={runId} className="border rounded-lg p-4 mb-2">
                    <div className="flex items-center justify-end gap-2 mb-2">
                        {/* 分享按鈕置右，移除文字與公開狀態 */}
                        <ShareRunIdButton runId={runId} />
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {itemsByRun[runId]?.slice(0, 5).map(item => (
                            <div key={item.r2Key} className="w-32 h-32 relative overflow-hidden rounded border">
                                <Image
                                    src={getOptimizedImageUrl(item.r2Key, { width: 300, quality: 80 })}
                                    alt={`Demo ${runId}`}
                                    fill
                                    className="object-cover"
                                    sizes="128px"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
