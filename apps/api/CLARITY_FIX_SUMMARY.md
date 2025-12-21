# Clarity Score Fix Summary

## Problem
Clarity scores consistently stuck at **2.00** despite Structure scores of **4.00**. This indicates the QA reviewer is finding specific clarity issues that the generator isn't addressing.

## Root Causes (from QA Reviewer Prompt)
The QA reviewer scores clarity as 2 if ANY of these are false:
1. ❌ `organization.area.lengthYards` or `widthYards` are **strings** instead of **numbers**
2. ❌ Age mismatches (any mention of different age group)
3. ❌ Player count inconsistencies across fields
4. ❌ Forbidden keys present (`diagramV1`, `progression`)
5. ❌ Missing organization fields

## Fixes Applied

### 1. Explicit Area Field Requirements
**Before:**
```
area: {lengthYards: number, widthYards: number}
```

**After:**
```
⚠️ CRITICAL FOR CLARITY: lengthYards and widthYards MUST be NUMBERS
❌ WRONG (causes clarity=2): {lengthYards: "35", widthYards: "25"}
✅ CORRECT: {lengthYards: 35, widthYards: 25}
```

### 2. Enhanced Age Consistency Checks
**Before:**
```
ALL age mentions = U10
```

**After:**
```
⚠️ AGE CONSISTENCY (causes clarity=2 if wrong):
Check: description, organization.setupSteps, organization.area.notes, 
       loadNotes.rationale, coachingPoints
❌ WRONG: Mentioning U12, U14, or any other age in a U10 drill
✅ CORRECT: Only mention U10 throughout the entire drill
```

### 3. Explicit Player Count Consistency
**Before:**
```
Player counts consistent
```

**After:**
```
⚠️ PLAYER COUNT CONSISTENCY (causes clarity=2 if inconsistent):
The SAME numbers must appear in: description text, organization.setupSteps, 
diagram.players array, numbersOnField object.

Example: If description says '4v4+GK', then:
- setupSteps must say '4 attackers, 4 defenders, 1 GK'
- diagram must have 9 players total
- numbersOnField must be {attackersOnField: 4, defendersOnField: 4, 
  gkForDefend: true, totalPlayersOnField: 9}
```

### 4. Enhanced QA Reviewer Prompt
Made the QA reviewer prompt more explicit about what causes clarity=2:
- Clear checklist format
- Explicit "score 2 if" conditions
- Emphasis on numeric area fields

## Expected Results

With these fixes, clarity scores should improve from **2.00** to **3-4+** because:

1. **Area fields**: Generator now explicitly warned about string vs number
2. **Age consistency**: More comprehensive checking across all fields
3. **Player counts**: Explicit examples showing what "consistent" means
4. **QA reviewer**: More aligned with generator requirements

## Testing

Run the comparison script to verify improvements:
```bash
cd /Users/macbook/Projects/aci/apps/api
./COMPARE_PROMPTS_ENHANCED.sh 3
```

Expected improvements:
- Clarity: 2.00 → 3-4+
- Structure: 4.00 (maintain)
- All other scores: Maintain current levels (4.00+)

## Files Modified

- `apps/api/src/prompts/drill-optimized-v2.ts` - Enhanced generator prompt
- `apps/api/src/prompts/drill.ts` - Active prompt (updated from optimized-v2)
- `apps/api/src/prompts/drill-optimized-v2.ts` - Enhanced QA reviewer prompt

