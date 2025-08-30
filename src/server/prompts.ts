// 伺服端提示詞：優先採用環境變數，否則使用內建預設

const DEFAULT_TO_COSPLAYER_PROMPT =
    "Generate a highly detailed photo of a person cosplaying this illustration, at Comiket. Exactly replicate the same pose, body posture, hand gestures, facial expression, and camera framing as in the original illustration. Keep the same angle, perspective, and composition, without any deviation";

const DEFAULT_TO_USER_COSPLAY_PROMPT =
    "Create a photorealistic final image by composing the provided inputs with strict fidelity: Use the user's photo (image 1) as the base identity, face, skin tone, body shape, and camera viewpoints. Transfer the cosplay styling from the generated cosplayer reference (image 2) including costume, colors, textures, accessories, wig/hair style, and makeup patterns. Preserve the exact pose, hand gestures, facial expression, camera framing, angle, perspective, and composition from image 2. Keep natural lighting and coherent shadows; avoid warping limbs, extra fingers, or distorted hands. Maintain clean edges around costume elements; do not introduce logos, text, or watermarks. The final image should look like a single coherent photo of the user wearing the cosplay from image 2, shot with the same framing and perspective, with realistic skin blending and consistent lighting.";

export const TO_COSPLAYER_PROMPT =
    (process.env.COSIFY_PROMPT_TO_COSPLAYER || "").trim() || DEFAULT_TO_COSPLAYER_PROMPT;

export const TO_USER_COSPLAY_PROMPT =
    (process.env.COSIFY_PROMPT_TO_USER_COSPLAY || "").trim() || DEFAULT_TO_USER_COSPLAY_PROMPT;

// 新增：將 cosplayer/outfit 轉為平鋪服裝（不包含臉與身體部位）
const DEFAULT_TO_COSPLAYER_OUTFIT_PROMPT =
    "convert the outfit(image 1) into a flat lay outfit without any face, head, hands, legs, or human body parts visible — only the clothing and accessories neatly arranged on a clean background";

export const TO_COSPLAYER_OUTFIT_PROMPT =
    (process.env.COSIFY_PROMPT_TO_COSPLAYER_OUTFIT || "").trim() || DEFAULT_TO_COSPLAYER_OUTFIT_PROMPT;
