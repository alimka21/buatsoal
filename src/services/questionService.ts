import { supabase } from './supabaseClient';
import { generateContentWithRetry, GENERATION_MODEL } from './aiService';
import { generateHash } from './hashService';

export interface GenerateParams {
  // Identitas Pembelajaran
  jenjang: string;
  fase: string;
  class_grade: string; // Kelas / Semester
  subject: string; // Mata Pelajaran
  learning_objectives: string; // Tujuan Pembelajaran
  
  // Konfigurasi Soal
  topic: string;
  source_type: 'no_material' | 'upload_pdf' | 'manual_input';
  reference_text?: string; // For manual input or extracted PDF text
  cognitive_level: number; // 1-6 (C1-C6)
  question_type: 'multiple_choice' | 'complex_multiple_choice' | 'true_false' | 'essay' | 'short_answer' | 'matching';
  count: number;
  option_count?: number; // 3, 4, or 5
  generate_image?: boolean;
  
  // Legacy/Optional/System
  difficulty?: string; // Derived from cognitive level or explicit
  additional_instructions?: string;
  apiKey?: string;
}

export const generateQuestions = async (userId: string, params: GenerateParams) => {
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

    return {
      result: cachedData.result_json,
      cacheHit: true,
      hash: inputHash
    };
  }

  // 2. Call AI Service
  try {
    // Map cognitive level to string description
    const cognitiveMap = ["C1 (Mengingat)", "C2 (Memahami)", "C3 (Mengaplikasikan)", "C4 (Menganalisis)", "C5 (Mengevaluasi)", "C6 (Mencipta)"];
    const cognitiveStr = cognitiveMap[params.cognitive_level - 1] || "C4 (Menganalisis)";

    const prompt = `
      Role: Expert Teacher & Curriculum Designer.
      Task: Create ${params.count} HOTS (Higher Order Thinking Skills) questions.
      
      Context:
      - Level: ${params.jenjang}
      - Phase: ${params.fase}
      - Class/Semester: ${params.class_grade}
      - Subject: ${params.subject}
      - Topic: ${params.topic}
      - Learning Objectives: ${params.learning_objectives}
      - Cognitive Level: ${cognitiveStr}
      - Question Type: ${params.question_type}
      ${params.generate_image ? '- Requirement: Include relevant image/graph/table descriptions for questions where applicable.' : ''}
      
      ${params.source_type !== 'no_material' && params.reference_text ? `Reference Material: "${params.reference_text}"` : ''}
      ${params.additional_instructions ? `Additional Instructions: ${params.additional_instructions}` : ''}
      
      Output strictly in JSON format.
      Schema:
      {
        "subject": "${params.subject}",
        "topic": "${params.topic}",
        "questions": [
          {
            "id": 1,
            "question": "...",
            "stimulus": "...", // Context/Case study/Intro text if needed
            "image_description": "...", // If generate_image is true, describe the image/graph needed here.
            "options": ["A", "B", "C", "D", "E"], // For multiple_choice (${params.option_count || 5} options), complex_multiple_choice (${params.option_count || 5} options), or true_false (["Benar", "Salah"])
            "correct_answer": "...", // For complex_multiple_choice, use comma separated values (e.g., "A, C"). For true_false, use "Benar" or "Salah".
            "explanation": "..."
          }
        ]
      }
    `;

    const { result: resultJson, retries } = await generateContentWithRetry(prompt, params.apiKey);

    // 3. Save to DB (Atomic Insert with Conflict Handling)
    const { data: savedData, error: saveError } = await supabase
      .from('generated_questions')
      .insert({
        created_by: userId,
        input_hash: inputHash,
        input_payload_json: params,
        reference_text: params.reference_text,
        result_json: resultJson,
        model_used: GENERATION_MODEL
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

