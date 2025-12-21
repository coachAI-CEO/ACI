import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error("GEMINI_API_KEY missing in .env");

// Use gemini-3-flash-preview as primary (better clarity scores, similar speed)
// Fallback to gemini-2.5-flash if preview model unavailable
const PRIMARY = process.env.GEMINI_MODEL_PRIMARY || "gemini-3-flash-preview";
const FALLBACK = process.env.GEMINI_MODEL_FALLBACK || "gemini-2.5-flash";

// Performance tuning - balance between speed and reliability
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 45000; // 45 seconds (Gemini can be very slow for complex prompts)
const MAX_RETRIES = Number(process.env.GEMINI_MAX_RETRIES) || 0; // No retries for speed (fail fast)
const BACKOFF_BASE_MS = Number(process.env.GEMINI_BACKOFF_BASE_MS) || 500; // Faster backoff

function newModel(name: string) {
  const genAI = new GoogleGenerativeAI(key!);
  return genAI.getGenerativeModel({ model: name });
}

function isTransient(e: any) {
  const msg = String(e?.message || e || "");
  return /(?:503|overload|temporarily unavailable|try again)/i.test(msg);
}

function isQuotaError(e: any) {
  const msg = String(e?.message || e || "");
  return /(?:429|quota|rate limit)/i.test(msg);
}

async function tryGenerate(modelName: string, prompt: string, attempts = MAX_RETRIES, timeoutMs = TIMEOUT_MS) {
  const m = newModel(modelName);
  let lastErr: any;
  
  // Ensure at least 1 attempt (attempts=0 means no retries, but still try once)
  const maxAttempts = Math.max(1, attempts + 1);
  
  for (let i = 0; i < maxAttempts; i++) {
    const startTime = Date.now();
    try {
      console.log(`[Gemini] Attempt ${i + 1}/${maxAttempts} with model ${modelName}, timeout: ${timeoutMs}ms, prompt length: ${prompt.length} chars`);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("LLM_TIMEOUT")), timeoutMs)
      );
      
      const generatePromise = m.generateContent(prompt);
      const r: any = await Promise.race([generatePromise, timeoutPromise]);
      
      const elapsed = Date.now() - startTime;
      console.log(`[Gemini] Success in ${elapsed}ms`);
      return r.response.text();
    } catch (e: any) {
      const elapsed = Date.now() - startTime;
      console.log(`[Gemini] Error after ${elapsed}ms: ${e.message || e}`);
      lastErr = e;
      
      // Don't retry quota errors - they won't resolve with retries
      if (isQuotaError(e)) throw e;
      
      // Only retry transient errors
      if (!isTransient(e) && e.message !== "LLM_TIMEOUT") throw e;
      
      // Don't retry if this was the last attempt
      if (i >= maxAttempts - 1) throw lastErr;
      
      // Exponential backoff with reduced timing
      const backoff = Math.min(BACKOFF_BASE_MS * (i + 1), 3000);
      console.log(`[Gemini] Retry ${i + 1}/${maxAttempts} after ${backoff}ms: ${e.message}`);
      await new Promise(res => setTimeout(res, backoff));
    }
  }
  throw lastErr;
}

export async function generateText(prompt: string, options?: { timeout?: number; retries?: number }) {
  const timeout = options?.timeout || TIMEOUT_MS;
  const retries = options?.retries ?? MAX_RETRIES;
  
  try {
    return await tryGenerate(PRIMARY, prompt, retries, timeout);
  } catch (e: any) {
    // Don't try fallback if quota error - it will fail too
    if (isQuotaError(e)) throw e;
    
    console.log(`[Gemini] Primary model failed, trying fallback: ${e.message}`);
    return await tryGenerate(FALLBACK, prompt, Math.min(retries, 1), timeout);
  }
}

export async function pingGemini() {
  return generateText("Say: ACI online");
}
