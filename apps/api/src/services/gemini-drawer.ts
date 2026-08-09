import { GoogleGenerativeAI } from "@google/generative-ai";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { DrawerResult } from "../types/drawer";

// gemini-3.5-flash (non-lite) is banned -- see gemini.ts for the cost
// comparison that made lite the standing default everywhere.
export const DEFAULT_GEMINI_DRAWER_MODEL = "gemini-3.5-flash-lite";
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

// These elements are byte-identical on every single diagram: the filter/
// marker defs, the card background, and the field's fill/border/corner
// cones all sit at fixed coordinates that never depend on drill data (only
// the dynamic dimension labels, zone bar, and halfway line/circle actually
// vary and stay in the prompt). Previously the model reproduced all of
// this verbatim on every call -- pure boilerplate output, repeated 4-5x
// per session across every drill, costing tokens for zero variation and
// risking a misplaced/typo'd element silently breaking the diagram.
// Injected here instead, deterministically, so it's both cheaper and
// guaranteed correct. Any <defs> the model wrote anyway (prompt says not
// to) is stripped first so there's never a duplicate id; the other
// elements are harmless even if the model draws them too, since an exact
// duplicate rect/path at the same coordinates and color is visually a
// no-op, not a rendering bug -- so those aren't stripped, only asked not
// to be drawn.
const STANDARD_CHROME = `<rect x="0" y="0" width="800" height="760" fill="#08111f"/><defs>
<filter id="ps" x="-30%" y="-30%" width="160%" height="180%">
<feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="rgba(0,0,0,0.4)"/>
</filter>
<marker id="mPass" markerWidth="7" markerHeight="6" refX="5.5" refY="3" orient="auto"><polygon points="0 0,7 3,0 6" fill="#3b82f6"/></marker>
<marker id="mRun" markerWidth="7" markerHeight="6" refX="5.5" refY="3" orient="auto"><polygon points="0 0,7 3,0 6" fill="#3b82f6"/></marker>
<marker id="mPress" markerWidth="7" markerHeight="6" refX="5.5" refY="3" orient="auto"><polygon points="0 0,7 3,0 6" fill="#ef4444"/></marker>
<marker id="mCounter" markerWidth="7" markerHeight="6" refX="5.5" refY="3" orient="auto"><polygon points="0 0,7 3,0 6" fill="#22c55e"/></marker>
<marker id="mDeliver" markerWidth="7" markerHeight="6" refX="5.5" refY="3" orient="auto"><polygon points="0 0,7 3,0 6" fill="#ffffff"/></marker>
<marker id="mFinish" markerWidth="7" markerHeight="6" refX="5.5" refY="3" orient="auto"><polygon points="0 0,7 3,0 6" fill="#fbbf24"/></marker>
</defs><rect x="117.92" y="239.38" width="564.16" height="313.24" fill="#1c5134"/><rect x="117.92" y="239.38" width="564.16" height="313.24" rx="6" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2"/><path d="M 117.92 232.38 L 111.92 244.38 L 123.92 244.38 Z" fill="#f97316" stroke="#7c2d12" stroke-width="1"/><path d="M 682.08 232.38 L 676.08 244.38 L 688.08 244.38 Z" fill="#f97316" stroke="#7c2d12" stroke-width="1"/><path d="M 117.92 545.62 L 111.92 557.62 L 123.92 557.62 Z" fill="#f97316" stroke="#7c2d12" stroke-width="1"/><path d="M 682.08 545.62 L 676.08 557.62 L 688.08 557.62 Z" fill="#f97316" stroke="#7c2d12" stroke-width="1"/>`;

function injectStandardDefs(svg: string): string {
  const withoutModelDefs = svg.replace(/<defs>[\s\S]*?<\/defs>/, "");
  return withoutModelDefs.replace(/(<svg[^>]*>)/, `$1${STANDARD_CHROME}`);
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
  svg = injectStandardDefs(svg);

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
