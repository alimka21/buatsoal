import { getGeminiClient } from './aiClient';

const IMAGE_MODEL_NATIVE = "gemini-2.5-flash-image";
const IMAGE_MODEL_IMAGEN = "imagen-3.0-generate-002";
const MAX_RETRIES = 1;

export const generateImage = async (prompt: string, apiKey?: string, retries = 0): Promise<{ imageBase64: string | null; retries: number }> => {
  const ai = getGeminiClient(apiKey);
  
  // Try using Imagen 3.0 (generateImages) first as it is much more consistent and is the standard for text-to-image
  try {
    console.log(`Attempting image generation with ${IMAGE_MODEL_IMAGEN}...`);
    const response = await ai.models.generateImages({
      model: IMAGE_MODEL_IMAGEN,
      prompt: `Educational illustration suitable for students, clean, clear, simple: ${prompt}. No unnecessary text, labels or borders.`,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    });

    if (response.generatedImages && response.generatedImages[0]?.image?.imageBytes) {
      console.log(`Image generated successfully using ${IMAGE_MODEL_IMAGEN}`);
      return { imageBase64: response.generatedImages[0].image.imageBytes, retries };
    }
  } catch (imagenError: any) {
    console.warn(`Imagen 3.0 prompt failed: ${imagenError.message || imagenError}. Falling back to ${IMAGE_MODEL_NATIVE}...`);
  }

  // Fallback to gemini-2.5-flash-image (generateContent)
  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL_NATIVE,
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

    if (imageBase64) {
      console.log(`Image generated successfully using fallback ${IMAGE_MODEL_NATIVE}`);
      return { imageBase64, retries };
    }
    
    throw new Error("No image data found in fallback model response");
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
      console.warn(`All Image APIs failed (${normalizedError.type}), retrying (${retries + 1}/${MAX_RETRIES})...`, error);
      return generateImage(prompt, apiKey, retries + 1);
    }
    
    console.error("Image generation failed after retries:", error);
    return { imageBase64: null, retries };
  }
};
