// Cheap token estimator. Real tokenizers (tiktoken) are heavy and BPE-specific.
// For a UI hint, ~chars/4 is the conventional approximation that holds within 10-20%.
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
