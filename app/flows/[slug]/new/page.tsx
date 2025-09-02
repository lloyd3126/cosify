import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { auth } from "@/server/auth";
import { db, schema } from "@/server/db";
import { getFlowBySlug, validateFlow } from "@/server/flows";

export const dynamic = "force-dynamic";

export default async function NewRunPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const h = await headers();
    const session = await auth.api.getSession({ headers: h });
    if (!session) {
        // 未登入，導回該 flow 首頁（讓那邊顯示登入需求畫面）
        redirect(`/flows/${encodeURIComponent(slug)}`);
    }

    // 檢查 flow 合法
    const flow = getFlowBySlug(slug);
    if (!flow) {
        redirect(`/flows`);
    }
    const errors = validateFlow(flow);
    if (errors.length > 0) {
        redirect(`/flows/${encodeURIComponent(slug)}`);
    }

    // 建立新 run 並導向具 runId 的頁面
    const runId = randomUUID();
    await db.insert(schema.flowRuns).values({ runId, userId: session.user.id, slug, status: "active" });
    redirect(`/flows/${encodeURIComponent(slug)}?runId=${encodeURIComponent(runId)}`);
}
