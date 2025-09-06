"use client";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { useState, useEffect } from "react";
import { Globe, GlobeLock } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TogglePublicConfirmModal } from "@/components/ui/toggle-public-confirm-modal";

const fetcher = (url: string) => fetch(url).then(res => {
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
});

export function ToggleRunPublicButton({ runId, initialPublic = false }: { runId: string; initialPublic?: boolean }) {
    const [isPublic, setIsPublic] = useState(initialPublic);
    const [showModal, setShowModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // 獲取當前公開狀態
    const { data, error } = useSWR(`/api/runs/${runId}/public`, fetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false
    });

    // 更新公開狀態
    const { trigger, isMutating } = useSWRMutation(`/api/runs/${runId}/public`, async (url, { arg }: { arg: boolean }) => {
        const res = await fetch(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ public: arg }),
        });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || "更新失敗");
        }
        const result = await res.json();
        return result.public;
    });

    // 當 API 數據載入時更新狀態
    useEffect(() => {
        if (data && typeof data.public === "boolean") {
            setIsPublic(data.public);
        }
    }, [data]);

    // 如果載入失敗且沒有初始值，使用預設值
    if (error && !data) {
        console.warn("無法載入 run 公開狀態:", error);
    }

    const handleToggle = async () => {
        try {
            const next = !isPublic;
            const result = await trigger(next);
            setIsPublic(result);
            setShowModal(false);

            if (result) {
                // 如果設為公開成功，顯示包含分享連結的成功 modal
                toast.success("已設為公開");
                setShowSuccessModal(true);
            } else {
                // 如果設為私密，直接顯示成功訊息
                toast.success("已設為私密");
            }
        } catch (e) {
            console.error("切換公開狀態失敗:", e);
            toast.error(e instanceof Error ? e.message : "切換失敗");
            setShowModal(false);
        }
    };

    return (
        <>
            <Button
                size="icon"
                variant="outline"
                disabled={isMutating}
                onClick={() => setShowModal(true)}
                aria-label={isPublic ? "設為私密" : "設為公開"}
                title={isPublic ? "設為私密" : "設為公開"}
            >
                {isPublic ? (
                    <Globe className="h-4 w-4" />
                ) : (
                    <GlobeLock className="h-4 w-4" />
                )}
            </Button>

            {/* 確認 Modal */}
            <TogglePublicConfirmModal
                open={showModal}
                runId={runId}
                currentlyPublic={isPublic}
                onConfirm={handleToggle}
                onCancel={() => setShowModal(false)}
            />

            {/* 成功分享 Modal - 只在設為公開成功後顯示 */}
            <TogglePublicConfirmModal
                open={showSuccessModal}
                runId={runId}
                currentlyPublic={true} // 此時已經是公開狀態
                onConfirm={() => setShowSuccessModal(false)}
                onCancel={() => setShowSuccessModal(false)}
                isSuccessMode={true}
            />
        </>
    );
}
