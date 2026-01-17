/**
 * Script to generate 10 random 9v9 sessions
 * Run with: npx ts-node scripts/generate-9v9-sessions.ts
 * 
 * Make sure both servers are running:
 * - API server on port 4000
 * - Web server on port 3000
 */

const API_BASE = "http://localhost:4000";

// 9v9 formations (8 outfield + 1 GK = 9 players)
const formations9v9 = ["3-2-3", "2-4-2", "3-3-2", "2-3-3", "3-4-1", "2-2-4"];

// Age groups typically for 9v9
const ageGroups = ["U9", "U10"];

// Game models
const gameModels = ["POSSESSION", "PRESSING", "TRANSITION", "COACHAI"];

// Phases
const phases = ["ATTACKING", "DEFENDING", "TRANSITION"];

// Zones
const zones = ["DEFENSIVE_THIRD", "MIDDLE_THIRD", "ATTACKING_THIRD"];

// Player levels
const playerLevels = ["BEGINNER", "DEVELOPING", "INTERMEDIATE"];

// Coach levels
const coachLevels = ["ENTRY", "GRASSROOTS", "QUALIFIED"];

// Helper to pick random item from array
function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate a random 9v9 session config
function generateConfig() {
  const formation = randomPick(formations9v9);
  return {
    gameModelId: randomPick(gameModels),
    ageGroup: randomPick(ageGroups),
    phase: randomPick(phases),
    zone: randomPick(zones),
    formationAttacking: formation,
    formationDefending: formation,
    playerLevel: randomPick(playerLevels),
    coachLevel: randomPick(coachLevels),
    numbersMin: 9,
    numbersMax: 18,
    goalsAvailable: 2,
    spaceConstraint: "FULL_PITCH",
    durationMin: randomPick([60, 75, 90]),
  };
}

async function generateSession(config: ReturnType<typeof generateConfig>, index: number) {
  console.log(`\n[${index + 1}/10] Generating ${config.gameModelId} ${config.ageGroup} ${config.formationAttacking} session...`);
  
  try {
    // Generate the session
    const res = await fetch(`${API_BASE}/ai/generate-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error(`  ❌ Failed to generate: ${error}`);
      return null;
    }

    const data = await res.json();
    const sessionId = data.session?.id;
    
    if (!sessionId) {
      console.error(`  ❌ No session ID returned`);
      return null;
    }

    console.log(`  ✓ Generated session: ${data.session?.title || sessionId}`);

    // Save to vault
    const vaultRes = await fetch(`${API_BASE}/vault/sessions/${sessionId}/save`, {
      method: "POST",
    });

    if (vaultRes.ok) {
      console.log(`  ✓ Saved to vault`);
    } else {
      console.log(`  ⚠ Could not save to vault`);
    }

    return data.session;
  } catch (e: any) {
    console.error(`  ❌ Error: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("Generating 10 random 9v9 sessions");
  console.log("=".repeat(60));
  
  const results = [];
  
  for (let i = 0; i < 10; i++) {
    const config = generateConfig();
    console.log(`  Config: ${config.gameModelId} | ${config.ageGroup} | ${config.formationAttacking} | ${config.phase} | ${config.zone}`);
    
    const session = await generateSession(config, i);
    if (session) {
      results.push(session);
    }
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Completed: ${results.length}/10 sessions generated`);
  console.log("=".repeat(60));
}

main().catch(console.error);
