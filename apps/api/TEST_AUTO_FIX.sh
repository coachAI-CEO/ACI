#!/bin/bash

echo "🧪 Testing Auto-Fix Logic..."
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
  }' > auto-fix-test.json

echo "✅ Response saved to auto-fix-test.json"
echo ""
echo "📊 Validation Results:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

jq -r '
  "✓ API Status: " + (.ok | tostring),
  "✓ Drill Title: " + .drill.title,
  "",
  "🔍 Organization Field:",
  "  - Type: " + (.drill.json.organization | type),
  "  - Has setupSteps: " + ((.drill.json.organization.setupSteps != null) | tostring),
  "  - Setup steps count: " + ((.drill.json.organization.setupSteps | length) | tostring),
  "  - Has area: " + ((.drill.json.organization.area != null) | tostring),
  "",
  "🔍 Forbidden Keys Check:",
  "  - Has diagramV1: " + ((.drill.json.diagramV1 != null) | tostring),
  "  - Has progression (singular): " + ((.drill.json.progression != null) | tostring),
  "  - Has progressions (array): " + ((.drill.json.progressions != null) | tostring),
  "",
  "🔍 QA Scores:",
  "  - Clarity: " + (.qa.scores.clarity | tostring) + "/5",
  "  - Structure: " + (.qa.scores.structure | tostring) + "/5",
  "  - Game Model: " + (.qa.scores.gameModel | tostring) + "/5",
  "  - Overall: " + (.drill.qaScore | tostring)
' auto-fix-test.json

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Organization setupSteps preview:"
jq -r '.drill.json.organization.setupSteps[]?' auto-fix-test.json | head -3

echo ""
echo "💾 Full output saved to: auto-fix-test.json"
