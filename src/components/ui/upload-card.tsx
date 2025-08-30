"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import clsx from "clsx";
import { preprocessImage } from "@/lib/image-preprocess";
import { X, Upload } from "lucide-react";
import useAdaptiveAspect from "@/lib/use-adaptive-aspect";
import ConfirmDialog from "@/components/ui/confirm-dialog";

export type UploadCardProps = {
    label: string;
    accept?: string; // default image/*
    maxSizeMB?: number; // optional size guard
    file: File | null;
    onChange: (file: File | null) => void;
    className?: string;
    placeholder?: React.ReactNode;
};

export function UploadCard({ label, accept = "image/*", maxSizeMB, file, onChange, className, placeholder }: UploadCardProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const aspect = "9 / 16"; // 固定 9:16 外觀
    const [confirmOpen, setConfirmOpen] = useState(false);

    useEffect(() => {
        if (!file) {
            setPreview(null);
            return;
        }
        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const validate = useCallback((f: File) => {
        if (accept && !f.type.startsWith(accept.replace("/*", "/"))) {
            return "檔案格式不支援";
        }
        if (maxSizeMB && f.size > maxSizeMB * 1024 * 1024) {
            return `檔案過大，請小於 ${maxSizeMB}MB`;
        }
        return null;
    }, [accept, maxSizeMB]);

    const pick = () => inputRef.current?.click();

    const onFiles = async (files: FileList | null) => {
        setError(null);
        const f = files?.[0];
        if (!f) return;
        const err = validate(f);
        if (err) {
            setError(err);
            return;
        }
        try {
            const processed = await preprocessImage(f, { maxDimension: 1600, outputType: 'image/webp', quality: 0.85 });
            onChange(processed);
        } catch {
            onChange(f);
        }
    };

    return (
        <div className={clsx("space-y-2 min-w-0", className)}>
            <div className="text-center font-medium">{label}</div>
            <Card
                className={clsx(
                    "group relative w-full overflow-hidden rounded-xl border-2",
                    dragOver ? "border-primary/60 bg-muted/50" : "border-muted-foreground/20"
                )}
                style={{ aspectRatio: aspect }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files); }}
                role="region"
                aria-label={label}
                tabIndex={0}
            >
                {preview ? (
                    <>
                        <Image src={preview} alt={label} fill className="object-cover" />
                        {/* Top-right clear button (show on hover/focus/drag) */}
                        <button
                            type="button"
                            onClick={() => setConfirmOpen(true)}
                            aria-label="清除圖片"
                            className={clsx(
                                "absolute right-2 top-2 z-10 rounded-full bg-black/60 text-white p-1.5 shadow-sm transition-colors hover:bg-black/75 focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none",
                                "opacity-0 pointer-events-none",
                                "group-hover:opacity-100 group-hover:pointer-events-auto",
                                "group-focus-within:opacity-100 group-focus-within:pointer-events-auto",
                                dragOver && "opacity-100 pointer-events-auto"
                            )}
                        >
                            <X className="h-4 w-4" />
                        </button>
                        <ConfirmDialog
                            open={confirmOpen}
                            title="清除這張圖片？"
                            description="此動作無法復原。"
                            confirmText="清除"
                            cancelText="取消"
                            onCancel={() => setConfirmOpen(false)}
                            onConfirm={() => { setConfirmOpen(false); onChange(null); }}
                        />
                        {/* Floating action overlay (only when image exists) */}
                        <div
                            className={clsx(
                                "absolute inset-0 z-0 flex items-end p-3 bg-black/30 transition-opacity duration-200",
                                "opacity-0 pointer-events-none",
                                "group-hover:opacity-100 group-hover:pointer-events-auto",
                                "group-focus-within:opacity-100 group-focus-within:pointer-events-auto",
                                dragOver && "opacity-100 pointer-events-auto"
                            )}
                        >
                            <div className="w-full">
                                <div className="grid grid-cols-1 gap-2">
                                    <Button className="w-full" onClick={pick} aria-label="選擇檔案">
                                        <Upload className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <button
                        type="button"
                        className="absolute inset-0 grid place-items-center text-5xl text-muted-foreground"
                        onClick={pick}
                        aria-label={`上傳 ${label}`}
                    >
                        {placeholder ?? "+"}
                    </button>
                )}
                <input
                    ref={inputRef}
                    type="file"
                    accept={accept}
                    className="hidden"
                    onChange={(e) => onFiles(e.target.files)}
                />
            </Card>
            {/* Buttons moved into overlay */}
            {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
    );
}

export default UploadCard;
