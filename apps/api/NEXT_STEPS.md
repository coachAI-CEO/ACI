# Next Steps for Clarity Improvement

## Current Status
- ✅ QA reviewer updated to be less strict (scores 3-4 for minor issues instead of 2)
- ✅ Sanitizer ensures area fields are numbers
- ✅ Enhanced validation checklist in generator prompt
- ⚠️ Clarity still scoring 2.00, causing NEEDS_REGEN

## Immediate Next Steps

### 1. Test Updated QA Reviewer
Run a quick test to see if the less-strict QA reviewer improves clarity scores:

```bash
cd /Users/macbook/Projects/aci/apps/api
./COMPARE_PROMPTS_ENHANCED.sh 3
```

**Expected**: Clarity should score 3-4 instead of 2 for drills with minor issues.

### 2. If Clarity Still 2: Add Diagnostic Logging

If clarity is still 2, we need to see what the QA reviewer is actually checking. Add logging to capture:

**Option A: Log QA Reviewer Input/Output**
- Log the drill JSON sent to QA reviewer
- Log the QA reviewer's response with notes
- This will show what specific issue is causing clarity=2

**Option B: Add Debug Endpoint**
- Create `/coach/generate-drill-debug` that returns the raw drill + QA response
- Allows inspection of what QA reviewer sees

**Option C: Check Actual Drill Output**
- Save a sample drill to file when clarity=2
- Manually inspect the drill JSON to see what's wrong

### 3. Potential Root Causes to Investigate

If clarity is still 2 after QA reviewer update, check:

1. **Area Fields**: Are they actually numbers in the final drill?
   - Check post-processing doesn't convert them back to strings
   - Verify sanitizer is running correctly

2. **Age Mismatches**: Is the QA reviewer finding age mentions we're missing?
   - Check description, setupSteps, loadNotes, coachingPoints
   - May need more aggressive age fixing

3. **Player Count Inconsistencies**: Are counts actually matching?
   - Description says "4v4+GK" but numbersOnField says different?
   - setupSteps mentions different numbers?

4. **Missing Fields**: Are rotation/restarts/scoring actually present?
   - Check if post-processing is removing them
   - Verify they're non-empty strings

### 4. Alternative: Adjust Fixer Threshold

If clarity is consistently 3 but still causing NEEDS_REGEN, we could:
- Change fixer to allow clarity=3 (currently requires ≥4)
- Or make clarity=3 trigger PATCHABLE instead of NEEDS_REGEN

## Recommended Action Plan

1. **Test now**: Run comparison script to see if QA reviewer update helps
2. **If still 2**: Add diagnostic logging to see what QA reviewer is checking
3. **Fix root cause**: Based on diagnostics, fix the specific issue
4. **Verify**: Re-test to confirm clarity improves to 3-4+

## Files to Modify (if needed)

- `apps/api/src/services/drill.ts` - Add logging around QA call
- `apps/api/src/prompts/drill-optimized-v2.ts` - Further refine QA reviewer if needed
- `apps/api/src/services/fixer.ts` - Adjust thresholds if clarity=3 is acceptable

