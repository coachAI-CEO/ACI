import { prisma } from "../prisma";
import { TrainingPriorityOutcome, TrainingPriorityStatus } from "@prisma/client";
import { getEligibleTiers } from "./game-model-readiness";
import { resolveClubDefaultReadinessCeiling } from "./readiness-ceiling-override";
import { currentWeekIndex } from "./coach-center-curriculum";

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

  // Ceiling resolution order: Team.readinessOverride (per-team, highest
  // priority) > the club's own default-ceiling override for this age group
  // (DOC-editable, see readiness-ceiling-override.ts) > the shared
  // hardcoded format/age default.
  const ceiling = team.readinessOverride ?? (await resolveClubDefaultReadinessCeiling(input.clubId, team.ageGroup));
  if (!getEligibleTiers(ceiling).includes(subprinciple.readiness)) {
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
 * The DOC-assigned focus for one team's calendar week, if any -- this is the
 * integration point between DOC Hub (where a DOC sets a TrainingPriority)
 * and Coach Center (where a coach sees "this week's curriculum"). Matched by
 * exact day, since weekStart is always stored as that week's Monday.
 */
export async function getActiveTrainingPriorityForTeamWeek(teamId: string, weekStart: Date) {
  const dayStart = new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate()));
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  return prisma.trainingPriority.findFirst({
    where: {
      teamId,
      status: TrainingPriorityStatus.ACTIVE,
      weekStart: { gte: dayStart, lt: dayEnd },
    },
    select: {
      id: true,
      rationale: true,
      subprinciple: {
        select: {
          id: true,
          trigger: true,
          response: true,
          antiPattern: true,
          principle: { select: { moment: true } },
        },
      },
    },
  });
}

/**
 * Convenience wrapper for callers (like the regular session generator) that
 * only have a teamId in hand -- resolves the team's active season week on
 * its own, then delegates to getActiveTrainingPriorityForTeamWeek. Coach
 * Center's serializeTeamWithActivePriority does this same weekIndex ->
 * weekStart math itself since it already has the team+season in memory;
 * this version exists for callers that don't.
 */
export async function getActivePriorityForCurrentWeek(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { seasons: { where: { active: true }, take: 1, select: { startDate: true } } },
  });
  const season = team?.seasons?.[0];
  if (!season) return null;

  const weekIndex = currentWeekIndex(season.startDate);
  const weekStart = new Date(season.startDate);
  weekStart.setUTCDate(weekStart.getUTCDate() + (weekIndex - 1) * 7);
  return getActiveTrainingPriorityForTeamWeek(teamId, weekStart);
}

export type TrainingPriorityMatch = {
  targetSubprincipleId: string | undefined;
  trainingPriorityId: string | undefined;
  deviationWarning: { assignedTrigger: string; providedTopic: string | null } | null;
};

/**
 * Pure decision logic for generateAndReviewSession: given the topic a coach
 * generated with and the team's active TrainingPriority (if any), decide
 * whether to tag the new Session or return a deviationWarning instead.
 * Extracted so this exact-match/mismatch branch is unit-testable without
 * pulling in session.ts's full gemini/diagram/description-enrichment
 * dependency chain -- session.ts should only need to call this and act on
 * the result.
 */
export function resolveTrainingPriorityMatchForTopic(
  topic: string | undefined | null,
  activePriority: NonNullable<Awaited<ReturnType<typeof getActiveTrainingPriorityForTeamWeek>>> | null
): TrainingPriorityMatch {
  if (!activePriority) {
    return { targetSubprincipleId: undefined, trainingPriorityId: undefined, deviationWarning: null };
  }

  const providedTopic = (topic || "").trim();
  const assignedTrigger = activePriority.subprinciple.trigger.trim();

  if (providedTopic && providedTopic.toLowerCase() === assignedTrigger.toLowerCase()) {
    return {
      targetSubprincipleId: activePriority.subprinciple.id,
      trainingPriorityId: activePriority.id,
      deviationWarning: null,
    };
  }

  return {
    targetSubprincipleId: undefined,
    trainingPriorityId: undefined,
    deviationWarning: { assignedTrigger, providedTopic: providedTopic || null },
  };
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
