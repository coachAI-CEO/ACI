import { prisma } from "../prisma";

// Characters that are unambiguous (no 0/O, 1/I/L confusion)
const CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Generate a random 4-character code from the unambiguous charset
 */
function generateRandomCode(length: number = 4): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return result;
}

/**
 * Reference code types
 */
export type RefCodeType = "drill" | "session" | "series" | "player-plan";

/**
 * Get the prefix for a reference code type
 */
function getPrefix(type: RefCodeType): string {
  switch (type) {
    case "drill":
      return "D";
    case "session":
      return "S";
    case "series":
      return "SR";
    case "player-plan":
      return "P";
  }
}

/**
 * Generate a unique reference code for a drill, session, series, or player plan
 * Format: D-XXXX, S-XXXX, SR-XXXX, P-XXXX
 */
export async function generateRefCode(type: RefCodeType): Promise<string> {
  const prefix = getPrefix(type);
  const maxAttempts = 10;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = `${prefix}-${generateRandomCode()}`;
    
    // Check uniqueness across all tables
    const [existingDrill, existingSession, existingPlayerPlan] = await Promise.all([
      prisma.drill.findFirst({ where: { refCode: code } }),
      prisma.session.findFirst({ where: { refCode: code } }),
      type === "player-plan" ? prisma.playerPlan.findFirst({ where: { refCode: code } }) : Promise.resolve(null),
    ]);
    
    if (!existingDrill && !existingSession && !existingPlayerPlan) {
      return code;
    }
  }
  
  // Fallback: add timestamp suffix for guaranteed uniqueness
  const timestamp = Date.now().toString(36).toUpperCase().slice(-2);
  return `${prefix}-${generateRandomCode(2)}${timestamp}`;
}

/**
 * Generate multiple unique reference codes at once (for batch operations)
 */
export async function generateRefCodes(
  type: RefCodeType,
  count: number
): Promise<string[]> {
  const codes: string[] = [];
  const usedCodes = new Set<string>();
  
  for (let i = 0; i < count; i++) {
    let code: string;
    do {
      code = await generateRefCode(type);
    } while (usedCodes.has(code));
    
    usedCodes.add(code);
    codes.push(code);
  }
  
  return codes;
}

/**
 * Parse a reference code to determine its type
 * Returns null if invalid format
 */
export function parseRefCode(refCode: string): { type: RefCodeType; code: string } | null {
  const match = refCode.toUpperCase().match(/^(D|S|SR|P)-([A-Z0-9]{4,6})$/);
  if (!match) return null;
  
  const prefix = match[1];
  const code = match[2];
  
  let type: RefCodeType;
  switch (prefix) {
    case "D":
      type = "drill";
      break;
    case "S":
      type = "session";
      break;
    case "SR":
      type = "series";
      break;
    case "P":
      type = "player-plan";
      break;
    default:
      return null;
  }
  
  return { type, code };
}

/**
 * Extract all reference codes from a text string
 */
export function extractRefCodes(text: string): string[] {
  const regex = /\b(D|S|SR|P)-[A-Z0-9]{4,6}\b/gi;
  const matches = text.match(regex) || [];
  return [...new Set(matches.map((m) => m.toUpperCase()))];
}

/**
 * Lookup an artifact by reference code
 */
export async function lookupByRefCode(refCode: string): Promise<{
  type: "drill" | "session" | "player-plan";
  data: any;
} | null> {
  const parsed = parseRefCode(refCode);
  if (!parsed) return null;
  
  // Check player plans first (if P- prefix)
  if (parsed.type === "player-plan") {
    const playerPlan = await prisma.playerPlan.findFirst({
      where: { refCode: refCode.toUpperCase() },
    });
    if (playerPlan) {
      return { type: "player-plan", data: playerPlan };
    }
    return null;
  }
  
  // Check sessions (includes series)
  const session = await prisma.session.findFirst({
    where: { refCode: refCode.toUpperCase() },
  });
  
  if (session) {
    return { type: "session", data: session };
  }
  
  // Check drills
  const drill = await prisma.drill.findFirst({
    where: { refCode: refCode.toUpperCase() },
  });
  
  if (drill) {
    return { type: "drill", data: drill };
  }
  
  return null;
}
