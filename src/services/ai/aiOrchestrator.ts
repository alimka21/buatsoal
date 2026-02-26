import { GenerateParams } from '../questionService';
import { generateTextQuestions } from './textModelService';

export const generateQuestionsOrchestrator = async (params: GenerateParams, apiKey?: string) => {
  // STEP 1: Call Text Model -> generate structured questions
  console.log("Orchestrator: Calling Text Model...");
  const { result: textResult, retries: textRetries } = await generateTextQuestions(params, apiKey);

  // STEP 2: Return result (images are now generated on-demand via UI)
  return {
    result: textResult,
    retries: textRetries
  };
};
