import { prisma } from "../prisma";
import { getActiveClubByOrganizationName } from "./clubs-store";

/**
 * Returns the enforced club game model for coaches assigned to a club.
 * - Applies only to role=COACH users with organizationName mapped to an active club.
 * - Returns null for all other users.
 */
export async function getEnforcedClubGameModelId(userId?: string): Promise<string | null> {
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
  if (user.adminRole) return null;
  if (user.role !== "COACH") return null;

  const organizationName = String(user.organizationName || "").trim();
  if (!organizationName) return null;

  const club = await getActiveClubByOrganizationName(organizationName);

  return club?.gameModelId || null;
}
