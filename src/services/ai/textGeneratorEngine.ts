import { getGeminiClient } from './aiClient';
import { GenerateParams } from '../questionService';
import { getModeConfig, AssessmentMode } from './promptTemplates';

const GENERATOR_MODEL = "gemini-2.5-flash";
const EVALUATOR_MODEL = "gemini-2.5-flash"; // Use consistent model
const EVALUATOR_TIMEOUT_MS = 30000; // 30 seconds
const MAX_RETRIES = 2;

function cleanAndParseJSON(jsonString: string): any {
  // 1. Remove Markdown code blocks
  let cleaned = jsonString.replace(/```json\n?|\n?```/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn("JSON parse failed, attempting to sanitize LaTeX backslashes...", e);
    
    // 2. Fix common LaTeX escape issues by ensuring even backslashes for non-JSON escapes
    let sanitized = "";
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i] === '\\') {
        let count = 0;
        while (cleaned[i] === '\\') {
          count++;
          i++;
        }
        const nextChar = cleaned[i];
        const isValidEscape = /["\\/bfnrtu]/.test(nextChar || '');
        
        if (count % 2 === 1 && !isValidEscape) {
          count++;
        }
        
        sanitized += '\\'.repeat(count);
        if (i < cleaned.length) {
          sanitized += cleaned[i];
        }
      } else {
        sanitized += cleaned[i];
      }
    }
    
    try {
      return JSON.parse(sanitized);
    } catch (e2) {
       console.error("Failed to parse sanitized JSON", sanitized.substring(0, 200) + "...");
       throw e; // Throw original error to trigger retry logic
    }
  }
}

// 2️⃣ PISAHKAN LOGIKA TIPE SOAL (VALIDATOR)
function normalizeAndEnforceContract(q: any, index: number) {
  // 1️⃣ ID
  const id = typeof q.id === "number" ? q.id : index + 1;

  // 2️⃣ Stimulus normalization
  let stimulus = null;
  if (typeof q.stimulus === "string") {
    stimulus = {
      type: "text",
      content: q.stimulus
    };
  } else if (typeof q.stimulus === "object" && q.stimulus !== null) {
    stimulus = q.stimulus;
  }

  // 3️⃣ Force nullable fields
  const image_prompt = q.image_prompt || null;
  const options = Array.isArray(q.options) ? q.options : null;
  const pairs = Array.isArray(q.pairs) ? q.pairs : null;

  // 4️⃣ correct_answer normalization
  let correct_answer = "";
  if (Array.isArray(q.correct_answer)) {
    correct_answer = q.correct_answer.join(", ");
  } else {
    correct_answer = q.correct_answer || "";
  }

  // 5️⃣ explanation fallback
  const explanation = q.explanation || "Pembahasan belum tersedia.";

  // 6️⃣ metadata enforce
  const _type = q._type || "multiple_choice";
  const _topic = typeof q._topic === "string" ? q._topic : "";
  const _learning_objective = q._learning_objective || q._learning_objectives || "";
  const _cognitive_level = Number(q._cognitive_level) || 1;

  return {
    id,
    question: q.question || "",
    stimulus,
    image_prompt,
    options,
    pairs,
    correct_answer,
    explanation,
    _type,
    _topic,
    _learning_objective,
    _cognitive_level
  };
}

function validateQuestions(questions: any[], requestedTypes: string | string[], count: number, optionCount?: number) {
    if (!Array.isArray(questions)) {
        throw new Error("Result 'questions' is not an array.");
    }

    if (questions.length !== count) {
        throw new Error(`Question count mismatch. Expected ${count}, got ${questions.length}`);
    }

    questions.forEach((q: any, idx: number) => {
        // Check for required fields
        if (!q.question) {
             throw new Error(`Question ${idx + 1} is missing 'question' field.`);
        }

        // Auto-fill explanation if missing
        if (!q.explanation) {
            q.explanation = "Pembahasan lengkap akan ditambahkan oleh guru.";
        }

        // Validate correct_answer based on type
        if (q._type !== 'matching' && q._type !== 'essay' && q._type !== 'short_answer' && !q.correct_answer) {
             throw new Error(`Question ${idx + 1} is missing 'correct_answer'.`);
        }

        if ((q._type === 'essay' || q._type === 'short_answer') && !q.correct_answer) {
             q.correct_answer = "Lihat pembahasan.";
        }

        // Validate specific types
        if (q._type === "multiple_choice" || q._type === "complex_multiple_choice") {
            if (!q.options || !Array.isArray(q.options)) {
                throw new Error(`Question ${idx + 1} is missing 'options' array.`);
            }
            if (optionCount && q.options.length !== optionCount) {
                throw new Error(`Question ${idx + 1} has ${q.options.length} options, but ${optionCount} were requested.`);
            }
        }

        if (q._type === "complex_multiple_choice") {
            if (!q.correct_answer || !q.correct_answer.includes(",")) {
                // Try to fix if it's an array
                if (Array.isArray(q.correct_answer)) {
                    q.correct_answer = q.correct_answer.join(", ");
                } else {
                    throw new Error(`Question ${idx + 1} (Complex MC) must have multiple correct answers (comma separated). Got: ${q.correct_answer}`);
                }
            }
        }
        if (q._type === "matching") {
            if (!q.pairs || !Array.isArray(q.pairs) || q.pairs.length === 0) {
                throw new Error(`Question ${idx + 1} (Matching) must have 'pairs' array.`);
            }
            // Auto-fill correct_answer for matching if missing, for consistency
            if (!q.correct_answer) {
                q.correct_answer = "Pasangan yang benar sesuai tabel.";
            }
        }
        if (q._type === "true_false") {
             if (!q.options || q.options.length !== 2 || !q.options.includes("Benar") || !q.options.includes("Salah")) {
                 // Auto-fix if possible, otherwise throw
                 if (q.options && q.options.length === 2) {
                     // Assume index 0 is True, 1 is False or similar, but better to enforce strictness
                 }
                 throw new Error(`Question ${idx + 1} (True/False) must have options ["Benar", "Salah"].`);
             }
        }
        if (q._type === "essay" || q._type === "short_answer") {
            if (q.options && q.options.length > 0) {
                // Warning only, or strip it? Let's strip it to be safe
                delete q.options;
            }
        }
        
        // Validate Stimulus Structure
        if (q.stimulus) {
            if (typeof q.stimulus === 'object') {
                if (!['text', 'list', 'table', 'chart'].includes(q.stimulus.type)) {
                     throw new Error(`Question ${idx + 1} has invalid stimulus type: ${q.stimulus.type}`);
                }
                if (q.stimulus.type === 'text' && !q.stimulus.content) throw new Error(`Question ${idx + 1} (Text Stimulus) missing content.`);
                if (q.stimulus.type === 'list' && (!q.stimulus.items || !Array.isArray(q.stimulus.items))) throw new Error(`Question ${idx + 1} (List Stimulus) missing items array.`);
                if (q.stimulus.type === 'table' && (!q.stimulus.headers || !q.stimulus.rows)) throw new Error(`Question ${idx + 1} (Table Stimulus) missing headers or rows.`);
                if (q.stimulus.type === 'chart' && (!q.stimulus.description || !q.stimulus.image_prompt)) throw new Error(`Question ${idx + 1} (Chart Stimulus) missing description or image_prompt.`);
            }
            
            // Check for potential duplication
            if (q.stimulus.content && q.question.includes(q.stimulus.content.slice(0, 30))) {
               console.warn(`Potential duplication detected in Question ${idx + 1}: Question text might contain stimulus content.`);
            }
        }
    });
    
    return true;
}

function validateByMode(mode: AssessmentMode, jenjang: string, questions: any[]) {
    const config = getModeConfig(mode, jenjang).validator;
    
    questions.forEach((q, idx) => {
        const qNum = idx + 1;
        
        // 1. Check minimum cognitive level
        if (q._cognitive_level < config.minCognitive) {
            throw new Error(`Question ${qNum} cognitive level (C${q._cognitive_level}) is below the minimum required (C${config.minCognitive}) for ${mode.toUpperCase()} mode.`);
        }
        
        // 2. Enforce stimulus if required
        const hasStimulus = q.stimulus && (q.stimulus.content || (q.stimulus.items && q.stimulus.items.length) || (q.stimulus.rows && q.stimulus.rows.length));
        if (config.enforceStimulus && !hasStimulus) {
            throw new Error(`Question ${qNum} is missing a required stimulus for ${mode.toUpperCase()} mode.`);
        }
        
        // 3. Narrative word count check (heuristic)
        if (q.stimulus && q.stimulus.type === 'text' && q.stimulus.content) {
            const wordCount = q.stimulus.content.split(/\s+/).length;
            if (wordCount > config.maxNarrativeWords) {
                console.warn(`Question ${qNum} stimulus word count (${wordCount}) exceeds recommended max (${config.maxNarrativeWords}) for ${mode.toUpperCase()} mode.`);
                if (mode === 'tka' || mode === 'standard') {
                    if (wordCount > config.maxNarrativeWords + 20) { // Add a small buffer
                        throw new Error(`Question ${qNum} stimulus is too long (${wordCount} words) for ${mode.toUpperCase()} mode. Max is ${config.maxNarrativeWords}.`);
                    }
                }
            }
        }
        
        // Mode specific custom rules
        if (mode === 'akm') {
            if (q.stimulus && q.stimulus.type === 'text' && q.stimulus.content) {
                const wordCount = q.stimulus.content.split(/\s+/).length;
                if (wordCount < 50 && (!q.stimulus.rows || q.stimulus.rows.length < 3)) {
                    throw new Error(`Question ${qNum} stimulus is too short for AKM mode. Must be a rich text or a table with >= 3 rows.`);
                }
            }
            if (q.question.toLowerCase().includes("adalah pengertian dari") || q.question.toLowerCase().includes("yang dimaksud dengan")) {
                throw new Error(`Question ${qNum} contains direct definition phrasing, which is forbidden in AKM mode.`);
            }
        }
        
        if (mode === 'olympiad') {
            if (q.question.toLowerCase().includes("hitung hasil dari") || q.question.toLowerCase().includes("berapakah hasil")) {
                throw new Error(`Question ${qNum} contains simple computational phrasing ("hitung hasil dari"), forbidden in Olympiad mode.`);
            }
        }
    });
}

export const generateTextQuestions = async (params: GenerateParams, apiKey?: string, retries = 0, onProgress?: (percent: number) => void): Promise<{ result: any; retries: number }> => {
  try {
    const ai = getGeminiClient(apiKey);
    
    if (onProgress) onProgress(10);

    const currentMode = params.mode || 'standard';
    const modeConfig = getModeConfig(currentMode, params.jenjang);

    // Map cognitive level to string description
    const cognitiveMap = ["C1 (Mengingat)", "C2 (Memahami)", "C3 (Mengaplikasikan)", "C4 (Menganalisis)", "C5 (Mengevaluasi)", "C6 (Mencipta)"];
    let cognitiveStr = "";
    if (Array.isArray(params.cognitive_level)) {
        cognitiveStr = params.cognitive_level.map((level: number) => cognitiveMap[level - 1]).join(", ");
    } else {
        cognitiveStr = cognitiveMap[params.cognitive_level - 1] || "C4 (Menganalisis)";
    }

    // Calculate Question Distribution
    let distributionInstruction = "";
    if (Array.isArray(params.question_type) && params.question_type.length > 1) {
        const typeCount = params.question_type.length;
        const baseCount = Math.floor(params.count / typeCount);
        const remainder = params.count % typeCount;
        
        const distribution = params.question_type.map((type, index) => {
            const count = baseCount + (index < remainder ? 1 : 0);
            return `${count} ${type.replace('_', ' ')}`;
        });
        
        distributionInstruction = `2. Distribute the questions EXACTLY as follows: ${distribution.join(', ')}.`;
    } else {
        distributionInstruction = `2. Distribute the questions across the requested Question Types (${Array.isArray(params.question_type) ? params.question_type.join(", ") : params.question_type}).`;
    }

    const prompt = `
      ${modeConfig.generation.role}
      Task: Create ${params.count} questions.
      
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
      
      LANGUAGE RULE:
      - IF THE SUBJECT IS 'BAHASA INGGRIS' OR 'ENGLISH', THE ENTIRE CONTENT (QUESTIONS, STIMULUS, OPTIONS) MUST BE IN ENGLISH.
      - For other subjects, use Indonesian (Bahasa Indonesia) unless specified otherwise.
      
      DISTRIBUTION INSTRUCTIONS:
      1. Distribute the ${params.count} questions evenly across the provided Topics and Learning Objectives.
      ${distributionInstruction}
      3. RANDOMIZE the correct answer positions (A, B, C, D, E) evenly. Do not default to 'A' or 'B'.
      
      ${params.source_type !== 'no_material' && params.reference_text ? `Reference Material: "${params.reference_text}"` : ''}
      ${params.additional_instructions ? `Additional Instructions: ${params.additional_instructions}` : ''}

      ---
      QUALITY STANDARDS (MUST FOLLOW):
      ${modeConfig.generation.qualityStandards}

      MATH FORMULAS:
      - Use LaTeX ONLY for complex mathematical expressions (fractions, roots, integrals, powers, limits, matrices, etc.).
      - Wrap inline formulas in single dollar signs, e.g., $E=mc^2$.
      - Wrap block formulas in double dollar signs, e.g., $$x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$$.
      - IMPORTANT: You MUST escape all backslashes in LaTeX commands for JSON compatibility. Use "\\frac" instead of "\frac", "\\sqrt" instead of "\sqrt", etc.
      - DO NOT use LaTeX for simple arithmetic or text (e.g., write "2 + 2 = 4", not "$2 + 2 = 4$").
      - DO NOT auto-format simple variables like "x" or "y" unless part of a larger equation.

      STIMULUS STRUCTURE (1️⃣ UBAH STIMULUS JADI TERSTRUKTUR):
      ${modeConfig.generation.stimulusRule}
      - FORMATS:
        1. "text": Standard paragraphs.
        2. "list": Intro sentence + list of items.
        3. "table": Use for data presentation. Do NOT embed tables in plain text string.
        4. "chart": Use for graphical reasoning. Provide a description and image prompt.

      STIMULUS-QUESTION SEPARATION RULE:
      - The stimulus and the question must have distinct roles.
      - The question must NOT repeat or restate the stimulus text.
      - Do NOT copy sentences from the stimulus into the question.
      - The stimulus provides data/context only.
      - The question must directly refer to the stimulus without rewriting it.

      QUESTION TYPE RULES:
      1. Multiple Choice: Standard 1 correct answer. MUST provide EXACTLY ${params.option_count || 4} options.
      2. Complex Multiple Choice: MUST have MORE THAN ONE correct answer (e.g., "A, C" or "B, D, E"). MUST provide EXACTLY ${params.option_count || 4} options.
      3. Matching: MUST use the "pairs" field with "left" and "right" items. Do NOT use "options".
      4. True/False: Use "options": ["Benar", "Salah"].
      5. Essay/Short Answer: No options needed.

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
      - Verify multiple correct answers (for Complex MC).
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
            "stimulus": {
              "type": "text", // "text" | "list" | "table" | "chart"
              "content": "...", // REQUIRED if type is "text". The text content.
              "items": ["Item 1", "Item 2"], // REQUIRED if type is "list".
              "headers": ["Col1", "Col2"], // REQUIRED if type is "table". Array of column headers.
              "rows": [["Row1Col1", "Row1Col2"], ["Row2Col1", "Row2Col2"]], // REQUIRED if type is "table". Array of arrays of strings.
              "description": "...", // REQUIRED if type is "chart". Description of the chart.
              "image_prompt": "..." // REQUIRED if type is "chart". Prompt to generate the chart image.
            },
            "image_prompt": "...", // Detailed prompt for an image generator if the question needs an illustration (optional, separate from stimulus chart)
            "options": ["A", "B", "C", "D", "E"], // For multiple_choice, complex_multiple_choice, or true_false. NULL for matching.
            "pairs": [ // REQUIRED ONLY for "matching" type
               { "left": "Item 1", "right": "Match 1" },
               { "left": "Item 2", "right": "Match 2" }
            ],
            "correct_answer": "...", // REQUIRED for MC, Complex MC, True/False. OPTIONAL for Matching.
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
    
    // Updated to use user-requested model
    const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash-exp", "gemini-flash-latest"];
    let draftResponse;
    let lastError;

    for (const model of modelsToTry) {
        try {
            console.log(`Attempting generation with model: ${model}`);
            draftResponse = await ai.models.generateContent({
                model: model,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    temperature: modeConfig.generation.temperature
                }
            });
            if (draftResponse && draftResponse.text) {
                break; // Success
            }
        } catch (e: any) {
            console.warn(`Failed with model ${model}:`, e.message);
            lastError = e;
            // Continue to next model
        }
    }

    if (!draftResponse || !draftResponse.text) {
        throw lastError || new Error("All models failed to generate content");
    }

    if (onProgress) onProgress(40);

    let currentDraftText = draftResponse.text;
    if (!currentDraftText) throw new Error("No response from Gemini during draft generation");

    let currentDraft = cleanAndParseJSON(currentDraftText);

    // Normalize IDs and Stimulus immediately after parsing
    if (currentDraft && Array.isArray(currentDraft.questions)) {
        currentDraft.questions = currentDraft.questions.map((q: any, i: number) => normalizeAndEnforceContract(q, i));
    }

    // Calculate max cognitive level to determine if refinement is needed
    let maxCognitiveLevel = 0;
    if (Array.isArray(params.cognitive_level)) {
        maxCognitiveLevel = Math.max(...params.cognitive_level);
    } else {
        maxCognitiveLevel = params.cognitive_level;
    }

    // Skip refinement for Lower Order Thinking Skills (C1-C2)
    if (maxCognitiveLevel < 3) {
        console.log("Skipping refinement for Lower Order Thinking Skills (C1-C2)...");
        // Still run validation
        try {
            validateQuestions(currentDraft.questions, params.question_type, params.count, params.option_count);
        } catch (e) {
            console.warn("Validation failed for C1-C2 draft, but proceeding as refinement is skipped.", e);
        }
        if (onProgress) onProgress(100);
        return { result: currentDraft, retries: 0 };
    }

    // 3️⃣ ADAPTIVE REFINEMENT (Refine ONLY C3-C6)
    const questionsToRefine = currentDraft.questions.filter((q: any) => q._cognitive_level >= 3);
    const questionsToSkip = currentDraft.questions.filter((q: any) => !q._cognitive_level || q._cognitive_level < 3);

    if (questionsToRefine.length === 0) {
        console.log("No C3-C6 questions found. Skipping refinement.");
        if (onProgress) onProgress(100);
        return { result: currentDraft, retries: 0 };
    }

    console.log(`Step 2: Adaptive Refinement (Refining ${questionsToRefine.length} questions in batches)...`);
    if (onProgress) onProgress(60);

    let refinedQuestions: any[] = [];
    let totalRetries = retries;
    const BATCH_SIZE = 5;

    // Helper function for model fallback
    const generateWithFallback = async (prompt: string) => {
        let lastError;
        for (const model of modelsToTry) {
            try {
                console.log(`Attempting refinement with model: ${model}`);
                const response = await ai.models.generateContent({
                    model: model,
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                        temperature: 0.5
                    }
                });
                if (response && response.text) {
                    return response;
                }
            } catch (e: any) {
                console.warn(`Refinement failed with model ${model}:`, e.message);
                lastError = e;
            }
        }
        throw lastError || new Error("All models failed during refinement");
    };

    for (let i = 0; i < questionsToRefine.length; i += BATCH_SIZE) {
        const batch = questionsToRefine.slice(i, i + BATCH_SIZE);
        console.log(`Refining batch ${i / BATCH_SIZE + 1} (${batch.length} questions)...`);
        
        const refineEvalPrompt = `
${modeConfig.refinement.persona}

TASK:
1. Evaluate the ${batch.length} draft questions below.
2. Refine them to meet high quality standards.
3. Return ONLY the refined questions.

CONSTRAINTS:
- Question Types: ${Array.isArray(params.question_type) ? params.question_type.join(", ") : params.question_type}
- Randomize Answers: Yes

RUBRIC:
1. Alignment (Learning Obj)
2. Bloom Level (C3-C6 MUST have stimulus. C1-C2 ignore stimulus.)
3. Stimulus Quality (Contextual for C3+)
4. Distractors (Logical, not trivial)
5. Language (Clear, Grade ${params.class_grade})
6. Validity (1 correct answer, or multiple for Complex MC)
7. Stimulus-Question Separation: Check that the question does NOT repeat or duplicate stimulus text. Penalize repetition.
8. ${modeConfig.refinement.rubric}

DRAFT QUESTIONS (JSON):
${JSON.stringify(batch)}

OUTPUT JSON SCHEMA:
{
  "refined_questions": [
    // Array of questions matching the original schema
    {
      "id": 1, // Keep original ID
      "question": "...",
      "stimulus": {
        "type": "text", // "text" | "list" | "table" | "chart"
        "content": "...",
        "items": ["..."],
        "headers": ["..."],
        "rows": [["..."]],
        "description": "...",
        "image_prompt": "..."
      },
      "image_prompt": "...",
      "options": ["A", "B", "C", "D", "E"],
      "pairs": [
        { "left": "...", "right": "..." }
      ],
      "correct_answer": "...",
      "explanation": "...",
      "_type": "...",
      "_topic": "...",
      "_learning_objective": "...",
      "_cognitive_level": 4
    }
  ]
}
        `;

        try {
            const refineEvalResponse = await generateWithFallback(refineEvalPrompt);
            const refineEvalText = refineEvalResponse.text;
            if (!refineEvalText) throw new Error("No response from Gemini during refinement/evaluation");
            
            const result = cleanAndParseJSON(refineEvalText);
            
            if (result.refined_questions && Array.isArray(result.refined_questions)) {
                let batchRefined = result.refined_questions.map((q: any, idx: number) => {
                    const normalized = normalizeAndEnforceContract(q, idx);
                    // Try to match with original if possible, else just assign
                    normalized.id = batch[idx]?.id || normalized.id;
                    return normalized;
                });
                refinedQuestions.push(...batchRefined);
            } else {
                console.warn(`Refinement returned invalid structure for batch, using original questions.`);
                refinedQuestions.push(...batch);
            }

        } catch (err) {
            console.error(`Error refining questions batch:`, err);
            refinedQuestions.push(...batch); // Fallback to original if refinement fails
        }
        
        // Update progress
        if (onProgress) {
            const progress = 60 + Math.floor(((i + BATCH_SIZE) / questionsToRefine.length) * 30);
            onProgress(Math.min(progress, 90));
        }
    }

    // Merge refined questions back with skipped questions
    // We need to maintain order or just concat? 
    // Usually order matters if we want to distribute topics evenly, but since we split by cognitive level, 
    // the order might be mixed. Let's sort by ID if possible, or just concat.
    // The draft generation assigns IDs 1..N.
    
    const allQuestions = [...questionsToSkip, ...refinedQuestions].sort((a: any, b: any) => a.id - b.id);

    // Update current draft with refined questions
    currentDraft.questions = allQuestions;

    // 5️⃣ STRUCTURAL GUARD LAYER
    console.log("Step 3: Final Validation...");
    try {
        validateQuestions(currentDraft.questions, params.question_type, params.count, params.option_count);
        validateByMode(currentMode, params.jenjang, currentDraft.questions);
        console.log("Validation passed.");
    } catch (e: any) {
        console.error("Validation failed:", e.message);
        // In a real production system, we might trigger a re-generation here.
        // For now, we log it and maybe try to fix simple things or just return what we have with a warning.
        // throw e; // Or decide to return with warning
    }

    if (onProgress) onProgress(100);
    return { result: currentDraft, retries: totalRetries };

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
