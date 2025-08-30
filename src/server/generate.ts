import { ai, IMAGE_MODEL } from "./genai";
import { TO_COSPLAYER_PROMPT, TO_COSPLAYER_OUTFIT_PROMPT, TO_USER_COSPLAY_PROMPT, TO_HAIR_SWAP_PROMPT } from "./prompts";
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
    stage3Key?: string; // stage3
};

// 公用解析函數
type InlinePart = { inlineData?: { data?: string } };
type TextPart = { text?: string };
function isInline(p: InlinePart | TextPart): p is Required<InlinePart> {
    return typeof (p as InlinePart).inlineData?.data === "string";
}

// 單步：角色 → cosplayer 參考照（Stage1）
export async function generateCosplayer(characterImage: Buffer): Promise<Buffer> {
    const stage1 = await ai.models.generateContent({
        model: IMAGE_MODEL,
        config: TEMPERATURES.toCosplayer !== undefined ? { temperature: TEMPERATURES.toCosplayer } : undefined,
        contents: [
            TO_COSPLAYER_PROMPT,
            { inlineData: { data: characterImage.toString("base64"), mimeType: "image/png" } },
        ],
    });
    const parts = (stage1.candidates?.[0]?.content?.parts ?? []) as Array<InlinePart | TextPart>;
    const inline = parts.find(isInline);
    const base64 = inline?.inlineData?.data as string | undefined;
    if (!base64) throw new Error("Stage1 image not generated");
    return Buffer.from(base64, "base64");
}

// 單步：cosplayer → 服裝平鋪（Stage2）
export async function generateOutfit(cosplayerImage: Buffer): Promise<Buffer> {
    const stage2 = await ai.models.generateContent({
        model: IMAGE_MODEL,
        config: TEMPERATURES.toCosplayerOutfit !== undefined ? { temperature: TEMPERATURES.toCosplayerOutfit } : undefined,
        contents: [
            TO_COSPLAYER_OUTFIT_PROMPT,
            { inlineData: { data: cosplayerImage.toString("base64"), mimeType: "image/png" } },
        ],
    });
    const parts = (stage2.candidates?.[0]?.content?.parts ?? []) as Array<InlinePart | TextPart>;
    const inline = parts.find(isInline);
    const base64 = inline?.inlineData?.data as string | undefined;
    if (!base64) throw new Error("Stage2 outfit image not generated");
    return Buffer.from(base64, "base64");
}

// 單步：使用者 + 平鋪服 → 上身照（Stage3）
export async function generateUserCosplay(userImage: Buffer, outfitImage: Buffer): Promise<Buffer> {
    const stage3 = await ai.models.generateContent({
        model: IMAGE_MODEL,
        config: TEMPERATURES.toUserCosplay !== undefined ? { temperature: TEMPERATURES.toUserCosplay } : undefined,
        contents: [
            TO_USER_COSPLAY_PROMPT,
            { inlineData: { data: userImage.toString("base64"), mimeType: "image/png" } },
            { inlineData: { data: outfitImage.toString("base64"), mimeType: "image/png" } },
        ],
    });
    const parts = (stage3.candidates?.[0]?.content?.parts ?? []) as Array<InlinePart | TextPart>;
    const inline = parts.find(isInline);
    const base64 = inline?.inlineData?.data as string | undefined;
    if (!base64) throw new Error("Stage3 image not generated");
    return Buffer.from(base64, "base64");
}

// 單步：髮型替換（Stage4）
export async function generateHairSwap(baseImage: Buffer, characterImage: Buffer): Promise<Buffer> {
    const stage4 = await ai.models.generateContent({
        model: IMAGE_MODEL,
        config: TEMPERATURES.toUserCosplay !== undefined ? { temperature: TEMPERATURES.toUserCosplay } : undefined,
        contents: [
            TO_HAIR_SWAP_PROMPT,
            { inlineData: { data: baseImage.toString("base64"), mimeType: "image/png" } },
            { inlineData: { data: characterImage.toString("base64"), mimeType: "image/png" } },
        ],
    });
    const parts = (stage4.candidates?.[0]?.content?.parts ?? []) as Array<InlinePart | TextPart>;
    const inline = parts.find(isInline);
    const base64 = inline?.inlineData?.data as string | undefined;
    if (!base64) throw new Error("Stage4 image not generated");
    return Buffer.from(base64, "base64");
}

export async function twoStageGenerate(params: GenerateParams): Promise<GenerateResult> {
    const { userImage, characterImage } = params;

    // 1) 角色 → cosplayer 中間圖
    const stage1Buf = await generateCosplayer(characterImage);

    // 上傳中間圖到 R2 (stage1)
    const intermediateKey = `intermediate/${randomUUID()}.png`;
    await r2Put(intermediateKey, stage1Buf, "image/png");

    // 2) cosplayer → flat lay outfit（僅輸出服裝平鋪圖）
    const stage2Buf = await generateOutfit(stage1Buf);

    // 上傳服裝平鋪圖到 R2 (stage2)
    const outfitKey = `outfit/${randomUUID()}.png`;
    await r2Put(outfitKey, stage2Buf, "image/png");

    // 3) Outfit + 使用者 → 最終（將平鋪服裝穿到使用者身上）
    const stage3Buf = await generateUserCosplay(userImage, stage2Buf);

    // 上傳第三階段結果
    const stage3Key = `final_stage3/${randomUUID()}.png`;
    await r2Put(stage3Key, stage3Buf, "image/png");

    // 4) 髮型替換：image1 = stage3 結果，image2 = 角色原圖
    const stage4Buf = await generateHairSwap(stage3Buf, characterImage);

    const finalKey = `final/${randomUUID()}.png`;
    await r2Put(finalKey, stage4Buf, "image/png");

    return { finalKey, intermediateKey, outfitKey, stage3Key };
}
