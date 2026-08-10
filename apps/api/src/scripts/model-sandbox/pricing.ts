// Standard-tier pricing, USD per 1M tokens. Source: https://ai.google.dev/gemini-api/docs/pricing
// checked 2026-08-10. Re-check before trusting cost numbers for a new model --
// Google revises these, and a stale entry silently under/overstates cost.
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-3.6-flash": { input: 1.5, output: 7.5 },
  "gemini-3.5-flash": { input: 1.5, output: 9.0 },
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "gemini-3.1-flash-lite-preview": { input: 0.25, output: 1.5 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  // Cache-miss input rate (worst case) -- DeepSeek's cache-hit rate is
  // $0.0028/1M, ~50x cheaper, but the sandbox always sends a fresh prompt
  // so cache-miss is the realistic number here. Source:
  // https://api-docs.deepseek.com/quick_start/pricing, checked 2026-08-10.
  "deepseek-v4-flash": { input: 0.14, output: 0.28 },
  // Source: https://platform.minimax.io/docs/guides/pricing-paygo, checked 2026-08-10.
  "MiniMax-M2.7": { input: 0.3, output: 1.2 },
  "MiniMax-M2.7-highspeed": { input: 0.6, output: 2.4 },
  // Source: https://developers.openai.com/api/docs/pricing, checked 2026-08-10.
  "gpt-5-nano": { input: 0.05, output: 0.4 },
};

// Models this harness will run without a confirmation prompt. Keep this in
// sync with the non-lite ban in gemini.ts -- the sandbox is for comparing
// CHEAP candidates, not for accidentally burning real money re-discovering
// why 3.5/3.6-flash got banned in the first place.
export const SANDBOX_ALLOWED_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-flash-lite",
  "deepseek-v4-flash",
  "MiniMax-M2.7",
  "MiniMax-M2.7-highspeed",
  "gpt-5-nano",
];

export function estimateCostUsd(model: string, promptTokens: number | null, completionTokens: number | null): number | null {
  const rates = MODEL_PRICING[model];
  if (!rates || promptTokens == null || completionTokens == null) return null;
  return (promptTokens / 1_000_000) * rates.input + (completionTokens / 1_000_000) * rates.output;
}
