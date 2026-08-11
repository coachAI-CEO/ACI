import { Response, NextFunction } from 'express';
import { ClubRole } from '@prisma/client';
import { authenticate, AuthRequest } from './auth';
import { prisma } from '../prisma';
import { DOC_HUB_ROLES } from '../services/club-memberships';

export interface ClubAuthRequest extends AuthRequest {
  clubId?: string;
  clubMembership?: {
    id: string;
    clubId: string;
    sectionId: string | null;
    role: ClubRole;
  };
  /** True when access was granted via SUPER_ADMIN preview, not a membership. */
  clubAccessViaSuperAdmin?: boolean;
}

function resolveClubId(req: ClubAuthRequest): string | null {
  const fromParams = typeof req.params?.clubId === 'string' ? req.params.clubId : null;
  const fromQuery = typeof req.query?.clubId === 'string' ? req.query.clubId : null;
  const body = req.body as { clubId?: unknown } | undefined;
  const fromBody = typeof body?.clubId === 'string' ? body.clubId : null;
  return fromParams || fromQuery || fromBody || null;
}

/**
 * Club-scoped role gate. Separate from requireAdmin (platform SUPER_ADMIN).
 * SUPER_ADMIN may pass for ops/QA preview; that path sets clubAccessViaSuperAdmin.
 */
export function requireClubRole(
  allowedRoles: ClubRole[] = DOC_HUB_ROLES,
  options: { requireClubId?: boolean } = {}
) {
  const requireClubId = options.requireClubId !== false;

  return (req: ClubAuthRequest, res: Response, next: NextFunction) => {
    authenticate(req as any, res, async () => {
      if (res.headersSent) return;

      try {
        if (!req.userId) {
          return res.status(401).json({ ok: false, error: 'Authentication required' });
        }

        const clubId = resolveClubId(req);
        if (requireClubId && !clubId) {
          return res.status(400).json({
            ok: false,
            error: 'clubId required',
            message: 'Pass clubId as a route param, query, or body field',
          });
        }

        if (clubId) {
          const membership = await prisma.clubMembership.findUnique({
            where: {
              userId_clubId: { userId: req.userId, clubId },
            },
            select: {
              id: true,
              clubId: true,
              sectionId: true,
              role: true,
            },
          });

          if (membership && allowedRoles.includes(membership.role)) {
            req.clubId = membership.clubId;
            req.clubMembership = membership;
            return next();
          }
        } else {
          const membership = await prisma.clubMembership.findFirst({
            where: {
              userId: req.userId,
              role: { in: allowedRoles },
            },
            select: {
              id: true,
              clubId: true,
              sectionId: true,
              role: true,
            },
          });
          if (membership) {
            req.clubId = membership.clubId;
            req.clubMembership = membership;
            return next();
          }
        }

        const user = await prisma.user.findUnique({
          where: { id: req.userId },
          select: { adminRole: true },
        });
        if (user?.adminRole === 'SUPER_ADMIN') {
          req.clubId = clubId ?? undefined;
          req.clubAccessViaSuperAdmin = true;
          return next();
        }

        return res.status(403).json({
          ok: false,
          error: 'Club role required',
          message: `This endpoint requires one of: ${allowedRoles.join(', ')}`,
          clubId: clubId ?? undefined,
        });
      } catch (error: any) {
        if (!res.headersSent) {
          return res.status(500).json({ ok: false, error: error.message || 'Club auth failed' });
        }
      }
    });
  };
}
