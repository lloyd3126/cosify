import { ai, IMAGE_MODEL } from "./genai";
import { TO_COSPLAYER_PROMPT, TO_COSPLAYER_OUTFIT_PROMPT, TO_USER_COSPLAY_PROMPT } from "./prompts";
import { TEMPERATURES } from "./config";
import { r2Put } from "./r2";
import { randomUUID } from "node:crypto";

type GenerateParams = {
    userImage: Buffer;
    characterImage: Buffer;
    userId: string;
};

export type GenerateResult = {
    finalKey: string;
    intermediateKey?: string; // stage1
    outfitKey?: string; // stage2
};

export async function twoStageGenerate(params: GenerateParams): Promise<GenerateResult> {
    const { userImage, characterImage } = params;

    // 1) 角色 → cosplayer 中間圖
    const stage1 = await ai.models.generateContent({
        model: IMAGE_MODEL,
        config: TEMPERATURES.toCosplayer !== undefined ? { temperature: TEMPERATURES.toCosplayer } : undefined,
        contents: [
            TO_COSPLAYER_PROMPT,
            { inlineData: { data: characterImage.toString("base64"), mimeType: "image/png" } },
        ],
    });

    type InlinePart = { inlineData?: { data?: string } };
    type TextPart = { text?: string };
    function isInline(p: InlinePart | TextPart): p is Required<InlinePart> {
        return typeof (p as InlinePart).inlineData?.data === "string";
    }

    const stage1Parts = (stage1.candidates?.[0]?.content?.parts ?? []) as Array<InlinePart | TextPart>;
    const stage1Inline = stage1Parts.find(isInline);
    const stage1ImageBase64 = stage1Inline?.inlineData?.data as
        | string
        | undefined;
    if (!stage1ImageBase64) throw new Error("Stage1 image not generated");
    const stage1Buf = Buffer.from(stage1ImageBase64, "base64");

    // 上傳中間圖到 R2 (stage1)
    const intermediateKey = `intermediate/${randomUUID()}.png`;
    await r2Put(intermediateKey, stage1Buf, "image/png");

    // 2) cosplayer → flat lay outfit（僅輸出服裝平鋪圖）
    const stage2 = await ai.models.generateContent({
        model: IMAGE_MODEL,
        config: TEMPERATURES.toCosplayerOutfit !== undefined ? { temperature: TEMPERATURES.toCosplayerOutfit } : undefined,
        contents: [
            TO_COSPLAYER_OUTFIT_PROMPT,
            { inlineData: { data: stage1Buf.toString("base64"), mimeType: "image/png" } },
        ],
    });

    const stage2Parts = (stage2.candidates?.[0]?.content?.parts ?? []) as Array<InlinePart | TextPart>;
    const stage2Inline = stage2Parts.find(isInline);
    const stage2ImageBase64 = stage2Inline?.inlineData?.data as string | undefined;
    if (!stage2ImageBase64) throw new Error("Stage2 outfit image not generated");
    const stage2Buf = Buffer.from(stage2ImageBase64, "base64");

    // 上傳服裝平鋪圖到 R2 (stage2)
    const outfitKey = `outfit/${randomUUID()}.png`;
    await r2Put(outfitKey, stage2Buf, "image/png");

    // 3) Outfit + 使用者 → 最終（將平鋪服裝穿到使用者身上）
    const stage3 = await ai.models.generateContent({
        model: IMAGE_MODEL,
        config: TEMPERATURES.toUserCosplay !== undefined ? { temperature: TEMPERATURES.toUserCosplay } : undefined,
        contents: [
            TO_USER_COSPLAY_PROMPT,
            { inlineData: { data: userImage.toString("base64"), mimeType: "image/png" } },
            { inlineData: { data: stage2Buf.toString("base64"), mimeType: "image/png" } },
        ],
    });

    const stage3Parts = (stage3.candidates?.[0]?.content?.parts ?? []) as Array<InlinePart | TextPart>;
    const stage3Inline = stage3Parts.find(isInline);
    const stage3ImageBase64 = stage3Inline?.inlineData?.data as string | undefined;
    if (!stage3ImageBase64) throw new Error("Stage3 image not generated");
    const stage3Buf = Buffer.from(stage3ImageBase64, "base64");

    const finalKey = `final/${randomUUID()}.png`;
    await r2Put(finalKey, stage3Buf, "image/png");

    return { finalKey, intermediateKey, outfitKey };
}
