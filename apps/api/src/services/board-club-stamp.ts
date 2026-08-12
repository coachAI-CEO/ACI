import { ClubRole, GameModelId } from '@prisma/client';
import { prisma } from '../prisma';
import { isClubGameModelId } from './club-philosophy';

export type BoardClubStamp = {
  clubId: string | null;
  clubName: string | null;
  gameModelId: GameModelId | null;
};

/**
 * Club stamp for tactical boards.
 * Unlike resolveClubSessionScope, this does NOT null out DOC memberships
 * or users with adminRole — boards must stamp club DNA for DOC creators too.
 *
 * Preference: COACH membership first, else first membership by createdAt.
 */
export async function resolveBoardClubStamp(userId?: string | null): Promise<BoardClubStamp> {
  if (!userId) {
    return { clubId: null, clubName: null, gameModelId: null };
  }

  const memberships = await prisma.clubMembership.findMany({
    where: { userId },
    select: {
      role: true,
      clubId: true,
      createdAt: true,
      club: {
        select: {
          id: true,
          name: true,
          gameModelId: true,
          active: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const preferred =
    memberships.find((m) => m.role === ClubRole.COACH && m.club?.active !== false) ||
    memberships.find((m) => m.club?.active !== false) ||
    null;

  if (preferred?.club) {
    return {
      clubId: preferred.club.id,
      clubName: preferred.club.name,
      gameModelId: preferred.club.gameModelId,
    };
  }

  // Legacy fallback while organizationName → ClubMembership backfill completes.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationName: true },
  });
  const organizationName = String(user?.organizationName || '').trim();
  if (!organizationName) {
    return { clubId: null, clubName: null, gameModelId: null };
  }

  const club = await prisma.club.findFirst({
    where: {
      active: true,
      name: { equals: organizationName, mode: 'insensitive' },
    },
    select: { id: true, name: true, gameModelId: true },
  });

  if (!club) {
    return { clubId: null, clubName: null, gameModelId: null };
  }

  return {
    clubId: club.id,
    clubName: club.name,
    gameModelId: club.gameModelId,
  };
}

export function parseClientGameModelId(value: unknown): GameModelId | null {
  if (!isClubGameModelId(value)) return null;
  return value;
}

export function isTacticalBoardV1Enabled(): boolean {
  return process.env.TACTICAL_BOARD_V1 === '1';
}
