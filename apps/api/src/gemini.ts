import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error("GEMINI_API_KEY missing in .env");

const PRIMARY = process.env.GEMINI_MODEL_PRIMARY || "gemini-2.5-pro";
const FALLBACK = process.env.GEMINI_MODEL_FALLBACK || "gemini-2.5-flash";

function newModel(name: string) {
  const genAI = new GoogleGenerativeAI(key!);
  return genAI.getGenerativeModel({ model: name });
}

function isTransient(e: any) {
  const msg = String(e?.message || e || "");
  return /(?:429|503|overload|temporarily unavailable|try again)/i.test(msg);
}

async function tryGenerate(modelName: string, prompt: string, attempts = 3) {
  const m = newModel(modelName);
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await m.generateContent(prompt);
      return r.response.text();
    } catch (e: any) {
      lastErr = e;
      if (!isTransient(e)) throw e;
      const backoff = Math.min(2000 * (i + 1), 6000);
      await new Promise(res => setTimeout(res, backoff));
    }
  }
  throw lastErr;
}

export async function generateText(prompt: string) {
  try {
    return await tryGenerate(PRIMARY, prompt);
  } catch {
    return await tryGenerate(FALLBACK, prompt, 2);
  }
}

export async function pingGemini() {
  return generateText("Say: ACI online");
}
