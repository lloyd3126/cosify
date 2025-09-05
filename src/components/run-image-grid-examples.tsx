// 使用範例：替代 IntroductionDemoList

"use client";
import React from "react";
import { RunImageGrid, type RunImageGridRun, type RunImageGridConfig } from "@/components/run-image-grid";

export function IntroductionDemoList({ demoRunIds }: { demoRunIds: string[] }) {
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

    // 轉換資料格式
    const runs: RunImageGridRun[] = validRunIds.map(runId => ({
        runId,
        createdAt: new Date().toISOString(), // 或從 API 獲取真實時間
        itemsPreview: itemsByRun[runId] || [],
        itemsTotal: itemsByRun[runId]?.length || 0,
        allItems: itemsByRun[runId] || []
    }));

    // 配置：簡潔的示範模式 - 明確啟用需要的功能
    const config: RunImageGridConfig = {
        showShare: true,        // 啟用分享按鈕
        // 其他功能保持預設 false
        maxPreviewItems: 5,     // 最多顯示 5 張圖片
        gridCols: {
            mobile: 5,          // 手機 5 欄（保持原有設計）
            tablet: 5,
            desktop: 5
        }
    };

    return <RunImageGrid runs={runs} config={config} />;
}

// 使用範例：替代 FlowHistoryList

import { type FlowHistoryListRun } from "@/components/flow-history-list";

export function FlowHistoryList({
    runs: originalRuns,
    showDelete = true,
    onToggleExpand,
    currentExpanded,
    onImageClick
}: {
    runs: FlowHistoryListRun[],
    showDelete?: boolean,
    onToggleExpand?: (runId: string) => void,
    currentExpanded?: Record<string, boolean>,
    onImageClick?: (runId: string, r2Key: string) => void
}) {
    // 轉換資料格式
    const runs: RunImageGridRun[] = originalRuns.map(run => ({
        runId: run.runId,
        createdAt: run.createdAt,
        itemsPreview: run.itemsPreview,
        itemsTotal: run.itemsTotal,
        allItems: run.allItems
    }));

    // 配置：完整的管理模式 - 明確啟用需要的功能
    const config: RunImageGridConfig = {
        showShare: true,
        showDelete: showDelete,
        showSettings: showDelete,    // 設定選單跟隨 showDelete
        showDownload: true,
        showExpand: true,
        showLightbox: true,
        showPlay: true,
        showTimestamp: true,
        maxPreviewItems: 6,          // 預覽時的圖片數
        gridCols: {
            mobile: 3,
            tablet: 5,
            desktop: 6
        },
        onImageClick: onImageClick,
        onToggleExpand: onToggleExpand
    };

    return <RunImageGrid runs={runs} config={config} currentExpanded={currentExpanded} />;
}
