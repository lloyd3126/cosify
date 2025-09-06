import { getFlowBySlug } from "@/server/flows";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeftFromLine, FilePlus2, LogIn, History } from "lucide-react";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { RunImageGrid, type RunImageGridRun, type RunImageGridConfig } from "@/components/run-image-grid";
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

export const dynamic = "force-dynamic";

export default async function FlowIntroductionPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const h = await headers();
    const flow = getFlowBySlug(slug);

    // 僅允許 public flow
    if (!flow || (flow.metadata?.visibility ?? "public") !== "public") {
        notFound();
    }

    // 檢查用戶登入狀態和歷史紀錄
    const session = await auth.api.getSession({ headers: h });
    let hasHistory = false;

    if (session) {
        try {
            // 檢查該用戶在此流程中是否有歷史紀錄
            const historyCount = await db.query.flowRuns.findFirst({
                where: (t, { eq, and }) => and(eq(t.userId, session.user.id), eq(t.slug, slug)),
                columns: { runId: true },
            });
            hasHistory = !!historyCount;
        } catch {
            // 靜默處理錯誤，預設為無歷史紀錄
        }
    }

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
                itemsPreview: items.map((it: any) => ({ r2Key: it.r2Key, createdAt: it.createdAt })), // 移除 slice(0, 6) 限制
                allItems: items.map((it: any) => ({ r2Key: it.r2Key, createdAt: it.createdAt })), // 新增：所有項目
                itemsTotal: items.length
            };
        });
    }
    return (
        <div className="mx-auto max-w-6xl p-6 pb-12">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Link
                        href="/flows"
                        className="inline-flex items-center rounded-md border p-2 hover:bg-muted"
                        aria-label="返回"
                    >
                        <ArrowLeftFromLine className="h-5 w-5" />
                    </Link>
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-2">
                    {canStart ? (
                        <Link
                            href={`/flows/${slug}/new`}
                            className="inline-flex items-center rounded-md border p-2 hover:bg-muted"
                            aria-label="開始創作"
                        >
                            <FilePlus2 className="h-5 w-5" />
                        </Link>
                    ) : (
                        <Link
                            href="/login"
                            className="inline-flex items-center rounded-md border p-2 hover:bg-muted"
                            aria-label="請先登入"
                        >
                            <LogIn className="h-5 w-5" />
                        </Link>
                    )}
                    {hasHistory ? (
                        <Link
                            href={`/flows/${encodeURIComponent(slug)}/history`}
                            className="inline-flex items-center rounded-md border p-2 hover:bg-muted"
                            aria-label="前往歷史紀錄"
                        >
                            <History className="h-5 w-5" />
                        </Link>
                    ) : null}
                </div>
            </div>
            <div className="mt-8 mb-14">
                <h1 className="text-4xl font-semibold text-center tracking-wide">{title}</h1>
                <p className="text-1xl text-muted-foreground mt-3 text-center tracking-widest">{description}</p>
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
