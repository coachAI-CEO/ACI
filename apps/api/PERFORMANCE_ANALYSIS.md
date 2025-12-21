# ACI API Performance Analysis

## Problem: Slow Response Times (3+ minutes)

The `/coach/generate-drill-vetted` endpoint is taking 3-5 minutes to return responses, even when failing.

## Root Cause Analysis

### The Call Chain

```
Request
  ↓
[Attempt 1]
  ↓
generateAndReviewDrill()
  ├─→ LLM Call #1: Generate drill (with retries)
  └─→ LLM Call #2: QA review (with retries)
  ↓
fixDrillDecision()
  ↓
[If PATCHABLE]
  ↓
fixDrill()
  ├─→ LLM Call #3: Fix drill (with retries)
  └─→ LLM Call #4: QA after fix (with retries)
  ↓
[If NEEDS_REGEN → Attempt 2, Attempt 3...]
```

### Retry Logic (gemini.ts)

Each LLM call uses `tryGenerate()` with:
- **3 retry attempts** for primary model
- **Exponential backoff**: 2s → 4s → 6s
- **Fallback to secondary model** with 2 more attempts
- **No timeout** - calls can hang indefinitely

```typescript
async function tryGenerate(modelName: string, prompt: string, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await m.generateContent(prompt);
    } catch (e: any) {
      if (!isTransient(e)) throw e;
      const backoff = Math.min(2000 * (i + 1), 6000);  // 2s, 4s, 6s
      await new Promise(res => setTimeout(res, backoff));
    }
  }
}

export async function generateText(prompt: string) {
  try {
    return await tryGenerate(PRIMARY, prompt);      // 3 attempts + backoff
  } catch {
    return await tryGenerate(FALLBACK, prompt, 2);  // 2 more attempts
  }
}
```

### Worst-Case Timing Breakdown

**Single Attempt** (if Gemini is rate-limiting):

| Step | Retries | Backoff | Time |
|------|---------|---------|------|
| Generate drill (primary) | 3 | 2s + 4s + 6s | ~12s + API time |
| QA drill (primary) | 3 | 2s + 4s + 6s | ~12s + API time |
| Generate drill (fallback) | 2 | 2s + 4s | ~6s + API time |
| QA drill (fallback) | 2 | 2s + 4s | ~6s + API time |
| **Subtotal per attempt** | | | **~40-60 seconds** |

**All 3 Attempts**:
- 3 attempts × 60s = **180 seconds (3 minutes)**

**With PATCHABLE + Fixer**:
- Add 2 more LLM calls per attempt
- **Total: 240-300 seconds (4-5 minutes)**

## Current Issues

### 1. No Timeout on LLM Calls
- Google Gemini API calls can hang indefinitely
- No maximum timeout configured
- Users wait with no feedback

### 2. Aggressive Retry Logic
- 3 retries + fallback = up to 5 LLM calls per prompt
- Each retry has exponential backoff (up to 6s)
- Compounds across multiple attempts

### 3. Multiple Attempts Loop
- Default: 3 attempts (`COACH_MAX_DRILL_ATTEMPTS`)
- Each attempt runs the full generate + QA pipeline
- No early exit if Gemini quota is exhausted

### 4. Fixer Adds More Calls
- PATCHABLE drills trigger 2 additional LLM calls
- No way to skip fixer for faster responses
- Happens on EVERY patchable drill

### 5. No Progress Feedback
- Client has no idea what's happening
- 3 minutes of silence before response
- Looks like a hang/timeout

## Potential Solutions

### Short-Term Fixes (Quick Wins)

#### 1. Add Timeout to LLM Calls
```typescript
async function tryGenerate(modelName: string, prompt: string, attempts = 3, timeout = 30000) {
  const m = newModel(modelName);
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const r = await m.generateContent(prompt, { signal: controller.signal });
      clearTimeout(timeoutId);
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
```

#### 2. Reduce Retry Attempts
```typescript
// Change from 3 to 2 attempts
async function tryGenerate(modelName: string, prompt: string, attempts = 2) {
  // ...
}

// Reduce backoff
const backoff = Math.min(1000 * (i + 1), 3000);  // 1s, 2s, 3s instead of 2s, 4s, 6s
```

#### 3. Make Fixer Optional
```typescript
// In routes-coach.ts
const useFixer = req.query.fixer === "1" || process.env.USE_LLM_FIXER === "1";

if (decision.code === "PATCHABLE" && useFixer) {
  // Run fixer logic
}
```

#### 4. Reduce Default Attempts
```env
# In .env
COACH_MAX_DRILL_ATTEMPTS=2  # Instead of 3
```

#### 5. Add Early Exit for Quota Errors
```typescript
// In routes-coach.ts
for (let i = 0; i < maxAttempts; i++) {
  try {
    const result = await generateAndReviewDrill(input);
    // ...
  } catch (e: any) {
    // If quota error, don't retry
    if (/429|quota|rate limit/i.test(e.message)) {
      return res.status(429).json({
        ok: false,
        error: "API_QUOTA_EXCEEDED",
        message: "Gemini API quota exceeded. Please try again later.",
      });
    }
    // Otherwise continue to next attempt
  }
}
```

### Medium-Term Improvements

#### 1. Streaming Response
- Send progress updates to client
- Use Server-Sent Events (SSE)
- Show "Generating drill...", "Running QA...", etc.

#### 2. Background Job Queue
- Accept request immediately
- Queue generation job
- Return job ID
- Client polls for completion

#### 3. Caching Layer
- Cache similar drill requests
- Return cached drills for common patterns
- Reduces LLM calls by 50-80%

#### 4. Parallel QA
- Run some QA checks in parallel
- Don't wait for full QA before returning
- Stream QA results as they complete

### Long-Term Optimizations

#### 1. Two-Tier Response
- Return "draft" drill immediately (30s)
- Run full QA + fixes asynchronously
- Notify client when fully vetted drill is ready

#### 2. Smart Retry
- Don't retry if quota exhausted
- Exponential backoff only for transient errors
- Circuit breaker pattern

#### 3. Model Selection
- Use faster model for initial generation
- Use slower/better model only for QA
- Skip fallback if primary succeeds

#### 4. Prompt Optimization
- Reduce prompt size
- Remove verbose instructions
- Faster LLM responses

## Recommended Immediate Actions

### Priority 1: Add Timeout (Prevents Hangs)
```typescript
// In gemini.ts
const TIMEOUT_MS = 30000; // 30 seconds max per LLM call
```

### Priority 2: Reduce Retries (Faster Failure)
```typescript
// In gemini.ts
async function tryGenerate(modelName: string, prompt: string, attempts = 2) {
  // ... reduced from 3 to 2
}
```

### Priority 3: Reduce Attempts (Faster Total)
```env
# In .env
COACH_MAX_DRILL_ATTEMPTS=2
```

### Priority 4: Add Quota Detection (Better Error Messages)
```typescript
// In routes-coach.ts - catch quota errors and fail fast
```

## Expected Improvements

With these changes:
- **Current**: 3-5 minutes (worst case)
- **After fixes**: 30-60 seconds (worst case)
- **Typical**: 15-30 seconds

## Monitoring Recommendations

Add logging for:
1. LLM call duration per step
2. Retry counts per request
3. Total request duration
4. Failure reasons (quota, timeout, QA fail)
5. Cache hit rate (if caching added)

## Environment Variables to Consider

```env
# Timeouts
GEMINI_TIMEOUT_MS=30000

# Retry settings
GEMINI_MAX_RETRIES=2
GEMINI_BACKOFF_BASE_MS=1000

# Attempt limits
COACH_MAX_DRILL_ATTEMPTS=2

# Fixer control
USE_LLM_FIXER=0  # Disable by default for speed

# Models
GEMINI_MODEL_PRIMARY=gemini-2.0-flash-exp  # Faster model
GEMINI_MODEL_FALLBACK=gemini-1.5-flash     # Even faster fallback
```

