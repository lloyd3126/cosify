import useSWR from "swr";
import Image from "next/image";

export function DemoRunPreview({ runId }: { runId: string }) {
    // 取得公開 runId items
    const { data, error, isLoading } = useSWR(`/api/runs/public/${runId}/items`, async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Not found");
        return await res.json();
    });
    if (isLoading) return <div className="text-xs text-muted-foreground">載入中...</div>;
    if (error || !data?.items) {
        if (typeof window !== "undefined") {
            window.location.href = "/404";
        }
        return <div className="text-xs text-destructive">Demo 不公開或不存在</div>;
    }
    if (data.items.length === 0) return <div className="text-xs text-muted-foreground">無預覽項目</div>;
    return (
        <div className="flex gap-2 overflow-x-auto py-2">
            {data.items.map((item: any) => (
                <div key={item.r2Key} className="w-24 h-24 relative border rounded">
                    <Image src={`/api/r2/${item.r2Key}`} alt={item.r2Key} fill className="object-cover rounded" />
                </div>
            ))}
        </div>
    );
}
