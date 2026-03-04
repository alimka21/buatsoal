export function stripLatex(text: string): string {
  if (!text) return "";

  return text
    .replace(/\$\$(.*?)\$\$/g, "$1")  // remove block delimiters
    .replace(/\$(.*?)\$/g, "$1")      // remove inline delimiters
    .replace(/\\frac{(.*?)}{(.*?)}/g, "($1)/($2)")
    .replace(/\\sqrt{(.*?)}/g, "√($1)")
    .replace(/\\times/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\pm/g, "±")
    .replace(/\\cdot/g, "·")
    .replace(/\\\\/g, "\\")            // Fix escaped backslashes
    .replace(/\\[a-zA-Z]+/g, "");     // remove unknown commands
}
