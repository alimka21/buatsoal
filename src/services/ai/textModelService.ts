import { getGeminiClient } from './aiClient';
import { GenerateParams } from '../questionService';

const TEXT_MODEL = "gemini-2.5-flash";
const MAX_RETRIES = 2;

export const generateTextQuestions = async (params: GenerateParams, apiKey?: string, retries = 0): Promise<{ result: any; retries: number }> => {
  try {
    const ai = getGeminiClient(apiKey);
    
    // Map cognitive level to string description
    const cognitiveMap = ["C1 (Mengingat)", "C2 (Memahami)", "C3 (Mengaplikasikan)", "C4 (Menganalisis)", "C5 (Mengevaluasi)", "C6 (Mencipta)"];
    const cognitiveStr = cognitiveMap[params.cognitive_level - 1] || "C4 (Menganalisis)";

    const prompt = `
      Role: Expert Teacher & Curriculum Designer.
      Task: Create ${params.count} HOTS (Higher Order Thinking Skills) questions.
      
      Context:
      - Level: ${params.jenjang}
      - Phase: ${params.fase}
      - Class: ${params.class_grade}
      - Subject: ${params.subject}
      - Topic: ${params.topic}
      - Learning Objectives: ${params.learning_objectives}
      - Cognitive Level: ${cognitiveStr}
      - Question Type: ${params.question_type}
      
      IMPORTANT: Adjust the complexity of the questions and language based strictly on the "Level" (Jenjang) and "Class" (Kelas). 
      For example, Grade 1 SD questions must be very simple and concrete, while SMA questions should be more complex and abstract.
      
      ${params.source_type !== 'no_material' && params.reference_text ? `Reference Material: "${params.reference_text}"` : ''}
      ${params.additional_instructions ? `Additional Instructions: ${params.additional_instructions}` : ''}

      ---
      QUALITY STANDARDS (MUST FOLLOW):
      1. Contextual Stimulus: Questions must be based on real-world context, cases, data, or situations (not direct definitions).
      2. Valid Measurement: Questions must directly measure the provided Learning Objectives.
      3. Logical Distractors: Distractors must be plausible, based on common student misconceptions, and not trivial or absurd. Avoid "All of the above" or "None of the above".
      4. No Ambiguity: Questions must have one clear correct answer (unless question type allows multiple).
      5. No Clueing: The question stem should not give away the answer.
      6. Clear Language: Use clear, economical, and grade-appropriate language.
      7. Understanding over Rote: Test for deep understanding, not just memorization (except for C1).

      STIMULUS STRUCTURE:
      - Must include a context/case/data/text/situation (2-4 sentences minimum, except for lower grades).
      - Must be relevant to students' lives.
      - Must contain information that students need to analyze to answer the question.
      - For Higher Levels (C4+): Stimulus must include data, a problem to solve, or trigger reasoning.

      BLOOM'S TAXONOMY RUBRIC:
      - C1: Recall facts (simple).
      - C2: Explain in own words.
      - C3: Apply to new situations.
      - C4: Analyze relationships (MUST use case-based stimulus).
      - C5: Evaluate or choose the best solution (MUST use case-based stimulus).
      - C6: Create/design a solution (MUST use case-based stimulus).

      DISTRACTOR CONTROL:
      - Based on common misconceptions.
      - Relative length should be similar to the correct answer.
      - No absurd or joke options.

      IMAGE PROMPT RULES:
      - If a question would benefit from an illustration, diagram, or graph, provide a detailed description in "image_prompt".
      - Must describe the object in detail so an image generator can create it.
      - If no image is needed, leave it empty or null.

      SELF-VALIDATION (Internal Step):
      - Verify Bloom's level match.
      - Verify alignment with Learning Objectives.
      - Verify no ambiguity.
      - Verify only 1 correct answer (for standard MC).
      ---
      
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
            "image_prompt": "...", // Detailed prompt for an image generator if the question needs an illustration (optional)
            "options": ["A", "B", "C", "D", "E"], // For multiple_choice (${params.option_count || 5} options), complex_multiple_choice (${params.option_count || 5} options), or true_false (["Benar", "Salah"])
            "correct_answer": "...", // For complex_multiple_choice, use comma separated values (e.g., "A, C"). For true_false, use "Benar" or "Salah".
            "explanation": "..."
          }
        ]
      }
    `;

    // STEP 1: Generate Draft
    console.log("Step 1: Generating Draft...");
    const draftResponse = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.7
      }
    });

    let currentDraftText = draftResponse.text;
    if (!currentDraftText) throw new Error("No response from Gemini during draft generation");

    let iteration = 0;
    const MAX_REFINEMENTS = 2;
    let totalRetries = retries;

    while (iteration < MAX_REFINEMENTS) {
      // STEP 2: Refine + Evaluate Draft
      console.log(`Step 2: Refining and Evaluating Draft (Iteration ${iteration + 1})...`);
      const refineEvalPrompt = `
Anda adalah AI evaluator soal pendidikan yang sangat ketat sekaligus Ahli Pembuat Soal HOTS.

TUGAS:
1. Evaluasi draf soal di bawah ini menggunakan rubrik yang disediakan.
2. Perbaiki soal tersebut agar memenuhi standar kualitas tinggi (skor >= 24/30).
3. Kembalikan hasil perbaikan beserta skor evaluasinya dalam format JSON.

RUBRIK PENILAIAN (skor 1–5):
1. Alignment Tujuan Pembelajaran: Mengukur tujuan pembelajaran (${params.learning_objectives}).
2. Kesesuaian Bloom Level: Sesuai level Bloom (${cognitiveStr}).
3. Kualitas Stimulus: Kontekstual, informatif, memicu analisis.
4. Kualitas Distraktor: Opsi salah logis dan tidak trivial.
5. Kejelasan Bahasa: Jelas dan sesuai jenjang (${params.jenjang} Kelas ${params.class_grade}).
6. Validitas Teknis Soal: Hanya ada satu jawaban benar dan tidak ambigu.

DRAF SOAL AWAL (JSON):
${currentDraftText}

OUTPUT JSON SCHEMA:
{
  "refined_questions": [
    // Array of questions matching the original schema
    {
      "id": 1,
      "question": "...",
      "stimulus": "...",
      "image_prompt": "...",
      "options": ["A", "B", "C", "D", "E"],
      "correct_answer": "...",
      "explanation": "..."
    }
  ],
  "score": 0, // Total score out of 30
  "analysis": "Penjelasan singkat mengenai perbaikan yang dilakukan dan alasan skor."
}
      `;

      const refineEvalResponse = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: refineEvalPrompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.5
        }
      });

      const refineEvalText = refineEvalResponse.text;
      if (!refineEvalText) throw new Error("No response from Gemini during refinement/evaluation");
      
      const result = JSON.parse(refineEvalText);
      console.log(`Iteration ${iteration + 1} Score: ${result.score}/30`);
      console.log(`Analysis: ${result.analysis}`);

      // Update current draft with refined questions
      const updatedDraft = {
        subject: params.subject,
        topic: params.topic,
        questions: result.refined_questions
      };
      currentDraftText = JSON.stringify(updatedDraft);

      // STEP 3: Check Score
      if (result.score >= 24) {
         console.log("Score is >= 24, returning final output.");
         return { result: updatedDraft, retries: totalRetries };
      }

      iteration++;
      totalRetries++;
    }

    console.log("Max refinements reached, returning current draft.");
    return { result: JSON.parse(currentDraftText), retries: totalRetries };

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
      console.warn(`Gemini Text API call failed (${normalizedError.type}), retrying (${retries + 1}/${MAX_RETRIES})...`, error);
      return generateTextQuestions(params, apiKey, retries + 1);
    }
    
    const finalError: any = new Error(normalizedError.message);
    finalError.type = normalizedError.type;
    throw finalError;
  }
};
