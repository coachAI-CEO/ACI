import { ClubRole, GameModelId } from "@prisma/client";
import { prisma } from "../prisma";
import {
  type ClubMembershipSummary,
  pickCoachPreferredMembership,
} from "./club-memberships";
import {
  philosophyHasContent,
  resolveClubSessionScope,
  type ClubPhilosophyStages,
} from "./club-philosophy";
import { getGameModelTemplatePhilosophy } from "./game-model-templates";
import type { BoardClubStamp } from "./board-club-stamp";

export type ClubVaultScope = {
  clubId: string | null;
  gameModelId: string | null;
};

const clubPhilosophySelect = {
  id: true,
  name: true,
  gameModelId: true,
  active: true,
  philosophyAttackingOrganization: true,
  philosophyDefensiveTransition: true,
  philosophyDefensiveOrganization: true,
  philosophyAttackingTransition: true,
} as const;

async function philosophyForClub(club: {
  gameModelId: GameModelId;
  philosophyAttackingOrganization: string | null;
  philosophyDefensiveTransition: string | null;
  philosophyDefensiveOrganization: string | null;
  philosophyAttackingTransition: string | null;
}): Promise<ClubPhilosophyStages | null> {
  const clubPhilosophy = {
    attackingOrganization: club.philosophyAttackingOrganization,
    defensiveTransition: club.philosophyDefensiveTransition,
    defensiveOrganization: club.philosophyDefensiveOrganization,
    attackingTransition: club.philosophyAttackingTransition,
  };
  if (philosophyHasContent(clubPhilosophy)) return clubPhilosophy;
  return getGameModelTemplatePhilosophy(club.gameModelId);
}

/**
 * One membership query for GET /auth/me: session lock, board stamp, and membership list.
 * Platform admins keep free session model choice; boards still stamp club DNA.
 */
export async function loadAuthMeClubFields(user: {
  id: string;
  adminRole: string | null;
  organizationName: string | null;
}): Promise<{
  clubMemberships: ClubMembershipSummary[];
  clubScope: {
    gameModelId: string | null;
    clubId: string | null;
    clubName: string | null;
    philosophy: ClubPhilosophyStages | null;
  } | null;
  boardStamp: BoardClubStamp;
}> {
  const rows = await prisma.clubMembership.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      clubId: true,
      sectionId: true,
      role: true,
      club: { select: clubPhilosophySelect },
    },
    orderBy: { createdAt: "asc" },
  });

  const clubMemberships: ClubMembershipSummary[] = rows.map((row) => ({
    id: row.id,
    clubId: row.clubId,
    clubName: row.club.name,
    sectionId: row.sectionId,
    role: row.role,
    gameModelId: row.club.gameModelId,
  }));

  const sessionPreferred = user.adminRole
    ? null
    : pickCoachPreferredMembership(rows);
  const boardPreferred =
    rows.find((m) => m.role === ClubRole.COACH && m.club?.active !== false) ||
    rows.find((m) => m.club?.active !== false) ||
    null;

  let clubScope = sessionPreferred?.club
    ? {
        gameModelId: sessionPreferred.club.gameModelId,
        clubId: sessionPreferred.club.id,
        clubName: sessionPreferred.club.name,
        philosophy: await philosophyForClub(sessionPreferred.club),
      }
    : null;

  let boardStamp: BoardClubStamp = boardPreferred?.club
    ? {
        clubId: boardPreferred.club.id,
        clubName: boardPreferred.club.name,
        gameModelId: boardPreferred.club.gameModelId,
      }
    : { clubId: null, clubName: null, gameModelId: null };

  const organizationName = String(user.organizationName || "").trim();
  const needsOrgFallback =
    Boolean(organizationName) &&
    ((!clubScope && !user.adminRole) || !boardStamp.clubId);

  if (needsOrgFallback) {
    const club = await prisma.club.findFirst({
      where: {
        active: true,
        name: { equals: organizationName, mode: "insensitive" },
      },
      select: clubPhilosophySelect,
    });
    if (club) {
      if (!clubScope && !user.adminRole) {
        clubScope = {
          gameModelId: club.gameModelId,
          clubId: club.id,
          clubName: club.name,
          philosophy: await philosophyForClub(club),
        };
      }
      if (!boardStamp.clubId) {
        boardStamp = {
          clubId: club.id,
          clubName: club.name,
          gameModelId: club.gameModelId,
        };
      }
    }
  }

  return { clubMemberships, clubScope, boardStamp };
}

/**
 * Club vault/list scope for the signed-in user.
 * Prefers ClubMembership → Club; falls back to organizationName matching.
 * Platform admins get a null scope (no enforcement).
 */
export async function getEnforcedClubVaultScope(userId?: string): Promise<ClubVaultScope> {
  const scope = await resolveClubSessionScope(userId);
  return {
    clubId: scope?.clubId || null,
    gameModelId: scope?.gameModelId || null,
  };
}

/**
 * Returns the enforced club game model for coaches assigned to a club.
 * Prefers ClubMembership → Club.gameModelId; falls back to organizationName
 * matching while membership backfill completes.
 * Returns null for platform admins and users without a club.
 */
export async function getEnforcedClubGameModelId(userId?: string): Promise<string | null> {
  const scope = await getEnforcedClubVaultScope(userId);
  return scope.gameModelId;
}
