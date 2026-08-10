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
};

// Models this harness will run without a confirmation prompt. Keep this in
// sync with the non-lite ban in gemini.ts -- the sandbox is for comparing
// CHEAP candidates, not for accidentally burning real money re-discovering
// why 3.5/3.6-flash got banned in the first place.
export const SANDBOX_ALLOWED_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-flash-lite",
];

export function estimateCostUsd(model: string, promptTokens: number | null, completionTokens: number | null): number | null {
  const rates = MODEL_PRICING[model];
  if (!rates || promptTokens == null || completionTokens == null) return null;
  return (promptTokens / 1_000_000) * rates.input + (completionTokens / 1_000_000) * rates.output;
}
