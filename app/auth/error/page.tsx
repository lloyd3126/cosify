import Link from "next/link";

export default async function AuthErrorPage({
    searchParams,
}: {
    searchParams?: Promise<{ error?: string; error_description?: string }>;
}) {
    const params = (await searchParams) || {};
    const error = params.error || "unknown_error";
    const desc = params.error_description || "登入發生錯誤，請重試。";
    return (
        <div className="min-h-dvh grid place-items-center p-6">
            <div className="max-w-md w-full space-y-3 text-center">
                <h1 className="text-2xl font-semibold">登入錯誤</h1>
                <p className="text-sm text-muted-foreground">{error}</p>
                <p className="text-sm text-muted-foreground">{desc}</p>
                <Link href="/" className="underline">
                    返回首頁
                </Link>
            </div>
        </div>
    );
}
