import { prisma } from "../prisma";
import { CoachLevel } from "@prisma/client";

/**
 * Get format from age group
 * U8-U12 = 7v7
 * U13-U14 = 9v9
 * U15-U18 = 11v11
 */
export function getFormatFromAgeGroup(ageGroup: string): string {
  const age = parseInt(ageGroup.replace("U", ""));
  if (age >= 8 && age <= 12) return "7v7";
  if (age >= 13 && age <= 14) return "9v9";
  if (age >= 15 && age <= 18) return "11v11";
  return "7v7"; // default
}

/**
 * Get format from formation
 * Helper to derive game format from formation (e.g., "4-3-3" -> "11v11")
 */
export function getFormatFromFormation(formation: string | undefined | null): string {
  if (!formation) return "unknown";
  const parts = formation.split("-").map(Number).filter(n => !isNaN(n));
  const outfieldPlayers = parts.reduce((sum, n) => sum + n, 0);
  if (outfieldPlayers <= 6) return "7v7";
  if (outfieldPlayers <= 8) return "9v9";
  return "11v11";
}

/**
 * Get format from age group (same as getFormatFromAgeGroup but exported for use in vault filtering)
 */
export function getFormatFromAgeGroupForSession(ageGroup: string): string {
  return getFormatFromAgeGroup(ageGroup);
}

/**
 * Get allowed formats and age groups for a user based on their permissions
 */
export async function getAllowedFormatsAndAgeGroups(
  userId: string,
  coachLevel?: CoachLevel | null
): Promise<{ formats: string[] | null; ageGroups: string[] | null }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coachLevel: true, adminRole: true }
  });

  if (!user) return { formats: null, ageGroups: null };
  
  // Super admins have access to all formats and age groups
  if (user.adminRole === "SUPER_ADMIN") return { formats: null, ageGroups: null };

  const userCoachLevel = coachLevel || user.coachLevel;

  // Get user-specific permissions first
  const userSpecificPermissions = await prisma.accessPermission.findMany({
    where: {
      AND: [
        { userId: userId },
        {
          OR: [
            { resourceType: "VAULT" },
            { resourceType: "BOTH" }
          ]
        },
        { canAccessVault: true }
      ]
    }
  });

  if (userSpecificPermissions.length > 0) {
    // Collect all allowed formats and age groups from user-specific permissions
    const allowedFormats = new Set<string>();
    const allowedAgeGroups = new Set<string>();
    let allFormatsAllowed = false;
    let allAgeGroupsAllowed = false;

    for (const perm of userSpecificPermissions) {
      if (perm.formats.length === 0) {
        allFormatsAllowed = true;
      } else {
        perm.formats.forEach(f => allowedFormats.add(f));
      }
      
      if (perm.ageGroups.length === 0) {
        allAgeGroupsAllowed = true;
      } else {
        perm.ageGroups.forEach(ag => allowedAgeGroups.add(ag));
      }
    }
    
    return {
      formats: allFormatsAllowed ? null : Array.from(allowedFormats),
      ageGroups: allAgeGroupsAllowed ? null : Array.from(allowedAgeGroups)
    };
  }

  // Get coach-level permissions
  const coachLevelPermissions = await prisma.accessPermission.findMany({
    where: {
      AND: [
        { userId: null },
        {
          OR: [
            { resourceType: "VAULT" },
            { resourceType: "BOTH" }
          ]
        },
        {
          OR: [
            { coachLevel: null },
            { coachLevel: userCoachLevel || undefined }
          ]
        },
        { canAccessVault: true }
      ]
    }
  });

  if (coachLevelPermissions.length === 0) {
    // No permissions = default to all formats and age groups (backward compatibility)
    return { formats: null, ageGroups: null };
  }

  // Collect all allowed formats and age groups from coach-level permissions
  const allowedFormats = new Set<string>();
  const allowedAgeGroups = new Set<string>();
  let allFormatsAllowed = false;
  let allAgeGroupsAllowed = false;

  for (const perm of coachLevelPermissions) {
    if (perm.formats.length === 0) {
      allFormatsAllowed = true;
    } else {
      perm.formats.forEach(f => allowedFormats.add(f));
    }
    
    if (perm.ageGroups.length === 0) {
      allAgeGroupsAllowed = true;
    } else {
      perm.ageGroups.forEach(ag => allowedAgeGroups.add(ag));
    }
  }
  
  return {
    formats: allFormatsAllowed ? null : Array.from(allowedFormats),
    ageGroups: allAgeGroupsAllowed ? null : Array.from(allowedAgeGroups)
  };
}

/**
 * Get allowed formats for a user based on their permissions (backward compatibility)
 */
export async function getAllowedFormats(
  userId: string,
  ageGroup?: string,
  coachLevel?: CoachLevel | null
): Promise<string[] | null> {
  const result = await getAllowedFormatsAndAgeGroups(userId, coachLevel);
  return result.formats;
}

/**
 * Check if a user has permission to generate sessions
 */
export async function canGenerateSessions(
  userId: string,
  ageGroup: string,
  coachLevel?: CoachLevel | null
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coachLevel: true, adminRole: true }
  });

  if (!user) return false;
  
  // Super admins always have access
  if (user.adminRole === "SUPER_ADMIN") return true;

  const format = getFormatFromAgeGroup(ageGroup);
  const userCoachLevel = coachLevel || user.coachLevel;

  // First check for user-specific permissions (highest priority)
  const userSpecificPermissions = await prisma.accessPermission.findMany({
    where: {
      AND: [
        { userId: userId }, // User-specific
        {
          OR: [
            { resourceType: "SESSION" },
            { resourceType: "BOTH" }
          ]
        },
        {
          OR: [
            { ageGroups: { has: ageGroup } },
            { ageGroups: { isEmpty: true } } // Empty array = all age groups
          ]
        },
        {
          OR: [
            { formats: { has: format } },
            { formats: { isEmpty: true } } // Empty array = all formats
          ]
        },
        { canGenerateSessions: true }
      ]
    }
  });

  // If user-specific permission exists and grants access, return true
  if (userSpecificPermissions.length > 0) {
    return userSpecificPermissions.some(p => {
      const matchesAgeGroup = p.ageGroups.length === 0 || p.ageGroups.includes(ageGroup);
      const matchesFormat = p.formats.length === 0 || p.formats.includes(format);
      return matchesAgeGroup && matchesFormat;
    });
  }

  // Check for coach-level based permissions (if no user-specific permission)
  const coachLevelPermissions = await prisma.accessPermission.findMany({
    where: {
      AND: [
        { userId: null }, // Not user-specific
        {
          OR: [
            { resourceType: "SESSION" },
            { resourceType: "BOTH" }
          ]
        },
        {
          OR: [
            { coachLevel: null }, // Applies to all coach levels
            { coachLevel: userCoachLevel || undefined }
          ]
        },
        {
          OR: [
            { ageGroups: { has: ageGroup } },
            { ageGroups: { isEmpty: true } } // Empty array = all age groups
          ]
        },
        {
          OR: [
            { formats: { has: format } },
            { formats: { isEmpty: true } } // Empty array = all formats
          ]
        },
        { canGenerateSessions: true }
      ]
    }
  });

  // If no specific permissions exist, default to true (backward compatibility)
  if (coachLevelPermissions.length === 0) return true;

  // Check if any permission grants access
  return coachLevelPermissions.some(p => {
    const matchesAgeGroup = p.ageGroups.length === 0 || p.ageGroups.includes(ageGroup);
    const matchesFormat = p.formats.length === 0 || p.formats.includes(format);
    const matchesCoachLevel = !p.coachLevel || p.coachLevel === userCoachLevel;
    
    return matchesAgeGroup && matchesFormat && matchesCoachLevel;
  });
}

/**
 * Check if a user has permission to access vault
 */
export async function canAccessVault(
  userId: string,
  ageGroup?: string,
  coachLevel?: CoachLevel | null
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coachLevel: true, adminRole: true }
  });

  if (!user) return false;
  
  // Super admins always have access
  if (user.adminRole === "SUPER_ADMIN") return true;

  const userCoachLevel = coachLevel || user.coachLevel;

  // If age group is provided, check format-specific permissions
  if (ageGroup) {
    const format = getFormatFromAgeGroup(ageGroup);
    
    // First check for user-specific permissions
    const userSpecificPermissions = await prisma.accessPermission.findMany({
      where: {
        AND: [
          { userId: userId }, // User-specific
          {
            OR: [
              { resourceType: "VAULT" },
              { resourceType: "BOTH" }
            ]
          },
          {
            OR: [
              { ageGroups: { has: ageGroup } },
              { ageGroups: { isEmpty: true } }
            ]
          },
          {
            OR: [
              { formats: { has: format } },
              { formats: { isEmpty: true } }
            ]
          },
          { canAccessVault: true }
        ]
      }
    });

    if (userSpecificPermissions.length > 0) {
      return userSpecificPermissions.some(p => {
        const matchesAgeGroup = p.ageGroups.length === 0 || p.ageGroups.includes(ageGroup);
        const matchesFormat = p.formats.length === 0 || p.formats.includes(format);
        return matchesAgeGroup && matchesFormat;
      });
    }

    // Check for coach-level based permissions
    const coachLevelPermissions = await prisma.accessPermission.findMany({
      where: {
        AND: [
          { userId: null }, // Not user-specific
          {
            OR: [
              { resourceType: "VAULT" },
              { resourceType: "BOTH" }
            ]
          },
          {
            OR: [
              { coachLevel: null },
              { coachLevel: userCoachLevel || undefined }
            ]
          },
          {
            OR: [
              { ageGroups: { has: ageGroup } },
              { ageGroups: { isEmpty: true } }
            ]
          },
          {
            OR: [
              { formats: { has: format } },
              { formats: { isEmpty: true } }
            ]
          },
          { canAccessVault: true }
        ]
      }
    });

    if (coachLevelPermissions.length === 0) return true; // Default to true for backward compatibility

    return coachLevelPermissions.some(p => {
      const matchesAgeGroup = p.ageGroups.length === 0 || p.ageGroups.includes(ageGroup);
      const matchesFormat = p.formats.length === 0 || p.formats.includes(format);
      const matchesCoachLevel = !p.coachLevel || p.coachLevel === userCoachLevel;
      
      return matchesAgeGroup && matchesFormat && matchesCoachLevel;
    });
  }

  // If no age group specified, check if user has any vault access
  // First check user-specific
  const userSpecificPermissions = await prisma.accessPermission.findMany({
    where: {
      AND: [
        { userId: userId },
        {
          OR: [
            { resourceType: "VAULT" },
            { resourceType: "BOTH" }
          ]
        },
        { canAccessVault: true }
      ]
    }
  });

  if (userSpecificPermissions.length > 0) return true;

  // Then check coach-level
  const coachLevelPermissions = await prisma.accessPermission.findMany({
    where: {
      AND: [
        { userId: null },
        {
          OR: [
            { resourceType: "VAULT" },
            { resourceType: "BOTH" }
          ]
        },
        {
          OR: [
            { coachLevel: null },
            { coachLevel: userCoachLevel || undefined }
          ]
        },
        { canAccessVault: true }
      ]
    }
  });

  // If no specific permissions exist, default to true
  if (coachLevelPermissions.length === 0) return true;

  // User has access if any permission grants it
  return coachLevelPermissions.length > 0;
}

/**
 * Check if a user can access video review.
 *
 * Behavior:
 * - SUPER_ADMIN always has access.
 * - If user-specific VIDEO_REVIEW permissions exist, they are authoritative.
 * - Else if coach-level VIDEO_REVIEW permissions exist, they are authoritative.
 * - Else default to true (backward compatibility until explicit rules are created).
 */
export async function canAccessVideoReview(
  userId: string,
  coachLevel?: CoachLevel | null
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coachLevel: true, adminRole: true },
  });

  if (!user) return false;
  if (user.adminRole === "SUPER_ADMIN") return true;

  const userCoachLevel = coachLevel || user.coachLevel;

    const userSpecific = await prisma.accessPermission.findMany({
      where: {
        AND: [
          { userId },
        {
          OR: [
            { resourceType: "VIDEO_REVIEW" },
            { resourceType: "BOTH" },
          ],
          },
        ],
      },
      select: {
        resourceType: true,
        canAccessVideoReview: true,
        canAccessVault: true,
      },
    });

    if (userSpecific.length > 0) {
      // Backward compatibility: older BOTH permissions may have vault allowed
      // without explicitly setting canAccessVideoReview.
      return userSpecific.some(
        (perm) => perm.canAccessVideoReview || (perm.resourceType === "BOTH" && perm.canAccessVault)
      );
    }

  const coachLevelRules = await prisma.accessPermission.findMany({
      where: {
        AND: [
          { userId: null },
        {
          OR: [
            { resourceType: "VIDEO_REVIEW" },
            { resourceType: "BOTH" },
          ],
        },
        {
          OR: [
            { coachLevel: null },
            { coachLevel: userCoachLevel || undefined },
          ],
          },
        ],
      },
      select: {
        resourceType: true,
        canAccessVideoReview: true,
        canAccessVault: true,
      },
    });

    if (coachLevelRules.length > 0) {
      // Backward compatibility for coach-level BOTH permissions.
      return coachLevelRules.some(
        (perm) => perm.canAccessVideoReview || (perm.resourceType === "BOTH" && perm.canAccessVault)
      );
    }

  return true;
}
