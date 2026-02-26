import { GoogleGenAI } from "@google/genai";

export const getGeminiClient = (apiKey?: string) => {
  const key = apiKey || import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("Gemini API Key is missing. Please provide one or set it in the environment.");
  }
  return new GoogleGenAI({ apiKey: key });
};
