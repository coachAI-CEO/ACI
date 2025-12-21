#!/bin/bash

echo "🧪 Testing with QA Enabled (no bypass)..."
echo ""

# Make the request
curl -s -X POST http://localhost:4000/coach/generate-drill-vetted \
  -H "Content-Type: application/json" \
  -d '{
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
  }' > qa-test-result.json

echo "✅ Response saved to qa-test-result.json"
echo ""
echo "📊 QA Results:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

jq -r '
  "✓ API Status: " + (.ok | tostring),
  "✓ Drill Title: " + .drill.title,
  "",
  "🎯 QA Scores:",
  "  - Clarity: " + (.qa.scores.clarity | tostring) + "/5",
  "  - Structure: " + (.qa.scores.structure | tostring) + "/5",
  "  - Game Model: " + (.qa.scores.gameModel | tostring) + "/5",
  "  - Psych: " + (.qa.scores.psych | tostring) + "/5",
  "  - Realism: " + (.qa.scores.realism | tostring) + "/5",
  "  - Constraints: " + (.qa.scores.constraints | tostring) + "/5",
  "  - Safety: " + (.qa.scores.safety | tostring) + "/5",
  "  - Overall Average: " + (.drill.qaScore | tostring),
  "",
  "✓ QA Pass: " + (.qa.pass | tostring),
  "✓ Decision: " + (.fixDecision.code | tostring),
  "",
  "🔍 Organization Validation:",
  "  - Type: " + (.drill.json.organization | type),
  "  - Has setupSteps: " + ((.drill.json.organization.setupSteps != null) | tostring),
  "  - Setup steps count: " + ((.drill.json.organization.setupSteps | length) | tostring),
  "",
  "🔍 Forbidden Keys:",
  "  - Has diagramV1: " + ((.drill.json.diagramV1 != null) | tostring),
  "  - Has progression (singular): " + ((.drill.json.progression != null) | tostring),
  "  - Has progressions (array): " + ((.drill.json.progressions != null) | tostring),
  "",
  "📝 QA Summary:",
  (.qa.summary // "No summary available")
' qa-test-result.json

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💾 Full output saved to: qa-test-result.json"
echo ""
echo "💡 To see QA notes:"
echo "   jq '.qa.notes' qa-test-result.json"
