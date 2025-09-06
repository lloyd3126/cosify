import { auth } from "@/server/auth";
import { getFlowBySlug } from "@/server/flows";
import { db, schema } from "@/server/db";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import FlowRecycle from "@/components/flow-recycle";

export const dynamic = "force-dynamic";

export default async function FlowRecyclePage({ params, searchParams }: { params: Promise<{ slug: string }>, searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
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
                    <p className="text-sm text-muted-foreground">請先登入後再查看回收站。</p>
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

    return <FlowRecycle slug={slug} flowName={flow.name} currentRunId={runIdFromUrl} fromSource={fromSource} />;
}
