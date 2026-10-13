import { prisma } from "../prisma";

export type CoachAdherenceRow = {
  userId: string;
  name: string;
  email: string | null;
  teams: Array<{ teamId: string; teamName: string; assigned: number; matched: number }>;
  assigned: number;
  matched: number;
  rate: number | null;
};

/**
 * Ranks a club's coaches by how often a DOC-assigned TrainingPriority for
 * their team actually resulted in a session generated for that exact
 * subprinciple (Session.trainingPriorityId gets set only when the coach's
 * session topic matched the assignment exactly -- see
 * generateAndReviewSession in services/session.ts).
 *
 * Credit is attributed per TEAM, not per individual generation: on a team
 * with more than one coach, every coach on that team shares the same
 * assigned/matched counts, since nothing in the data model says which coach
 * was responsible for a given week when a team has more than one. A team
 * with no TrainingPriority ever assigned contributes nothing (rate: null,
 * not 0) -- there's nothing to have complied with yet.
 */
export async function getCoachAdherenceRanking(clubId: string): Promise<CoachAdherenceRow[]> {
  const teams = await prisma.team.findMany({
    where: { clubId },
    select: {
      id: true,
      name: true,
      coaches: { select: { userId: true, user: { select: { name: true, email: true } } } },
      trainingPriorities: { select: { id: true } },
    },
  });

  const priorityIds = teams.flatMap((team) => team.trainingPriorities.map((p) => p.id));
  const matchedSessions = priorityIds.length
    ? await prisma.session.findMany({
        where: { trainingPriorityId: { in: priorityIds } },
        select: { trainingPriorityId: true },
      })
    : [];
  const matchedPriorityIds = new Set(
    matchedSessions.map((s) => s.trainingPriorityId).filter((id): id is string => Boolean(id))
  );

  const byCoach = new Map<string, CoachAdherenceRow>();
  for (const team of teams) {
    const assigned = team.trainingPriorities.length;
    const matched = team.trainingPriorities.filter((p) => matchedPriorityIds.has(p.id)).length;

    for (const coach of team.coaches) {
      const existing = byCoach.get(coach.userId) || {
        userId: coach.userId,
        name: coach.user?.name || coach.user?.email || "Coach",
        email: coach.user?.email || null,
        teams: [],
        assigned: 0,
        matched: 0,
        rate: null,
      };
      existing.teams.push({ teamId: team.id, teamName: team.name, assigned, matched });
      existing.assigned += assigned;
      existing.matched += matched;
      byCoach.set(coach.userId, existing);
    }
  }

  return Array.from(byCoach.values())
    .map((row) => ({ ...row, rate: row.assigned > 0 ? row.matched / row.assigned : null }))
    .sort((a, b) => {
      if (a.rate === null && b.rate === null) return 0;
      if (a.rate === null) return 1;
      if (b.rate === null) return -1;
      return b.rate - a.rate;
    });
}
