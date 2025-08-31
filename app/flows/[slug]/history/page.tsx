import { auth } from "@/server/auth";
import { getFlowBySlug } from "@/server/flows";
import { headers } from "next/headers";
import Link from "next/link";
import FlowHistory from "../../../../src/components/flow-history";

export const dynamic = "force-dynamic";

export default async function FlowHistoryPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const h = await headers();
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

    return <FlowHistory slug={slug} flowName={flow.name} />;
}
