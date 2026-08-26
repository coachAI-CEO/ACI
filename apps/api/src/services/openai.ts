// Thin OpenAI client, mirroring generateTextWithMetrics's shape from
// gemini.ts/deepseek.ts/minimax.ts. Uses the plain chat completions
// endpoint (OpenAI keeps this backward-compatible across model families,
// including GPT-5).
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com";
const TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS) || 45000;

export async function generateTextWithMetrics(
  prompt: string,
  options?: { timeout?: number; model?: string; reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high" }
): Promise<{
  text: string;
  model: string;
  durationMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing in .env");

  const model = options?.model || "gpt-5-nano";
  const timeout = options?.timeout || TIMEOUT_MS;
  const startTime = Date.now();

  console.log(`[OpenAI] Attempt with model ${model}, timeout: ${timeout}ms, prompt length: ${prompt.length} chars`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  // Belt-and-suspenders: a silent 48-minute hang was observed live
  // (2026-08-26) well past the AbortController's timeout, meaning fetch()
  // did not reliably honor the abort signal for a stalled response body
  // read (headers can return promptly while the body itself never
  // completes). Race the whole call against an independent timer so a
  // hang can never again silently eat an entire batch run.
  const hardTimeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("OPENAI_HARD_TIMEOUT")), timeout + 15000)
  );

  const attempt = (async () => {
    try {
      const res = await fetch(`${OPENAI_BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          ...(options?.reasoningEffort ? { reasoning_effort: options.reasoningEffort } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`OpenAI ${res.status}: ${body.slice(0, 300)}`);
      }

      const json: any = await res.json();
      const text = json?.choices?.[0]?.message?.content;
      if (typeof text !== "string") throw new Error("OpenAI response missing choices[0].message.content");

      const result = {
        text,
        model,
        durationMs: Date.now() - startTime,
        promptTokens: json?.usage?.prompt_tokens ?? null,
        completionTokens: json?.usage?.completion_tokens ?? null,
        totalTokens: json?.usage?.total_tokens ?? null,
      };
      console.log(`[OpenAI] Success in ${result.durationMs}ms`);
      return result;
    } catch (e: any) {
      if (e?.name === "AbortError") throw new Error("OPENAI_TIMEOUT");
      throw e;
    }
  })();

  try {
    return await Promise.race([attempt, hardTimeout]);
  } catch (e: any) {
    console.log(`[OpenAI] Error after ${Date.now() - startTime}ms: ${e?.message || String(e)}`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
