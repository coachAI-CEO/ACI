# Testing New Formation & Level Fields

## Overview

The `/coach/generate-drill-vetted` endpoint now requires three additional fields:
- `formationUsed`: Exact formation string (e.g., "4-3-3", "2-3-1")
- `playerLevel`: Player skill level (BEGINNER, INTERMEDIATE, ADVANCED)
- `coachLevel`: Coach certification level (GRASSROOTS, USSF_C, USSF_B_PLUS)

## Valid Formations

### 7v7 Formats
- `2-3-1`
- `3-2-1`

### 9v9 Formats
- `3-2-3`
- `2-3-2-1`
- `3-3-2`

### 11v11 Formats
- `4-3-3`
- `4-2-3-1`
- `4-4-2`
- `3-5-2`

## Valid Player Levels
- `BEGINNER` - Simple patterns, minimal decisions
- `INTERMEDIATE` - Combination play, moderate complexity
- `ADVANCED` - Complex patterns, high tactical demands

## Valid Coach Levels
- `GRASSROOTS` - Simple language, focus on fundamentals
- `USSF_C` - Moderate detail, tactical concepts
- `USSF_B_PLUS` - Advanced tactical language, sophisticated progressions

## Test Commands

### Example 1: 7v7 Drill (Beginner, Grassroots)
```bash
curl -X POST http://localhost:4000/coach/generate-drill-vetted \
  -H "Content-Type: application/json" \
  -d '{
    "gameModelId": "COACHAI",
    "ageGroup": "U10",
    "phase": "ATTACKING",
    "zone": "ATTACKING_THIRD",
    "formationUsed": "2-3-1",
    "playerLevel": "BEGINNER",
    "coachLevel": "GRASSROOTS",
    "numbersMin": 6,
    "numbersMax": 8,
    "goalsAvailable": 2,
    "spaceConstraint": "HALF",
    "durationMin": 20
  }' | jq '.drill | {id, title, formationUsed, playerLevel, coachLevel, qaScore}'
```

### Example 2: 11v11 Drill (Advanced, USSF_B_PLUS)
```bash
curl -X POST http://localhost:4000/coach/generate-drill-vetted \
  -H "Content-Type: application/json" \
  -d '{
    "gameModelId": "POSSESSION",
    "ageGroup": "U16",
    "phase": "ATTACKING",
    "zone": "MIDDLE_THIRD",
    "formationUsed": "4-3-3",
    "playerLevel": "ADVANCED",
    "coachLevel": "USSF_B_PLUS",
    "numbersMin": 16,
    "numbersMax": 20,
    "goalsAvailable": 1,
    "spaceConstraint": "FULL",
    "durationMin": 25
  }' | jq '.drill | {id, title, formationUsed, playerLevel, coachLevel, energySystem, rpeMin, rpeMax}'
```

### Example 3: 9v9 Drill (Intermediate, USSF_C)
```bash
curl -X POST http://localhost:4000/coach/generate-drill-vetted \
  -H "Content-Type: application/json" \
  -d '{
    "gameModelId": "PRESSING",
    "ageGroup": "U12",
    "phase": "DEFENDING",
    "zone": "DEFENSIVE_THIRD",
    "formationUsed": "3-2-3",
    "playerLevel": "INTERMEDIATE",
    "coachLevel": "USSF_C",
    "numbersMin": 10,
    "numbersMax": 12,
    "goalsAvailable": 2,
    "spaceConstraint": "THIRD",
    "durationMin": 20
  }' | jq '.'
```

## Expected Response Structure

### Success Response
```json
{
  "ok": true,
  "drill": {
    "id": "uuid",
    "title": "Drill Title",
    "formationUsed": "4-3-3",
    "playerLevel": "INTERMEDIATE",
    "coachLevel": "USSF_C",
    "principleIds": [],
    "psychThemeIds": [],
    "energySystem": "Aerobic",
    "rpeMin": 3,
    "rpeMax": 6,
    "numbersMin": 16,
    "numbersMax": 20,
    "goalsAvailable": 1,
    "goalMode": "LARGE",
    "qaScore": 4.5,
    "approved": true,
    ...
  },
  "qa": {
    "pass": true,
    "scores": {
      "structure": 5,
      "gameModel": 5,
      "psych": 4,
      "clarity": 4,
      "realism": 5,
      "constraints": 5,
      "safety": 4
    }
  },
  "fixDecision": {
    "code": "OK"
  }
}
```

### Error Response (Invalid Input)
```json
{
  "ok": false,
  "error": "INVALID_INPUT",
  "details": [
    {
      "path": "formationUsed",
      "message": "Invalid enum value. Expected '2-3-1' | '3-2-1' | ...",
      "code": "invalid_enum_value"
    }
  ]
}
```

### Error Response (Invalid Output)
```json
{
  "ok": false,
  "error": "INVALID_OUTPUT",
  "details": [
    {
      "path": "drill.formationUsed",
      "message": "Required"
    }
  ]
}
```

## Validation Points

### Request Validation
- All three new fields are **required**
- Values must match exact enum values (case-sensitive)
- Formation must be from the approved list
- Returns 400 with detailed error on validation failure

### Response Validation
- Drill object must include all three fields
- Fields must match the LOV constraints
- DB check ensures fields were persisted correctly
- Returns 500 with INVALID_OUTPUT if response validation fails

### DB Check
After saving, the system:
1. Re-reads the drill from DB
2. Verifies `formationUsed`, `playerLevel`, `coachLevel` are non-null
3. Confirms values match the input exactly
4. Throws error if mismatch detected

## Implementation Details

### Files Modified
- `prisma/schema.prisma` - Added enums and fields
- `src/types/drill.ts` - Added TypeScript types
- `src/routes-coach.ts` - Added Zod validation schemas
- `src/prompts/drill.ts` - Updated prompt with level constraints
- `src/services/postprocess.ts` - Added fields to output
- `src/services/drill.ts` - Added DB persistence + check

### Database Schema
```prisma
enum PlayerLevel {
  BEGINNER
  INTERMEDIATE
  ADVANCED
}

enum CoachLevel {
  GRASSROOTS
  USSF_C
  USSF_B_PLUS
}

model Drill {
  // ... existing fields ...
  formationUsed    String?
  playerLevel      PlayerLevel?
  coachLevel       CoachLevel?
  // ... rest of fields ...
}
```

