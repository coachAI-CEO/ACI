import express from 'express';
import { ClubRole } from '@prisma/client';
import { requireClubRole, ClubAuthRequest } from './middleware/club-auth';
import { DOC_HUB_ROLES, listClubMembershipsForUser } from './services/club-memberships';

const r = express.Router();

/**
 * GET /doc-hub/access
 * Confirms the caller may enter DOC Hub (DOC | SECTION_DIRECTOR, or SUPER_ADMIN preview).
 * Soft client gates mirror this; real data endpoints will reuse requireClubRole with clubId.
 */
r.get(
  '/doc-hub/access',
  requireClubRole(DOC_HUB_ROLES, { requireClubId: false }),
  async (req: ClubAuthRequest, res) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ ok: false, error: 'Authentication required' });
      }

      const memberships = await listClubMembershipsForUser(req.userId);
      const directorMemberships = memberships.filter((m) =>
        DOC_HUB_ROLES.includes(m.role as ClubRole)
      );

      return res.json({
        ok: true,
        access: true,
        viaSuperAdmin: Boolean(req.clubAccessViaSuperAdmin),
        memberships: directorMemberships,
      });
    } catch (error: any) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  }
);

export default r;
