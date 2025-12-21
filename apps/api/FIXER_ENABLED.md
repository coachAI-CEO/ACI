# Fixer Enabled - Test Scripts Updated

## Changes Made

All test scripts have been updated to run **WITHOUT** `BYPASS_QA=1`, meaning:

✅ **QA is enabled** - Drills are reviewed and scored
✅ **Fixer decision is active** - NEEDS_REGEN triggers retries
✅ **Real production behavior** - Tests reflect actual API behavior

## Updated Scripts

1. **COMPARE_PROMPTS_ENHANCED.sh**
   - Removed `BYPASS_QA=1` from server startup
   - Now runs with QA enabled

2. **COMPARE_PROMPTS.sh**
   - Removed `BYPASS_QA=1` from server startup
   - Now runs with QA enabled

## How It Works Now

### Fixer Decision Logic

The fixer uses QA scores to decide:

- **NEEDS_REGEN** (any score ≤ 2) → Retry up to 3 times
- **PATCHABLE** (all scores ≥ 3, some = 3) → Accept as-is
- **OK** (all scores ≥ 4) → Accept immediately

### Current Performance

With clarity at **3.33**:
- Most drills should be **PATCHABLE** or **OK**
- Only drills with clarity ≤ 2 will trigger retries
- Success rate should remain high

### Running Tests

```bash
# Start server (without BYPASS_QA)
cd /Users/macbook/Projects/aci/apps/api
pnpm dev

# In another terminal, run tests
./COMPARE_PROMPTS_ENHANCED.sh 3
```

## Expected Behavior

1. **First attempt** generates drill
2. **QA reviews** and scores it
3. **Fixer decides**:
   - If clarity ≥ 3 → Accept (PATCHABLE or OK)
   - If clarity ≤ 2 → Retry (NEEDS_REGEN)
4. **Up to 3 attempts** before giving up

## Monitoring

Watch the server logs to see:
- QA scores for each attempt
- Fixer decisions (OK/PATCHABLE/NEEDS_REGEN)
- Retry logic in action

## Notes

- The **LLM fixer** (`fixDrill`) is still disabled (commented out)
- Only the **decision logic** is active
- PATCHABLE drills are accepted without fixing (by design)

