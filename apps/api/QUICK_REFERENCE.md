# Quick Reference Guide

## Current Configuration

### Active Files
- **Prompt**: `src/prompts/drill.ts` (13.7KB optimized)
- **Backup**: `src/prompts/drill-original-backup.ts` (19.2KB original)

### Model Settings
- **Primary**: `gemini-3-flash-preview`
- **Fallback**: `gemini-2.5-flash`
- **LLM Timeout**: 45s
- **QA Timeout**: 45s
- **Server Timeout**: 180s

### QA Status
- **Enabled**: Yes (BYPASS_QA removed)
- **Fixer Decision**: Active
- **LLM Fixer**: Disabled (by design)

## Performance Metrics

| Metric | Value |
|--------|-------|
| Success Rate | 100% (3/3) |
| Avg Response Time | 37.24s |
| Clarity Score | 3.33 |
| Structure Score | 4.67 |
| Organization Object | 100% |

## Running Tests

```bash
# Start server
cd /Users/macbook/Projects/aci/apps/api
pnpm dev

# Run comparison test
./COMPARE_PROMPTS_ENHANCED.sh 3

# Quick clarity diagnostic
./TEST_CLARITY.sh
```

## Fixer Decision Logic

- **NEEDS_REGEN** (score ≤ 2) → Retry up to 3 times
- **PATCHABLE** (all ≥ 3, some = 3) → Accept
- **OK** (all ≥ 4) → Accept immediately

## Key Files

- `IMPROVEMENTS_SUMMARY.md` - Complete documentation
- `FIXER_ENABLED.md` - Fixer configuration details
- `CLARITY_IMPROVEMENTS_FINAL.md` - Clarity fix details
- `NEXT_STEPS.md` - Future improvements

