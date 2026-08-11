import { ClubRole } from '@prisma/client';
import { prisma } from '../prisma';

/** Roles that may enter DOC Hub (not COACH). */
export const DOC_HUB_ROLES: ClubRole[] = [ClubRole.DOC, ClubRole.SECTION_DIRECTOR];

export const CLUB_MEMBERSHIP_ROLES: ClubRole[] = [
  ClubRole.DOC,
  ClubRole.SECTION_DIRECTOR,
  ClubRole.COACH,
];

export type ClubMembershipSummary = {
  id: string;
  clubId: string;
  clubName: string;
  sectionId: string | null;
  role: ClubRole;
};

export function isClubMembershipRole(value: unknown): value is ClubRole {
  return typeof value === 'string' && CLUB_MEMBERSHIP_ROLES.includes(value as ClubRole);
}

export async function listClubMembershipsForUser(
  userId: string
): Promise<ClubMembershipSummary[]> {
  const rows = await prisma.clubMembership.findMany({
    where: { userId },
    select: {
      id: true,
      clubId: true,
      sectionId: true,
      role: true,
      club: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map((row) => ({
    id: row.id,
    clubId: row.clubId,
    clubName: row.club.name,
    sectionId: row.sectionId,
    role: row.role,
  }));
}

export async function listClubMembershipsForUsers(
  userIds: string[]
): Promise<Map<string, ClubMembershipSummary[]>> {
  const byUser = new Map<string, ClubMembershipSummary[]>();
  if (userIds.length === 0) return byUser;

  const rows = await prisma.clubMembership.findMany({
    where: { userId: { in: userIds } },
    select: {
      id: true,
      userId: true,
      clubId: true,
      sectionId: true,
      role: true,
      club: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push({
      id: row.id,
      clubId: row.clubId,
      clubName: row.club.name,
      sectionId: row.sectionId,
      role: row.role,
    });
    byUser.set(row.userId, list);
  }

  return byUser;
}

export async function upsertClubMembership(input: {
  userId: string;
  clubId: string;
  role: ClubRole;
  sectionId?: string | null;
}): Promise<ClubMembershipSummary> {
  if (!isClubMembershipRole(input.role)) {
    throw new Error('Invalid club membership role');
  }

  const row = await prisma.clubMembership.upsert({
    where: {
      userId_clubId: {
        userId: input.userId,
        clubId: input.clubId,
      },
    },
    create: {
      userId: input.userId,
      clubId: input.clubId,
      role: input.role,
      sectionId: input.sectionId ?? null,
    },
    update: {
      role: input.role,
      ...(input.sectionId !== undefined ? { sectionId: input.sectionId } : {}),
    },
    select: {
      id: true,
      clubId: true,
      sectionId: true,
      role: true,
      club: { select: { name: true } },
    },
  });

  return {
    id: row.id,
    clubId: row.clubId,
    clubName: row.club.name,
    sectionId: row.sectionId,
    role: row.role,
  };
}

export async function deleteClubMembership(
  userId: string,
  clubId: string
): Promise<boolean> {
  const result = await prisma.clubMembership.deleteMany({
    where: { userId, clubId },
  });
  return result.count > 0;
}

export function canAccessDocHub(input: {
  adminRole?: string | null;
  clubMemberships?: Array<{ role: string }> | null;
}): boolean {
  if (input.adminRole === 'SUPER_ADMIN') return true;
  return (input.clubMemberships ?? []).some((m) =>
    DOC_HUB_ROLES.includes(m.role as ClubRole)
  );
}
