import { GoogleGenAI } from "@google/genai";

export const GENERATION_MODEL = "gemini-3-flash-preview";

const MAX_RETRIES = 2;

export const getGeminiClient = (apiKey?: string) => {
  const key = apiKey || import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("Gemini API Key is missing. Please provide one or set it in the environment.");
  }
  return new GoogleGenAI({ apiKey: key });
};

export const generateContentWithRetry = async (
  prompt: string, 
  apiKey?: string, 
  retries = 0
): Promise<{ result: any; retries: number }> => {
  try {
    const ai = getGeminiClient(apiKey);
    
    const response = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const responseText = response.text;
    if (!responseText) throw new Error("No response from Gemini");
    
    return { result: JSON.parse(responseText), retries };
  } catch (error: any) {
    // Error Normalization
    let normalizedError = {
      message: error.message || "Unknown error occurred",
      type: "unknown"
    };

    if (error.message?.includes("network") || error.message?.includes("fetch")) {
      normalizedError.type = "network";
    } else if (error.message?.includes("429") || error.message?.includes("quota")) {
      normalizedError.type = "quota";
    } else if (error.message?.includes("model") || error.message?.includes("generate")) {
      normalizedError.type = "model";
    }

    if (retries < MAX_RETRIES) {
      console.warn(`Gemini API call failed (${normalizedError.type}), retrying (${retries + 1}/${MAX_RETRIES})...`, error);
      // Simple exponential backoff could be added here if needed
      return generateContentWithRetry(prompt, apiKey, retries + 1);
    }
    
    // Attach type to error object for logging
    const finalError: any = new Error(normalizedError.message);
    finalError.type = normalizedError.type;
    throw finalError;
  }
};
