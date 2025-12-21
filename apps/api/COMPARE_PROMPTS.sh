#!/bin/bash

echo "🔬 Prompt Optimization Comparison Test"
echo "========================================"
echo ""

# Test request body
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

echo "📊 Testing each prompt version with $NUM_TESTS requests..."
echo ""

# Function to test a prompt version
test_prompt() {
  local version=$1
  local results_file=$(mktemp)
  
  echo "Testing: $version"
  echo "----------------------------------------"
  
  for i in $(seq 1 $NUM_TESTS); do
    echo -n "  Request $i/$NUM_TESTS... "
    
    start_time=$(date +%s%N)
    response=$(curl -s -X POST "$ENDPOINT" \
      -H "Content-Type: application/json" \
      -d "$REQUEST_BODY")
    end_time=$(date +%s%N)
    
    time_ms=$(( (end_time - start_time) / 1000000 ))
    time_sec=$(awk "BEGIN {printf \"%.2f\", $time_ms/1000}")
    
    ok=$(echo "$response" | jq -r '.ok // false')
    title=$(echo "$response" | jq -r '.drill.title // "N/A"')
    clarity=$(echo "$response" | jq -r '.qa.scores.clarity // null')
    org_type=$(echo "$response" | jq -r 'if .drill.organization == null then "null" else (.drill.organization | type) end')
    has_setup=$(echo "$response" | jq -r '.drill.organization.setupSteps != null // false')
    
    if [ "$ok" = "true" ]; then
      echo "✅ ${time_sec}s | Clarity: $clarity | Org: $org_type | Setup: $has_setup"
      echo "$time_sec|$clarity|$org_type|$has_setup|$ok" >> "$results_file"
    else
      error=$(echo "$response" | jq -r '.error // "Unknown"')
      echo "❌ ${time_sec}s | Error: $error"
      echo "$time_sec|null|null|null|false" >> "$results_file"
    fi
    
    sleep 1
  done
  
  echo ""
  
  # Calculate averages
  if [ -s "$results_file" ]; then
    avg_time=$(awk -F'|' '{sum+=$1; count++} END {if(count>0) printf "%.2f", sum/count}' "$results_file")
    avg_clarity=$(awk -F'|' '$2 != "null" {sum+=$2; count++} END {if(count>0) printf "%.2f", sum/count; else print "N/A"}' "$results_file")
    success_count=$(awk -F'|' '$5=="true" {count++} END {print count+0}' "$results_file")
    org_object_count=$(awk -F'|' '$3=="object" {count++} END {print count+0}' "$results_file")
    has_setup_count=$(awk -F'|' '$4=="true" {count++} END {print count+0}' "$results_file")
    
    echo "  Summary:"
    echo "    Avg Time: ${avg_time}s"
    echo "    Avg Clarity: $avg_clarity"
    echo "    Success Rate: $success_count/$NUM_TESTS"
    echo "    Org=Object: $org_object_count/$NUM_TESTS"
    echo "    Has SetupSteps: $has_setup_count/$NUM_TESTS"
    echo ""
  fi
  
  rm "$results_file"
}

# Test original
echo "📝 ORIGINAL PROMPT (19.2KB)"
test_prompt "original"

# Switch to optimized
echo "Switching to optimized prompt..."
cd /Users/macbook/Projects/aci/apps/api
cp src/prompts/drill.ts src/prompts/drill-backup-comparison.ts
cp src/prompts/drill-optimized-v2.ts src/prompts/drill.ts

# Restart server
echo "Restarting server..."
lsof -ti:4000 | xargs kill 2>/dev/null
sleep 3
cd /Users/macbook/Projects/aci/apps/api && pnpm dev > /tmp/api-server-comparison.log 2>&1 &
sleep 5

# Test optimized
echo ""
echo "📝 OPTIMIZED PROMPT (7KB - 63% smaller)"
test_prompt "optimized"

# Restore original
echo "Restoring original prompt..."
cp src/prompts/drill-backup-comparison.ts src/prompts/drill.ts
lsof -ti:4000 | xargs kill 2>/dev/null

echo ""
echo "========================================"
echo "✅ Comparison complete!"

