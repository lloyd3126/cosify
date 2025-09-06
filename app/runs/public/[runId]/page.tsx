import { db } from "@/server/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PublicRunView } from "@/components/public-run-view";
import { getFlowBySlug } from "@/server/flows";

export const dynamic = "force-dynamic";

export default async function PublicRunPage({ params }: { params: Promise<{ runId: string }> }) {
    const { runId } = await params;

    // 檢查 run 是否存在且為公開，同時獲取使用者資訊
    const run = await db.query.flowRuns.findFirst({
        where: (t, { eq }) => eq(t.runId, runId),
        columns: { runId: true, public: true, slug: true, createdAt: true, userId: true },
    });

    if (!run || !run.public) {
        notFound();
    }

    // 獲取 flow 資訊
    const flow = getFlowBySlug(run.slug);
    if (!flow) {
        notFound();
    }

    // 獲取使用者資訊
    const user = await db.query.users.findFirst({
        where: (t, { eq }) => eq(t.id, run.userId),
        columns: { name: true, email: true },
    });

    return (
        <div className="min-h-screen bg-background">
            <PublicRunView
                runId={runId}
                slug={run.slug}
                createdAt={run.createdAt.toISOString()}
                flowName={flow.name}
                userName={user?.name || user?.email || "匿名使用者"}
                userId={run.userId}
            />
        </div>
    );
}
