import { GoogleGenAI } from "@google/genai";

export const getGeminiClient = (apiKey?: string) => {
  let key = apiKey?.trim();
  
  // If no key provided, check localStorage (client-side only)
  if (!key && typeof window !== 'undefined') {
    key = localStorage.getItem('gemini_api_key')?.trim();
  }

  // Fallback to environment variables
  if (!key) {
    key = (import.meta.env.GEMINI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim());
  }

  if (!key) {
    throw new Error("Gemini API Key is missing. Please provide one in Settings or set it in the environment.");
  }
  return new GoogleGenAI({ apiKey: key });
};
