import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { SUBSCRIPTION_LIMITS } from '../config/subscription-limits';
import { generateVerificationToken, sendVerificationEmail } from './email';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';
const REFRESH_TOKEN_EXPIRES_IN = '30d';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
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
}): Promise<{ user: any; tokens: AuthTokens }> {
  // Check if user exists
  const existing = await prisma.user.findUnique({
    where: { email: data.email }
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
      email: data.email,
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
  const refreshToken = await createRefreshToken(user.id);
  
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      subscriptionPlan: user.subscriptionPlan,
      adminRole: (user as any).adminRole ?? null,
      emailVerified: user.emailVerified,
    },
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
    }
  };
}

export async function loginUser(email: string, password: string, ipAddress?: string, userAgent?: string): Promise<{ user: any; tokens: AuthTokens }> {
  const user = await prisma.user.findUnique({
    where: { email }
  });
  
  if (!user || !user.passwordHash) {
    throw new Error('Invalid credentials');
  }
  
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
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
  
  return {
    user: {
      id: updatedUser!.id,
      email: updatedUser!.email,
      name: updatedUser!.name,
      role: updatedUser!.role,
      subscriptionPlan: updatedUser!.subscriptionPlan,
      adminRole: (updatedUser as any).adminRole ?? null,
      emailVerified: updatedUser!.emailVerified,
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
  
  const limits = SUBSCRIPTION_LIMITS[user.subscriptionPlan];
  const limit = operation === 'session' 
    ? limits.sessionsPerMonth 
    : limits.drillsPerMonth;
  
  // Check if monthly reset needed
  const now = new Date();
  const lastReset = new Date(user.lastResetDate);
  const daysSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceReset >= 30) {
    // Reset monthly counters
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
  }
  
  const used = operation === 'session' 
    ? user.sessionsGeneratedThisMonth 
    : user.drillsGeneratedThisMonth;
  
  // Unlimited plans
  if (limit === -1) {
    return { allowed: true, limit: -1, used, remaining: -1 };
  }
  
  const remaining = limit - used;
  const allowed = remaining > 0;
  
  return { allowed, limit, used, remaining };
}

export async function incrementUsage(userId: string, operation: 'session' | 'drill'): Promise<void> {
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
