import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function Home() {
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
        </div>
    );
}
