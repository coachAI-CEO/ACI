// Thin MiniMax client, mirroring generateTextWithMetrics's shape from
// gemini.ts/deepseek.ts. Uses the chatcompletion_v2 endpoint (not the
// plain OpenAI-compatible /v1/chat/completions one) because it returns the
// model's reasoning in a separate `reasoning_content` field -- the plain
// endpoint inlines a <think>...</think> block into `content` itself, which
// breaks every scenario's JSON-parsing validator.
const MINIMAX_BASE_URL = process.env.MINIMAX_BASE_URL || "https://api.minimax.io";
const TIMEOUT_MS = Number(process.env.MINIMAX_TIMEOUT_MS) || 45000;

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
  const key = process.env.MINIMAX_API_KEY;
  if (!key) throw new Error("MINIMAX_API_KEY missing in .env");

  const model = options?.model || process.env.MINIMAX_MODEL || "MiniMax-M2.7";
  const timeout = options?.timeout || TIMEOUT_MS;
  const startTime = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${MINIMAX_BASE_URL}/v1/text/chatcompletion_v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
        ...(options?.reasoningEffort === "none"
          ? { chat_template_kwargs: { thinking: false }, reasoning: { exclude: true } }
          : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`MiniMax ${res.status}: ${body.slice(0, 300)}`);
    }

    const json: any = await res.json();
    if (json?.base_resp?.status_code && json.base_resp.status_code !== 0) {
      throw new Error(`MiniMax API error ${json.base_resp.status_code}: ${json.base_resp.status_msg}`);
    }
    const text = json?.choices?.[0]?.message?.content;
    if (typeof text !== "string") throw new Error("MiniMax response missing choices[0].message.content");

    return {
      text,
      model,
      durationMs: Date.now() - startTime,
      promptTokens: json?.usage?.prompt_tokens ?? null,
      completionTokens: json?.usage?.completion_tokens ?? null,
      totalTokens: json?.usage?.total_tokens ?? null,
    };
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("MINIMAX_TIMEOUT");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
