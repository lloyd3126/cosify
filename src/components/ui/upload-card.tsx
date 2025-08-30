"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import clsx from "clsx";
import { preprocessImage } from "@/lib/image-preprocess";
import useAdaptiveAspect from "@/lib/use-adaptive-aspect";

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
    const aspect = useAdaptiveAspect();

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
                        {/* Floating action overlay (only when image exists) */}
                        <div
                            className={clsx(
                                "absolute inset-0 flex items-end p-3 bg-black/30 transition-opacity duration-200",
                                "opacity-0 pointer-events-none",
                                "group-hover:opacity-100 group-hover:pointer-events-auto",
                                "group-focus-within:opacity-100 group-focus-within:pointer-events-auto",
                                dragOver && "opacity-100 pointer-events-auto"
                            )}
                        >
                            <div className="w-full">
                                <div className="grid grid-cols-1 gap-2">
                                    <Button className="w-full" onClick={pick}>選擇檔案</Button>
                                    <Button className="w-full" onClick={() => onChange(null)} disabled={!file}>清除</Button>
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
