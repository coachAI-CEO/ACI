import { prisma } from "../prisma";
import { isReadinessEligibleForTeam } from "./game-model-readiness";

export class SubprincipleNotEligibleError extends Error {
  constructor(readiness: string, ageGroup: string) {
    super(
      `Subprinciple is ${readiness} tier, which is above this team's readiness ceiling for ageGroup=${ageGroup}. ` +
        `Raise Team.readinessOverride if this team should be allowed to work on it early.`
    );
    this.name = "SubprincipleNotEligibleError";
  }
}

/**
 * Create a TrainingPriority, enforcing the team's readiness ceiling at write
 * time -- not just a UI filter. A team's coach/DOC can still deliberately
 * raise Team.readinessOverride to unlock a tier early; this only blocks an
 * accidental assignment past what's currently eligible.
 */
export async function createTrainingPriority(input: {
  teamId: string;
  subprincipleId: string;
  weekStart: Date;
  rationale: string;
  createdByUserId?: string;
}) {
  const team = await prisma.team.findUniqueOrThrow({
    where: { id: input.teamId },
    select: { id: true, ageGroup: true, readinessOverride: true },
  });
  const subprinciple = await prisma.subprinciple.findUniqueOrThrow({
    where: { id: input.subprincipleId },
    select: { id: true, readiness: true, trigger: true, response: true },
  });

  if (!isReadinessEligibleForTeam(team, subprinciple.readiness)) {
    throw new SubprincipleNotEligibleError(subprinciple.readiness, team.ageGroup);
  }

  return prisma.trainingPriority.create({
    data: {
      teamId: input.teamId,
      subprincipleId: input.subprincipleId,
      weekStart: input.weekStart,
      rationale: input.rationale,
      createdByUserId: input.createdByUserId,
    },
  });
}
