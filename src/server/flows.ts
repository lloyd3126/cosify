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
    homepage?: {
        flows?: Record<string, string | { id: string; imageUrl?: string }>;
    };
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
        .map(([k, v]) => {
            const idx = Number(k);
            let id: string | null = null;
            if (typeof v === "string") id = v;
            else if (v && typeof v === "object" && typeof (v as any).id === "string") id = (v as any).id;
            return { idx, id };
        })
        .filter((x) => Number.isFinite(x.idx) && typeof x.id === "string" && !!x.id)
        .sort((a, b) => a.idx - b.idx);
    // helper: resolve id as flowId or stepId
    const resolveFlowByAnyId = (anyId: string): Flow | undefined => {
        if (raw.flows[anyId]) return raw.flows[anyId];
        for (const f of Object.values(raw.flows)) {
            if (Array.isArray(f.steps) && f.steps.some((s) => s.id === anyId)) return f;
        }
        return undefined;
    };
    for (const { id } of ordered) {
        const flow = id ? resolveFlowByAnyId(id) : undefined;
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

// 取得首頁卡片對應的自訂圖片（slug -> imageUrl）
export function getHomepageFlowImages(): Record<string, string> {
    const raw = loadRaw();
    const map: Record<string, string> = {};
    const hp = raw.homepage?.flows || {};
    // helper to resolve id -> flow slug
    const resolveSlugByAnyId = (anyId: string): string | null => {
        if (raw.flows[anyId]) return raw.flows[anyId].slug;
        for (const f of Object.values(raw.flows)) {
            if (Array.isArray(f.steps) && f.steps.some((s) => s.id === anyId)) return f.slug;
        }
        return null;
    };
    for (const v of Object.values(hp)) {
        if (v && typeof v === "object") {
            const id = (v as any).id;
            const imageUrl = (v as any).imageUrl;
            if (typeof id === "string" && typeof imageUrl === "string") {
                const slug = resolveSlugByAnyId(id);
                if (slug) map[slug] = imageUrl;
            }
        }
    }
    return map;
}

// 依首頁 flows 順序回傳 imageUrl（用於與 getHomepageFlows(3) 搭配，避免補位造成圖片缺漏）
export function getHomepageImagesByIndex(): Array<string | undefined> {
    const raw = loadRaw();
    const hp = raw.homepage?.flows || {};
    const ordered = Object.entries(hp)
        .map(([k, v]) => {
            const idx = Number(k);
            const imageUrl = v && typeof v === "object" ? (v as any).imageUrl : undefined;
            return { idx, imageUrl };
        })
        .filter((x) => Number.isFinite(x.idx))
        .sort((a, b) => a.idx - b.idx);
    return ordered.map((o) => (typeof o.imageUrl === "string" ? o.imageUrl : undefined));
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
