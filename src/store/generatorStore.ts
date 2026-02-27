import { create } from 'zustand';
import { generateQuestions, GenerateParams } from '@/services/questionService';
import { generateHash } from '@/services/hashService';
import Swal from 'sweetalert2';

export const MAX_TOTAL_SOAL = 20;

interface GeneratorState {
  isGenerating: boolean;
  progress: number;
  result: any | null; // Merged result
  error: string | null;
  cacheHit: boolean;
  formData: any | null; // Store form data for history view
  
  generate: (userId: string, payload: GenerateParams) => Promise<void>;
  reset: () => void;
  setResult: (result: any, formData?: any) => void; // For history view
  setFormData: (data: any) => void;
}

export const useGeneratorStore = create<GeneratorState>((set, get) => ({
  isGenerating: false,
  progress: 0,
  result: null,
  error: null,
  cacheHit: false,
  formData: null,

  generate: async (userId: string, payload: GenerateParams) => {
    if (payload.count > MAX_TOTAL_SOAL) {
      Swal.fire('Peringatan', `Maksimal ${MAX_TOTAL_SOAL} soal per generate untuk menjaga kedalaman analisis HOTS.`, 'warning');
      return;
    }

    set({ isGenerating: true, progress: 0, result: null, error: null, formData: payload });

    try {
      // Since we now support arrays for topics and types in the service/prompt, 
      // we can make a single call or split if needed. 
      // For now, let's assume the service handles the complexity or we split here if we want granular progress.
      
      // However, to ensure better quality and avoid token limits or confusion, 
      // let's split by Question Type if multiple are selected, as the structure differs significantly.
      // But the prompt now handles mixed types. Let's try single call first as it's more efficient for "integrated" context.
      
      // Wait, if we have multiple topics, we might want to ensure coverage.
      // The prompt instructs to distribute.
      
      const { result, cacheHit } = await generateQuestions(userId, payload);
      
      // Post-process result to ensure _type, _topic, etc are present if the model didn't inject them perfectly
      // The model is asked to inject _type.
      // We can fallback to payload.question_type[0] if missing and only 1 type exists.
      
      if (result && result.questions) {
         result.questions = result.questions.map((q: any) => ({
             ...q,
             _type: q._type || (Array.isArray(payload.question_type) && payload.question_type.length === 1 ? payload.question_type[0] : 'multiple_choice'),
             _topic: payload.topic, // Can be array or string
             _learning_objectives: payload.learning_objectives
         }));
      }

      set({ 
        isGenerating: false, 
        result,
        cacheHit,
        progress: 100
      });

    } catch (error: any) {
      console.error("Generation error:", error);
      set({ 
        isGenerating: false, 
        error: error.message || "Gagal membuat soal",
        progress: 0
      });
      Swal.fire('Error', error.message || 'Terjadi kesalahan saat membuat soal', 'error');
    }
  },

  reset: () => set({ result: null, error: null, cacheHit: false, progress: 0, isGenerating: false, formData: null }),
  setResult: (result: any, formData?: any) => set({ result, cacheHit: true, error: null, formData: formData || null }),
  setFormData: (data: any) => set({ formData: data })
}));
