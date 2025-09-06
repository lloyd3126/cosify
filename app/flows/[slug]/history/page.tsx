import { auth } from "@/server/auth";
import { getFlowBySlug } from "@/server/flows";
import { db, schema } from "@/server/db";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import FlowHistory from "../../../../src/components/flow-history";

export const dynamic = "force-dynamic";

export default async function FlowHistoryPage({ params, searchParams }: { params: Promise<{ slug: string }>, searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    const { slug } = await params;
    const h = await headers();
    const sp = (await (searchParams ?? Promise.resolve({}))) as Record<string, string | string[] | undefined>;
    const runIdRaw = sp?.runId;
    const runIdFromUrl = Array.isArray(runIdRaw) ? (runIdRaw[0] ?? null) : (runIdRaw ?? null);
    const fromRaw = sp?.from;
    const fromSource = Array.isArray(fromRaw) ? (fromRaw[0] ?? null) : (fromRaw ?? null);
    const session = await auth.api.getSession({ headers: h });
    if (!session) {
        return (
            <div className="min-h-dvh grid place-items-center p-6">
                <div className="space-y-3 text-center">
                    <h1 className="text-xl font-semibold">需要登入</h1>
                    <p className="text-sm text-muted-foreground">請先登入後再查看歷史。</p>
                    <Link href="/" className="underline">返回首頁</Link>
                </div>
            </div>
        );
    }

    const flow = getFlowBySlug(slug);
    if (!flow) {
        return (
            <div className="min-h-dvh grid place-items-center p-6">
                <div className="space-y-3 text-center">
                    <h1 className="text-xl font-semibold">找不到流程</h1>
                    <p className="text-sm text-muted-foreground">slug: {slug}</p>
                    <Link href="/flows" className="underline">返回列表</Link>
                </div>
            </div>
        );
    }

    // 進入歷史頁時：掃描並刪除「空的 run」（沒有任何 step 的 r2Key 且沒有任何資產）
    // 僅清理當前使用者、當前 slug 的 run
    try {
        const runs = await db.query.flowRuns.findMany({
            where: (t, { eq, and }) => and(eq(t.userId, session.user.id), eq(t.slug, slug)),
            columns: { runId: true },
        });
        for (const r of runs) {
            const hasStepKey = await db.query.flowRunSteps.findFirst({
                where: (t, { eq, and, isNotNull }) => and(eq(t.runId, r.runId), isNotNull(t.r2Key)),
                columns: { runId: true },
            });
            if (hasStepKey) continue;
            const hasAssets = await db.query.flowRunStepAssets.findFirst({
                where: (t, { eq }) => eq(t.runId, r.runId),
                columns: { id: true },
            });
            if (hasAssets) continue;
            // 刪除空 run（連帶清理殘留步驟/資產，以防過去遺留）
            await db.delete(schema.flowRunStepAssets).where(eq(schema.flowRunStepAssets.runId, r.runId));
            await db.delete(schema.flowRunSteps).where(eq(schema.flowRunSteps.runId, r.runId));
            await db.delete(schema.flowRuns).where(eq(schema.flowRuns.runId, r.runId));
        }
    } catch { /* 靜默清理 */ }

    return <FlowHistory slug={slug} flowName={flow.name} currentRunId={runIdFromUrl} fromSource={fromSource} />;
}
