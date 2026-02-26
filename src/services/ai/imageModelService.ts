import { getGeminiClient } from './aiClient';

const IMAGE_MODEL = "gemini-2.5-flash-image";
const MAX_RETRIES = 1;

export const generateImage = async (prompt: string, apiKey?: string, retries = 0): Promise<{ imageBase64: string | null; retries: number }> => {
  try {
    const ai = getGeminiClient(apiKey);
    
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: {
        parts: [
          {
            text: `Generate an educational illustration for the following description: ${prompt}. The image should be clear, simple, and suitable for students. Do not include any text in the image unless necessary for labels.`
          }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1", // Default square for questions
        }
      }
    });

    let imageBase64: string | null = null;

    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageBase64 = part.inlineData.data;
          break; // Found the image
        }
      }
    }

    if (!imageBase64) {
      // If no image found, maybe retry or just return null (as image generation might fail or be refused)
      // But user wants retry logic.
      throw new Error("No image generated in response");
    }
    
    return { imageBase64, retries };
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
      console.warn(`Gemini Image API call failed (${normalizedError.type}), retrying (${retries + 1}/${MAX_RETRIES})...`, error);
      return generateImage(prompt, apiKey, retries + 1);
    }
    
    // If image generation fails after retries, we might want to return null instead of throwing, 
    // so the question can still be saved without the image.
    console.error("Image generation failed after retries:", error);
    return { imageBase64: null, retries };
  }
};
