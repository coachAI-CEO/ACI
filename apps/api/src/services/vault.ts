import { prisma } from "../prisma";
import type { SessionPromptInput } from "../prompts/session";

async function generateEmbedding(text: string): Promise<number[]> {
  const hash = text.split("").reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0);
  const dims = 8;
  const vector: number[] = [];
  for (let i = 0; i < dims; i++) {
    vector.push(Math.sin(hash + i) * 0.5 + 0.5);
  }
  return vector;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function createPromptSignature(input: SessionPromptInput): string {
  return JSON.stringify({
    gameModelId: input.gameModelId,
    ageGroup: input.ageGroup,
    phase: input.phase || null,
    zone: input.zone || null,
    formationAttacking: input.formationAttacking,
    formationDefending: input.formationDefending,
    playerLevel: input.playerLevel,
    coachLevel: input.coachLevel,
    numbersMin: input.numbersMin,
    numbersMax: input.numbersMax,
    goalsAvailable: input.goalsAvailable,
    spaceConstraint: input.spaceConstraint,
    durationMin: input.durationMin,
  }, null, 0);
}

// Helper to derive game format from formation (e.g., "4-3-3" -> "11v11")
function getGameFormatFromFormation(formation: string | undefined | null): string {
  if (!formation) return "unknown";
  const parts = formation.split("-").map(Number).filter(n => !isNaN(n));
  const outfieldPlayers = parts.reduce((sum, n) => sum + n, 0);
  if (outfieldPlayers <= 6) return "7v7";
  if (outfieldPlayers <= 8) return "9v9";
  return "11v11";
}

export async function findSimilarSessions(
  input: SessionPromptInput,
  threshold: number = 0.85
): Promise<Array<{ session: any; similarity: number; matchReason: string }>> {
  // Derive game format from input formation
  const inputGameFormat = getGameFormatFromFormation(input.formationAttacking);
  
  const vaultSessions = await prisma.session.findMany({
    where: { savedToVault: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  if (vaultSessions.length === 0) return [];

  const matches: Array<{ session: any; similarity: number; matchReason: string }> = [];

  for (const vaultSession of vaultSessions) {
    const savedInput = vaultSession.json as any;
    
    // Get saved session's values
    const savedGameModelId = savedInput.gameModelId || vaultSession.gameModelId;
    const savedAgeGroup = savedInput.ageGroup || vaultSession.ageGroup;
    const savedPhase = savedInput.phase || vaultSession.phase;
    const savedZone = savedInput.zone || vaultSession.zone;
    const savedFormation = savedInput.formationAttacking || vaultSession.formationUsed;
    const savedGameFormat = getGameFormatFromFormation(savedFormation);
    
    // STRICT MATCHING: Require exact match on critical fields
    // Skip if game format doesn't match (7v7, 9v9, 11v11)
    if (savedGameFormat !== inputGameFormat) continue;
    
    // Skip if gameModelId (topic) doesn't match
    if (savedGameModelId !== input.gameModelId) continue;
    
    // Skip if age group doesn't match
    if (savedAgeGroup !== input.ageGroup) continue;
    
    // Skip if phase doesn't match
    if (savedPhase !== input.phase) continue;
    
    // Skip if zone doesn't match
    if (savedZone !== input.zone) continue;
    
    // All critical fields match - now calculate similarity for ranking
    const inputSignature = createPromptSignature(input);
    const savedSignature = createPromptSignature({
      gameModelId: savedGameModelId,
      ageGroup: savedAgeGroup,
      phase: savedPhase,
      zone: savedZone,
      formationAttacking: savedFormation,
      formationDefending: savedInput.formationDefending || vaultSession.formationUsed || "",
      playerLevel: savedInput.playerLevel || vaultSession.playerLevel || "",
      coachLevel: savedInput.coachLevel || vaultSession.coachLevel || "",
      numbersMin: savedInput.numbersMin || vaultSession.numbersMin || 0,
      numbersMax: savedInput.numbersMax || vaultSession.numbersMax || 0,
      goalsAvailable: savedInput.goalsAvailable || vaultSession.goalsAvailable || 0,
      spaceConstraint: savedInput.spaceConstraint || vaultSession.spaceConstraint || "",
      durationMin: savedInput.durationMin || vaultSession.durationMin || 0,
    });

    const inputEmbedding = await generateEmbedding(inputSignature);
    const savedEmbedding = await generateEmbedding(savedSignature);
    const similarity = cosineSimilarity(inputEmbedding, savedEmbedding);
    
    // Build match reason showing what matched
    const matchedFields = [
      `${inputGameFormat}`,
      input.gameModelId,
      input.ageGroup,
      input.phase,
      input.zone,
    ].filter(Boolean);
    
    matches.push({
      session: { ...vaultSession, json: savedInput },
      similarity,
      matchReason: `Exact match: ${matchedFields.join(", ")}`,
    });
  }

  matches.sort((a, b) => b.similarity - a.similarity);
  return matches;
}

export async function saveSessionToVault(sessionId: string): Promise<{ success: boolean; id: string }> {
  const trimmedId = sessionId.trim();
  if (!trimmedId) throw new Error("Session ID is required");

  const existingSession = await prisma.session.findUnique({
    where: { id: trimmedId },
    select: { id: true, savedToVault: true },
  });
  if (!existingSession) {
    throw new Error(`Session with id ${trimmedId} not found`);
  }
  if (existingSession.savedToVault) {
    return { success: true, id: trimmedId };
  }

  await prisma.session.updateMany({
    where: { id: trimmedId },
    data: { savedToVault: true },
  });

  return { success: true, id: trimmedId };
}

export async function saveDrillToVault(drillId: string): Promise<{ success: boolean; id: string }> {
  const trimmedId = drillId.trim();
  if (!trimmedId) throw new Error("Drill ID is required");

  const existingDrill = await prisma.drill.findUnique({
    where: { id: trimmedId },
    select: { id: true, savedToVault: true },
  });
  if (!existingDrill) {
    throw new Error(`Drill with id ${trimmedId} not found`);
  }
  if (existingDrill.savedToVault) {
    return { success: true, id: trimmedId };
  }

  await prisma.drill.updateMany({
    where: { id: trimmedId },
    data: { savedToVault: true },
  });

  return { success: true, id: trimmedId };
}

export async function removeSessionFromVault(sessionId: string): Promise<{ success: boolean }> {
  await prisma.session.update({
    where: { id: sessionId },
    data: { savedToVault: false },
  });
  return { success: true };
}

export async function getVaultSessions(filters?: {
  gameModelId?: string;
  ageGroup?: string;
  phase?: string;
  zone?: string;
  limit?: number;
  offset?: number;
  excludeSeries?: boolean;
}) {
  const where: any = { savedToVault: true };
  if (filters?.excludeSeries !== false) {
    where.isSeries = false;
  }
  if (filters?.gameModelId) where.gameModelId = filters.gameModelId;
  if (filters?.ageGroup) where.ageGroup = filters.ageGroup;
  if (filters?.phase) where.phase = filters.phase;
  if (filters?.zone) where.zone = filters.zone;

  const [sessions, total] = await Promise.all([
    prisma.session.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters?.limit || 500,
      skip: filters?.offset || 0,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.session.count({ where }),
  ]);

  return { sessions, total, limit: filters?.limit || 500, offset: filters?.offset || 0 };
}

export async function saveSeriesToVault(seriesId: string, sessionIds: string[]): Promise<{ success: boolean }> {
  const finalSeriesId = seriesId || `series-${Date.now()}`;
  for (let i = 0; i < sessionIds.length; i++) {
    await prisma.session.update({
      where: { id: sessionIds[i] },
      data: {
        savedToVault: true,
        isSeries: true,
        seriesId: finalSeriesId,
        seriesNumber: i + 1,
      },
    });
  }
  return { success: true };
}

export async function getVaultSeries() {
  const seriesSessions = await prisma.session.findMany({
    where: { savedToVault: true, isSeries: true },
    orderBy: [{ seriesId: "asc" }, { seriesNumber: "asc" }],
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const seriesMap = new Map<string, any[]>();
  for (const session of seriesSessions) {
    if (!session.seriesId) continue;
    if (!seriesMap.has(session.seriesId)) {
      seriesMap.set(session.seriesId, []);
    }
    seriesMap.get(session.seriesId)!.push(session);
  }

  return Array.from(seriesMap.entries()).map(([seriesId, sessions]) => ({
    seriesId,
    sessions: sessions.sort((a, b) => (a.seriesNumber || 0) - (b.seriesNumber || 0)),
    totalSessions: sessions.length,
    createdAt: sessions[0]?.createdAt,
    gameModelId: sessions[0]?.gameModelId,
    ageGroup: sessions[0]?.ageGroup,
  }));
}
