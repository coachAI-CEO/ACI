# Drill Type Proposal

## Training Session Structure

A typical soccer training session follows a structured progression. Here are common session structures:

### Standard Session Structure (90-120 minutes)

1. **WARMUP** (10-15 min)
   - Dynamic movements, ball work, activation
   - Low intensity, technical touches
   - Examples: Rondos, passing patterns, dynamic stretching with ball

2. **TECHNICAL** (15-20 min)
   - Focused skill development
   - Repetitive practice of specific techniques
   - Examples: Finishing drills, passing accuracy, first touch

3. **TACTICAL** (20-30 min)
   - Game-like situations with constraints
   - Positional play, patterns of play
   - Examples: Small-sided games, positional play, build-up patterns

4. **CONDITIONED_GAME** (20-30 min)
   - Modified game with specific rules/constraints
   - Applies technical and tactical work
   - Examples: 7v7 with offside, possession game with restrictions

5. **COOLDOWN** (5-10 min)
   - Recovery, stretching, reflection
   - Low intensity, static stretching

### Alternative Session Structures

#### Technical-Focused Session
- **WARMUP** → **TECHNICAL** → **TECHNICAL_GAME** → **COOLDOWN**

#### Tactical-Focused Session
- **WARMUP** → **TACTICAL** → **CONDITIONED_GAME** → **COOLDOWN**

#### Match Preparation Session
- **WARMUP** → **TACTICAL** → **FULL_GAME** → **COOLDOWN**

## Proposed Drill Types

Based on common coaching practices, here are the proposed drill types:

### Primary Types

1. **WARMUP**
   - Purpose: Activation, technical touches, low intensity
   - Characteristics: 
     - Short duration (5-15 min)
     - Low RPE (3-5)
     - High touches, low pressure
     - Examples: Rondos, passing squares, dynamic movements

2. **TECHNICAL**
   - Purpose: Skill development, repetition, muscle memory
   - Characteristics:
     - Medium duration (10-20 min)
     - Medium RPE (4-6)
     - Focused on specific technique
     - Examples: Finishing, passing accuracy, first touch, dribbling

3. **TACTICAL**
   - Purpose: Game understanding, decision-making, patterns
   - Characteristics:
     - Medium-long duration (15-30 min)
     - Medium-high RPE (5-7)
     - Game-like situations
     - Examples: Positional play, build-up patterns, pressing triggers

4. **CONDITIONED_GAME**
   - Purpose: Apply skills in game context with constraints
   - Characteristics:
     - Long duration (20-40 min)
     - High RPE (6-8)
     - Modified game rules
     - Examples: Small-sided games, possession games, transition games

5. **FULL_GAME**
   - Purpose: Match simulation, full game context
   - Characteristics:
     - Long duration (30-60 min)
     - High RPE (7-9)
     - Full rules (or modified)
     - Examples: 11v11, 9v9, 7v7 scrimmage

6. **COOLDOWN**
   - Purpose: Recovery, stretching, reflection
   - Characteristics:
     - Short duration (5-10 min)
     - Low RPE (2-3)
     - Static/dynamic stretching
     - Examples: Light jogging, stretching, team talk

### Secondary/Alternative Types

7. **FUNCTIONAL**
   - Purpose: Position-specific training
   - Characteristics:
     - Medium duration (15-25 min)
     - Medium RPE (5-7)
     - Position-focused
     - Examples: Striker finishing, defender 1v1, goalkeeper distribution

8. **PHASE_OF_PLAY**
   - Purpose: Specific game phase (attack, defense, transition)
   - Characteristics:
     - Medium duration (15-30 min)
     - Medium-high RPE (5-7)
     - Phase-specific
     - Examples: Counter-attack, pressing, build-up

9. **SMALL_SIDED_GAME**
   - Purpose: Game-like situations in smaller spaces
   - Characteristics:
     - Medium-long duration (15-30 min)
     - High RPE (6-8)
     - Reduced numbers
     - Examples: 3v3, 4v4, 5v5 games

## Recommended Implementation

### Option 1: Simple (Recommended)
Use the 6 primary types:
- `WARMUP`
- `TECHNICAL`
- `TACTICAL`
- `CONDITIONED_GAME`
- `FULL_GAME`
- `COOLDOWN`

### Option 2: Extended
Include all 9 types for more granularity.

### Option 3: Custom
Allow custom types or additional metadata.

## Impact on Drill Generation

The drill type should influence:
- **Duration**: Warmup/Cooldown shorter, Full Game longer
- **RPE Range**: Warmup lower (3-5), Full Game higher (7-9)
- **Intensity**: Warmup low intensity, Full Game high intensity
- **Complexity**: Technical simpler, Tactical more complex
- **Space**: Warmup smaller, Full Game larger
- **Player Count**: Warmup fewer, Full Game more
- **Equipment**: Some types need more equipment
- **Coaching Points**: Type-specific focus

## Example Usage

```typescript
{
  drillType: "TACTICAL",
  gameModelId: "POSSESSION",
  phase: "ATTACKING",
  zone: "ATTACKING_THIRD",
  // ... other fields
}
```

This would generate a tactical drill focused on attacking possession in the final third, with appropriate duration (15-30 min), RPE (5-7), and complexity.

## Questions for Discussion

1. Do we want 6 primary types or all 9 types?
2. Should drill type be required or optional?
3. Should drill type have default values based on other inputs?
4. Do we need sub-types or additional metadata?
5. Should drill type affect the prompt significantly or just guide parameters?

