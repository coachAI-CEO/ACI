import { GoogleGenerativeAI } from "@google/generative-ai";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { DrawerResult } from "../types/drawer";

export const DEFAULT_GEMINI_DRAWER_MODEL = "gemini-3.5-flash";
const DEFAULT_GEMINI_DRAWER_TIMEOUT_MS = 20_000;

export async function generateDiagramSVG(prompt: string): Promise<DrawerResult> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { ok: false, reason: "model_error", raw: "GEMINI_API_KEY missing" };

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_DRAWER_MODEL ?? DEFAULT_GEMINI_DRAWER_MODEL;
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 12000,
      },
    });
    const timeoutMs = Number(process.env.GEMINI_DRAWER_TIMEOUT_MS ?? DEFAULT_GEMINI_DRAWER_TIMEOUT_MS);
    const result = await withTimeout(
      model.generateContent(prompt),
      Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_GEMINI_DRAWER_TIMEOUT_MS
    );
    return validateAndCleanSVG(result.response.text());
  } catch (err) {
    return { ok: false, reason: "model_error", raw: err instanceof Error ? err.message : String(err) };
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Gemini drawer timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function validateAndCleanSVG(raw: string): DrawerResult {
  let svg = raw
    .replace(/^```(?:svg|xml)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const startMatch = svg.match(/<svg(?:\s|>)/);
  const start = startMatch ? startMatch.index ?? -1 : -1;
  const end = svg.lastIndexOf("</svg>");
  if (start === -1 || end === -1 || end < start) {
    return { ok: false, reason: "invalid_output", raw };
  }
  svg = svg.slice(start, end + "</svg>".length);

  if (svg.length < 500) {
    console.warn("diagram_svg_suspiciously_short", { length: svg.length });
    return { ok: false, reason: "too_short", raw };
  }
  if (svg.length > 120_000) return { ok: false, reason: "too_large", raw };

  if (!isValidXml(svg)) return { ok: false, reason: "xml_error", raw };
  if (containsBlockedSvg(svg)) return { ok: false, reason: "unsafe_svg", raw };

  const sanitized = sanitizeSVG(svg);
  if (!isValidXml(sanitized)) return { ok: false, reason: "xml_error", raw };
  if (containsBlockedSvg(sanitized)) return { ok: false, reason: "unsafe_svg", raw };

  return { ok: true, svg: sanitized };
}

function isValidXml(svg: string): boolean {
  const valid = XMLValidator.validate(svg);
  if (valid !== true) return false;
  try {
    new XMLParser({ ignoreAttributes: false }).parse(svg);
    return true;
  } catch {
    return false;
  }
}

function containsBlockedSvg(svg: string): boolean {
  return /<\s*(script|foreignObject|iframe|object|embed)\b/i.test(svg)
    || /\s+on[a-z]+\s*=/i.test(svg)
    || /\b(?:href|xlink:href)\s*=\s*["']\s*(?:javascript:|https?:)/i.test(svg);
}

function sanitizeSVG(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?<\/embed>/gi, "")
    .replace(/\s+on\w+="[^"]*"/gi, "")
    .replace(/\s+on\w+='[^']*'/gi, "")
    .replace(/\s+(?:href|xlink:href)="\s*javascript:[^"]*"/gi, "")
    .replace(/\s+(?:href|xlink:href)='\s*javascript:[^']*'/gi, "");
}
