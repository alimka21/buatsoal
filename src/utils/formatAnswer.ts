export const getFullAnswer = (answer: string, options?: string[]): string => {
  if (!options || !Array.isArray(options) || options.length === 0) return answer;

  const cleanAnswer = answer.trim();
  
  // 1. Check if answer is a direct match in options (ignoring potential A. prefix in option text)
  const directIndex = options.findIndex(opt => {
    const cleanOpt = opt.replace(/^[A-Ea-e][\.\)]\s*/, '').trim();
    return cleanOpt === cleanAnswer || opt.trim() === cleanAnswer;
  });
  
  if (directIndex !== -1) {
    const letter = String.fromCharCode(65 + directIndex);
    const text = options[directIndex].replace(/^[A-Ea-e][\.\)]\s*/, '').trim();
    return `${letter}. ${text}`;
  }

  // 2. Check if answer is just a letter (A, B, C...)
  const letterMatch = cleanAnswer.match(/^[A-Ea-e]$/);
  if (letterMatch) {
    const idx = letterMatch[0].toUpperCase().charCodeAt(0) - 65;
    if (options[idx]) {
      const text = options[idx].replace(/^[A-Ea-e][\.\)]\s*/, '').trim();
      return `${letterMatch[0].toUpperCase()}. ${text}`;
    }
  }

  return answer;
};
