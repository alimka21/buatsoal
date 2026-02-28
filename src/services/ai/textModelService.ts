import { getGeminiClient } from './aiClient';
import { GenerateParams } from '../questionService';

const GENERATOR_MODEL = "gemini-2.5-flash";
const EVALUATOR_MODEL = "gemini-3-flash";
const EVALUATOR_TIMEOUT_MS = 20000; // 20 seconds
const MAX_RETRIES = 2;

function cleanAndParseJSON(jsonString: string): any {
  // 1. Remove Markdown code blocks
  let cleaned = jsonString.replace(/```json\n?|\n?```/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn("JSON parse failed, attempting to sanitize LaTeX backslashes...", e);
    
    // 2. Try to fix common LaTeX escape issues
    // The error "Bad escaped character" happens when a backslash is followed by an invalid escape char.
    // We want to escape backslashes that are likely part of LaTeX commands but not valid JSON escapes.
    // Valid JSON escapes: " \ / b f n r t u
    // We will double-escape backslashes that are followed by a character that is NOT a valid escape.
    
    // Regex explanation:
    // \\        Match a single backslash
    // (?!       Negative lookahead (not followed by...)
    //   ["\\/bfnrtu]  Any of the valid escape characters
    // )
    const sanitized = cleaned.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
    
    try {
      return JSON.parse(sanitized);
    } catch (e2) {
       // If that fails, try a more aggressive approach: escape ALL backslashes that aren't already escaped?
       // No, that might break valid escapes like \n.
       // Let's try one more fallback: if the error is specifically about bad escapes, 
       // maybe we just double escape ALL backslashes if the previous attempt failed? 
       // But that turns \n into \\n (literal \n), which might be okay for text content.
       
       // Let's stick to the first sanitization for now, as it targets the specific "Bad escaped character" cause.
       console.error("Failed to parse sanitized JSON", sanitized.substring(0, 200) + "...");
       throw e; // Throw original error to trigger retry logic
    }
  }
}

export const generateTextQuestions = async (params: GenerateParams, apiKey?: string, retries = 0, onProgress?: (percent: number) => void): Promise<{ result: any; retries: number }> => {
  try {
    const ai = getGeminiClient(apiKey);
    
    if (onProgress) onProgress(20);

    // Map cognitive level to string description
    const cognitiveMap = ["C1 (Mengingat)", "C2 (Memahami)", "C3 (Mengaplikasikan)", "C4 (Menganalisis)", "C5 (Mengevaluasi)", "C6 (Mencipta)"];
    let cognitiveStr = "";
    if (Array.isArray(params.cognitive_level)) {
        cognitiveStr = params.cognitive_level.map((level: number) => cognitiveMap[level - 1]).join(", ");
    } else {
        cognitiveStr = cognitiveMap[params.cognitive_level - 1] || "C4 (Menganalisis)";
    }

    const prompt = `
      Role: Expert Teacher & Curriculum Designer.
      Task: Create ${params.count} HOTS (Higher Order Thinking Skills) questions.
      
      Context:
      - Level: ${params.jenjang}
      - Phase: ${params.fase}
      - Class: ${params.class_grade}
      - Subject: ${params.subject}
      - Topics: ${Array.isArray(params.topic) ? params.topic.join(", ") : params.topic}
      - Learning Objectives: ${Array.isArray(params.learning_objectives) ? params.learning_objectives.join(", ") : params.learning_objectives}
      - Cognitive Level: ${cognitiveStr}
      - Question Types: ${Array.isArray(params.question_type) ? params.question_type.join(", ") : params.question_type}
      
      IMPORTANT: Adjust the complexity of the questions and language based strictly on the "Level" (Jenjang) and "Class" (Kelas). 
      For example, Grade 1 SD questions must be very simple and concrete, while SMA questions should be more complex and abstract.
      
      DISTRIBUTION INSTRUCTIONS:
      1. Distribute the ${params.count} questions evenly across the provided Topics and Learning Objectives.
      2. Distribute the questions across the requested Question Types (${Array.isArray(params.question_type) ? params.question_type.join(", ") : params.question_type}).
      3. RANDOMIZE the correct answer positions (A, B, C, D, E) evenly. Do not default to 'A' or 'B'.
      
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

      MATH FORMULAS:
      - Use LaTeX ONLY for complex mathematical expressions (fractions, roots, integrals, powers, limits, matrices, etc.).
      - Wrap inline formulas in single dollar signs, e.g., $E=mc^2$.
      - Wrap block formulas in double dollar signs, e.g., $$x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$$.
      - IMPORTANT: You MUST escape all backslashes in LaTeX commands for JSON compatibility. Use "\\frac" instead of "\frac", "\\sqrt" instead of "\sqrt", etc.
      - DO NOT use LaTeX for simple arithmetic or text (e.g., write "2 + 2 = 4", not "$2 + 2 = 4$").
      - DO NOT auto-format simple variables like "x" or "y" unless part of a larger equation.

      STIMULUS STRUCTURE:
      - Must include a context/case/data/text/situation (2-4 sentences minimum, except for lower grades).
      - Must be relevant to students' lives.
      - Must contain information that students need to analyze to answer the question.
      - For Higher Levels (C4+): Stimulus must include data, a problem to solve, or trigger reasoning.
      - LONG READING PASSAGES: For subjects like Bahasa Indonesia, English, IPS, PPKN, etc., provide longer reading passages (texts, poems, news, etc.) as stimulus.
      - MANDATORY PREFIX: If a reading passage is used, precede it with a clear instruction line, e.g., "Bacalah Pernyataan Berikut:", "Bacalah Pantun Berikut:", "Bacalah Berita Berikut:", etc.

      QUESTION STEM RULES:
      - Avoid ending the question stem with a direct question mark if possible. Use incomplete sentences or direct instructions.
      - Example (Good): "Berdasarkan grafik tersebut, kesimpulan yang paling tepat mengenai pertumbuhan ekonomi adalah ..."
      - Example (Bad): "Apa kesimpulan yang dapat diambil dari grafik tersebut?"
      - Ensure the stem clearly directs the student to the answer without being conversational.

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
      - STRICT RULE: ONLY generate an "image_prompt" if the question ABSOLUTELY REQUIRES visualization to be understood (e.g., geometry, biology diagrams, physics setups).
      - DO NOT generate images for algebra, arithmetic, simple equations, or text-based questions.
      - If the question can be understood without a visual, set "image_prompt" to null or empty string.
      - If an image is needed, describe the object in detail so an image generator can create it.

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
        "topic": "${Array.isArray(params.topic) ? params.topic[0] : params.topic}", // Primary topic
        "questions": [
          {
            "id": 1,
            "question": "...",
            "stimulus": "...", // Context/Case study/Intro text if needed
            "image_prompt": "...", // Detailed prompt for an image generator if the question needs an illustration (optional)
            "options": ["A", "B", "C", "D", "E"], // For multiple_choice (${params.option_count || 5} options), complex_multiple_choice (${params.option_count || 5} options), or true_false (["Benar", "Salah"])
            "correct_answer": "...", // For complex_multiple_choice, use comma separated values (e.g., "A, C"). For true_false, use "Benar" or "Salah".
            "explanation": "...",
            "_type": "multiple_choice", // The specific type of this question from the requested types
            "_topic": "...", // The specific topic this question covers from the provided list
            "_learning_objective": "...", // The specific learning objective this question addresses
            "_cognitive_level": 4 // The specific cognitive level (number) of this question (e.g., 3, 4, 5)
          }
        ]
      }
    `;

    // STEP 1: Generate Draft
    console.log("Step 1: Generating Draft...");
    const draftResponse = await ai.models.generateContent({
      model: GENERATOR_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.7
      }
    });

    if (onProgress) onProgress(50);

    let currentDraftText = draftResponse.text;
    if (!currentDraftText) throw new Error("No response from Gemini during draft generation");

    let iteration = 0;
    const MAX_REFINEMENTS = 2;
    let totalRetries = retries;

    while (iteration < MAX_REFINEMENTS) {
      // STEP 2: Refine + Evaluate Draft
      console.log(`Step 2: Refining and Evaluating Draft (Iteration ${iteration + 1})...`);
      
      if (onProgress) onProgress(50 + ((iteration + 1) * 20)); // 70%, 90%

      const refineEvalPrompt = `
Anda adalah AI evaluator soal pendidikan yang sangat ketat sekaligus Ahli Pembuat Soal HOTS.

TUGAS:
1. Evaluasi draf soal di bawah ini menggunakan rubrik yang disediakan.
2. Perbaiki soal tersebut agar memenuhi standar kualitas tinggi (skor >= 24/30).
3. Kembalikan hasil perbaikan beserta skor evaluasinya dalam format JSON.

PASTIKAN:
- Jumlah soal tetap ${params.count}
- Distribusi topic tetap merata
- Tipe soal sesuai permintaan (${Array.isArray(params.question_type) ? params.question_type.join(", ") : params.question_type})
- Posisi jawaban tetap random

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

      // Helper function for model fallback
      const generateWithFallback = async () => {
        const tryModel = async (model: string, timeout?: number) => {
            const generatePromise = ai.models.generateContent({
                model: model,
                contents: refineEvalPrompt,
                config: {
                  responseMimeType: "application/json",
                  temperature: 0.5
                }
            });

            if (!timeout) return await generatePromise;

            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Timeout")), timeout)
            );

            return await Promise.race([generatePromise, timeoutPromise]) as any;
        };

        try {
            console.log(`Attempting refinement with ${EVALUATOR_MODEL}...`);
            return await tryModel(EVALUATOR_MODEL, EVALUATOR_TIMEOUT_MS);
        } catch (error) {
            console.warn(`Evaluator model (${EVALUATOR_MODEL}) failed or timed out, falling back to ${GENERATOR_MODEL}. Error:`, error);
            return await tryModel(GENERATOR_MODEL);
        }
      };

      const refineEvalResponse = await generateWithFallback();

      const refineEvalText = refineEvalResponse.text;
      if (!refineEvalText) throw new Error("No response from Gemini during refinement/evaluation");
      
      const result = cleanAndParseJSON(refineEvalText);
      console.log(`Iteration ${iteration + 1} Score: ${result.score}/30`);
      console.log(`Analysis: ${result.analysis}`);

      // Structural Guard
      if (result.refined_questions.length !== params.count) {
        throw new Error(`Refinement broke question count. Expected ${params.count}, got ${result.refined_questions.length}`);
      }

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
    return { result: cleanAndParseJSON(currentDraftText), retries: totalRetries };

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
      return generateTextQuestions(params, apiKey, retries + 1, onProgress);
    }
    
    const finalError: any = new Error(normalizedError.message);
    finalError.type = normalizedError.type;
    throw finalError;
  }
};
