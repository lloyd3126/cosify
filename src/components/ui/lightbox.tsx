"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/scroll-lock";

type LightboxProps = {
    open: boolean;
    src: string | null;
    alt?: string;
    onClose: () => void;
    className?: string;
    // Zoom bounds (optional)
    minScale?: number;
    maxScale?: number;
    // Optional navigation
    onPrev?: () => void;
    onNext?: () => void;
    canPrev?: boolean;
    canNext?: boolean;
};

export default function Lightbox({ open, src, alt, onClose, className, minScale = 1, maxScale = 3, onPrev, onNext, canPrev, canNext }: LightboxProps) {
    const [scale, setScale] = useState(1);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
    const basePinch = useRef<{ distance: number; scale: number } | null>(null);
    const [mounted, setMounted] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [showLoading, setShowLoading] = useState(false);
    const [prevSrc, setPrevSrc] = useState<string | null>(null);
    const swipeStart = useRef<{ x: number; y: number } | null>(null);
    const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => { setMounted(true); }, []);

    // Lock background scroll when open (with scrollbar compensation)
    useEffect(() => {
        if (!open) return;
        lockBodyScroll();
        return () => unlockBodyScroll();
    }, [open]);

    useEffect(() => {
        if (!open) {
            setScale(1);
            setImageLoaded(false);
            setImageError(false);
            setShowLoading(false);
            setPrevSrc(null);
            pointers.current.clear();
            basePinch.current = null;
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
                loadingTimeoutRef.current = null;
            }
        }
    }, [open, src]);

    // Reset image state when src changes
    useEffect(() => {
        if (src && src !== prevSrc) {
            // 清除之前的載入計時器
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
            }

            // 檢查圖片是否已在快取中
            const img = new Image();
            img.src = src;

            const isImageCached = img.complete && img.naturalWidth > 0;

            if (isImageCached) {
                // 圖片已快取，直接切換
                setImageLoaded(true);
                setImageError(false);
                setShowLoading(false);
                setScale(1);
            } else {
                // 圖片未快取，設置載入狀態
                setImageLoaded(false);
                setImageError(false);
                setShowLoading(false);
                setScale(1);

                // 延遲顯示載入動畫 (200ms)
                loadingTimeoutRef.current = setTimeout(() => {
                    setShowLoading(true);
                }, 200);
            }

            setPrevSrc(src);
        }
    }, [src, prevSrc]);

    const clamp = (v: number) => Math.min(maxScale, Math.max(minScale, v));

    const onWheel = (e: React.WheelEvent) => {
        // Desktop wheel zoom: deltaY > 0 => zoom out
        e.preventDefault();
        const delta = -e.deltaY; // invert so wheel up zooms in
        const step = 0.0015; // sensitivity
        setScale((s) => clamp(s + delta * step));
    };

    const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.hypot(dx, dy);
    };

    const onPointerDown = (e: React.PointerEvent) => {
        // Enable pinch on mobile (two fingers). No panning.
        (e.target as Element).setPointerCapture?.(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 1) {
            swipeStart.current = { x: e.clientX, y: e.clientY };
        }
        if (pointers.current.size === 2) {
            const [p1, p2] = Array.from(pointers.current.values());
            basePinch.current = { distance: distance(p1, p2), scale };
        }
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
            const [p1, p2] = Array.from(pointers.current.values());
            const dist = distance(p1, p2);
            if (!basePinch.current) {
                basePinch.current = { distance: dist, scale };
            } else {
                const next = (basePinch.current.scale * dist) / Math.max(1, basePinch.current.distance);
                setScale(clamp(next));
            }
        }
    };

    const onPointerUpOrCancel = (e: React.PointerEvent) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size < 2) {
            basePinch.current = null;
        }
        // Swipe detection when only one pointer was active
        if (swipeStart.current && pointers.current.size === 0 && (onPrev || onNext)) {
            const end = { x: e.clientX, y: e.clientY };
            const dx = end.x - swipeStart.current.x;
            const dy = end.y - swipeStart.current.y;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            const threshold = 48; // px
            if (absDx > threshold && absDy < 80) {
                if (dx > 0 && onPrev && (canPrev ?? true)) onPrev(); // swipe right -> prev
                else if (dx < 0 && onNext && (canNext ?? true)) onNext(); // swipe left -> next
            }
            swipeStart.current = null;
        }
    };

    // Keyboard arrows
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft" && onPrev && (canPrev ?? true)) { e.preventDefault(); onPrev(); }
            if (e.key === "ArrowRight" && onNext && (canNext ?? true)) { e.preventDefault(); onNext(); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onPrev, onNext, canPrev, canNext]);

    // 清理計時器
    useEffect(() => {
        return () => {
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
            }
        };
    }, []);

    if (!open || !src || !mounted) return null;

    const content = (
        <div
            className={clsx("fixed inset-0 z-50 bg-black/50", className)}
            role="dialog"
            aria-modal="true"
            onClick={(e) => { onClose(); e.stopPropagation(); }}
        >
            {/* Wrapper allows events so background clicks bubble to overlay */}
            <div className="flex h-full w-full items-center justify-center">
                {/* Content box handles interactions */}
                <div
                    ref={containerRef}
                    className="pointer-events-auto relative"
                    onWheel={onWheel}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUpOrCancel}
                    onPointerCancel={onPointerUpOrCancel}
                    style={{ touchAction: "none" }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Loading indicator - 只有在延遲後且圖片未載入時才顯示 */}
                    {showLoading && !imageLoaded && !imageError && (
                        <div className="flex items-center justify-center min-h-[200px] min-w-[200px]">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                        </div>
                    )}

                    {/* Error state */}
                    {imageError && (
                        <div className="flex items-center justify-center min-h-[200px] min-w-[200px] text-white">
                            <div className="text-center">
                                <div className="text-4xl mb-2">⚠️</div>
                                <div>圖片載入失敗</div>
                            </div>
                        </div>
                    )}

                    {/* Current Image */}
                    <img
                        key={src} // 強制重新渲染以確保事件觸發
                        src={src}
                        alt={alt ?? "image"}
                        className={clsx(
                            "max-h-[100vh] max-w-[100vw] select-none",
                            imageLoaded ? "opacity-100" : "opacity-0 absolute"
                        )}
                        style={{ transform: `scale(${scale})`, transformOrigin: "center center", objectFit: "contain" as const }}
                        draggable={false}
                        onLoad={(e) => {
                            // 即使圖片已經快取，onLoad 仍可能觸發，確保狀態正確
                            setImageLoaded(true);
                            setShowLoading(false);
                            if (loadingTimeoutRef.current) {
                                clearTimeout(loadingTimeoutRef.current);
                                loadingTimeoutRef.current = null;
                            }
                        }}
                        onError={() => {
                            setImageError(true);
                            setShowLoading(false);
                            if (loadingTimeoutRef.current) {
                                clearTimeout(loadingTimeoutRef.current);
                                loadingTimeoutRef.current = null;
                            }
                        }}
                    />

                    {/* Previous Image (保持顯示直到新圖片載入完成) */}
                    {prevSrc && prevSrc !== src && !imageLoaded && !imageError && (
                        <img
                            src={prevSrc}
                            alt="previous"
                            className="max-h-[100vh] max-w-[100vw] select-none opacity-100"
                            style={{ transform: `scale(1)`, transformOrigin: "center center", objectFit: "contain" as const }}
                            draggable={false}
                        />
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
}
