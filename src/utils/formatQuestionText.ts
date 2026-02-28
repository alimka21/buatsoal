export function formatQuestionText(text: string): string {
  let t = text;
  
  // Add newline after specific introductory phrases
  t = t.replace(/((?:Bacalah|Perhatikan|Cermati).*?berikut:)/gi, "$1\n");
  
  // Add newline before numbered list items (e.g., " 1. ", " 2. ") within the text
  t = t.replace(/\s+(\d+\.\s)/g, "\n$1");
  
  return t;
}
