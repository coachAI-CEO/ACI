import express from 'express';
import { z } from 'zod';
import { ClubRole, TeamCoachRole } from '@prisma/client';
import { requireClubRole, ClubAuthRequest } from './middleware/club-auth';
import { DOC_HUB_ROLES, listClubMembershipsForUser } from './services/club-memberships';
import {
  getClubPhilosophy,
  updateClubPhilosophy,
} from './services/club-philosophy';
import { assistClubPhilosophyStage } from './services/club-philosophy-assist';
import { importClubPhilosophyFromDocument } from './services/club-philosophy-import';
import {
  getClubCalendarWeek,
  getCoachUsageSnapshot,
  resolveSectionScope,
} from './services/club-coach-overview';
import { getClubAttention } from './services/club-attention';
import {
  ClubCalendarAssignError,
  assignSessionToCoach,
  autoPopulateCoachWeek,
  listClubVaultSessions,
  reassignCalendarEvent,
} from './services/club-calendar-assign';
import { prisma } from './prisma';
import {
  CoachCenterError,
  assignClubTeamCoach,
  createClubTeamForCoach,
  listClubTeams,
  syncClubCoachTeams,
  syncClubTeamCoaches,
  unassignClubTeamCoach,
} from './services/coach-center';
import { TrainingPriorityOutcome, TrainingPriorityStatus } from '@prisma/client';
import {
  TrainingPriorityError,
  SubprincipleNotEligibleError,
  createTrainingPriority,
  getTrainingPriorityForClub,
  listTrainingPrioritiesForTeam,
  resolveTrainingPriority,
} from './services/training-priority';
import { generateDrillForTrainingPriority, LlmResponseParseError } from './services/generate-from-priority';

function sectionScopeFromRequest(req: ClubAuthRequest): string | null {
  return resolveSectionScope({
    membershipSectionId: req.clubMembership?.sectionId,
    membershipRole: req.clubMembership?.role,
    viaSuperAdmin: req.clubAccessViaSuperAdmin,
    requestedSectionId:
      typeof req.query.sectionId === 'string' ? req.query.sectionId : null,
  });
}

function assignScopeFromRequest(req: ClubAuthRequest, clubId: string) {
  if (!req.userId) {
    throw new ClubCalendarAssignError(401, 'UNAUTHENTICATED', 'Authentication required');
  }
  return {
    clubId,
    requesterUserId: req.userId,
    membershipRole: req.clubMembership?.role,
    membershipSectionId: req.clubMembership?.sectionId,
    viaSuperAdmin: Boolean(req.clubAccessViaSuperAdmin),
    sectionFilter: sectionScopeFromRequest(req),
  };
}

function sendAssignError(res: express.Response, error: unknown) {
  if (error instanceof ClubCalendarAssignError) {
    return res.status(error.status).json({
      ok: false,
      error: error.code,
      message: error.message,
      details: error.details,
    });
  }
  const message = error instanceof Error ? error.message : String(error);
  return res.status(500).json({ ok: false, error: message });
}

const r = express.Router();

const PhilosophyAssistSchema = z.object({
  stageKey: z.enum([
    'attackingOrganization',
    'defensiveTransition',
    'defensiveOrganization',
    'attackingTransition',
  ]),
  mode: z.enum(['polish', 'expand', 'shorten', 'draft', 'align']),
  currentText: z.string().max(4000).optional().default(''),
  notes: z.string().max(2000).nullable().optional(),
  otherStages: z
    .object({
      attackingOrganization: z.string().max(4000).nullable().optional(),
      defensiveTransition: z.string().max(4000).nullable().optional(),
      defensiveOrganization: z.string().max(4000).nullable().optional(),
      attackingTransition: z.string().max(4000).nullable().optional(),
    })
    .optional(),
});

const PhilosophyPatchSchema = z
  .object({
    attackingOrganization: z.string().max(4000).nullable().optional(),
    defensiveTransition: z.string().max(4000).nullable().optional(),
    defensiveOrganization: z.string().max(4000).nullable().optional(),
    attackingTransition: z.string().max(4000).nullable().optional(),
  })
  .refine(
    (body) =>
      body.attackingOrganization !== undefined ||
      body.defensiveTransition !== undefined ||
      body.defensiveOrganization !== undefined ||
      body.attackingTransition !== undefined,
    { message: 'At least one philosophy field is required' }
  );

/**
 * GET /doc-hub/access
 * Confirms the caller may enter DOC Hub (DOC | SECTION_DIRECTOR, or SUPER_ADMIN preview).
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

      let previewClubs: Array<{ id: string; name: string; gameModelId: string }> | undefined;
      if (req.clubAccessViaSuperAdmin && directorMemberships.length === 0) {
        previewClubs = await prisma.club.findMany({
          where: { active: true },
          select: { id: true, name: true, gameModelId: true },
          orderBy: { name: 'asc' },
          take: 50,
        });
      }

      return res.json({
        ok: true,
        access: true,
        viaSuperAdmin: Boolean(req.clubAccessViaSuperAdmin),
        memberships: directorMemberships,
        canEditPhilosophy: Boolean(
          req.clubAccessViaSuperAdmin ||
            directorMemberships.some((m) => m.role === ClubRole.DOC)
        ),
        previewClubs,
      });
    } catch (error: any) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  }
);

/**
 * GET /doc-hub/clubs/:clubId/philosophy
 * Read club game-model DNA (4 stages). DOC | SECTION_DIRECTOR | SUPER_ADMIN.
 */
r.get(
  '/doc-hub/clubs/:clubId/philosophy',
  requireClubRole(DOC_HUB_ROLES),
  async (req: ClubAuthRequest, res) => {
    try {
      const clubId = req.clubId || String(req.params.clubId || '');
      const record = await getClubPhilosophy(clubId);
      if (!record) {
        return res.status(404).json({ ok: false, error: 'Club not found' });
      }
      return res.json({ ok: true, ...record });
    } catch (error: any) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  }
);

/**
 * PATCH /doc-hub/clubs/:clubId/philosophy
 * DOC owns club DNA (4 stages). Game model assignment stays platform-admin only.
 * SUPER_ADMIN may preview-write. Section directors read-only.
 */
r.patch(
  '/doc-hub/clubs/:clubId/philosophy',
  requireClubRole([ClubRole.DOC]),
  async (req: ClubAuthRequest, res) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ ok: false, error: 'Authentication required' });
      }

      const parsed = PhilosophyPatchSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid philosophy payload',
          details: parsed.error.flatten(),
        });
      }

      const clubId = req.clubId || String(req.params.clubId || '');
      const record = await updateClubPhilosophy(clubId, parsed.data, req.userId);
      if (!record) {
        return res.status(404).json({ ok: false, error: 'Club not found' });
      }

      return res.json({ ok: true, ...record });
    } catch (error: any) {
      if (error?.message === 'Invalid game model for club') {
        return res.status(400).json({ ok: false, error: error.message });
      }
      return res.status(500).json({ ok: false, error: error.message });
    }
  }
);

/**
 * POST /doc-hub/clubs/:clubId/philosophy/assist
 * AI writing assistant for one philosophy stage (DOC + SUPER_ADMIN).
 */
r.post(
  '/doc-hub/clubs/:clubId/philosophy/assist',
  requireClubRole([ClubRole.DOC]),
  async (req: ClubAuthRequest, res) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ ok: false, error: 'Authentication required' });
      }

      const parsed = PhilosophyAssistSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid assist payload',
          details: parsed.error.flatten(),
        });
      }

      const clubId = req.clubId || String(req.params.clubId || '');
      const result = await assistClubPhilosophyStage({
        clubId,
        stageKey: parsed.data.stageKey,
        mode: parsed.data.mode,
        currentText: parsed.data.currentText || '',
        notes: parsed.data.notes,
        otherStages: parsed.data.otherStages,
      });

      return res.json({ ok: true, ...result, stageKey: parsed.data.stageKey, mode: parsed.data.mode });
    } catch (error: any) {
      const message = error?.message || String(error);
      if (message === 'Club not found') {
        return res.status(404).json({ ok: false, error: message });
      }
      return res.status(500).json({ ok: false, error: message });
    }
  }
);

const PhilosophyImportSchema = z.object({
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(100),
  base64: z.string().min(100).max(8_000_000),
});

/**
 * POST /doc-hub/clubs/:clubId/philosophy/import
 * Upload a club game-model PDF → AI draft of 4 stages (DOC reviews before save).
 */
r.post(
  '/doc-hub/clubs/:clubId/philosophy/import',
  requireClubRole([ClubRole.DOC]),
  async (req: ClubAuthRequest, res) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ ok: false, error: 'Authentication required' });
      }

      const parsed = PhilosophyImportSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid import payload',
          details: parsed.error.flatten(),
        });
      }

      const clubId = req.clubId || String(req.params.clubId || '');
      const result = await importClubPhilosophyFromDocument({
        clubId,
        fileName: parsed.data.fileName,
        mimeType: parsed.data.mimeType,
        base64: parsed.data.base64,
      });

      return res.json({ ok: true, ...result });
    } catch (error: any) {
      const message = error?.message || String(error);
      if (message === 'Club not found') {
        return res.status(404).json({ ok: false, error: message });
      }
      if (
        message.includes('Only PDF') ||
        message.includes('too large') ||
        message.includes('Empty') ||
        message.includes('No usable')
      ) {
        return res.status(400).json({ ok: false, error: message });
      }
      return res.status(500).json({ ok: false, error: message });
    }
  }
);

/**
 * GET /doc-hub/clubs/:clubId/coaches/usage?sectionId=&days=7
 * Coach adoption snapshot for the last N days (session generations).
 */
r.get(
  '/doc-hub/clubs/:clubId/coaches/usage',
  requireClubRole(DOC_HUB_ROLES),
  async (req: ClubAuthRequest, res) => {
    try {
      const clubId = req.clubId || String(req.params.clubId || '');
      const sectionId = sectionScopeFromRequest(req);
      const days = Number(req.query.days) || 7;
      const snapshot = await getCoachUsageSnapshot({ clubId, sectionId, days });
      return res.json({ ok: true, ...snapshot });
    } catch (error: any) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  }
);

/**
 * GET /doc-hub/clubs/:clubId/attention?weekStart=&sectionId=
 * Club Attention (Director Alerts v1) — rule-ranked visibility into dark / empty coaches.
 */
r.get(
  '/doc-hub/clubs/:clubId/attention',
  requireClubRole(DOC_HUB_ROLES),
  async (req: ClubAuthRequest, res) => {
    try {
      const clubId = req.clubId || String(req.params.clubId || '');
      const sectionId = sectionScopeFromRequest(req);
      const weekStart =
        typeof req.query.weekStart === 'string' ? req.query.weekStart : null;
      const attention = await getClubAttention({ clubId, sectionId, weekStart });
      return res.json({ ok: true, ...attention });
    } catch (error: any) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  }
);

/**
 * GET /doc-hub/clubs/:clubId/calendar/week?weekStart=YYYY-MM-DD&coachUserId=&sectionId=
 * Multi-coach weekly calendar grid (Mon–Sun UTC week).
 */
r.get(
  '/doc-hub/clubs/:clubId/calendar/week',
  requireClubRole(DOC_HUB_ROLES),
  async (req: ClubAuthRequest, res) => {
    try {
      const clubId = req.clubId || String(req.params.clubId || '');
      const sectionId = sectionScopeFromRequest(req);
      const weekStart =
        typeof req.query.weekStart === 'string' ? req.query.weekStart : null;
      const coachUserId =
        typeof req.query.coachUserId === 'string' ? req.query.coachUserId : null;
      const week = await getClubCalendarWeek({
        clubId,
        sectionId,
        weekStart,
        coachUserId,
      });
      return res.json({ ok: true, ...week });
    } catch (error: any) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  }
);

/**
 * GET /doc-hub/clubs/:clubId/vault/sessions?ageGroup=&limit=
 * Vault sessions matching the club's game model (for assign picker).
 */
r.get(
  '/doc-hub/clubs/:clubId/vault/sessions',
  requireClubRole(DOC_HUB_ROLES),
  async (req: ClubAuthRequest, res) => {
    try {
      const clubId = req.clubId || String(req.params.clubId || '');
      const ageGroup =
        typeof req.query.ageGroup === 'string' ? req.query.ageGroup : null;
      const limit = Number(req.query.limit) || 100;
      const result = await listClubVaultSessions({ clubId, ageGroup, limit });
      return res.json({ ok: true, ...result });
    } catch (error) {
      return sendAssignError(res, error);
    }
  }
);

/**
 * POST /doc-hub/clubs/:clubId/calendar/assign
 * Assign one vault session onto a coach calendar (Add to Coach).
 */
r.post(
  '/doc-hub/clubs/:clubId/calendar/assign',
  requireClubRole(DOC_HUB_ROLES),
  async (req: ClubAuthRequest, res) => {
    try {
      const clubId = req.clubId || String(req.params.clubId || '');
      const body = req.body || {};
      const coachUserId = String(body.coachUserId || '').trim();
      const sessionId = String(body.sessionId || '').trim();
      const scheduledDateRaw = body.scheduledDate;
      if (!coachUserId || !sessionId || !scheduledDateRaw) {
        return res.status(400).json({
          ok: false,
          error: 'coachUserId, sessionId, and scheduledDate are required',
        });
      }
      const scheduledDate = new Date(scheduledDateRaw);
      if (Number.isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ ok: false, error: 'Invalid scheduledDate' });
      }

      const event = await assignSessionToCoach(assignScopeFromRequest(req, clubId), {
        coachUserId,
        sessionId,
        scheduledDate,
        durationMin: body.durationMin != null ? Number(body.durationMin) : undefined,
        notes: body.notes != null ? String(body.notes) : undefined,
        location: body.location != null ? String(body.location) : undefined,
        teamName: body.teamName != null ? String(body.teamName) : undefined,
        allowConflict: Boolean(body.allowConflict),
      });
      return res.status(201).json({ ok: true, event });
    } catch (error) {
      return sendAssignError(res, error);
    }
  }
);

/**
 * POST /doc-hub/clubs/:clubId/calendar/auto-populate
 * Fill empty Mon–Fri slots for a coach from vault sessions.
 */
r.post(
  '/doc-hub/clubs/:clubId/calendar/auto-populate',
  requireClubRole(DOC_HUB_ROLES),
  async (req: ClubAuthRequest, res) => {
    try {
      const clubId = req.clubId || String(req.params.clubId || '');
      const body = req.body || {};
      const coachUserId = String(body.coachUserId || '').trim();
      if (!coachUserId) {
        return res.status(400).json({ ok: false, error: 'coachUserId is required' });
      }

      const result = await autoPopulateCoachWeek(assignScopeFromRequest(req, clubId), {
        coachUserId,
        weekStart: body.weekStart != null ? String(body.weekStart) : null,
        sessionIds: Array.isArray(body.sessionIds)
          ? body.sessionIds.map((id: unknown) => String(id))
          : undefined,
        defaultTime: body.defaultTime != null ? String(body.defaultTime) : '17:00',
        ageGroup: body.ageGroup != null ? String(body.ageGroup) : null,
        skipDaysWithEvents: body.skipDaysWithEvents !== false,
      });
      return res.json({ ok: true, ...result });
    } catch (error) {
      return sendAssignError(res, error);
    }
  }
);

/**
 * POST /doc-hub/clubs/:clubId/calendar/reassign
 * Move an event to a substitute coach with audit trail.
 */
r.post(
  '/doc-hub/clubs/:clubId/calendar/reassign',
  requireClubRole(DOC_HUB_ROLES),
  async (req: ClubAuthRequest, res) => {
    try {
      const clubId = req.clubId || String(req.params.clubId || '');
      const body = req.body || {};
      const eventId = String(body.eventId || '').trim();
      const toCoachUserId = String(body.toCoachUserId || '').trim();
      if (!eventId || !toCoachUserId) {
        return res.status(400).json({
          ok: false,
          error: 'eventId and toCoachUserId are required',
        });
      }

      let scheduledDate: Date | null = null;
      if (body.scheduledDate != null && body.scheduledDate !== '') {
        scheduledDate = new Date(body.scheduledDate);
        if (Number.isNaN(scheduledDate.getTime())) {
          return res.status(400).json({ ok: false, error: 'Invalid scheduledDate' });
        }
      }

      const event = await reassignCalendarEvent(assignScopeFromRequest(req, clubId), {
        eventId,
        toCoachUserId,
        scheduledDate,
        notes: body.notes !== undefined ? (body.notes == null ? null : String(body.notes)) : undefined,
        allowConflict: Boolean(body.allowConflict),
      });
      return res.json({ ok: true, event });
    } catch (error) {
      return sendAssignError(res, error);
    }
  }
);

function sendTeamError(res: express.Response, error: unknown) {
  if (error instanceof CoachCenterError) {
    return res.status(error.status).json({ ok: false, error: error.code, message: error.message });
  }
  const message = error instanceof Error ? error.message : String(error);
  return res.status(500).json({ ok: false, error: message });
}

r.get(
  '/doc-hub/clubs/:clubId/teams',
  requireClubRole(DOC_HUB_ROLES),
  async (req: ClubAuthRequest, res) => {
    try {
      const clubId = req.clubId || String(req.params.clubId || '');
      const teams = await listClubTeams(clubId, sectionScopeFromRequest(req), req.userId);
      return res.json({ ok: true, teams });
    } catch (error) {
      return sendTeamError(res, error);
    }
  }
);

r.post(
  '/doc-hub/clubs/:clubId/teams',
  requireClubRole(DOC_HUB_ROLES),
  async (req: ClubAuthRequest, res) => {
    try {
      if (!req.userId) return res.status(401).json({ ok: false, error: 'Authentication required' });
      const clubId = req.clubId || String(req.params.clubId || '');
      const schema = z.object({
        name: z.string().min(1).max(80),
        ageGroup: z.string().min(2).max(8),
        coachUserId: z.string().uuid(),
        seasonLabel: z.string().max(40).nullable().optional(),
        role: z.enum(['HEAD', 'ASSISTANT']).optional(),
      });
      const body = schema.parse(req.body ?? {});
      const team = await createClubTeamForCoach(
        req.userId,
        clubId,
        sectionScopeFromRequest(req),
        {
          ...body,
          role: body.role === 'ASSISTANT' ? TeamCoachRole.ASSISTANT : TeamCoachRole.HEAD,
        }
      );
      return res.json({ ok: true, team });
    } catch (error) {
      if ((error as { name?: string })?.name === 'ZodError') {
        return res.status(400).json({ ok: false, error: 'Invalid input' });
      }
      return sendTeamError(res, error);
    }
  }
);

r.patch(
  '/doc-hub/clubs/:clubId/coaches/:userId/teams',
  requireClubRole(DOC_HUB_ROLES),
  async (req: ClubAuthRequest, res) => {
    try {
      const clubId = req.clubId || String(req.params.clubId || '');
      const schema = z.object({
        teamIds: z.array(z.string().uuid()),
        role: z.enum(['HEAD', 'ASSISTANT']).optional(),
      });
      const body = schema.parse(req.body ?? {});
      const teams = await syncClubCoachTeams(
        clubId,
        sectionScopeFromRequest(req),
        req.params.userId,
        body.teamIds,
        body.role === 'ASSISTANT' ? TeamCoachRole.ASSISTANT : TeamCoachRole.HEAD
      );
      return res.json({ ok: true, teams });
    } catch (error) {
      if ((error as { name?: string })?.name === 'ZodError') {
        return res.status(400).json({ ok: false, error: 'Invalid team assignment' });
      }
      return sendTeamError(res, error);
    }
  }
);

r.patch(
  '/doc-hub/clubs/:clubId/teams/:teamId/coaches',
  requireClubRole(DOC_HUB_ROLES),
  async (req: ClubAuthRequest, res) => {
    try {
      const clubId = req.clubId || String(req.params.clubId || '');
      const schema = z.object({
        coachUserIds: z.array(z.string().uuid()),
        role: z.enum(['HEAD', 'ASSISTANT']).optional(),
      });
      const body = schema.parse(req.body ?? {});
      const team = await syncClubTeamCoaches(
        clubId,
        sectionScopeFromRequest(req),
        req.params.teamId,
        body.coachUserIds,
        body.role === 'ASSISTANT' ? TeamCoachRole.ASSISTANT : TeamCoachRole.HEAD
      );
      return res.json({ ok: true, team });
    } catch (error) {
      if ((error as { name?: string })?.name === 'ZodError') {
        return res.status(400).json({ ok: false, error: 'Invalid coach assignment' });
      }
      return sendTeamError(res, error);
    }
  }
);

r.post(
  '/doc-hub/clubs/:clubId/teams/:teamId/coaches/:userId',
  requireClubRole(DOC_HUB_ROLES),
  async (req: ClubAuthRequest, res) => {
    try {
      const clubId = req.clubId || String(req.params.clubId || '');
      const roleRaw = (req.body as { role?: unknown } | undefined)?.role;
      const team = await assignClubTeamCoach(
        clubId,
        sectionScopeFromRequest(req),
        req.params.teamId,
        req.params.userId,
        roleRaw === 'ASSISTANT' ? TeamCoachRole.ASSISTANT : TeamCoachRole.HEAD
      );
      return res.json({ ok: true, team });
    } catch (error) {
      return sendTeamError(res, error);
    }
  }
);

r.delete(
  '/doc-hub/clubs/:clubId/teams/:teamId/coaches/:userId',
  requireClubRole(DOC_HUB_ROLES),
  async (req: ClubAuthRequest, res) => {
    try {
      const clubId = req.clubId || String(req.params.clubId || '');
      const team = await unassignClubTeamCoach(
        clubId,
        sectionScopeFromRequest(req),
        req.params.teamId,
        req.params.userId
      );
      return res.json({ ok: true, team });
    } catch (error) {
      return sendTeamError(res, error);
    }
  }
);

function sendTrainingPriorityError(res: express.Response, error: unknown) {
  if (error instanceof TrainingPriorityError) {
    return res.status(error.status).json({ ok: false, error: error.code, message: error.message });
  }
  if (error instanceof SubprincipleNotEligibleError) {
    return res.status(400).json({ ok: false, error: 'NOT_ELIGIBLE', message: error.message });
  }
  if (error instanceof LlmResponseParseError) {
    return res.status(502).json({ ok: false, error: 'MODEL_RESPONSE_UNPARSEABLE', message: error.message });
  }
  const message = error instanceof Error ? error.message : String(error);
  return res.status(500).json({ ok: false, error: message });
}

const CreateTrainingPrioritySchema = z.object({
  teamId: z.string().uuid(),
  subprincipleId: z.string().uuid(),
  weekStart: z.string().min(1),
  rationale: z.string().min(1).max(2000),
});

/**
 * POST /doc-hub/clubs/:clubId/training-priorities
 * A DOC (or section director) sets one team's training focus for a week by
 * picking a game-model subprinciple. Enforces the team's readiness ceiling
 * and that both team and subprinciple belong to this club.
 */
r.post(
  '/doc-hub/clubs/:clubId/training-priorities',
  requireClubRole(DOC_HUB_ROLES),
  async (req: ClubAuthRequest, res) => {
    try {
      const clubId = req.clubId || String(req.params.clubId || '');
      const parsed = CreateTrainingPrioritySchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid training priority payload',
          details: parsed.error.flatten(),
        });
      }

      const weekStart = new Date(parsed.data.weekStart);
      if (Number.isNaN(weekStart.getTime())) {
        return res.status(400).json({ ok: false, error: 'Invalid weekStart' });
      }

      const priority = await createTrainingPriority({
        clubId,
        teamId: parsed.data.teamId,
        subprincipleId: parsed.data.subprincipleId,
        weekStart,
        rationale: parsed.data.rationale,
        createdByUserId: req.userId,
      });
      return res.status(201).json({ ok: true, priority });
    } catch (error) {
      return sendTrainingPriorityError(res, error);
    }
  }
);

/**
 * GET /doc-hub/clubs/:clubId/teams/:teamId/training-priorities?status=ACTIVE
 * List a team's training priorities, newest week first, with the target
 * subprinciple's trigger/response/moment for display.
 */
r.get(
  '/doc-hub/clubs/:clubId/teams/:teamId/training-priorities',
  requireClubRole(DOC_HUB_ROLES),
  async (req: ClubAuthRequest, res) => {
    try {
      const clubId = req.clubId || String(req.params.clubId || '');
      const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
      const status =
        statusRaw && (Object.values(TrainingPriorityStatus) as string[]).includes(statusRaw)
          ? (statusRaw as TrainingPriorityStatus)
          : undefined;
      const priorities = await listTrainingPrioritiesForTeam({ clubId, teamId: req.params.teamId, status });
      return res.json({ ok: true, priorities });
    } catch (error) {
      return sendTrainingPriorityError(res, error);
    }
  }
);

const ResolveTrainingPrioritySchema = z.object({
  outcome: z.nativeEnum(TrainingPriorityOutcome),
  outcomeNotes: z.string().max(2000).nullable().optional(),
});

/**
 * PATCH /doc-hub/clubs/:clubId/training-priorities/:priorityId
 * Close the loop: record whether the team improved after training on this
 * priority and mark it RESOLVED.
 */
r.patch(
  '/doc-hub/clubs/:clubId/training-priorities/:priorityId',
  requireClubRole(DOC_HUB_ROLES),
  async (req: ClubAuthRequest, res) => {
    try {
      const clubId = req.clubId || String(req.params.clubId || '');
      const parsed = ResolveTrainingPrioritySchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid resolve payload',
          details: parsed.error.flatten(),
        });
      }

      const priority = await resolveTrainingPriority({
        clubId,
        trainingPriorityId: req.params.priorityId,
        outcome: parsed.data.outcome,
        outcomeNotes: parsed.data.outcomeNotes,
      });
      return res.json({ ok: true, priority });
    } catch (error) {
      return sendTrainingPriorityError(res, error);
    }
  }
);

/**
 * POST /doc-hub/clubs/:clubId/training-priorities/:priorityId/generate-drill
 * First real caller of the Call1(intent)->Call2(drill)->Call3(QA gate)
 * pipeline: turns a DOC-assigned TrainingPriority into one drill + QA
 * verdict for a coach to review. Does not persist the drill -- this is the
 * minimal end-to-end path; saving/attaching it to a session is follow-on work.
 */
r.post(
  '/doc-hub/clubs/:clubId/training-priorities/:priorityId/generate-drill',
  requireClubRole(DOC_HUB_ROLES),
  async (req: ClubAuthRequest, res) => {
    try {
      const clubId = req.clubId || String(req.params.clubId || '');
      await getTrainingPriorityForClub(req.params.priorityId, clubId);
      const result = await generateDrillForTrainingPriority(req.params.priorityId);
      return res.json({ ok: true, ...result });
    } catch (error) {
      return sendTrainingPriorityError(res, error);
    }
  }
);

export default r;
