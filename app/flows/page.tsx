import Link from "next/link";
import { getAllFlows } from "@/server/flows";

export const dynamic = "force-dynamic";

export default function FlowsListPage() {
    const flows = getAllFlows().filter(f => (f.metadata?.visibility ?? "public") === "public");
    return (
        <div className="mx-auto max-w-4xl p-6 space-y-6">
            <h1 className="text-2xl font-semibold">可用流程</h1>
            <div className="grid gap-4 sm:grid-cols-2">
                {flows.map(flow => (
                    <Link key={flow.slug} href={`/flows/${flow.slug}/new`} className="block border rounded-lg p-4 hover:bg-muted/30">
                        <div className="font-medium">{flow.name}</div>
                        {flow.metadata?.description ? (
                            <div className="text-sm text-muted-foreground mt-1">{flow.metadata.description}</div>
                        ) : null}
                    </Link>
                ))}
            </div>
        </div>
    );
}
