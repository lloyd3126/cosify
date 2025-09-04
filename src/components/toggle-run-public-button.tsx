import useSWRMutation from "swr/mutation";
import { useState } from "react";

export function ToggleRunPublicButton({ runId, initialPublic }: { runId: string; initialPublic: boolean }) {
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
        <button
            className={`px-3 py-1 rounded border ${isPublic ? "bg-green-100" : "bg-gray-100"}`}
            disabled={isMutating}
            onClick={async () => {
                try {
                    const next = !isPublic;
                    await trigger(next);
                    setIsPublic(next);
                } catch (e) {
                    alert("切換失敗");
                }
            }}
        >
            {isPublic ? "已公開" : "未公開"}
        </button>
    );
}
