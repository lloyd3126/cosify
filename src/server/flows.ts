import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type FlowStep =
    | { id: string; name: string; type: "uploader"; data: Record<string, unknown> }
    | { id: string; name: string; type: "imgGenerator"; data: { model: string; prompt: string; temperature?: number; referenceImgs: string[] } };

export type Flow = {
    name: string;
    slug: string;
    metadata?: { description?: string; thumbnail?: string; visibility?: "public" | "private" };
    steps: FlowStep[];
};

export type FlowsFile = {
    flows: Record<string, Flow>;
    homepage?: { flows?: Record<string, string> };
};

// 簡化：每次讀取檔案（檔案小，效能可接受）。如需快取可再加入 fs.stat 判斷。

function loadRaw(): FlowsFile {
    const p = resolve(process.cwd(), "flows.json");
    const content = readFileSync(p, "utf-8");
    const json: unknown = JSON.parse(content);
    if (!json || typeof json !== "object" || !("flows" in json)) {
        throw new Error("flows.json 結構不正確：缺少 flows");
    }
    const typed = json as FlowsFile;
    if (typeof typed.flows !== "object") throw new Error("flows.json 結構不正確：flows 應為物件");
    return typed;
}

export function getAllFlows(): Flow[] {
    const { flows } = loadRaw();
    return Object.values(flows);
}

export function getFlowBySlug(slug: string): Flow | null {
    const flows = getAllFlows();
    return flows.find((f) => f.slug === slug) ?? null;
}

// 回傳依照 flows.json -> homepage.flows 指定順序的清單（僅公開項目），不滿足時以公開清單補足
export function getHomepageFlows(limit: number = 3): Flow[] {
    const raw = loadRaw();
    const allPublic = Object.values(raw.flows).filter(
        (f) => (f.metadata?.visibility ?? "public") === "public"
    );
    const result: Flow[] = [];
    const pickedSlugs = new Set<string>();
    const hp = raw.homepage?.flows || {};
    const ordered = Object.entries(hp)
        .map(([k, id]) => ({ idx: Number(k), id }))
        .filter((x) => Number.isFinite(x.idx) && typeof x.id === "string")
        .sort((a, b) => a.idx - b.idx);
    for (const { id } of ordered) {
        const flow = raw.flows[id];
        if (!flow) continue;
        if ((flow.metadata?.visibility ?? "public") !== "public") continue;
        if (pickedSlugs.has(flow.slug)) continue;
        result.push(flow);
        pickedSlugs.add(flow.slug);
        if (result.length >= limit) break;
    }
    if (result.length < limit) {
        for (const f of allPublic) {
            if (pickedSlugs.has(f.slug)) continue;
            result.push(f);
            pickedSlugs.add(f.slug);
            if (result.length >= limit) break;
        }
    }
    return result.slice(0, limit);
}

export type FlowValidationError = { kind: "unsupported-step-type" | "invalid-reference"; message: string };

export function validateFlow(flow: Flow): FlowValidationError[] {
    const errors: FlowValidationError[] = [];
    const seen = new Set<string>();
    for (const step of flow.steps) {
        if (step.type === "uploader") {
            // ok
            seen.add(step.id);
            continue;
        }
        if (step.type === "imgGenerator") {
            // referenceImgs 必須存在且皆指向先前的 step
            const refs = step.data.referenceImgs || [];
            if (!Array.isArray(refs) || refs.length === 0) {
                errors.push({ kind: "invalid-reference", message: `步驟 ${step.name} 缺少 referenceImgs` });
            } else {
                for (const ref of refs) {
                    if (!seen.has(ref)) {
                        errors.push({ kind: "invalid-reference", message: `步驟 ${step.name} 的引用 ${ref} 不存在或順序不合法` });
                    }
                }
            }
            seen.add(step.id);
            continue;
        }
        // 以保守方式讀取未知型別，不使用 any 以通過 ESLint
        const tUnknown = (step as Record<string, unknown>)["type"];
        const t = typeof tUnknown === "string" ? tUnknown : "unknown";
        errors.push({ kind: "unsupported-step-type", message: `不支援的步驟型別：${t}` });
    }
    return errors;
}
