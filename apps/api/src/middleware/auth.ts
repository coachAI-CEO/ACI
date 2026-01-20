import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';

// IMPORTANT: This MUST match the default used in services/auth.ts
// so that tokens created during login can be verified here.
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface AuthRequest extends Request {
  userId?: string;
  user?: any;
  userRole?: string;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Try Bearer token first
    const authHeader = req.headers.authorization;
    let token: string | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      // Fallback to x-user-id for backward compatibility (anonymous users)
      const userId = req.headers['x-user-id'] as string;
      if (userId) {
        req.userId = userId;
        req.userRole = 'FREE'; // Anonymous users are free tier
        return next();
      }
    }
    
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        trialEndDate: true,
      }
    });
    
    if (!user) {
      return res.status(401).json({ ok: false, error: 'User not found' });
    }
    
    // Check if trial expired
    if (user.role === 'TRIAL' && user.trialEndDate && user.trialEndDate < new Date()) {
      // Auto-downgrade to FREE
      await prisma.user.update({
        where: { id: user.id },
        data: {
          role: 'FREE',
          subscriptionPlan: 'FREE',
          subscriptionStatus: 'EXPIRED',
        }
      });
      user.role = 'FREE';
      user.subscriptionPlan = 'FREE';
    }
    
    req.userId = user.id;
    req.user = user;
    req.userRole = user.role;
    
    next();
  } catch (error) {
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
};

// Optional authentication (allows anonymous users)
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
        }
      });
      if (user) {
        req.userId = user.id;
        req.user = user;
        req.userRole = user.role;
      }
    } else {
      // Anonymous user
      const userId = req.headers['x-user-id'] as string;
      if (userId) {
        req.userId = userId;
        req.userRole = 'FREE';
      }
    }
    next();
  } catch (error) {
    // Continue as anonymous
    next();
  }
};

// Require specific role
export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ 
        ok: false, 
        error: 'Insufficient permissions',
        required: roles,
        current: req.userRole
      });
    }
    next();
  };
};

// Check subscription feature
export const requireFeature = (feature: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    
    const { SUBSCRIPTION_LIMITS } = await import('../config/subscription-limits');
    const limits = SUBSCRIPTION_LIMITS[req.user.subscriptionPlan as keyof typeof SUBSCRIPTION_LIMITS];
    const hasFeature = limits[feature as keyof typeof limits];
    
    if (!hasFeature) {
      return res.status(403).json({ 
        ok: false, 
        error: 'Feature not available in your plan',
        feature,
        plan: req.user.subscriptionPlan
      });
    }
    
    next();
  };
};
