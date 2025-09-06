import { getFlowBySlug } from "@/server/flows";
import { headers } from "next/headers";
import Link from "next/link";
import { List, WandSparkles } from "lucide-react";
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
import { RunImageGrid, type RunImageGridRun, type RunImageGridConfig } from "@/components/run-image-grid";

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
    let runs: RunImageGridRun[] = [];
    if (demoRunIds.length > 0) {
        // 動態構建 API URL（伺服器端需要完整 URL）
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
            process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
            'http://localhost:3000';
        const apiUrl = `${baseUrl}/api/runs/public/selected-items`;

        const res = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ runIds: demoRunIds, slug })
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
        <div className="mx-auto max-w-6xl p-6 space-y-6">
            <div className="mt-8 mb-12">
                <h1 className="text-4xl font-semibold text-center tracking-wide">{title}</h1>
                <p className="text-1xl text-muted-foreground mt-3 text-center tracking-widest">{description}</p>
                <div className="mt-4 flex justify-center gap-2">
                    <Link
                        href="/flows"
                        className="inline-flex items-center rounded-md border p-2 hover:bg-muted"
                        aria-label="返回"
                    >
                        <List className="h-4 w-4" />
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
            <RunImageGrid
                runs={runs}
                slug={slug}
                config={{
                    showShare: true,
                    showPlay: true,
                    showLightbox: true,
                    showDownload: true,
                    showTimestamp: true,
                    showExpand: false,  // 移除展開功能
                    maxPreviewItems: 20, // 顯示更多項目（因為現在每步驟只有一張圖）
                    gridCols: {
                        mobile: 3,
                        tablet: 5,
                        desktop: 6
                    }
                }}
            />
        </div>
    );
}
