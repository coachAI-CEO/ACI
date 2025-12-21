#!/bin/bash

echo "🚀 Performance Test - Drill Generation"
echo "======================================"
echo ""

# Configuration
NUM_REQUESTS=${1:-5}
ENDPOINT="http://localhost:4000/coach/generate-drill-vetted"

# Request body
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

echo "📊 Running $NUM_REQUESTS requests..."
echo ""

# Arrays to store results
success_count=0
total_time=0
total_attempts=0
total_clarity=0
clarity_count=0
fixer_count=0
# Use regular array for decisions (bash 3 compatible)
decision_counts=""

# Run requests
for i in $(seq 1 $NUM_REQUESTS); do
  echo "Request $i/$NUM_REQUESTS..."
  
  # Measure time
  start_time=$(date +%s%N)
  
  response=$(curl -s -X POST "$ENDPOINT" \
    -H "Content-Type: application/json" \
    -d "$REQUEST_BODY")
  
  end_time=$(date +%s%N)
  
  # Calculate time in seconds
  time_ns=$((end_time - start_time))
  time_sec=$(awk "BEGIN {printf \"%.2f\", $time_ns/1000000000}")
  total_time=$(awk "BEGIN {printf \"%.2f\", $total_time + $time_sec}")
  
  # Parse JSON response
  ok=$(echo "$response" | jq -r '.ok // false')
  
  if [ "$ok" = "true" ]; then
    success_count=$((success_count + 1))
    
    # Extract metrics
    title=$(echo "$response" | jq -r '.drill.title // "N/A"')
    clarity=$(echo "$response" | jq -r '.qa.scores.clarity // empty')
    decision=$(echo "$response" | jq -r '.fixDecision.code // "N/A"')
    num_attempts=$(echo "$response" | jq -r 'if .attempts then (.attempts | length) else 1 end')
    used_fixer=$(echo "$response" | jq -r 'if .fixer.raw.fixed then "true" else "false" end')
    
    # Accumulate
    total_attempts=$((total_attempts + num_attempts))
    
    if [ -n "$clarity" ] && [ "$clarity" != "null" ]; then
      total_clarity=$(awk "BEGIN {printf \"%.2f\", $total_clarity + $clarity}")
      clarity_count=$((clarity_count + 1))
    fi
    
    if [ "$used_fixer" = "true" ]; then
      fixer_count=$((fixer_count + 1))
    fi
    
    # Count decisions (store as string for later parsing)
    if [ -n "$decision" ] && [ "$decision" != "N/A" ]; then
      decision_counts="$decision_counts$decision "
    fi
    
    echo "  ✅ ${time_sec}s | Attempts: $num_attempts | Clarity: ${clarity:-N/A} | Decision: $decision | Fixer: $used_fixer"
    echo "     $title"
  else
    error=$(echo "$response" | jq -r '.error // "Unknown error"')
    echo "  ❌ ${time_sec}s | Error: $error"
  fi
  
  echo ""
  
  # Small delay between requests
  sleep 1
done

echo "======================================"
echo "📈 Performance Summary"
echo "======================================"
echo ""

if [ $success_count -gt 0 ]; then
  avg_time=$(awk "BEGIN {printf \"%.2f\", $total_time / $NUM_REQUESTS}")
  avg_attempts=$(awk "BEGIN {printf \"%.2f\", $total_attempts / $success_count}")
  avg_clarity=$(awk "BEGIN {printf \"%.2f\", $total_clarity / $clarity_count}")
  fixer_percent=$(awk "BEGIN {printf \"%.1f\", $fixer_count * 100 / $success_count}")
  
  echo "Total Requests: $NUM_REQUESTS"
  echo "Successful: $success_count"
  echo ""
  echo "⏱️  Timing:"
  echo "  Average Response Time: ${avg_time}s"
  echo "  Total Time: ${total_time}s"
  echo ""
  echo "🔄 Attempts:"
  echo "  Average Attempts per Request: $avg_attempts"
  echo ""
  echo "📊 Quality:"
  echo "  Average Clarity Score: ${avg_clarity}/5"
  echo ""
  echo "🔧 Fixer Usage:"
  echo "  Fixer Used: $fixer_count / $success_count ($fixer_percent%)"
  echo ""
  
  if [ -n "$decision_counts" ]; then
    echo "📋 Decision Breakdown:"
    echo "$decision_counts" | tr ' ' '\n' | grep -v '^$' | sort | uniq -c | awk '{print "  " $2 ": " $1}'
  fi
else
  echo "❌ No successful requests to analyze"
fi

echo ""
echo "======================================"
