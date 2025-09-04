import { useState } from "react";
import { Share } from "lucide-react";

export function ShareRunIdButton({ runId }: { runId: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        await navigator.clipboard.writeText(runId);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
    };
    return (
        <button
            className={`w-8 h-8 flex items-center justify-center rounded border hover:bg-muted transition ${copied ? 'bg-primary/10' : ''}`}
            onClick={handleCopy}
            title={copied ? "已複製" : "分享 runId"}
            aria-label="分享 runId"
        >
            <Share size={18} strokeWidth={2} />
        </button>
    );
}
