import { promises as fs } from "fs";
import path from "path";
import { prisma } from "../prisma";

type ClubRecord = {
  id: string;
  name: string;
  code: string;
  gameModelId: string;
  description: string | null;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

const CLUBS_STORE_PATH = path.join(__dirname, "..", "..", ".data", "clubs.json");

async function readClubsStore(): Promise<ClubRecord[]> {
  try {
    const raw = await fs.readFile(CLUBS_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error: any) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

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

  const clubs = await readClubsStore();
  const club = clubs.find(
    (c) =>
      c.active !== false &&
      String(c.name || "").trim().toLowerCase() === organizationName.toLowerCase()
  );

  return club?.gameModelId || null;
}

