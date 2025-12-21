#!/bin/bash

echo "🔍 Clarity Diagnostic Test"
echo "=========================="
echo ""

ENDPOINT="http://localhost:4000/coach/generate-drill-vetted"

REQUEST='{
  "gameModelId": "POSSESSION",
  "ageGroup": "U10",
  "phase": "ATTACKING",
  "zone": "ATTACKING_THIRD",
  "formationUsed": "2-3-1",
  "playerLevel": "INTERMEDIATE",
  "coachLevel": "GRASSROOTS",
  "numbersMin": 8,
  "numbersMax": 10,
  "goalsAvailable": 2,
  "spaceConstraint": "HALF",
  "durationMin": 20
}'

echo "Making request..."
response=$(curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "$REQUEST")

echo ""
echo "=== CLARITY DIAGNOSTICS ==="
echo ""

# Check if successful
ok=$(echo "$response" | jq -r '.ok // false')
if [ "$ok" != "true" ]; then
  echo "❌ Request failed"
  echo "$response" | jq '.'
  exit 1
fi

# Extract clarity score
clarity=$(echo "$response" | jq -r '.qa.scores.clarity // "null"')
structure=$(echo "$response" | jq -r '.qa.scores.structure // "null"')

echo "📊 Scores:"
echo "  Structure: $structure"
echo "  Clarity: $clarity"
echo ""

# Check organization
org=$(echo "$response" | jq '.drill.organization // .drill.json.organization // null')
if [ "$org" = "null" ]; then
  echo "❌ Organization is NULL"
else
  echo "✅ Organization exists"
  
  # Check area field
  area=$(echo "$org" | jq '.area // null')
  if [ "$area" = "null" ]; then
    echo "❌ organization.area is MISSING"
  else
    length_type=$(echo "$area" | jq -r '.lengthYards | type')
    width_type=$(echo "$area" | jq -r '.widthYards | type')
    length_val=$(echo "$area" | jq -r '.lengthYards')
    width_val=$(echo "$area" | jq -r '.widthYards')
    
    echo "  Area field:"
    echo "    lengthYards: $length_val (type: $length_type)"
    echo "    widthYards: $width_val (type: $width_type)"
    
    if [ "$length_type" != "number" ] || [ "$width_type" != "number" ]; then
      echo "    ❌ CLARITY ISSUE: Area fields are NOT numbers!"
    else
      echo "    ✅ Area fields are numbers"
    fi
  fi
  
  # Check setupSteps
  setup_count=$(echo "$org" | jq '.setupSteps | length // 0')
  echo "  setupSteps: $setup_count items"
  
  # Check rotation, restarts, scoring
  rotation=$(echo "$org" | jq -r '.rotation // "missing"')
  restarts=$(echo "$org" | jq -r '.restarts // "missing"')
  scoring=$(echo "$org" | jq -r '.scoring // "missing"')
  
  echo "  rotation: ${rotation:0:50}..."
  echo "  restarts: ${restarts:0:50}..."
  echo "  scoring: ${scoring:0:50}..."
fi

echo ""
echo "=== AGE CONSISTENCY CHECK ==="
description=$(echo "$response" | jq -r '.drill.description // .drill.json.description // ""')
ages_found=$(echo "$description" | grep -oE "U[0-9]+" | sort -u | tr '\n' ' ' || echo "none")
echo "Ages found in description: $ages_found (expected: U10)"

echo ""
echo "=== FULL RESPONSE (for debugging) ==="
echo "$response" | jq '{ok, title: .drill.title, clarity: .qa.scores.clarity, structure: .qa.scores.structure, org: .drill.organization}' | head -30
