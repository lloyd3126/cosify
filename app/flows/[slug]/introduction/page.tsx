import { getFlowBySlug } from "@/server/flows";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeftFromLine, WandSparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { Metadata } from "next";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const flow = getFlowBySlug(slug);
    if (!flow || (flow.metadata?.visibility ?? "public") !== "public") {
        return { title: "流程不存在" };
    }
    const intro = (flow.metadata && (flow.metadata as any).introduction) ?? {};
    const title = intro.title ?? flow.name;
    const description = intro.description ?? flow.metadata?.description ?? "";
    const image = flow.metadata?.thumbnail || "/vercel.svg";
    return {
        title,
        description,
        openGraph: {
            title,
            description,
            images: [image],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [image],
        },
        metadataBase: new URL("http://localhost:3000"),
    };
}
import { IntroductionDemoList } from "@/components/introduction-demo-list";
import { FlowHistoryList, FlowHistoryListRun } from "@/components/flow-history-list";

export const dynamic = "force-dynamic";

export default async function FlowIntroductionPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const flow = getFlowBySlug(slug);
    // 僅允許 public flow
    if (!flow || (flow.metadata?.visibility ?? "public") !== "public") {
        notFound();
    }
    // 權限判斷（僅 public flow 可直接創作，private flow 應導向登入或顯示提示）
    const canStart = (flow.metadata?.visibility ?? "public") === "public";
    const intro = flow.introduction ?? {};
    const title = intro.title ?? flow.name;
    const description = intro.description ?? flow.metadata?.description ?? "";
    // demo runId 陣列（強制 fallback 為 string[]）
    let demoRunIds: string[] = [];
    if (Array.isArray(intro.demo)) {
        demoRunIds = intro.demo.filter((id: any) => typeof id === "string");
    }
    // 取得 demo run 的 items/createdAt 等資訊
    let runs: FlowHistoryListRun[] = [];
    if (demoRunIds.length > 0) {
        // 直接查詢 API 批量取得 items
        const res = await fetch("http://localhost:3000/api/runs/public/items-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ runIds: demoRunIds })
        });
        const data = await res.json();
        // itemsByRun: { runId: [{ r2Key, createdAt, stepId }] }
        runs = demoRunIds.map(runId => {
            const items = Array.isArray(data.itemsByRun?.[runId]) ? data.itemsByRun[runId] : [];
            return {
                runId,
                createdAt: items.length > 0 ? items[0].createdAt : "",
                itemsPreview: items.slice(0, 6).map((it: any) => ({ r2Key: it.r2Key, createdAt: it.createdAt })),
                allItems: items.map((it: any) => ({ r2Key: it.r2Key, createdAt: it.createdAt })), // 新增：所有項目
                itemsTotal: items.length
            };
        });
    }
    return (
        <div className="mx-auto max-w-5xl p-6 space-y-6">
            <div className="mt-8 mb-12">
                <h1 className="text-4xl font-semibold text-center tracking-wide">{title}</h1>
                <p className="text-1xl text-muted-foreground mt-3 text-center tracking-widest">{description}</p>
                <div className="mt-4 flex justify-center gap-2">
                    <Link
                        href="/flows"
                        className="inline-flex items-center rounded-md border p-2 hover:bg-muted"
                        aria-label="返回"
                    >
                        <ArrowLeftFromLine className="h-4 w-4" />
                    </Link>
                    {canStart ? (
                        <Link
                            href={`/flows/${slug}/new`}
                            className="inline-flex items-center rounded-md border p-2 hover:bg-muted"
                            aria-label="開始創作"
                        >
                            <WandSparkles className="h-4 w-4" />
                        </Link>
                    ) : (
                        <Link href="/login">
                            <button className="px-5 py-2 rounded bg-muted text-muted-foreground font-semibold" disabled>請先登入</button>
                        </Link>
                    )}
                </div>

            </div>
            <FlowHistoryList runs={runs} showDelete={false} />
        </div>
    );
}
