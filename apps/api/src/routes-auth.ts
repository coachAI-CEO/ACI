import express from 'express';
import { z } from 'zod';
import { 
  registerUser, 
  loginUser, 
  refreshAccessToken,
  checkUsageLimit,
  verifyEmail,
  resendVerificationEmail
} from './services/auth';
import { authenticate } from './middleware/auth';
import { prisma } from './prisma';
import { SUBSCRIPTION_LIMITS } from './config/subscription-limits';

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

// Register
r.post('/auth/register', async (req, res) => {
  try {
    const data = RegisterSchema.parse(req.body);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];
    const result = await registerUser(data);
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
    const result = await loginUser(data.email, data.password, ipAddress, userAgent);
    return res.json({ ok: true, ...result });
  } catch (error: any) {
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
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
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
      }
    });
    
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    
    // Get usage limits
    const sessionLimit = await checkUsageLimit(req.userId, 'session');
    const drillLimit = await checkUsageLimit(req.userId, 'drill');
    
    // Get subscription features
    const plan = user.subscriptionPlan as keyof typeof SUBSCRIPTION_LIMITS;
    const limits = SUBSCRIPTION_LIMITS[plan] || SUBSCRIPTION_LIMITS.FREE;
    const features = {
      canExportPDF: limits.canExportPDF,
      canGenerateSeries: limits.canGenerateSeries,
      canUseAdvancedFilters: limits.canUseAdvancedFilters,
      canAccessCalendar: limits.canAccessCalendar,
      canCreatePlayerPlans: limits.canCreatePlayerPlans,
      canGenerateWeeklySummaries: limits.canGenerateWeeklySummaries,
      canInviteCoaches: limits.canInviteCoaches,
      canManageOrganization: limits.canManageOrganization,
    };
    
    return res.json({
      ok: true,
      user: {
        ...user,
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

export default r;
