import { prisma } from "../prisma";
import { TrainingPriorityOutcome, TrainingPriorityStatus } from "@prisma/client";
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

/** Matches the {status, code} shape used by CoachCenterError/ClubCalendarAssignError elsewhere in doc-hub. */
export class TrainingPriorityError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "TrainingPriorityError";
  }
}

/**
 * Create a TrainingPriority, enforcing the team's readiness ceiling at write
 * time -- not just a UI filter. A team's coach/DOC can still deliberately
 * raise Team.readinessOverride to unlock a tier early; this only blocks an
 * accidental assignment past what's currently eligible.
 *
 * Also enforces that both the team and the subprinciple belong to clubId --
 * without this a DOC authenticated into one club could target another
 * club's team or subprinciple by guessing its id.
 */
export async function createTrainingPriority(input: {
  clubId: string;
  teamId: string;
  subprincipleId: string;
  weekStart: Date;
  rationale: string;
  createdByUserId?: string;
}) {
  const team = await prisma.team.findUniqueOrThrow({
    where: { id: input.teamId },
    select: { id: true, clubId: true, ageGroup: true, readinessOverride: true },
  });
  if (team.clubId !== input.clubId) {
    throw new TrainingPriorityError(404, "NOT_FOUND", "Team not found in this club");
  }

  const subprinciple = await prisma.subprinciple.findUniqueOrThrow({
    where: { id: input.subprincipleId },
    select: {
      id: true,
      readiness: true,
      trigger: true,
      response: true,
      principle: { select: { clubId: true } },
    },
  });
  if (subprinciple.principle.clubId !== input.clubId) {
    throw new TrainingPriorityError(404, "NOT_FOUND", "Subprinciple not found in this club");
  }

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

/**
 * Fetch a TrainingPriority scoped to a club, for the generate-drill route --
 * same cross-club guard as createTrainingPriority, applied on read.
 */
export async function getTrainingPriorityForClub(trainingPriorityId: string, clubId: string) {
  const priority = await prisma.trainingPriority.findUniqueOrThrow({
    where: { id: trainingPriorityId },
    select: { id: true, team: { select: { clubId: true } } },
  });
  if (priority.team.clubId !== clubId) {
    throw new TrainingPriorityError(404, "NOT_FOUND", "Training priority not found in this club");
  }
  return priority;
}

/** List a team's training priorities (newest week first), scoped to the club. */
export async function listTrainingPrioritiesForTeam(input: {
  clubId: string;
  teamId: string;
  status?: TrainingPriorityStatus;
}) {
  const team = await prisma.team.findUniqueOrThrow({
    where: { id: input.teamId },
    select: { id: true, clubId: true },
  });
  if (team.clubId !== input.clubId) {
    throw new TrainingPriorityError(404, "NOT_FOUND", "Team not found in this club");
  }

  return prisma.trainingPriority.findMany({
    where: { teamId: input.teamId, status: input.status },
    include: {
      subprinciple: {
        select: {
          id: true,
          trigger: true,
          response: true,
          readiness: true,
          principle: { select: { moment: true, statement: true } },
        },
      },
    },
    orderBy: { weekStart: "desc" },
  });
}

/**
 * Close the loop on a TrainingPriority: record whether the team actually
 * improved (RARELY/SOMETIMES/CONSISTENTLY) after training on it, and mark it
 * RESOLVED. Without this, status/outcome/outcomeNotes exist on the schema
 * but nothing ever sets them -- a DOC could assign a priority and generate a
 * drill, but never had a way to record what happened.
 */
export async function resolveTrainingPriority(input: {
  clubId: string;
  trainingPriorityId: string;
  outcome: TrainingPriorityOutcome;
  outcomeNotes?: string | null;
}) {
  await getTrainingPriorityForClub(input.trainingPriorityId, input.clubId);

  return prisma.trainingPriority.update({
    where: { id: input.trainingPriorityId },
    data: {
      status: TrainingPriorityStatus.RESOLVED,
      outcome: input.outcome,
      outcomeNotes: input.outcomeNotes,
    },
  });
}
