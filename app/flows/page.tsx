import Link from "next/link";
import Image from "next/image";
import { getAllFlows, getHomepageFlowImages, getHomepageImagesByIndex } from "@/server/flows";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function FlowsListPage() {
    const flows = getAllFlows().filter(f => (f.metadata?.visibility ?? "public") === "public");
    const images = getHomepageFlowImages();
    const imagesByIndex = getHomepageImagesByIndex();

    return (
        <div className="mx-auto w-full max-w-6xl p-6 space-y-10">
            {/* Flow 展示區塊 */}
            <div className="space-y-3 mb-10">
                {/* 格線佈局 - 一列4張 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {flows.map((flow, idx) => (
                        <Link
                            key={flow.slug}
                            href={`/flows/${flow.slug}/introduction`}
                            className="block h-full"
                        >
                            <Card className="overflow-hidden hover:bg-muted/30 border p-0 h-full flex flex-col gap-0">
                                <div className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
                                    <Image
                                        src={imagesByIndex[idx] || images[flow.slug] || flow.metadata?.thumbnail || "/vercel.svg"}
                                        alt={flow.name}
                                        fill
                                        className="object-contain bg-muted"
                                    />
                                </div>
                                <div className="p-4 flex flex-col flex-grow">
                                    <div className="font-medium mt-2">{flow.name}</div>
                                    {flow.metadata?.description ? (
                                        <div className="text-sm text-muted-foreground mt-1 line-clamp-2 flex-grow mb-2">{flow.metadata.description}</div>
                                    ) : (
                                        <div className="flex-grow mb-2"></div>
                                    )}
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
