"use client";
import { useEffect, useRef, useState } from "react";
import { CircleChevronLeft, CircleChevronRight } from "lucide-react";

type HorizontalCarouselProps<T> = {
    items: T[];
    renderItem: (item: T, itemWidthPx: number, index: number) => React.ReactNode;
    className?: string;
};

export default function HorizontalCarousel<T>({ items, renderItem, className }: HorizontalCarouselProps<T>) {
    const [cursor, setCursor] = useState<number>(0);
    const [isMd, setIsMd] = useState<boolean>(false);
    const trackRef = useRef<HTMLDivElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [stepPx, setStepPx] = useState<number>(0);
    const [itemWidth, setItemWidth] = useState<number>(0);

    useEffect(() => {
        const mq = window.matchMedia("(min-width: 768px)");
        const onChange = () => setIsMd(mq.matches);
        onChange();
        mq.addEventListener?.("change", onChange);
        return () => mq.removeEventListener?.("change", onChange);
    }, []);

    const visibleItems = isMd ? 3 : 1;
    const maxCursor = Math.max(0, items.length - visibleItems);
    const canGoPrev = cursor > 0;
    const canGoNext = cursor < maxCursor;
    const goPrev = () => { if (canGoPrev) setCursor((c) => Math.max(0, c - 1)); };
    const goNext = () => { if (canGoNext) setCursor((c) => Math.min(maxCursor, c + 1)); };
    const showArrows = items.length >= 4;
    const centerMode = isMd && items.length <= 2;

    useEffect(() => {
        const recompute = () => {
            if (!trackRef.current || !containerRef.current) return;
            const containerW = containerRef.current.getBoundingClientRect().width;
            const cs = getComputedStyle(trackRef.current);
            let gapStr = cs.getPropertyValue("gap");
            if (!gapStr) gapStr = cs.getPropertyValue("column-gap");
            if (!gapStr) gapStr = cs.getPropertyValue("row-gap");
            if (!gapStr) gapStr = "0";
            const gap = parseFloat(gapStr) || 0;
            const vis = visibleItems;
            const w = vis > 0 ? Math.max(0, (containerW - gap * (vis - 1)) / vis) : 0;
            setItemWidth(w);
            setStepPx(w + gap);
        };
        recompute();
        const ros: ResizeObserver[] = [];
        if (typeof ResizeObserver !== "undefined") {
            if (containerRef.current) {
                const ro = new ResizeObserver(recompute);
                ro.observe(containerRef.current);
                ros.push(ro);
            }
            if (trackRef.current) {
                const ro2 = new ResizeObserver(recompute);
                ro2.observe(trackRef.current);
                ros.push(ro2);
            }
        }
        window.addEventListener("resize", recompute);
        return () => {
            window.removeEventListener("resize", recompute);
            ros.forEach(r => r.disconnect());
        };
    }, [visibleItems]);

    return (
        <div className={className}>
            <div className="relative">
                {showArrows && (
                    <>
                        <button
                            type="button"
                            onClick={goPrev}
                            disabled={!canGoPrev}
                            aria-label="上一張"
                            title="上一張"
                            className="absolute -left-12 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-1 disabled:opacity-40"
                        >
                            <CircleChevronLeft className="h-7 w-7" />
                        </button>
                        <button
                            type="button"
                            onClick={goNext}
                            disabled={!canGoNext}
                            aria-label="下一張"
                            title="下一張"
                            className="absolute -right-12 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-1 disabled:opacity-40"
                        >
                            <CircleChevronRight className="h-7 w-7" />
                        </button>
                    </>
                )}

                <div className="overflow-hidden" ref={containerRef}>
                    <div
                        ref={trackRef}
                        className={`flex gap-4 transition-transform duration-300 ease-in-out ${centerMode ? "justify-center" : ""}`}
                        style={{ transform: stepPx > 0 && !centerMode ? `translateX(${-cursor * stepPx}px)` : undefined }}
                    >
                        {items.map((item, idx) => (
                            <div key={idx} className="shrink-0" style={{ width: itemWidth ? `${itemWidth}px` : undefined }}>
                                {renderItem(item, itemWidth, idx)}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
