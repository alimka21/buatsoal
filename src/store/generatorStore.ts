import { create } from 'zustand';
import { generateQuestions, GenerateParams } from '@/services/questionService';
import { supabase } from '@/services/supabaseClient';

interface GeneratorState {
  loading: boolean;
  result: any | null;
  error: string | null;
  cacheHit: boolean;
  requestTimestamps: number[]; // For rate limiting
  generate: (userId: string, params: GenerateParams) => Promise<void>;
  reset: () => void;
}

export const useGeneratorStore = create<GeneratorState>((set, get) => ({
  loading: false,
  result: null,
  error: null,
  cacheHit: false,
  requestTimestamps: [],

  generate: async (userId: string, params: GenerateParams) => {
    const { requestTimestamps } = get();
    const now = Date.now();
    
    // 1. Soft Rate Limit Check (20 requests per minute)
    const recentRequests = requestTimestamps.filter(t => now - t < 60000);
    if (recentRequests.length >= 20) {
      set({ error: "Rate limit exceeded. Please wait a moment before generating again." });
      return;
    }

    // Update timestamps
    set({ 
      loading: true, 
      error: null, 
      result: null, 
      cacheHit: false,
      requestTimestamps: [...recentRequests, now]
    });

    try {
      const { result, cacheHit } = await generateQuestions(userId, params);
      set({ result, cacheHit, loading: false });
    } catch (error: any) {
      console.error("Generation error:", error);
      set({ error: error.message || "Failed to generate questions", loading: false });
      
      // Log error (already logged in service, but good to have store state consistent)
    }
  },

  reset: () => set({ result: null, error: null, cacheHit: false })
}));
