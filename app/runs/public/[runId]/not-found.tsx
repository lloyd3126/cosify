import Link from "next/link";

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold">404</h1>
                <h2 className="text-xl font-semibold">找不到頁面</h2>
                <p className="text-muted-foreground">
                    此執行結果不存在或未設為公開
                </p>
                <Link
                    href="/"
                    className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
                >
                    返回首頁
                </Link>
            </div>
        </div>
    );
}
