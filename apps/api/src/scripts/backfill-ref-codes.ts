/**
 * Backfill script to assign reference codes to existing sessions and drills
 * Run with: npx ts-node src/scripts/backfill-ref-codes.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Characters that are unambiguous (no 0/O, 1/I/L confusion)
const CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function generateRandomCode(length: number = 4): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return result;
}

async function generateUniqueCode(
  prefix: string,
  usedCodes: Set<string>
): Promise<string> {
  let code: string;
  let attempts = 0;
  
  do {
    code = `${prefix}-${generateRandomCode()}`;
    attempts++;
    if (attempts > 100) {
      // Fallback with timestamp
      const ts = Date.now().toString(36).toUpperCase().slice(-2);
      code = `${prefix}-${generateRandomCode(2)}${ts}`;
      break;
    }
  } while (usedCodes.has(code));
  
  usedCodes.add(code);
  return code;
}

async function backfillSessions() {
  console.log("Backfilling session ref codes...");
  
  const sessions = await prisma.session.findMany({
    where: { refCode: null },
    select: { id: true, isSeries: true },
  });
  
  console.log(`Found ${sessions.length} sessions without ref codes`);
  
  const usedCodes = new Set<string>();
  
  // Get existing codes
  const existingCodes = await prisma.session.findMany({
    where: { refCode: { not: null } },
    select: { refCode: true },
  });
  existingCodes.forEach((s) => s.refCode && usedCodes.add(s.refCode));
  
  let updated = 0;
  for (const session of sessions) {
    const prefix = session.isSeries ? "SR" : "S";
    const refCode = await generateUniqueCode(prefix, usedCodes);
    
    await prisma.session.update({
      where: { id: session.id },
      data: { refCode },
    });
    
    updated++;
    if (updated % 50 === 0) {
      console.log(`Updated ${updated}/${sessions.length} sessions`);
    }
  }
  
  console.log(`Completed: ${updated} sessions updated with ref codes`);
}

async function backfillDrills() {
  console.log("Backfilling drill ref codes...");
  
  const drills = await prisma.drill.findMany({
    where: { refCode: null },
    select: { id: true },
  });
  
  console.log(`Found ${drills.length} drills without ref codes`);
  
  const usedCodes = new Set<string>();
  
  // Get existing codes from both tables
  const existingSessionCodes = await prisma.session.findMany({
    where: { refCode: { not: null } },
    select: { refCode: true },
  });
  existingSessionCodes.forEach((s) => s.refCode && usedCodes.add(s.refCode));
  
  const existingDrillCodes = await prisma.drill.findMany({
    where: { refCode: { not: null } },
    select: { refCode: true },
  });
  existingDrillCodes.forEach((d) => d.refCode && usedCodes.add(d.refCode));
  
  let updated = 0;
  for (const drill of drills) {
    const refCode = await generateUniqueCode("D", usedCodes);
    
    await prisma.drill.update({
      where: { id: drill.id },
      data: { refCode },
    });
    
    updated++;
    if (updated % 50 === 0) {
      console.log(`Updated ${updated}/${drills.length} drills`);
    }
  }
  
  console.log(`Completed: ${updated} drills updated with ref codes`);
}

async function backfillEmbeddedDrills() {
  console.log("Backfilling embedded drill ref codes in session JSON...");
  
  const sessions = await prisma.session.findMany({
    where: { savedToVault: true },
    select: { id: true, json: true },
  });
  
  const usedCodes = new Set<string>();
  
  // Collect all existing codes
  const existingSessionCodes = await prisma.session.findMany({
    where: { refCode: { not: null } },
    select: { refCode: true },
  });
  existingSessionCodes.forEach((s) => s.refCode && usedCodes.add(s.refCode));
  
  const existingDrillCodes = await prisma.drill.findMany({
    where: { refCode: { not: null } },
    select: { refCode: true },
  });
  existingDrillCodes.forEach((d) => d.refCode && usedCodes.add(d.refCode));
  
  let sessionsUpdated = 0;
  let drillsUpdated = 0;
  
  for (const session of sessions) {
    const json = session.json as any;
    if (!json?.drills || !Array.isArray(json.drills)) continue;
    
    let needsUpdate = false;
    
    for (const drill of json.drills) {
      if (!drill.refCode) {
        drill.refCode = await generateUniqueCode("D", usedCodes);
        needsUpdate = true;
        drillsUpdated++;
      }
    }
    
    if (needsUpdate) {
      await prisma.session.update({
        where: { id: session.id },
        data: { json },
      });
      sessionsUpdated++;
    }
  }
  
  console.log(`Completed: ${drillsUpdated} embedded drills in ${sessionsUpdated} sessions updated`);
}

async function main() {
  console.log("Starting ref code backfill...\n");
  
  await backfillSessions();
  console.log("");
  
  await backfillDrills();
  console.log("");
  
  await backfillEmbeddedDrills();
  console.log("");
  
  console.log("Backfill complete!");
}

main()
  .catch((e) => {
    console.error("Error during backfill:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
