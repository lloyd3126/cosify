import { auth } from "@/server/auth";
import { getFlowBySlug, validateFlow } from "@/server/flows";
import { db, schema } from "@/server/db";
import { headers } from "next/headers";
import Link from "next/link";
import FlowRunner from "../../../src/components/flow-runner";

export const dynamic = "force-dynamic";

export default async function FlowRunnerPage({ params, searchParams }: { params: Promise<{ slug: string }>, searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    const { slug } = await params;
    const h = await headers();
    const sp = (await (searchParams ?? Promise.resolve({}))) as Record<string, string | string[] | undefined>;
    const runIdRaw = sp?.runId;
    const runIdFromUrl = Array.isArray(runIdRaw) ? (runIdRaw[0] ?? null) : (runIdRaw ?? null);
    const session = await auth.api.getSession({ headers: h });
    if (!session) {
        return (
            <div className="min-h-dvh grid place-items-center p-6">
                <div className="space-y-3 text-center">
                    <h1 className="text-xl font-semibold">需要登入</h1>
                    <p className="text-sm text-muted-foreground">請先登入後再存取此 flow。</p>
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

    const errors = validateFlow(flow);
    if (errors.length > 0) {
        return (
            <div className="min-h-dvh grid place-items-center p-6">
                <div className="max-w-xl w-full space-y-3">
                    <h1 className="text-xl font-semibold">流程定義錯誤</h1>
                    <ul className="list-disc pl-6 text-sm text-red-600">
                        {errors.map((e, i) => (
                            <li key={i}>{e.message}</li>
                        ))}
                    </ul>
                    <Link href="/flows" className="underline">返回列表</Link>
                </div>
            </div>
        );
    }

    // 決定是否顯示「前往歷史紀錄」按鈕：該使用者在此 slug 是否有任何 run
    const hasHistory = !!(await db.query.flowRuns.findFirst({
        where: (t, { eq, and }) => and(eq(t.userId, session.user.id), eq(t.slug, slug)),
        columns: { runId: true },
    }));

    return <FlowRunner slug={slug} flow={flow} runIdFromUrl={runIdFromUrl} hasHistory={hasHistory} />;
}
