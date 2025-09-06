"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Globe, GlobeLock, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface TogglePublicConfirmModalProps {
    open: boolean;
    runId: string;
    currentlyPublic: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    isSuccessMode?: boolean; // 新增：是否為成功分享模式
}

export function TogglePublicConfirmModal({
    open,
    runId,
    currentlyPublic,
    onConfirm,
    onCancel,
    isSuccessMode = false
}: TogglePublicConfirmModalProps) {
    const [copied, setCopied] = useState(false);

    if (!open) return null;

    const willBePublic = !currentlyPublic;
    const shareUrl = `${window.location.origin}/runs/public/${runId}`;

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            toast.success("分享連結已複製");
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error("複製失敗");
        }
    };

    const openInNewTab = () => {
        window.open(shareUrl, '_blank');
    };

    // 成功模式：顯示分享連結
    if (isSuccessMode) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div
                    className="absolute inset-0 bg-black/50"
                    onClick={onCancel}
                />

                <Card className="relative w-full max-w-md mx-4 p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <Globe className="h-6 w-6 text-green-600" />
                        <h2 className="text-lg font-semibold">已設為公開</h2>
                    </div>

                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                            執行結果已成功設為公開，任何人都可以透過以下連結查看。
                        </p>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">分享連結</label>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 p-2 bg-muted rounded-md text-sm font-mono truncate border">
                                    {shareUrl}
                                </div>
                                <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={copyToClipboard}
                                    className="shrink-0"
                                    title="複製連結"
                                >
                                    <Copy className={`h-4 w-4 transition-colors ${copied ? 'text-green-600' : ''}`} />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={openInNewTab}
                                    className="shrink-0"
                                    title="在新分頁開啟"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="flex pt-2">
                        <Button
                            onClick={onCancel}
                            className="w-full"
                        >
                            關閉
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* 背景遮罩 */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={onCancel}
            />

            {/* Modal 內容 */}
            <Card className="relative w-full max-w-md mx-4 p-6 space-y-4">
                <div className="flex items-center gap-3">
                    {willBePublic ? (
                        <Globe className="h-6 w-6 text-green-600" />
                    ) : (
                        <GlobeLock className="h-6 w-6 text-gray-600" />
                    )}
                    <h2 className="text-lg font-semibold">
                        {willBePublic ? "設為公開" : "設為私密"}
                    </h2>
                </div>

                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        {willBePublic
                            ? "設為公開後，任何人都可以透過分享連結查看此執行結果。"
                            : "設為私密後，只有您可以查看此執行結果，分享連結將失效。"
                        }
                    </p>

                    {/* 只在目前是公開且要設為私密時顯示當前連結 */}
                    {currentlyPublic && !willBePublic && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">目前的分享連結</label>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 p-2 bg-muted rounded-md text-sm font-mono truncate border">
                                    {shareUrl}
                                </div>
                                <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={copyToClipboard}
                                    className="shrink-0"
                                    title="複製連結"
                                >
                                    <Copy className={`h-4 w-4 transition-colors ${copied ? 'text-green-600' : ''}`} />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={openInNewTab}
                                    className="shrink-0"
                                    title="在新分頁開啟"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                                <p className="text-sm text-yellow-800">
                                    ⚠️ 設為私密後，此分享連結將無法使用。
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-2 pt-2">
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        className="flex-1"
                    >
                        取消
                    </Button>
                    <Button
                        onClick={onConfirm}
                        className="flex-1"
                        variant={willBePublic ? "default" : "destructive"}
                    >
                        {willBePublic ? "確認公開" : "確認私密"}
                    </Button>
                </div>
            </Card>
        </div>
    );
}
