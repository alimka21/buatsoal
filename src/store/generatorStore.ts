import { create } from 'zustand';
import { generateQuestions, GenerateParams } from '@/services/questionService';
import { generateHash } from '@/services/hashService';
import Swal from 'sweetalert2';

export const MAX_SOAL_PER_ITEM = 5;
export const MAX_CART_ITEM = 5;
export const MAX_TOTAL_SOAL = 20;

export interface CartItem {
  id: string;
  payload: GenerateParams;
  hash: string;
  status: 'waiting' | 'generating' | 'cached' | 'done' | 'failed';
  result?: any;
  error?: string;
}

interface GeneratorState {
  cart: CartItem[];
  isGenerating: boolean;
  progress: number;
  result: any | null; // Merged result
  error: string | null;
  cacheHit: boolean; // Just for backward compatibility if needed, though batch might have mixed hits
  formData: any | null; // Store form data for history view
  
  addToCart: (payload: GenerateParams) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  generateBatch: (userId: string) => Promise<void>;
  reset: () => void;
  setResult: (result: any, formData?: any) => void; // For history view
  setFormData: (data: any) => void;
}

export const useGeneratorStore = create<GeneratorState>((set, get) => ({
  cart: [],
  isGenerating: false,
  progress: 0,
  result: null,
  error: null,
  cacheHit: false,
  formData: null,

  addToCart: (payload: GenerateParams) => {
    const { cart } = get();
    
    if (payload.count > MAX_SOAL_PER_ITEM) {
      Swal.fire('Peringatan', `Maksimal ${MAX_SOAL_PER_ITEM} soal per konfigurasi untuk menjaga kualitas berbasis rubric.`, 'warning');
      return;
    }
    
    if (cart.length >= MAX_CART_ITEM) {
      Swal.fire('Peringatan', `Maksimal ${MAX_CART_ITEM} konfigurasi dalam keranjang.`, 'warning');
      return;
    }

    const hash = generateHash(payload);
    const newItem: CartItem = {
      id: Math.random().toString(36).substring(7),
      payload,
      hash,
      status: 'waiting'
    };

    set({ cart: [...cart, newItem] });
  },

  removeFromCart: (id: string) => {
    const { cart } = get();
    set({ cart: cart.filter(item => item.id !== id) });
  },

  clearCart: () => set({ cart: [], result: null, error: null, progress: 0 }),

  generateBatch: async (userId: string) => {
    const { cart } = get();
    
    if (cart.length === 0) return;

    const totalSoal = cart.reduce((sum, item) => sum + item.payload.count, 0);
    if (totalSoal > MAX_TOTAL_SOAL) {
      Swal.fire('Peringatan', `Maksimal ${MAX_TOTAL_SOAL} soal per generate untuk menjaga kedalaman analisis HOTS dan kualitas distraktor.`, 'warning');
      return;
    }

    set({ isGenerating: true, progress: 0, result: null, error: null });

    const mergedResults: any[] = [];
    let hasError = false;

    for (let i = 0; i < cart.length; i++) {
      const item = cart[i];
      
      // Update status to generating
      set(state => ({
        cart: state.cart.map(c => c.id === item.id ? { ...c, status: 'generating' } : c)
      }));

      try {
        const { result, cacheHit } = await generateQuestions(userId, item.payload);
        
        if (result && result.questions) {
          const questionsWithType = result.questions.map((q: any) => ({
            ...q,
            _type: item.payload.question_type, // Inject type for grouping later
            _topic: item.payload.topic,
            _learning_objectives: item.payload.learning_objectives
          }));
          mergedResults.push(...questionsWithType);
        }

        set(state => ({
          cart: state.cart.map(c => c.id === item.id ? { 
            ...c, 
            status: cacheHit ? 'cached' : 'done',
            result 
          } : c),
          progress: Math.round(((i + 1) / cart.length) * 100)
        }));

      } catch (error: any) {
        console.error(`Error generating item ${item.id}:`, error);
        hasError = true;
        set(state => ({
          cart: state.cart.map(c => c.id === item.id ? { 
            ...c, 
            status: 'failed',
            error: error.message 
          } : c),
          progress: Math.round(((i + 1) / cart.length) * 100)
        }));
        // Continue to next item
      }
    }

    if (hasError) {
      Swal.fire('Peringatan', 'Beberapa soal gagal dibuat. Silakan periksa status di keranjang.', 'warning');
    }

    // Create a merged result object
    const finalResult = {
      subject: "Kompilasi Soal",
      topic: "Berbagai Topik",
      questions: mergedResults
    };

    set({ 
      isGenerating: false, 
      result: finalResult,
      progress: 100
    });
  },

  reset: () => set({ result: null, error: null, cacheHit: false, cart: [], progress: 0, isGenerating: false, formData: null }),
  setResult: (result: any, formData?: any) => set({ result, cacheHit: true, error: null, formData: formData || null }),
  setFormData: (data: any) => set({ formData: data })
}));
