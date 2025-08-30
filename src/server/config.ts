function readTemperature(name: string): number | undefined {
    const raw = (process.env[name] || "").trim();
    if (!raw) return undefined;
    const n = Number(raw);
    if (Number.isNaN(n)) return undefined;
    // Clamp to [0, 2] which is common for Gemini models
    const clamped = Math.min(2, Math.max(0, n));
    return clamped;
}

export const TEMPERATURES = {
    toCosplayer: readTemperature("COSIFY_TEMP_TO_COSPLAYER"),
    toCosplayerOutfit: readTemperature("COSIFY_TEMP_TO_COSPLAYER_OUTFIT"),
    toUserCosplay: readTemperature("COSIFY_TEMP_TO_USER_COSPLAY"),
};
