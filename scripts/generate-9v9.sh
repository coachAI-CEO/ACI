#!/bin/bash

# 9v9 formations (8 outfield + 1 GK = 9 players)
# Valid for U13-U14 according to FORMATION_BY_AGE
FORMATIONS=("3-2-3" "2-3-2-1" "3-3-2")

# Age groups for 9v9 (U13-U14)
AGE_GROUPS=("U13" "U14")

# Game models
GAME_MODELS=("POSSESSION" "PRESSING" "TRANSITION" "COACHAI")

# Phases
PHASES=("ATTACKING" "DEFENDING" "TRANSITION")

# Zones  
ZONES=("DEFENSIVE_THIRD" "MIDDLE_THIRD" "ATTACKING_THIRD")

# Player levels (must match Prisma enum)
PLAYER_LEVELS=("BEGINNER" "INTERMEDIATE" "ADVANCED")

# Coach levels (must match Prisma enum)
COACH_LEVELS=("GRASSROOTS" "USSF_C" "USSF_B_PLUS")

# Durations
DURATIONS=(60 75 90)

# Function to pick random element
random_pick() {
    local arr=("$@")
    echo "${arr[RANDOM % ${#arr[@]}]}"
}

echo "============================================================"
echo "Generating 10 random 9v9 sessions"
echo "============================================================"

SUCCESS=0

for i in {1..10}; do
    FORMATION=$(random_pick "${FORMATIONS[@]}")
    AGE=$(random_pick "${AGE_GROUPS[@]}")
    MODEL=$(random_pick "${GAME_MODELS[@]}")
    PHASE=$(random_pick "${PHASES[@]}")
    ZONE=$(random_pick "${ZONES[@]}")
    PLAYER_LEVEL=$(random_pick "${PLAYER_LEVELS[@]}")
    COACH_LEVEL=$(random_pick "${COACH_LEVELS[@]}")
    DURATION=$(random_pick "${DURATIONS[@]}")
    
    echo ""
    echo "[$i/10] $MODEL | $AGE | $FORMATION | $PHASE | $ZONE"
    
    # Generate session
    RESPONSE=$(curl -s -X POST http://localhost:4000/ai/generate-session \
        -H "Content-Type: application/json" \
        -d "{
            \"gameModelId\": \"$MODEL\",
            \"ageGroup\": \"$AGE\",
            \"phase\": \"$PHASE\",
            \"zone\": \"$ZONE\",
            \"formationAttacking\": \"$FORMATION\",
            \"formationDefending\": \"$FORMATION\",
            \"playerLevel\": \"$PLAYER_LEVEL\",
            \"coachLevel\": \"$COACH_LEVEL\",
            \"numbersMin\": 9,
            \"numbersMax\": 18,
            \"goalsAvailable\": 2,
            \"spaceConstraint\": \"FULL_PITCH\",
            \"durationMin\": $DURATION
        }")
    
    # Extract session ID (from session object specifically)
    SESSION_ID=$(echo "$RESPONSE" | grep -o '"session":{[^}]*"id":"[^"]*"' | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    TITLE=$(echo "$RESPONSE" | grep -o '"title":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    # Fallback if session ID not found
    if [ -z "$SESSION_ID" ]; then
        SESSION_ID=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('session',{}).get('id',''))" 2>/dev/null)
    fi
    
    if [ -n "$SESSION_ID" ]; then
        echo "  ✓ Generated: $TITLE"
        
        # Save to vault
        VAULT_RESPONSE=$(curl -s -X POST "http://localhost:4000/vault/sessions/$SESSION_ID/save")
        echo "  ✓ Saved to vault"
        ((SUCCESS++))
    else
        echo "  ❌ Failed to generate session"
        echo "  Response: ${RESPONSE:0:200}"
    fi
    
    sleep 2
done

echo ""
echo "============================================================"
echo "Completed: $SUCCESS/10 sessions generated"
echo "============================================================"
