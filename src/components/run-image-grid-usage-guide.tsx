// RunImageGrid 使用指南
// 所有功能預設為 false，需要時明確啟用

import { RunImageGrid, type RunImageGridConfig } from "@/components/run-image-grid";

// 1. 最簡配置 - 只顯示圖片，無任何功能
const minimalConfig: RunImageGridConfig = {
    // 不設定任何 show* 屬性，全部使用預設 false
};

// 2. 純展示模式 - 適合首頁/介紹頁
const displayConfig: RunImageGridConfig = {
    showShare: true,           // 只啟用分享功能
    maxPreviewItems: 5,        // 顯示 5 張圖片
    gridCols: {
        mobile: 3,
        tablet: 4,
        desktop: 5
    }
};

// 3. 瀏覽模式 - 適合瀏覽頁面
const browseConfig: RunImageGridConfig = {
    showShare: true,
    showLightbox: true,        // 啟用 lightbox 預覽
    showDownload: true,        // 啟用下載
    showTimestamp: true,       // 顯示時間戳
    maxPreviewItems: 6
};

// 4. 管理模式 - 適合個人管理頁
const manageConfig: RunImageGridConfig = {
    showShare: true,
    showDelete: true,          // 啟用刪除
    showSettings: true,        // 啟用設定選單
    showDownload: true,
    showExpand: true,          // 啟用展開/收合
    showLightbox: true,
    showTimestamp: true
};

// 5. 完整功能模式 - 管理員頁面
const adminConfig: RunImageGridConfig = {
    showShare: true,
    showDelete: true,
    showSettings: true,
    showDownload: true,
    showExpand: true,
    showLightbox: true,
    showPlay: true,            // 啟用播放按鈕
    showTogglePublic: true,    // 啟用公開/私密切換
    showTimestamp: true,
    cardClassName: "border-2", // 自訂樣式
    onImageClick: (runId, r2Key) => {
        console.log("Admin clicked:", runId, r2Key);
    },
    onPlay: (runId) => {
        console.log("Admin play:", runId);
    },
    onDelete: (runId) => {
        console.log("Admin delete:", runId);
    }
};

// 6. 自訂回調模式 - 特殊互動需求
const customCallbackConfig: RunImageGridConfig = {
    showShare: true,
    showExpand: true,
    // 不啟用內建 lightbox，使用自訂處理
    onImageClick: (runId, r2Key) => {
        // 自訂圖片點擊邏輯
        window.open(`/custom-viewer/${runId}/${r2Key}`, '_blank');
    },
    onToggleExpand: (runId) => {
        // 自訂展開邏輯
        console.log("Custom expand logic for:", runId);
    }
};

// 使用範例：
export function ExampleUsage({ runs }: { runs: any[] }) {
    return (
        <>
            {/* 首頁展示 */}
            <RunImageGrid runs={runs} config={displayConfig} />

            {/* 瀏覽頁面 */}
            <RunImageGrid runs={runs} config={browseConfig} />

            {/* 管理頁面 */}
            <RunImageGrid runs={runs} config={manageConfig} />
        </>
    );
}
