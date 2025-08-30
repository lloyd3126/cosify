"use client";
import { useEffect, useState } from "react";

export type AdaptiveAspectOptions = {
    // 切換門檻（視窗高度，單位 px）
    to34?: number; // 小於此高度，從 9/16 降為 3/4（預設 820）
    to11?: number; // 再更小時，降為 1/1（預設 680）
};

// 依視窗高度在 9:16 → 3:4 → 1:1 之間切換
export function useAdaptiveAspect(opts: AdaptiveAspectOptions = {}) {
    const { to34 = 780, to11 = 600 } = opts;
    const [ratio, setRatio] = useState<string>("9 / 16");

    useEffect(() => {
        const update = () => {
            const h = window.innerHeight;
            if (h < to11) setRatio("1 / 1");
            else if (h < to34) setRatio("3 / 4");
            else setRatio("9 / 16");
        };
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, [to34, to11]);

    return ratio;
}

export default useAdaptiveAspect;
