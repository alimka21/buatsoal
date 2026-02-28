import { supabase } from './supabaseClient';
import { generateHash } from './hashService';
import { generateQuestionsOrchestrator } from './ai/aiOrchestrator';
import { GENERATION_MODEL } from './aiService'; // Still need this for logging model used, or update it

export interface GenerateParams {
  // Identitas Pembelajaran
  jenjang: string;
  fase: string;
  class_grade: string; // Kelas / Semester
  subject: string; // Mata Pelajaran
  
  // Konfigurasi Soal
  learning_objectives: string[]; // Tujuan Pembelajaran (Array)
  topic: string[]; // Topik (Array)
  
  source_type: 'no_material' | 'upload_pdf' | 'manual_input';
  reference_text?: string; // For manual input or extracted PDF text
  cognitive_level: number | number[]; // 1-6 (C1-C6)
  question_type: string[]; // Array of types
  count: number;
  option_count?: number; // 3, 4, or 5
  
  // Legacy/Optional/System
  difficulty?: string; // Derived from cognitive level or explicit
  additional_instructions?: string;
  apiKey?: string;
}

export const generateQuestions = async (userId: string, params: GenerateParams, onProgress?: (percent: number) => void) => {
  const inputHash = generateHash(params);

  // 1. Check Cache (Read-first optimization, though insert-conflict handles it too)
  const { data: cachedData } = await supabase
    .from('generated_questions')
    .select('*')
    .eq('input_hash', inputHash)
    .single();

  if (cachedData) {
    // Log Cache Hit
    await supabase.from('activity_log').insert({
      user_id: userId,
      input_hash: inputHash,
      model_used: cachedData.model_used,
      retry_count: 0,
      cache_hit: true,
      status: 'success'
    });

    if (onProgress) onProgress(100);

    return {
      result: cachedData.result_json,
      cacheHit: true,
      hash: inputHash
    };
  }

  // 2. Call AI Orchestrator
  try {
    if (onProgress) onProgress(10);
    const { result: resultJson, retries } = await generateQuestionsOrchestrator(params, params.apiKey, onProgress);

    // 3. Save to DB (Atomic Insert with Conflict Handling)
    const { data: savedData, error: saveError } = await supabase
      .from('generated_questions')
      .insert({
        created_by: userId,
        input_hash: inputHash,
        input_payload_json: params,
        reference_text: params.reference_text,
        result_json: resultJson,
        model_used: GENERATION_MODEL // Or update to reflect multi-model usage
      })
      .select()
      .single();

    if (saveError) {
      // If conflict (duplicate key), it means another request saved it just now.
      // We should fetch that one.
      if (saveError.code === '23505') { // Unique violation
         const { data: existingData } = await supabase
          .from('generated_questions')
          .select('*')
          .eq('input_hash', inputHash)
          .single();
          
         if (existingData) {
           return {
             result: existingData.result_json,
             cacheHit: true, // Technically a race-condition cache hit
             hash: inputHash
           };
         }
      }
      console.error("Failed to save cache:", saveError);
    }

    // 4. Log Activity (Success)
    await supabase.from('activity_log').insert({
      user_id: userId,
      input_hash: inputHash,
      model_used: GENERATION_MODEL,
      retry_count: retries,
      cache_hit: false,
      status: 'success'
    });

    return {
      result: resultJson,
      cacheHit: false,
      hash: inputHash
    };
  } catch (error: any) {
    // Log Failure
    await supabase.from('activity_log').insert({
      user_id: userId,
      input_hash: inputHash,
      model_used: GENERATION_MODEL,
      retry_count: 2, // Assuming max retries reached if failed
      cache_hit: false,
      status: 'failed',
      details: { error: error.message, type: error.type || 'unknown' }
    });
    throw error;
  }
};

