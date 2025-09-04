import Link from "next/link";
import Image from "next/image";
import { getHomepageFlows, getHomepageFlowImages, getHomepageImagesByIndex } from "@/server/flows";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function Home() {
    const flows = getHomepageFlows(3);
    const images = getHomepageFlowImages();
    const imagesByIndex = getHomepageImagesByIndex();
    return (
        <div className="mx-auto w-full max-w-6xl p-6 space-y-10">
            {/* Hero */}
            <div className="mt-10 mb-4 text-center space-y-4 mb-10">
                <h1 className="text-4xl font-semibold tracking-wide">Cosify</h1>
                <p className="text-muted-foreground">上傳圖片，快速生成你的 Cosplay 靈感與成品</p>
                <div className="pt-2">
                    <Button size="lg" asChild>
                        <Link href="/flows">前往創作</Link>
                    </Button>
                </div>
            </div>

            {/* 新版功能輪播（依照網站功能展示各 Flow） */}
            <div className="space-y-3 mb-10">
                {/* CSS 滾動輪播（scroll-snap） */}
                <div className="relative">
                    <div className="-mx-6 overflow-x-auto px-6">
                        <div className="flex snap-x snap-mandatory gap-4">
                            {flows.map((flow, idx) => (
                                <Link
                                    key={flow.slug}
                                    href={`/flows/${flow.slug}/introduction`}
                                    className="snap-start shrink-0 w-[85%] sm:w-[48%] md:w-[32%]"
                                >
                                    <Card className="overflow-hidden hover:bg-muted/30 border p-0">
                                        <div className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
                                            <Image
                                                src={imagesByIndex[idx] || images[flow.slug] || flow.metadata?.thumbnail || "/vercel.svg"}
                                                alt={flow.name}
                                                fill
                                                className="object-contain bg-muted"
                                            />
                                        </div>
                                        <div className="p-4">
                                            <div className="font-medium">{flow.name}</div>
                                            {flow.metadata?.description ? (
                                                <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{flow.metadata.description}</div>
                                            ) : null}
                                            <div className="pt-3">
                                                <Button className="w-full" variant="secondary">進入介紹</Button>
                                            </div>
                                        </div>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
