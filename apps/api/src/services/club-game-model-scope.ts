import { resolveClubSessionScope } from "./club-philosophy";

/**
 * Returns the enforced club game model for coaches assigned to a club.
 * Prefers ClubMembership → Club.gameModelId; falls back to organizationName
 * matching while membership backfill completes.
 * Returns null for platform admins and non-coach users.
 */
export async function getEnforcedClubGameModelId(userId?: string): Promise<string | null> {
  const scope = await resolveClubSessionScope(userId);
  return scope?.gameModelId || null;
}
