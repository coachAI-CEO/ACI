import { ClubRole } from '@prisma/client';
import { prisma } from '../prisma';

/** Roles that may enter DOC Hub (not COACH). */
export const DOC_HUB_ROLES: ClubRole[] = [ClubRole.DOC, ClubRole.SECTION_DIRECTOR];

export type ClubMembershipSummary = {
  id: string;
  clubId: string;
  clubName: string;
  sectionId: string | null;
  role: ClubRole;
};

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

export function canAccessDocHub(input: {
  adminRole?: string | null;
  clubMemberships?: Array<{ role: string }> | null;
}): boolean {
  if (input.adminRole === 'SUPER_ADMIN') return true;
  return (input.clubMemberships ?? []).some((m) =>
    DOC_HUB_ROLES.includes(m.role as ClubRole)
  );
}
