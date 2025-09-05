"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/scroll-lock";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import clsx from "clsx";

export type RunSettingsModalProps = {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    className?: string;
};

export function RunSettingsModal({
    open,
    onClose,
    title = "設定",
    children,
    className,
}: RunSettingsModalProps) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    // Lock background scroll when open (with scrollbar compensation)
    useEffect(() => {
        if (!open) return;
        lockBodyScroll();
        return () => unlockBodyScroll();
    }, [open]);

    if (!open) return null;

    const node = (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            className={clsx(
                "fixed inset-0 z-50 flex items-center justify-center",
                className
            )}
        >
            <div className="absolute inset-0 bg-black/50" onClick={(e) => { onClose(); e.stopPropagation(); }} />
            <div className="relative z-10 w-[90%] max-w-md rounded-xl border bg-background p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h2 id="settings-title" className="text-lg font-semibold">
                        {title}
                    </h2>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={onClose}
                        className="h-6 w-6"
                        aria-label="關閉"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="space-y-3">
                    {children}
                </div>
            </div>
        </div>
    );

    return createPortal(node, document.body);
}

export default RunSettingsModal;
