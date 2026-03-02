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

  // 1. Call AI Orchestrator
  try {
    if (onProgress) onProgress(10);
    const { result: resultJson, retries } = await generateQuestionsOrchestrator(params, params.apiKey, onProgress);

    // 2. Save to DB (Individual Questions to Bank Soal)
    try {
      if (resultJson && resultJson.questions && Array.isArray(resultJson.questions)) {
        const questionsToInsert = resultJson.questions.map((q: any) => ({
          user_id: userId,
          content: q,
          subject: params.subject,
          topic: Array.isArray(q._topic) ? q._topic[0] : q._topic,
          question_type: q._type,
          cognitive_level: q._cognitive_level
        }));

        const { data: savedQuestions, error: saveError } = await supabase
          .from('questions')
          .insert(questionsToInsert)
          .select();

        if (saveError) {
          console.error("Failed to save questions to bank:", saveError);
        } else if (savedQuestions) {
          // Inject the DB IDs back into the result so the UI can use them
          resultJson.questions = savedQuestions.map(sq => ({
            ...sq.content,
            id: sq.id
          }));
        }
      }
    } catch (dbError) {
      console.error("Database save error:", dbError);
    }

    // 3. Log Activity (Success)
    try {
      const { error } = await supabase.from('activity_log').insert({
        user_id: userId,
        input_hash: inputHash,
        model_used: GENERATION_MODEL,
        retry_count: retries,
        cache_hit: false,
        status: 'success'
      });
      if (error) throw error;
    } catch (logError) {
      console.error("Activity log error:", logError);
    }

    return {
      result: resultJson,
      cacheHit: false,
      hash: inputHash
    };
  } catch (error: any) {
    // Log Failure
    try {
      const { error: logError } = await supabase.from('activity_log').insert({
        user_id: userId,
        input_hash: inputHash,
        model_used: GENERATION_MODEL,
        retry_count: 2,
        cache_hit: false,
        status: 'failed',
        details: { error: error.message, type: error.type || 'unknown' }
      });
      if (logError) throw logError;
    } catch (err) {
      console.error("Failed to log failure:", err);
    }
    throw error;
  }
};

