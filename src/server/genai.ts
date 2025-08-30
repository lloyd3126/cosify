import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

export const ai = new GoogleGenAI(
    GEMINI_API_KEY ? { apiKey: GEMINI_API_KEY } : {}
);

export const IMAGE_MODEL =
    process.env.GENAI_IMAGE_MODEL || "gemini-2.5-flash-image-preview";
