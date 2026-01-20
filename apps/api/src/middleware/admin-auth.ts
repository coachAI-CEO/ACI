import { Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from './auth';
import { hasPermission, AdminRole, ADMIN_PERMISSIONS } from '../config/admin-permissions';
import { prisma } from '../prisma';

export interface AdminRequest extends AuthRequest {
  adminRole?: AdminRole;
}

// Require admin authentication
export const requireAdmin = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  // First check regular authentication
  await new Promise<void>((resolve, reject) => {
    authenticate(req as any, res, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
  
  // Check if user is admin
  if (!req.user) {
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }
  
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { adminRole: true, role: true }
  });
  
  // Only SUPER_ADMIN users are allowed to access admin endpoints
  if (!user || user.adminRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ 
      ok: false, 
      error: 'Admin access required',
      message: 'This endpoint requires SUPER_ADMIN privileges'
    });
  }
  
  req.adminRole = user.adminRole as AdminRole;
  next();
};

// Require specific admin permission
export const requireAdminPermission = (permission: string) => {
  return async (req: AdminRequest, res: Response, next: NextFunction) => {
    await requireAdmin(req, res, async () => {
      if (!req.adminRole) {
        return res.status(403).json({ ok: false, error: 'Admin role not found' });
      }
      
      const hasAccess = hasPermission(
        req.adminRole, 
        permission as keyof typeof ADMIN_PERMISSIONS.SUPER_ADMIN
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          ok: false,
          error: 'Insufficient permissions',
          required: permission,
          currentRole: req.adminRole
        });
      }
      
      next();
    });
  };
};

// Log admin action
export async function logAdminAction(
  adminId: string,
  action: string,
  details: {
    resourceType?: string;
    resourceId?: string;
    data?: any;
  },
  req?: Request
) {
  await prisma.adminAction.create({
    data: {
      adminId,
      action,
      resourceType: details.resourceType,
      resourceId: details.resourceId,
      details: details.data,
      ipAddress: req?.ip || (req?.headers['x-forwarded-for'] as string),
      userAgent: req?.headers['user-agent'],
    }
  });
  
  // Update user's last admin action
  await prisma.user.update({
    where: { id: adminId },
    data: { lastAdminAction: new Date() }
  });
}
