import { generateTextWithMetrics, setMetricsContext, clearMetricsContext } from "../../gemini";
import { estimateCostUsd } from "./pricing";

export type ModelRunResult = {
  model: string;
  ok: boolean;
  text: string | null;
  error: string | null;
  durationMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estCostUsd: number | null;
};

export type Scenario = {
  name: string;
  buildPrompt: () => string;
  // Optional: parse/validate the raw response so the report can show a
  // pass/fail signal beyond "it returned text", e.g. JSON.parse + shape check.
  validate?: (text: string) => { ok: boolean; note?: string };
};

// Runs every candidate model against the same prompt in parallel, isolated
// (fallbackModel: null) so a weak model's failure never silently gets
// covered by another model's answer -- the whole point is to see each one's
// output on its own merits.
export async function runScenario(
  scenario: Scenario,
  models: string[],
  opts?: { timeout?: number }
): Promise<{ scenario: string; prompt: string; results: (ModelRunResult & { validation?: { ok: boolean; note?: string } })[] }> {
  const prompt = scenario.buildPrompt();

  const results = await Promise.all(
    models.map(async (model): Promise<ModelRunResult & { validation?: { ok: boolean; note?: string } }> => {
      setMetricsContext({ operationType: `sandbox_${scenario.name}` });
      try {
        const r = await generateTextWithMetrics(prompt, {
          model,
          fallbackModel: null,
          timeout: opts?.timeout,
        });
        const validation = scenario.validate ? scenario.validate(r.text) : undefined;
        return {
          model,
          ok: true,
          text: r.text,
          error: null,
          durationMs: r.durationMs,
          promptTokens: r.promptTokens,
          completionTokens: r.completionTokens,
          totalTokens: r.totalTokens,
          estCostUsd: estimateCostUsd(model, r.promptTokens, r.completionTokens),
          validation,
        };
      } catch (e: any) {
        return {
          model,
          ok: false,
          text: null,
          error: e?.message || String(e),
          durationMs: null,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          estCostUsd: null,
        };
      } finally {
        clearMetricsContext();
      }
    })
  );

  return { scenario: scenario.name, prompt, results };
}
