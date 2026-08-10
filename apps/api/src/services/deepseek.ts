// Thin DeepSeek client, mirroring the shape of gemini.ts's
// generateTextWithMetrics so the model sandbox can treat both providers
// interchangeably. DeepSeek's API is OpenAI-chat-completions-compatible.
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const TIMEOUT_MS = Number(process.env.DEEPSEEK_TIMEOUT_MS) || 45000;

export async function generateTextWithMetrics(
  prompt: string,
  options?: { timeout?: number; model?: string }
): Promise<{
  text: string;
  model: string;
  durationMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY missing in .env");

  const model = options?.model || "deepseek-v4-flash";
  const timeout = options?.timeout || TIMEOUT_MS;
  const startTime = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`DeepSeek ${res.status}: ${body.slice(0, 300)}`);
    }

    const json: any = await res.json();
    const text = json?.choices?.[0]?.message?.content;
    if (typeof text !== "string") throw new Error("DeepSeek response missing choices[0].message.content");

    return {
      text,
      model,
      durationMs: Date.now() - startTime,
      promptTokens: json?.usage?.prompt_tokens ?? null,
      completionTokens: json?.usage?.completion_tokens ?? null,
      totalTokens: json?.usage?.total_tokens ?? null,
    };
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("DEEPSEEK_TIMEOUT");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
