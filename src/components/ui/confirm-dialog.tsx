"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import clsx from "clsx";

export type ConfirmDialogProps = {
    open: boolean;
    title?: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    className?: string;
};

export function ConfirmDialog({
    open,
    title = "確認",
    description,
    confirmText = "確定",
    cancelText = "取消",
    onConfirm,
    onCancel,
    className,
}: ConfirmDialogProps) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onCancel]);

    if (!open) return null;

    return (
        <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className={clsx(
                "fixed inset-0 z-50 flex items-center justify-center",
                className
            )}
        >
            <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
            <div className="relative z-10 w-[90%] max-w-sm rounded-xl border bg-background p-4 shadow-lg">
                <div className="space-y-2">
                    <h2 id="confirm-title" className="text-base font-semibold">
                        {title}
                    </h2>
                    {description ? (
                        <p className="text-sm text-muted-foreground">{description}</p>
                    ) : null}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button onClick={onCancel} variant="secondary" className="w-full">
                        {cancelText}
                    </Button>
                    <Button onClick={onConfirm} className="w-full">
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default ConfirmDialog;
