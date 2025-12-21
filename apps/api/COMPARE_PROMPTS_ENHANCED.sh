#!/bin/bash

echo "🔬 Enhanced Prompt Optimization Comparison"
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

# Check if server is running
check_server() {
  if ! curl -s http://localhost:4000/ai/ping > /dev/null 2>&1; then
    echo "⚠️  Server not responding on port 4000"
    echo "   Starting server in background (with QA enabled)..."
    cd /Users/macbook/Projects/aci/apps/api
    lsof -ti:4000 | xargs kill 2>/dev/null
    sleep 2
    pnpm dev > /tmp/api-server-comparison.log 2>&1 &
    echo "   Waiting for server to start..."
    for i in {1..30}; do
      if curl -s http://localhost:4000/ai/ping > /dev/null 2>&1; then
        echo "   ✅ Server is ready"
        sleep 2
        return 0
      fi
      sleep 1
    done
    echo "   ❌ Server failed to start after 30 seconds"
    return 1
  fi
  return 0
}

test_prompt() {
  local version=$1
  local results_file=$(mktemp)
  
  echo "📝 Testing: $version"
  echo "----------------------------------------"
  
  # Ensure server is running before each test
  if ! check_server; then
    echo "  ❌ Cannot proceed - server not available"
    return 1
  fi
  
  for i in $(seq 1 $NUM_TESTS); do
    echo -n "  Request $i/$NUM_TESTS... "
    
    # Check server before each request
    if ! curl -s http://localhost:4000/ai/ping > /dev/null 2>&1; then
      echo "❌ Server down, waiting 5s..."
      sleep 5
      check_server
    fi
    
    start_time=$(date +%s%N)
    response=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" \
      -H "Content-Type: application/json" \
      -d "$REQUEST_BODY")
    http_code=$(echo "$response" | tail -1)
    response=$(echo "$response" | sed '$d')
    end_time=$(date +%s%N)
    
    time_ms=$(( (end_time - start_time) / 1000000 ))
    time_sec=$(awk "BEGIN {printf \"%.2f\", $time_ms/1000}")
    
    # Check if request failed due to server issues
    if [ "$http_code" != "200" ] || [ -z "$response" ]; then
      echo "❌ ${time_sec}s | HTTP $http_code | Server error"
      echo "$response" | head -3
      continue
    fi
    
    ok=$(echo "$response" | jq -r '.ok // false')
    title=$(echo "$response" | jq -r '.drill.title // "N/A"')
    
    # Extract ALL QA scores
    structure=$(echo "$response" | jq -r '.qa.scores.structure // "null"')
    gameModel=$(echo "$response" | jq -r '.qa.scores.gameModel // "null"')
    psych=$(echo "$response" | jq -r '.qa.scores.psych // "null"')
    clarity=$(echo "$response" | jq -r '.qa.scores.clarity // "null"')
    realism=$(echo "$response" | jq -r '.qa.scores.realism // "null"')
    constraints=$(echo "$response" | jq -r '.qa.scores.constraints // "null"')
    safety=$(echo "$response" | jq -r '.qa.scores.safety // "null"')
    
    # Check organization (try both paths)
    org_type=$(echo "$response" | jq -r 'if .drill.organization != null then (.drill.organization | type) elif .drill.json.organization != null then (.drill.json.organization | type) else "null" end')
    has_setup=$(echo "$response" | jq -r 'if .drill.organization.setupSteps != null then "true" elif .drill.json.organization.setupSteps != null then "true" else "false" end')
    
    if [ "$ok" = "true" ]; then
      echo "✅ ${time_sec}s"
      echo "     Scores: S=$structure G=$gameModel P=$psych C=$clarity R=$realism Co=$constraints Sa=$safety"
      echo "     Org: $org_type, Setup: $has_setup"
      echo "$time_sec|$structure|$gameModel|$psych|$clarity|$realism|$constraints|$safety|$org_type|$has_setup|$ok" >> "$results_file"
    else
      error=$(echo "$response" | jq -r '.error // "Unknown"')
      echo "❌ ${time_sec}s | Error: $error"
      echo "$time_sec|null|null|null|null|null|null|null|null|null|false" >> "$results_file"
    fi
    
    sleep 1
  done
  
  echo ""
  
  # Calculate averages
  if [ -s "$results_file" ]; then
    avg_time=$(awk -F'|' '{sum+=$1; count++} END {if(count>0) printf "%.2f", sum/count}' "$results_file")
    avg_structure=$(awk -F'|' '$2 != "null" {sum+=$2; count++} END {if(count>0) printf "%.2f", sum/count; else print "N/A"}' "$results_file")
    avg_gameModel=$(awk -F'|' '$3 != "null" {sum+=$3; count++} END {if(count>0) printf "%.2f", sum/count; else print "N/A"}' "$results_file")
    avg_psych=$(awk -F'|' '$4 != "null" {sum+=$4; count++} END {if(count>0) printf "%.2f", sum/count; else print "N/A"}' "$results_file")
    avg_clarity=$(awk -F'|' '$5 != "null" {sum+=$5; count++} END {if(count>0) printf "%.2f", sum/count; else print "N/A"}' "$results_file")
    avg_realism=$(awk -F'|' '$6 != "null" {sum+=$6; count++} END {if(count>0) printf "%.2f", sum/count; else print "N/A"}' "$results_file")
    avg_constraints=$(awk -F'|' '$7 != "null" {sum+=$7; count++} END {if(count>0) printf "%.2f", sum/count; else print "N/A"}' "$results_file")
    avg_safety=$(awk -F'|' '$8 != "null" {sum+=$8; count++} END {if(count>0) printf "%.2f", sum/count; else print "N/A"}' "$results_file")
    success_count=$(awk -F'|' '$11=="true" {count++} END {print count+0}' "$results_file")
    org_object_count=$(awk -F'|' '$9=="object" {count++} END {print count+0}' "$results_file")
    has_setup_count=$(awk -F'|' '$10=="true" {count++} END {print count+0}' "$results_file")
    
    echo "  📊 Summary:"
    echo "    ⏱️  Avg Time: ${avg_time}s"
    echo "    ✅ Success Rate: $success_count/$NUM_TESTS"
    echo "    📋 Organization: $org_object_count/$NUM_TESTS (object), $has_setup_count/$NUM_TESTS (has setupSteps)"
    echo "    🎯 QA Scores (avg):"
    echo "       Structure: $avg_structure | GameModel: $avg_gameModel | Psych: $avg_psych"
    echo "       Clarity: $avg_clarity | Realism: $avg_realism | Constraints: $avg_constraints | Safety: $avg_safety"
    echo ""
  fi
  
  rm "$results_file"
}

# Test optimized prompt (original is backed up as drill-original-backup.ts)
echo "📝 OPTIMIZED PROMPT (13.7KB - 29% smaller than original)"
echo "   Original backed up to: drill-original-backup.ts"
test_prompt "optimized"

echo ""
echo "========================================"
echo "✅ Comparison complete!"

