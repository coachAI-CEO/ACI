import { prisma } from "../db";

/**
 * Persist a generated drill JSON blob into the DB (Drill table).
 * Returns { saved: boolean, id?: string }.
 *
 * NOTE: Callers should pass a fully post-processed json:
 * - json.goalMode set
 * - json.goalsSupported set (array of ints)
 * - canonicalized equipment already set
 */
export async function saveGeneratedDrill(json: any) {
  // Feature flag
  if (process.env.PERSIST_DRILLS !== "1") return { saved: false } as const;

  // Build a minimal, valid Drill record for Prisma types
  const data: any = {
    title: json?.title || "Untitled",
    gameModelId: json?.gameModelId || "POSSESSION",
    phase: json?.phase || "ATTACKING",
    zone: json?.zone || "ATTACKING_THIRD",
    ageGroup: json?.ageGroup || "U12",
    coachLevel: json?.coachLevel || "advanced",
    playerLevel: json?.playerLevel || "developing",
    durationMin: json?.durationMin ?? 0,
    numbersMin: json?.numbersMin ?? 0,
    numbersMax: json?.numbersMax ?? 0,
    spaceConstraint: json?.spaceConstraint || "HALF",
    goalsSupported: Array.isArray(json?.goalsSupported) ? json.goalsSupported : [],
    json: json || {},
  };

  const rec = await prisma.drill.create({ data });
return { saved: true, id: rec.id };// Optional: create QA row if present
  if (json?.qa) {
    try {
      await prisma.qAReport.create({ data: {
        artifact: { connect: { id: rec.id } },
pass: Boolean(json.qa?.pass),
        scores: (json.qa?.scores as any) ?? {},
      }});
    } catch {}
  }

  return { saved: true, id: rec.id } as const;
}

