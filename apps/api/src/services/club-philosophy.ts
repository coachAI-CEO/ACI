import { ClubRole, GameModelId } from '@prisma/client';
import { prisma } from '../prisma';

export type ClubPhilosophyStages = {
  attackingOrganization: string | null;
  defensiveTransition: string | null;
  defensiveOrganization: string | null;
  attackingTransition: string | null;
};

export type ClubPhilosophyRecord = {
  clubId: string;
  clubName: string;
  gameModelId: GameModelId;
  philosophy: ClubPhilosophyStages;
  philosophyUpdatedAt: Date | null;
  philosophyUpdatedBy: string | null;
};

const PHILOSOPHY_MAX_LEN = 4000;

export function clampPhilosophyText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, PHILOSOPHY_MAX_LEN);
}

export function philosophyHasContent(philosophy?: ClubPhilosophyStages | null): boolean {
  if (!philosophy) return false;
  return Boolean(
    philosophy.attackingOrganization ||
      philosophy.defensiveTransition ||
      philosophy.defensiveOrganization ||
      philosophy.attackingTransition
  );
}

export async function getClubPhilosophy(clubId: string): Promise<ClubPhilosophyRecord | null> {
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: {
      id: true,
      name: true,
      gameModelId: true,
      philosophyAttackingOrganization: true,
      philosophyDefensiveTransition: true,
      philosophyDefensiveOrganization: true,
      philosophyAttackingTransition: true,
      philosophyUpdatedAt: true,
      philosophyUpdatedBy: true,
    },
  });
  if (!club) return null;

  return {
    clubId: club.id,
    clubName: club.name,
    gameModelId: club.gameModelId,
    philosophy: {
      attackingOrganization: club.philosophyAttackingOrganization,
      defensiveTransition: club.philosophyDefensiveTransition,
      defensiveOrganization: club.philosophyDefensiveOrganization,
      attackingTransition: club.philosophyAttackingTransition,
    },
    philosophyUpdatedAt: club.philosophyUpdatedAt,
    philosophyUpdatedBy: club.philosophyUpdatedBy,
  };
}

export async function updateClubPhilosophy(
  clubId: string,
  patch: Partial<ClubPhilosophyStages>,
  updatedByUserId: string
): Promise<ClubPhilosophyRecord | null> {
  const existing = await prisma.club.findUnique({
    where: { id: clubId },
    select: { id: true },
  });
  if (!existing) return null;

  await prisma.club.update({
    where: { id: clubId },
    data: {
      ...(patch.attackingOrganization !== undefined
        ? { philosophyAttackingOrganization: clampPhilosophyText(patch.attackingOrganization) }
        : {}),
      ...(patch.defensiveTransition !== undefined
        ? { philosophyDefensiveTransition: clampPhilosophyText(patch.defensiveTransition) }
        : {}),
      ...(patch.defensiveOrganization !== undefined
        ? { philosophyDefensiveOrganization: clampPhilosophyText(patch.defensiveOrganization) }
        : {}),
      ...(patch.attackingTransition !== undefined
        ? { philosophyAttackingTransition: clampPhilosophyText(patch.attackingTransition) }
        : {}),
      philosophyUpdatedAt: new Date(),
      philosophyUpdatedBy: updatedByUserId,
    },
  });

  return getClubPhilosophy(clubId);
}

/**
 * Resolve club game model + philosophy for a session-generating user.
 * Prefers ClubMembership → Club; falls back to organizationName mapping.
 */
export async function resolveClubSessionScope(userId?: string): Promise<{
  gameModelId: string | null;
  clubId: string | null;
  philosophy: ClubPhilosophyStages | null;
} | null> {
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      adminRole: true,
      organizationName: true,
    },
  });
  if (!user) return null;
  // Platform admins keep free model choice; only club-affiliated coaches are locked.
  if (user.adminRole) return null;
  if (user.role !== 'COACH') return null;

  const memberships = await prisma.clubMembership.findMany({
    where: { userId },
    select: {
      role: true,
      clubId: true,
      club: {
        select: {
          id: true,
          gameModelId: true,
          philosophyAttackingOrganization: true,
          philosophyDefensiveTransition: true,
          philosophyDefensiveOrganization: true,
          philosophyAttackingTransition: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const preferred =
    memberships.find((m) => m.role === ClubRole.COACH) || memberships[0] || null;

  if (preferred?.club) {
    return {
      gameModelId: preferred.club.gameModelId,
      clubId: preferred.club.id,
      philosophy: {
        attackingOrganization: preferred.club.philosophyAttackingOrganization,
        defensiveTransition: preferred.club.philosophyDefensiveTransition,
        defensiveOrganization: preferred.club.philosophyDefensiveOrganization,
        attackingTransition: preferred.club.philosophyAttackingTransition,
      },
    };
  }

  // Legacy fallback while organizationName → ClubMembership backfill completes.
  const organizationName = String(user.organizationName || '').trim();
  if (!organizationName) return null;

  const club = await prisma.club.findFirst({
    where: {
      active: true,
      name: { equals: organizationName, mode: 'insensitive' },
    },
    select: {
      id: true,
      gameModelId: true,
      philosophyAttackingOrganization: true,
      philosophyDefensiveTransition: true,
      philosophyDefensiveOrganization: true,
      philosophyAttackingTransition: true,
    },
  });
  if (!club) return null;

  return {
    gameModelId: club.gameModelId,
    clubId: club.id,
    philosophy: {
      attackingOrganization: club.philosophyAttackingOrganization,
      defensiveTransition: club.philosophyDefensiveTransition,
      defensiveOrganization: club.philosophyDefensiveOrganization,
      attackingTransition: club.philosophyAttackingTransition,
    },
  };
}
