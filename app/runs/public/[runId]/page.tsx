import { db } from "@/server/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PublicRunView } from "@/components/public-run-view";

export const dynamic = "force-dynamic";

export default async function PublicRunPage({ params }: { params: Promise<{ runId: string }> }) {
    const { runId } = await params;

    // 檢查 run 是否存在且為公開
    const run = await db.query.flowRuns.findFirst({
        where: (t, { eq }) => eq(t.runId, runId),
        columns: { runId: true, public: true, slug: true, createdAt: true },
    });

    if (!run || !run.public) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-background">
            <PublicRunView runId={runId} slug={run.slug} createdAt={run.createdAt.toISOString()} />
        </div>
    );
}
