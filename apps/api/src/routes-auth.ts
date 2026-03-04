import express from 'express';
import { z } from 'zod';
import { 
  registerUser, 
  loginUser, 
  refreshAccessToken,
  checkUsageLimit,
  verifyEmail,
  resendVerificationEmail,
  requestPasswordReset,
  resetPassword,
  updateProfile,
  changePassword,
} from './services/auth';
import { authenticate } from './middleware/auth';
import { prisma } from './prisma';
import { SUBSCRIPTION_LIMITS } from './config/subscription-limits';
import { getEnforcedClubGameModelId } from './services/club-game-model-scope';

type SubscriptionPlanKey = keyof typeof SUBSCRIPTION_LIMITS;
type SubscriptionFeatures = {
  canExportPDF: boolean;
  canGenerateSeries: boolean;
  canUseAdvancedFilters: boolean;
  canAccessCalendar: boolean;
  canCreatePlayerPlans: boolean;
  canGenerateWeeklySummaries: boolean;
  canInviteCoaches: boolean;
  canManageOrganization: boolean;
};

function getFeaturesForAuthUser(input: {
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
  };
}

/** Shape of user returned by GET /auth/me (select + preferences) */
interface AuthMeUser {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  adminRole: string | null;
  subscriptionPlan: SubscriptionPlanKey;
  subscriptionStatus: string;
  coachLevel: string | null;
  organizationName: string | null;
  teamAgeGroups: string[];
  preferences: unknown;
  sessionsGeneratedThisMonth: number;
  drillsGeneratedThisMonth: number;
  trialEndDate: Date | null;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  enforcedGameModelId?: string | null;
}

const r = express.Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  coachLevel: z.enum(['GRASSROOTS', 'USSF_C', 'USSF_B_PLUS']).optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const ForgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

const ResetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});

const UpdateProfileSchema = z.object({
  name: z.string().min(0).max(200).optional(),
  coachLevel: z.enum(['GRASSROOTS', 'USSF_C', 'USSF_B_PLUS']).optional().nullable(),
  organizationName: z.string().min(0).max(200).optional().nullable(),
  teamAgeGroups: z.array(z.string().max(20)).max(20).optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

// Register
r.post('/auth/register', async (req, res) => {
  try {
    const data = RegisterSchema.parse(req.body);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];
    const result = await registerUser({
      ...data,
      ipAddress: ipAddress || undefined,
      userAgent: typeof userAgent === 'string' ? userAgent : undefined,
    });
    return res.json({ ok: true, ...result });
  } catch (error: any) {
    if (error.message === 'User already exists') {
      return res.status(409).json({ ok: false, error: error.message });
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ ok: false, error: 'Invalid input', details: error.errors });
    }
    return res.status(400).json({ ok: false, error: error.message });
  }
});

// Login
r.post('/auth/login', async (req, res) => {
  try {
    const data = LoginSchema.parse(req.body);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];
    const email = data.email?.trim().toLowerCase();
    console.log('[AUTH] Login attempt', {
      email,
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString(),
    });
    const result = await loginUser(data.email, data.password, ipAddress, userAgent);
    console.log('[AUTH] Login success', {
      email,
      userId: result.user?.id,
      role: result.user?.role,
      adminRole: result.user?.adminRole,
      timestamp: new Date().toISOString(),
    });
    return res.json({ ok: true, ...result });
  } catch (error: any) {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email : undefined;
    const email = rawEmail?.trim().toLowerCase();
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];
    console.log('[AUTH] Login failed', {
      email,
      ipAddress,
      userAgent,
      error: error?.message || 'Unknown auth error',
      errorType: error?.name || 'Error',
      timestamp: new Date().toISOString(),
    });
    if (error.name === 'ZodError') {
      return res.status(400).json({ ok: false, error: 'Invalid input', details: error.errors });
    }
    return res.status(401).json({ ok: false, error: error.message || 'Invalid credentials' });
  }
});

// Refresh token
r.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ ok: false, error: 'Refresh token required' });
    }
    const tokens = await refreshAccessToken(refreshToken);
    return res.json({ ok: true, ...tokens });
  } catch (error: any) {
    return res.status(401).json({ ok: false, error: error.message || 'Invalid refresh token' });
  }
});

// Get current user
r.get('/auth/me', authenticate, async (req: any, res) => {
  try {
    // Omit preferences from select so /auth/me works even if migration add_user_preferences not applied
    const raw = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        adminRole: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        coachLevel: true,
        organizationName: true,
        teamAgeGroups: true,
        sessionsGeneratedThisMonth: true,
        drillsGeneratedThisMonth: true,
        trialEndDate: true,
        emailVerified: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    });

    const user = raw ? { ...raw, preferences: null as unknown } as AuthMeUser : null;
    
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    const enforcedGameModelId = await getEnforcedClubGameModelId(req.userId);
    
    // Get usage limits
    const sessionLimit = await checkUsageLimit(req.userId, 'session');
    const drillLimit = await checkUsageLimit(req.userId, 'drill');
    
    // Get subscription features (SUPER_ADMIN has no feature limits)
    const features = getFeaturesForAuthUser({
      subscriptionPlan: user.subscriptionPlan,
      adminRole: user.adminRole,
    });
    
    return res.json({
      ok: true,
      user: {
        ...user,
        enforcedGameModelId,
        limits: {
          sessions: sessionLimit,
          drills: drillLimit,
        },
        features,
      }
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Update profile and preferences
r.patch('/auth/me', authenticate, async (req: any, res) => {
  try {
    const body = UpdateProfileSchema.parse(req.body);
    await updateProfile(req.userId, {
      name: body.name,
      coachLevel: body.coachLevel ?? undefined,
      organizationName: body.organizationName ?? undefined,
      teamAgeGroups: body.teamAgeGroups,
      preferences: body.preferences ?? undefined,
    });
    return res.json({ ok: true, message: 'Profile updated' });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ ok: false, error: 'Invalid input', details: error.errors });
    }
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Change password (authenticated)
r.post('/auth/password/change', authenticate, async (req: any, res) => {
  try {
    const body = ChangePasswordSchema.parse(req.body);
    await changePassword(req.userId, body.currentPassword, body.newPassword);
    return res.json({ ok: true, message: 'Password changed. Please sign in again.' });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ ok: false, error: 'Invalid input', details: error.errors });
    }
    if (error.message?.includes('Current password') || error.message?.includes('incorrect')) {
      return res.status(401).json({ ok: false, error: error.message });
    }
    return res.status(400).json({ ok: false, error: error.message });
  }
});

// Check usage limits
r.get('/auth/usage', authenticate, async (req: any, res) => {
  try {
    const sessionLimit = await checkUsageLimit(req.userId, 'session');
    const drillLimit = await checkUsageLimit(req.userId, 'drill');
    
    return res.json({
      ok: true,
      limits: {
        sessions: sessionLimit,
        drills: drillLimit,
      }
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Logout (revoke refresh token)
r.post('/auth/logout', authenticate, async (req: any, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken, userId: req.userId }
      });
    }
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Verify email
r.post('/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ ok: false, error: 'Verification token required' });
    }
    const result = await verifyEmail(token);
    if (!result.success) {
      return res.status(400).json({ ok: false, error: result.message });
    }
    return res.json({ ok: true, message: result.message });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Resend verification email
r.post('/auth/resend-verification', authenticate, async (req: any, res) => {
  try {
    await resendVerificationEmail(req.userId);
    return res.json({ ok: true, message: 'Verification email sent' });
  } catch (error: any) {
    if (error.message === 'Email is already verified') {
      return res.status(400).json({ ok: false, error: error.message });
    }
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Request password reset
r.post('/auth/password/forgot', async (req, res) => {
  try {
    const data = ForgotPasswordSchema.parse(req.body);
    await requestPasswordReset(data.email);
    // Always respond with success message regardless of whether user exists
    return res.json({
      ok: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res
        .status(400)
        .json({ ok: false, error: 'Invalid input', details: error.errors });
    }
    return res
      .status(500)
      .json({ ok: false, error: error.message || 'Failed to request password reset' });
  }
});

// Reset password
r.post('/auth/password/reset', async (req, res) => {
  try {
    const data = ResetPasswordSchema.parse(req.body);
    await resetPassword(data.token, data.password);
    return res.json({ ok: true, message: 'Password has been reset successfully.' });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res
        .status(400)
        .json({ ok: false, error: 'Invalid input', details: error.errors });
    }
    // Treat token issues as 400 to avoid exposing stack traces
    const message = error.message || 'Failed to reset password';
    const status =
      message.includes('reset link') || message.includes('token') ? 400 : 500;
    return res.status(status).json({ ok: false, error: message });
  }
});

export default r;
