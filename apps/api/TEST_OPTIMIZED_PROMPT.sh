#!/bin/bash

echo "🔬 Testing Optimized Prompt - Clarity Focus"
echo "=========================================="
echo ""

REQUEST_BODY='{
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

ENDPOINT="http://localhost:4000/coach/generate-drill-vetted"
NUM_TESTS=${1:-3}

echo "📊 Running $NUM_TESTS tests with optimized prompt..."
echo ""

for i in $(seq 1 $NUM_TESTS); do
  echo "Test $i/$NUM_TESTS:"
  echo "----------------------------------------"
  
  start_time=$(date +%s%N)
  response=$(curl -s -X POST "$ENDPOINT" \
    -H "Content-Type: application/json" \
    -d "$REQUEST_BODY")
  end_time=$(date +%s%N)
  
  time_ms=$(( (end_time - start_time) / 1000000 ))
  time_sec=$(awk "BEGIN {printf \"%.2f\", $time_ms/1000}")
  
  ok=$(echo "$response" | jq -r '.ok // false')
  
  if [ "$ok" = "true" ]; then
    # Extract scores
    structure=$(echo "$response" | jq -r '.qa.scores.structure // "null"')
    clarity=$(echo "$response" | jq -r '.qa.scores.clarity // "null"')
    
    # Check organization details
    org_type=$(echo "$response" | jq -r 'if .drill.organization != null then (.drill.organization | type) elif .drill.json.organization != null then (.drill.json.organization | type) else "null" end')
    has_setup=$(echo "$response" | jq -r 'if .drill.organization.setupSteps != null then "true" elif .drill.json.organization.setupSteps != null then "true" else "false" end')
    setup_count=$(echo "$response" | jq -r 'if .drill.organization.setupSteps != null then (.drill.organization.setupSteps | length) elif .drill.json.organization.setupSteps != null then (.drill.json.organization.setupSteps | length) else 0 end')
    
    # Check area field
    area_type=$(echo "$response" | jq -r 'if .drill.organization.area != null then (.drill.organization.area.lengthYards | type) elif .drill.json.organization.area != null then (.drill.json.organization.area.lengthYards | type) else "null" end')
    length_yards=$(echo "$response" | jq -r '.drill.organization.area.lengthYards // .drill.json.organization.area.lengthYards // "missing"')
    width_yards=$(echo "$response" | jq -r '.drill.organization.area.widthYards // .drill.json.organization.area.widthYards // "missing"')
    
    # Check for age mismatches
    description=$(echo "$response" | jq -r '.drill.description // .drill.json.description // ""')
    age_in_desc=$(echo "$description" | grep -oE "U[0-9]+" | head -1 || echo "none")
    
    # Check player counts
    desc_text=$(echo "$response" | jq -r '.drill.description // .drill.json.description // ""')
    total_on_field=$(echo "$response" | jq -r '.drill.numbersOnField.totalPlayersOnField // .drill.json.numbersOnField.totalPlayersOnField // "missing"')
    
    echo "  ✅ ${time_sec}s | Structure: $structure | Clarity: $clarity"
    echo "  📋 Organization: $org_type, SetupSteps: $has_setup ($setup_count items)"
    echo "  📏 Area: lengthYards=$length_yards (type: $area_type), widthYards=$width_yards"
    echo "  👥 Age in description: $age_in_desc (expected: U10)"
    echo "  🔢 Total players on field: $total_on_field"
    
    if [ "$clarity" = "2" ]; then
      echo "  ⚠️  CLARITY ISSUE DETECTED - Checking details..."
      if [ "$area_type" != "number" ]; then
        echo "     ❌ Area fields are NOT numbers (type: $area_type)"
      fi
      if [ "$age_in_desc" != "U10" ] && [ "$age_in_desc" != "none" ]; then
        echo "     ❌ Age mismatch in description: found $age_in_desc, expected U10"
      fi
    fi
  else
    error=$(echo "$response" | jq -r '.error // "Unknown"')
    echo "  ❌ ${time_sec}s | Error: $error"
  fi
  
  echo ""
  sleep 2
done

echo "=========================================="
echo "✅ Test complete!"

