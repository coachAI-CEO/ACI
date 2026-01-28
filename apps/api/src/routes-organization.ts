import express from "express";
import { z } from "zod";
import { prisma } from "./prisma";
import { authenticate, AuthRequest, requireFeature, requireRole } from "./middleware/auth";
import {
  getOrganizationInfo,
  getOrganizationMembers,
  canInviteCoach,
  inviteCoach,
  removeCoach,
  updateOrganization,
} from "./services/organization";

const r = express.Router();

// All routes require authentication
r.use(authenticate);

/**
 * GET /organization
 * Get current user's organization info
 */
r.get("/organization", requireRole("CLUB"), async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { organizationName: true },
    });

    if (!user || !user.organizationName) {
      return res.status(404).json({
        ok: false,
        error: "Organization not found. Please set up your organization first.",
      });
    }

    const orgInfo = await getOrganizationInfo(user.organizationName);

    return res.json({
      ok: true,
      organization: orgInfo,
    });
  } catch (error: any) {
    console.error("[ORGANIZATION] Error fetching organization:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to fetch organization",
    });
  }
});

/**
 * GET /organization/members
 * Get organization members
 */
r.get("/organization/members", requireRole("CLUB"), async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { organizationName: true },
    });

    if (!user || !user.organizationName) {
      return res.status(404).json({
        ok: false,
        error: "Organization not found",
      });
    }

    const members = await getOrganizationMembers(user.organizationName);

    return res.json({
      ok: true,
      members,
    });
  } catch (error: any) {
    console.error("[ORGANIZATION] Error fetching members:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to fetch members",
    });
  }
});

/**
 * POST /organization/invite
 * Invite a coach to the organization
 */
r.post("/organization/invite", requireRole("CLUB"), requireFeature("canInviteCoaches"), async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const schema = z.object({
      email: z.string().email(),
      name: z.string().optional(),
      coachLevel: z.enum(["GRASSROOTS", "USSF_C", "USSF_B_PLUS"]).optional(),
      teamAgeGroups: z.array(z.string()).optional(),
    });

    const body = schema.parse(req.body);

    const result = await inviteCoach(
      req.userId,
      body.email,
      body.name,
      body.coachLevel,
      body.teamAgeGroups
    );

    if (!result.success) {
      return res.status(400).json({
        ok: false,
        error: result.message,
      });
    }

    return res.json({
      ok: true,
      message: result.message,
      coach: result.user,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        ok: false,
        error: "Invalid input",
        details: error.issues,
      });
    }

    console.error("[ORGANIZATION] Error inviting coach:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to invite coach",
    });
  }
});

/**
 * DELETE /organization/coaches/:coachId
 * Remove a coach from the organization
 */
r.delete("/organization/coaches/:coachId", requireRole("CLUB"), requireFeature("canInviteCoaches"), async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const { coachId } = req.params;

    const result = await removeCoach(req.userId, coachId);

    if (!result.success) {
      return res.status(400).json({
        ok: false,
        error: result.message,
      });
    }

    return res.json({
      ok: true,
      message: result.message,
    });
  } catch (error: any) {
    console.error("[ORGANIZATION] Error removing coach:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to remove coach",
    });
  }
});

/**
 * PATCH /organization
 * Update organization settings
 */
r.patch("/organization", requireRole("CLUB"), requireFeature("canManageOrganization"), async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const schema = z.object({
      name: z.string().min(1).optional(),
      teamAgeGroups: z.array(z.string()).optional(),
    });

    const body = schema.parse(req.body);

    const result = await updateOrganization(req.userId, body);

    if (!result.success) {
      return res.status(400).json({
        ok: false,
        error: result.message,
      });
    }

    return res.json({
      ok: true,
      message: result.message,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        ok: false,
        error: "Invalid input",
        details: error.issues,
      });
    }

    console.error("[ORGANIZATION] Error updating organization:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to update organization",
    });
  }
});

/**
 * GET /organization/invite-status
 * Check if user can invite more coaches
 */
r.get("/organization/invite-status", requireRole("CLUB"), requireFeature("canInviteCoaches"), async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const status = await canInviteCoach(req.userId);

    return res.json({
      ok: true,
      canInvite: status.allowed,
      currentCount: status.currentCount,
      limit: status.limit,
      reason: status.reason,
    });
  } catch (error: any) {
    console.error("[ORGANIZATION] Error checking invite status:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to check invite status",
    });
  }
});

export default r;
