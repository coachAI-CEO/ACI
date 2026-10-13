import { prisma } from "../prisma";

/**
 * A club's full game-model tree: principles grouped by moment, each with its
 * subprinciples. Read-only -- authoring principles/subprinciples happens via
 * the seed scripts today (see scripts/seed-game-model-rocklin-fc.ts); this is
 * what the DOC Hub subprinciple picker (Training Priorities) and any future
 * "Principles & Subprinciples" viewer both read from.
 */
export async function listPrinciplesForClub(clubId: string) {
  return prisma.principle.findMany({
    where: { clubId },
    orderBy: [{ moment: "asc" }, { order: "asc" }],
    select: {
      id: true,
      moment: true,
      statement: true,
      order: true,
      subprinciples: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          trigger: true,
          response: true,
          antiPattern: true,
          readiness: true,
          order: true,
        },
      },
    },
  });
}
