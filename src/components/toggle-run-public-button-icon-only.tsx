// 可選的 icon-only 版本，與其他按鈕樣式一致

import useSWRMutation from "swr/mutation";
import { useState } from "react";
import { Globe, GlobeLock } from 'lucide-react';
import { Button } from "@/components/ui/button";

export function ToggleRunPublicButton({ runId, initialPublic = false }: { runId: string; initialPublic?: boolean }) {
    const [isPublic, setIsPublic] = useState(initialPublic);
    const { trigger, isMutating } = useSWRMutation(`/api/runs/${runId}/public`, async (url, { arg }: { arg: boolean }) => {
        const res = await fetch(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ public: arg }),
        });
        if (!res.ok) throw new Error("更新失敗");
        return arg;
    });

    return (
        <Button
            size="icon"
            variant="outline"
            disabled={isMutating}
            className={isPublic ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}
            onClick={async () => {
                try {
                    const next = !isPublic;
                    await trigger(next);
                    setIsPublic(next);
                } catch (e) {
                    alert("切換失敗");
                }
            }}
            aria-label={isPublic ? "設為私密" : "設為公開"}
        >
            {isPublic ? (
                <Globe className="h-4 w-4" />
            ) : (
                <GlobeLock className="h-4 w-4" />
            )}
        </Button>
    );
}
