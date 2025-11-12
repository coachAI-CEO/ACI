import { prisma } from "../services/prisma";

export async function saveDrillWithQA(input: {
  drillJson: any,
  qa: { pass: boolean, scores: any, mustFix?: string[], redFlags?: string[], summary?: string, loadNotes?: any }
}) {
  const { drillJson, qa } = input;
  return await prisma.$transaction(async (tx) => {
    const drill = await tx.drill.create({
      data: {
        title: drillJson.title || drillJson?.json?.title || "Untitled",
        gameModelId: drillJson.gameModel || drillJson.gameModelId || drillJson?.json?.gameModel || "COACHAI",
        phase: drillJson.phase || drillJson?.json?.phase,
        zone: drillJson.zone || drillJson?.json?.zone,
        ageGroup: drillJson.age || drillJson.ageGroup || drillJson?.json?.age || "U12",
        durationMin: drillJson.durationMin || drillJson?.json?.durationMin || 20,
        numbersMin: drillJson.numbersMin ?? drillJson?.json?.numbersMin ?? null,
        numbersMax: drillJson.numbersMax ?? drillJson?.json?.numbersMax ?? null,
        gkOptional: drillJson.gkOptional ?? drillJson?.json?.gkOptional ?? false,
        spaceConstraint: drillJson.spaceConstraint || drillJson?.json?.spaceConstraint || null,
        goalsSupported: drillJson.goalsSupported || drillJson?.json?.goalsSupported || [],
        json: drillJson, // keep raw payload
      }
    });

    await tx.qAReport.create({
      data: {
        drillId: drill.id,
        pass: qa.pass,
        scores: qa.scores,
        mustFix: qa.mustFix ?? [],
        redFlags: qa.redFlags ?? [],
        summary: qa.summary ?? "",
        loadNotes: qa.loadNotes ?? null,
      }
    });

    return drill;
  });
}

export async function getDrill(id: string) {
  return prisma.drill.findUnique({
    where: { id },
    include: { QAReport: true },
  });
}

export async function listDrills(limit = 20, cursor?: string) {
  const take = Math.min(Math.max(limit, 1), 50);
  const where = {};
  const orderBy = { createdAt: "desc" as const };
  const items = await prisma.drill.findMany({
    where, orderBy, take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { QAReport: true }
  });
  const next = items.length > take ? items.pop() : null;
  return { items, nextCursor: next?.id ?? null };
}
