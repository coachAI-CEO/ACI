import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { SUBSCRIPTION_LIMITS } from '../config/subscription-limits';
import { generateVerificationToken, sendVerificationEmail, sendPasswordResetEmail } from './email';
import { isTacticalBoardV1Enabled } from './board-club-stamp';
import {
  listClubMembershipsForUser,
  pickCoachPreferredMembership,
  type ClubMembershipSummary,
} from './club-memberships';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';
const REFRESH_TOKEN_EXPIRES_IN = '30d';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

type SubscriptionPlanKey = keyof typeof SUBSCRIPTION_LIMITS;

export type SubscriptionFeatures = {
  canExportPDF: boolean;
  canGenerateSeries: boolean;
  canUseAdvancedFilters: boolean;
  canAccessCalendar: boolean;
  canCreatePlayerPlans: boolean;
  canGenerateWeeklySummaries: boolean;
  canInviteCoaches: boolean;
  canManageOrganization: boolean;
  tacticalBoardV1: boolean;
};

export function getFeaturesForAuthUser(input: {
  subscriptionPlan?: SubscriptionPlanKey | string | null;
  adminRole?: string | null;
}): SubscriptionFeatures {
  if (input.adminRole === 'SUPER_ADMIN') {
    return {
      canExportPDF: true,
      canGenerateSeries: true,
      canUseAdvancedFilters: true,
      canAccessCalendar: true,
      canCreatePlayerPlans: true,
      canGenerateWeeklySummaries: true,
      canInviteCoaches: true,
      canManageOrganization: true,
      tacticalBoardV1: isTacticalBoardV1Enabled(),
    };
  }

  const plan = (input.subscriptionPlan && input.subscriptionPlan in SUBSCRIPTION_LIMITS
    ? input.subscriptionPlan
    : 'FREE') as SubscriptionPlanKey;
  const limits = SUBSCRIPTION_LIMITS[plan];
  return {
    canExportPDF: limits.canExportPDF,
    canGenerateSeries: limits.canGenerateSeries,
    canUseAdvancedFilters: limits.canUseAdvancedFilters,
    canAccessCalendar: limits.canAccessCalendar,
    canCreatePlayerPlans: limits.canCreatePlayerPlans,
    canGenerateWeeklySummaries: limits.canGenerateWeeklySummaries,
    canInviteCoaches: limits.canInviteCoaches,
    canManageOrganization: limits.canManageOrganization,
    tacticalBoardV1: isTacticalBoardV1Enabled(),
  };
}

type UsageLimitUser = {
  adminRole?: string | null;
  subscriptionPlan: keyof typeof SUBSCRIPTION_LIMITS;
  sessionsGeneratedThisMonth: number;
  drillsGeneratedThisMonth: number;
  lastResetDate: Date;
};

/** Display-only usage snapshot — no monthly-reset write. */
export function computeUsageLimitFromUser(
  user: UsageLimitUser,
  operation: 'session' | 'drill'
): { allowed: boolean; limit: number; used: number; remaining: number } {
  if (user.adminRole === 'SUPER_ADMIN') {
    return { allowed: true, limit: -1, used: 0, remaining: -1 };
  }

  const limits = SUBSCRIPTION_LIMITS[user.subscriptionPlan];
  const limit: number =
    operation === 'session' ? limits.sessionsPerMonth : limits.drillsPerMonth;
  const daysSinceReset = Math.floor(
    (Date.now() - new Date(user.lastResetDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  const used =
    daysSinceReset >= 30
      ? 0
      : operation === 'session'
        ? user.sessionsGeneratedThisMonth
        : user.drillsGeneratedThisMonth;

  if (limit === -1) {
    return { allowed: true, limit: -1, used, remaining: -1 };
  }

  const remaining = limit - used;
  return { allowed: remaining > 0, limit, used, remaining };
}

function loginClubFields(
  adminRole: string | null | undefined,
  clubMemberships: ClubMembershipSummary[],
  subscriptionPlan?: string | null
): {
  enforcedGameModelId: string | null;
  clubId: string | null;
  clubName: string | null;
  features: SubscriptionFeatures;
} {
  const features = getFeaturesForAuthUser({ subscriptionPlan, adminRole });
  if (adminRole) {
    return { enforcedGameModelId: null, clubId: null, clubName: null, features };
  }
  const preferred = pickCoachPreferredMembership(clubMemberships);
  return {
    enforcedGameModelId: preferred?.gameModelId || null,
    clubId: preferred?.clubId || null,
    clubName: preferred?.clubName || null,
    features,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(userId: string, role: string): string {
  return jwt.sign(
    { userId, role, type: 'access' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
}

export async function createRefreshToken(userId: string, ipAddress?: string, userAgent?: string): Promise<string> {
  const token = generateRefreshToken(userId);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
  
  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt,
      ipAddress,
      userAgent,
    }
  });
  
  return token;
}

export async function registerUser(data: {
  email: string;
  password: string;
  name?: string;
  coachLevel?: string;
  subscriptionPlan?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ user: any; tokens: AuthTokens }> {
  const normalizedEmail = data.email.trim().toLowerCase();

  // Check if user exists
  const existing = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
    },
  });
  
  if (existing) {
    throw new Error('User already exists');
  }
  
  // Hash password
  const passwordHash = await hashPassword(data.password);
  
  // Create user with TRIAL role
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 7); // 7 days trial
  
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name: data.name,
      coachLevel: data.coachLevel as any,
      role: 'TRIAL',
      subscriptionPlan: 'TRIAL',
      subscriptionStatus: 'TRIAL',
      subscriptionStartDate: new Date(),
      trialEndDate,
      lastResetDate: new Date(),
      // Note: SUPER_ADMIN users should be created via create-admin script, not registration
      // But if somehow they are, we'll skip email verification
      emailVerified: false, // Will be set to true if adminRole is SUPER_ADMIN (via script)
    }
  });
  
  // Only send verification email if user is not a SUPER_ADMIN
  // (SUPER_ADMIN users are created via create-admin script which auto-verifies)
  if (!user.adminRole || user.adminRole !== 'SUPER_ADMIN') {
    // Generate verification token
    const verificationToken = generateVerificationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours expiry
    
    await prisma.emailVerificationToken.create({
      data: {
        token: verificationToken,
        userId: user.id,
        email: user.email!,
        expiresAt,
      }
    });
    
    // Send verification email (don't await - send in background)
    sendVerificationEmail(user.email!, user.name, verificationToken).catch(err => {
      console.error('[AUTH] Failed to send verification email:', err);
      // Don't throw - registration should succeed even if email fails
    });
  }
  
  // Generate tokens
  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = await createRefreshToken(user.id, data.ipAddress, data.userAgent);
  const clubMemberships = await listClubMembershipsForUser(user.id);
  const adminRole = (user as any).adminRole ?? null;

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      subscriptionPlan: user.subscriptionPlan,
      adminRole,
      emailVerified: user.emailVerified,
      clubMemberships,
      ...loginClubFields(adminRole, clubMemberships, user.subscriptionPlan),
    },
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
    }
  };
}

export async function loginUser(email: string, password: string, ipAddress?: string, userAgent?: string): Promise<{ user: any; tokens: AuthTokens }> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
    },
  });
  
  if (!user || !user.passwordHash) {
    console.log('[AUTH] loginUser reject', {
      email: normalizedEmail,
      reason: !user ? 'USER_NOT_FOUND' : 'MISSING_PASSWORD_HASH',
      hasUser: Boolean(user),
      hasPasswordHash: Boolean(user?.passwordHash),
      timestamp: new Date().toISOString(),
    });
    throw new Error('Invalid credentials');
  }
  
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    console.log('[AUTH] loginUser reject', {
      email: normalizedEmail,
      reason: 'PASSWORD_MISMATCH',
      hasUser: true,
      hasPasswordHash: true,
      timestamp: new Date().toISOString(),
    });
    throw new Error('Invalid credentials');
  }
  
  // Auto-verify email for SUPER_ADMIN if not already verified
  const updateData: any = { lastLoginAt: new Date() };
  if (user.adminRole === 'SUPER_ADMIN' && !user.emailVerified) {
    updateData.emailVerified = true;
    updateData.emailVerifiedAt = new Date();
  }
  
  // Update last login (and email verification if SUPER_ADMIN)
  await prisma.user.update({
    where: { id: user.id },
    data: updateData
  });
  
  // Refresh user data to get updated emailVerified status
  const updatedUser = await prisma.user.findUnique({
    where: { id: user.id }
  });
  
  // Create user session
  await prisma.userSession.create({
    data: {
      userId: user.id,
      ipAddress,
      userAgent,
    }
  });
  
  // Generate tokens
  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = await createRefreshToken(user.id, ipAddress, userAgent);
  const clubMemberships = await listClubMembershipsForUser(updatedUser!.id);
  const adminRole = (updatedUser as any).adminRole ?? null;

  return {
    user: {
      id: updatedUser!.id,
      email: updatedUser!.email,
      name: updatedUser!.name,
      role: updatedUser!.role,
      subscriptionPlan: updatedUser!.subscriptionPlan,
      adminRole,
      emailVerified: updatedUser!.emailVerified,
      clubMemberships,
      ...loginClubFields(adminRole, clubMemberships, updatedUser!.subscriptionPlan),
    },
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60,
    }
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };
    
    // Check if token exists in database
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });
    
    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new Error('Invalid refresh token');
    }
    
    // Generate new access token
    const accessToken = generateAccessToken(decoded.userId, tokenRecord.user.role);
    
    return {
      accessToken,
      refreshToken, // Keep same refresh token
      expiresIn: 7 * 24 * 60 * 60,
    };
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
}

export async function checkUsageLimit(
  userId: string,
  operation: 'session' | 'drill'
): Promise<{ allowed: boolean; limit: number; used: number; remaining: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  
  if (!user) {
    throw new Error('User not found');
  }

  if (user.adminRole === 'SUPER_ADMIN') {
    return computeUsageLimitFromUser(user, operation);
  }

  const now = new Date();
  const lastReset = new Date(user.lastResetDate);
  const daysSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceReset >= 30) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        sessionsGeneratedThisMonth: 0,
        drillsGeneratedThisMonth: 0,
        lastResetDate: now,
      }
    });
    user.sessionsGeneratedThisMonth = 0;
    user.drillsGeneratedThisMonth = 0;
    user.lastResetDate = now;
  }

  const snapshot = computeUsageLimitFromUser(user, operation);
  if (!snapshot.allowed) {
    console.log(`[LIMIT_ENFORCEMENT] User ${userId} hit ${operation} limit: ${snapshot.used}/${snapshot.limit}`);
  }
  return snapshot;
}

export async function incrementUsage(userId: string, operation: 'session' | 'drill'): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { adminRole: true }
  });
  if (user?.adminRole === 'SUPER_ADMIN') return;

  const updateData = operation === 'session'
    ? { sessionsGeneratedThisMonth: { increment: 1 } }
    : { drillsGeneratedThisMonth: { increment: 1 } };
  
  await prisma.user.update({
    where: { id: userId },
    data: updateData
  });
}

export async function verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
  const tokenRecord = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: { user: true }
  });
  
  if (!tokenRecord) {
    return { success: false, message: 'Invalid verification token' };
  }
  
  if (tokenRecord.used) {
    return { success: false, message: 'This verification link has already been used' };
  }
  
  if (tokenRecord.expiresAt < new Date()) {
    return { success: false, message: 'This verification link has expired' };
  }
  
  // Mark token as used
  await prisma.emailVerificationToken.update({
    where: { id: tokenRecord.id },
    data: { used: true }
  });
  
  // Verify user's email
  await prisma.user.update({
    where: { id: tokenRecord.userId },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
    }
  });
  
  // Delete all other verification tokens for this user
  await prisma.emailVerificationToken.deleteMany({
    where: {
      userId: tokenRecord.userId,
      id: { not: tokenRecord.id }
    }
  });
  
  return { success: true, message: 'Email verified successfully' };
}

export async function resendVerificationEmail(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  
  if (!user || !user.email) {
    throw new Error('User not found or email not set');
  }
  
  if (user.emailVerified) {
    throw new Error('Email is already verified');
  }
  
  // Invalidate old tokens
  await prisma.emailVerificationToken.deleteMany({
    where: { userId, used: false }
  });
  
  // Generate new verification token
  const verificationToken = generateVerificationToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  
  await prisma.emailVerificationToken.create({
    data: {
      token: verificationToken,
      userId: user.id,
      email: user.email,
      expiresAt,
    }
  });
  
  // Send verification email
  await sendVerificationEmail(user.email, user.name, verificationToken);
}

export async function updateProfile(
  userId: string,
  data: {
    name?: string;
    coachLevel?: string;
    organizationName?: string;
    teamAgeGroups?: string[];
    preferences?: Record<string, unknown>;
  }
): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.coachLevel !== undefined) updateData.coachLevel = data.coachLevel;
  if (data.organizationName !== undefined) updateData.organizationName = data.organizationName;
  if (data.teamAgeGroups !== undefined) updateData.teamAgeGroups = data.teamAgeGroups;
  if (data.preferences !== undefined) updateData.preferences = data.preferences;

  if (Object.keys(updateData).length === 0) return;

  await prisma.user.update({
    where: { id: userId },
    data: updateData as any,
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user?.passwordHash) {
    throw new Error('Account has no password set. Use forgot password.');
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw new Error('Current password is incorrect');
  }

  if (newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  // Revoke all refresh tokens so user must log in again on other devices
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
}

export async function requestPasswordReset(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
    },
  });

  // Always return success-like behaviour to avoid leaking whether an email exists
  if (!user || !user.email || !user.passwordHash) {
    return;
  }

  // For new models that may not yet be in the generated Prisma types (during migration),
  // access via a typed-any client to avoid TS errors while keeping runtime behaviour.
  const prismaAny = prisma as any;

  // Invalidate old tokens
  await prismaAny.passwordResetToken.deleteMany({
    where: {
      userId: user.id,
      used: false,
    },
  });

  const resetToken = generateVerificationToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

  await prismaAny.passwordResetToken.create({
    data: {
      token: resetToken,
      userId: user.id,
      expiresAt,
    },
  });

  // Fire and forget email sending; do not block or throw
  sendPasswordResetEmail(user.email, user.name, resetToken).catch((err) => {
    console.error('[AUTH] Failed to send password reset email:', err);
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const prismaAny = prisma as any;

  const tokenRecord = await prismaAny.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!tokenRecord || !tokenRecord.user) {
    throw new Error('Invalid or expired reset token');
  }

  if (tokenRecord.used) {
    throw new Error('This reset link has already been used');
  }

  if (tokenRecord.expiresAt < new Date()) {
    throw new Error('This reset link has expired');
  }

  const passwordHash = await hashPassword(newPassword);

  // Update password and mark token as used
  await prisma.$transaction([
    prisma.user.update({
      where: { id: tokenRecord.userId },
      data: {
        passwordHash,
      },
    }),
    prismaAny.passwordResetToken.update({
      where: { id: tokenRecord.id },
      data: { used: true },
    }),
    // Revoke all existing refresh tokens (force re-login on all devices)
    prisma.refreshToken.deleteMany({
      where: { userId: tokenRecord.userId },
    }),
  ]);
}
