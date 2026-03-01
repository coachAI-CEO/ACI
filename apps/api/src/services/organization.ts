import { prisma } from "../prisma";
import { SUBSCRIPTION_LIMITS } from "../config/subscription-limits";
import { notifyNewAccountCreated } from "./account-alerts";

/**
 * Get organization members (users with the same organizationName)
 */
export async function getOrganizationMembers(organizationName: string) {
  return prisma.user.findMany({
    where: {
      organizationName,
      role: { in: ["CLUB", "COACH"] },
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      subscriptionPlan: true,
      coachLevel: true,
      teamAgeGroups: true,
      createdAt: true,
      lastLoginAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Get organization info
 */
export async function getOrganizationInfo(organizationName: string) {
  const members = await getOrganizationMembers(organizationName);
  const owner = members.find((m) => m.role === "CLUB");
  
  return {
    name: organizationName,
    owner: owner || null,
    members,
    memberCount: members.length,
  };
}

/**
 * Check if user can invite coaches (based on subscription plan and current coach count)
 */
export async function canInviteCoach(userId: string): Promise<{ allowed: boolean; reason?: string; currentCount: number; limit: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      subscriptionPlan: true,
      organizationName: true,
    },
  });

  if (!user) {
    return { allowed: false, reason: "User not found", currentCount: 0, limit: 0 };
  }

  if (user.role !== "CLUB") {
    return { allowed: false, reason: "Only CLUB accounts can invite coaches", currentCount: 0, limit: 0 };
  }

  if (!user.organizationName) {
    return { allowed: false, reason: "User must have an organization name", currentCount: 0, limit: 0 };
  }

  const plan = user.subscriptionPlan as keyof typeof SUBSCRIPTION_LIMITS;
  const limits = SUBSCRIPTION_LIMITS[plan] || SUBSCRIPTION_LIMITS.FREE;
  const maxCoaches = (limits as any).maxCoaches || 0;

  // -1 means unlimited
  if (maxCoaches === -1) {
    return { allowed: true, currentCount: 0, limit: -1 };
  }

  // Count current coaches in organization (excluding the owner)
  const coachCount = await prisma.user.count({
    where: {
      organizationName: user.organizationName,
      role: "COACH",
    },
  });

  const allowed = coachCount < maxCoaches;
  return {
    allowed,
    currentCount: coachCount,
    limit: maxCoaches,
    reason: allowed ? undefined : `Coach limit reached (${coachCount}/${maxCoaches})`,
  };
}

/**
 * Invite a coach to the organization
 */
export async function inviteCoach(
  ownerId: string,
  email: string,
  name?: string,
  coachLevel?: string,
  teamAgeGroups?: string[]
): Promise<{ success: boolean; message: string; user?: any }> {
  // Check if owner can invite
  const canInvite = await canInviteCoach(ownerId);
  if (!canInvite.allowed) {
    return {
      success: false,
      message: canInvite.reason || "Cannot invite coach",
    };
  }

  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { organizationName: true, email: true },
  });

  if (!owner || !owner.organizationName) {
    return {
      success: false,
      message: "Owner not found or has no organization",
    };
  }

  // Check if user already exists
  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (user) {
    // If user exists, add them to the organization
    if (user.organizationName && user.organizationName !== owner.organizationName) {
      return {
        success: false,
        message: "User already belongs to another organization",
      };
    }

    // Update existing user
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        organizationName: owner.organizationName,
        role: user.role === "CLUB" ? user.role : "COACH",
        coachLevel: coachLevel ? (coachLevel as any) : user.coachLevel,
        teamAgeGroups: teamAgeGroups || user.teamAgeGroups,
        name: name || user.name,
      },
    });

    return {
      success: true,
      message: "Coach added to organization",
      user,
    };
  }

  // Create new user (they'll need to set a password later)
  user = await prisma.user.create({
    data: {
      email,
      name,
      role: "COACH",
      subscriptionPlan: "FREE", // Coaches get FREE plan, access through organization
      subscriptionStatus: "ACTIVE",
      organizationName: owner.organizationName,
      coachLevel: coachLevel ? (coachLevel as any) : undefined,
      teamAgeGroups: teamAgeGroups || [],
      emailVerified: false,
    },
  });

  notifyNewAccountCreated({
    userId: user.id,
    email: user.email || email,
    name: user.name,
    role: user.role,
    subscriptionPlan: user.subscriptionPlan,
    source: "organization_invite",
    createdById: ownerId,
    createdByEmail: owner?.email || null,
  }).catch((error) => {
    console.error("[ORGANIZATION] Failed to emit new account alerts for invite:", error);
  });

  return {
    success: true,
    message: "Coach invited to organization",
    user,
  };
}

/**
 * Remove a coach from the organization
 */
export async function removeCoach(ownerId: string, coachId: string): Promise<{ success: boolean; message: string }> {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { organizationName: true, role: true },
  });

  if (!owner || owner.role !== "CLUB") {
    return {
      success: false,
      message: "Only CLUB account owners can remove coaches",
    };
  }

  const coach = await prisma.user.findUnique({
    where: { id: coachId },
    select: { organizationName: true, role: true },
  });

  if (!coach || coach.organizationName !== owner.organizationName) {
    return {
      success: false,
      message: "Coach not found in your organization",
    };
  }

  // Remove coach from organization (set organizationName to null)
  await prisma.user.update({
    where: { id: coachId },
    data: {
      organizationName: null,
    },
  });

  return {
    success: true,
    message: "Coach removed from organization",
  };
}

/**
 * Update organization settings
 */
export async function updateOrganization(
  ownerId: string,
  updates: {
    name?: string;
    teamAgeGroups?: string[];
  }
): Promise<{ success: boolean; message: string }> {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { organizationName: true, role: true },
  });

  if (!owner || owner.role !== "CLUB") {
    return {
      success: false,
      message: "Only CLUB account owners can update organization",
    };
  }

  if (!owner.organizationName) {
    return {
      success: false,
      message: "Organization not found",
    };
  }

  // Update owner's organization name and team age groups
  await prisma.user.update({
    where: { id: ownerId },
    data: {
      organizationName: updates.name || owner.organizationName,
      teamAgeGroups: updates.teamAgeGroups || undefined,
    },
  });

  // If organization name changed, update all members
  if (updates.name && updates.name !== owner.organizationName) {
    await prisma.user.updateMany({
      where: {
        organizationName: owner.organizationName,
      },
      data: {
        organizationName: updates.name,
      },
    });
  }

  return {
    success: true,
    message: "Organization updated",
  };
}
