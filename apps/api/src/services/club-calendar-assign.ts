import { ClubRole } from '@prisma/client';
import { prisma } from '../prisma';
import { getVaultSessions } from './vault';
import { listClubCoaches, resolveWeekBounds } from './club-coach-overview';
import { sessionVisibleToClub } from './club-session-visibility';

export class ClubCalendarAssignError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type RequesterScope = {
  clubId: string;
  requesterUserId: string;
  membershipRole?: ClubRole | null;
  membershipSectionId?: string | null;
  viaSuperAdmin?: boolean;
  sectionFilter?: string | null;
};

async function getClubGameModelId(clubId: string): Promise<string> {
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: { gameModelId: true },
  });
  if (!club) {
    throw new ClubCalendarAssignError(404, 'CLUB_NOT_FOUND', 'Club not found');
  }
  return club.gameModelId;
}

/**
 * Ensure the requester may manage the target coach within the club/section.
 */
export async function assertRequesterManagesCoach(
  scope: RequesterScope,
  coachUserId: string
): Promise<{ userId: string; sectionId: string | null }> {
  const coaches = await listClubCoaches({
    clubId: scope.clubId,
    sectionId: scope.sectionFilter ?? null,
  });
  const coach = coaches.find((c) => c.userId === coachUserId);
  if (!coach) {
    throw new ClubCalendarAssignError(
      403,
      'COACH_OUT_OF_SCOPE',
      'Target coach is not in this club/section'
    );
  }

  if (scope.viaSuperAdmin || scope.membershipRole === ClubRole.DOC) {
    return { userId: coach.userId, sectionId: coach.sectionId };
  }

  if (scope.membershipRole === ClubRole.SECTION_DIRECTOR) {
    if (
      scope.membershipSectionId &&
      coach.sectionId &&
      coach.sectionId !== scope.membershipSectionId
    ) {
      throw new ClubCalendarAssignError(
        403,
        'COACH_OUT_OF_SCOPE',
        'Section directors can only manage coaches in their section'
      );
    }
    // Director with null sectionId: allow coaches already returned by sectionFilter/list
    return { userId: coach.userId, sectionId: coach.sectionId };
  }

  throw new ClubCalendarAssignError(403, 'FORBIDDEN', 'Club role required');
}

function utcDayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
  );
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 1);
  return { start, end };
}

async function findDayConflicts(coachUserId: string, scheduledDate: Date) {
  const { start, end } = utcDayRange(scheduledDate);
  return prisma.calendarEvent.findMany({
    where: {
      userId: coachUserId,
      cancelled: false,
      scheduledDate: { gte: start, lt: end },
    },
    select: {
      id: true,
      sessionId: true,
      sessionRefCode: true,
      scheduledDate: true,
    },
    orderBy: { scheduledDate: 'asc' },
  });
}

async function loadAssignableSession(sessionId: string, clubId: string, clubGameModelId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      refCode: true,
      title: true,
      durationMin: true,
      savedToVault: true,
      gameModelId: true,
      clubId: true,
      ageGroup: true,
    },
  });
  if (!session) {
    throw new ClubCalendarAssignError(404, 'SESSION_NOT_FOUND', 'Session not found');
  }
  if (!session.savedToVault) {
    throw new ClubCalendarAssignError(
      400,
      'SESSION_NOT_IN_VAULT',
      'Only vault sessions can be assigned from DOC Hub'
    );
  }
  if (
    !sessionVisibleToClub({
      sessionClubId: session.clubId,
      sessionGameModelId: String(session.gameModelId),
      clubId,
      clubGameModelId,
    })
  ) {
    throw new ClubCalendarAssignError(
      400,
      'SESSION_CLUB_MISMATCH',
      'Session does not belong to this club'
    );
  }
  return session;
}

function serializeEvent(event: {
  id: string;
  userId: string;
  sessionId: string;
  sessionRefCode: string | null;
  scheduledDate: Date;
  durationMin: number | null;
  notes: string | null;
  location: string | null;
  teamName: string | null;
  originalCoachId: string | null;
  assignedByUserId: string | null;
  reassignedBy: string | null;
  reassignedAt: Date | null;
  completed: boolean;
  cancelled: boolean;
}, session?: { id: string; refCode: string | null; title: string; durationMin: number | null }) {
  return {
    id: event.id,
    userId: event.userId,
    sessionId: event.sessionId,
    sessionRefCode: event.sessionRefCode,
    scheduledDate: event.scheduledDate.toISOString(),
    durationMin: event.durationMin,
    notes: event.notes,
    location: event.location,
    teamName: event.teamName,
    originalCoachId: event.originalCoachId,
    assignedByUserId: event.assignedByUserId,
    reassignedBy: event.reassignedBy,
    reassignedAt: event.reassignedAt?.toISOString() ?? null,
    completed: event.completed,
    cancelled: event.cancelled,
    session: session
      ? {
          id: session.id,
          refCode: session.refCode,
          title: session.title,
          durationMin: session.durationMin,
        }
      : undefined,
  };
}

export async function listClubVaultSessions(input: {
  clubId: string;
  ageGroup?: string | null;
  limit?: number;
}) {
  const gameModelId = await getClubGameModelId(input.clubId);
  const result = await getVaultSessions({
    clubId: input.clubId,
    gameModelId,
    ageGroup: input.ageGroup || undefined,
    limit: input.limit || 100,
    excludeSeries: true,
  });
  return {
    clubId: input.clubId,
    gameModelId,
    total: result.total,
    sessions: result.sessions.map((s) => ({
      id: s.id,
      refCode: s.refCode,
      title: s.title,
      ageGroup: s.ageGroup,
      durationMin: s.durationMin,
      phase: s.phase,
      createdAt: s.createdAt,
    })),
  };
}

export async function assignSessionToCoach(
  scope: RequesterScope,
  input: {
    coachUserId: string;
    sessionId: string;
    scheduledDate: Date;
    durationMin?: number;
    notes?: string;
    location?: string;
    teamName?: string;
    allowConflict?: boolean;
  }
) {
  await assertRequesterManagesCoach(scope, input.coachUserId);
  const clubGameModelId = await getClubGameModelId(scope.clubId);
  const session = await loadAssignableSession(input.sessionId, scope.clubId, clubGameModelId);

  if (!input.allowConflict) {
    const conflicts = await findDayConflicts(input.coachUserId, input.scheduledDate);
    if (conflicts.length > 0) {
      throw new ClubCalendarAssignError(
        409,
        'DAY_CONFLICT',
        'Coach already has a session that day',
        { conflicts }
      );
    }
  }

  const event = await prisma.calendarEvent.create({
    data: {
      userId: input.coachUserId,
      sessionId: session.id,
      sessionRefCode: session.refCode,
      scheduledDate: input.scheduledDate,
      durationMin: input.durationMin || session.durationMin || 60,
      notes: input.notes,
      location: input.location,
      teamName: input.teamName,
      originalCoachId: input.coachUserId,
      assignedByUserId: scope.requesterUserId,
    },
  });

  return serializeEvent(event, session);
}

function parseDefaultTime(defaultTime?: string | null): { hours: number; minutes: number } {
  const raw = String(defaultTime || '17:00').trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return { hours: 17, minutes: 0 };
  const hours = Math.min(23, Math.max(0, Number(m[1])));
  const minutes = Math.min(59, Math.max(0, Number(m[2])));
  return { hours, minutes };
}

export async function autoPopulateCoachWeek(
  scope: RequesterScope,
  input: {
    coachUserId: string;
    weekStart?: string | null;
    sessionIds?: string[];
    defaultTime?: string | null;
    ageGroup?: string | null;
    skipDaysWithEvents?: boolean;
  }
) {
  await assertRequesterManagesCoach(scope, input.coachUserId);
  const bounds = resolveWeekBounds(input.weekStart);
  const clubGameModelId = await getClubGameModelId(scope.clubId);
  const { hours, minutes } = parseDefaultTime(input.defaultTime);
  const skipDaysWithEvents = input.skipDaysWithEvents !== false;

  let sessionPool: Array<{
    id: string;
    refCode: string | null;
    title: string;
    durationMin: number | null;
  }> = [];

  if (input.sessionIds && input.sessionIds.length > 0) {
    for (const id of input.sessionIds) {
      sessionPool.push(await loadAssignableSession(id, scope.clubId, clubGameModelId));
    }
  } else {
    const vault = await getVaultSessions({
      clubId: scope.clubId,
      gameModelId: clubGameModelId,
      ageGroup: input.ageGroup || undefined,
      limit: 20,
      excludeSeries: true,
    });
    sessionPool = vault.sessions.map((s) => ({
      id: s.id,
      refCode: s.refCode,
      title: s.title,
      durationMin: s.durationMin,
    }));
  }

  if (sessionPool.length === 0) {
    throw new ClubCalendarAssignError(
      400,
      'NO_VAULT_SESSIONS',
      'No vault sessions available to auto-populate'
    );
  }

  const created: ReturnType<typeof serializeEvent>[] = [];
  const skipped: Array<{ date: string; reason: string }> = [];
  let poolIndex = 0;

  // Mon–Fri only (i = 0..4)
  for (let i = 0; i < 5; i++) {
    const day = new Date(bounds.weekStart);
    day.setUTCDate(bounds.weekStart.getUTCDate() + i);
    const dateStr = day.toISOString().slice(0, 10);

    if (poolIndex >= sessionPool.length) {
      skipped.push({ date: dateStr, reason: 'NO_MORE_SESSIONS' });
      continue;
    }

    const scheduledDate = new Date(day);
    scheduledDate.setUTCHours(hours, minutes, 0, 0);

    if (skipDaysWithEvents) {
      const conflicts = await findDayConflicts(input.coachUserId, scheduledDate);
      if (conflicts.length > 0) {
        skipped.push({ date: dateStr, reason: 'DAY_ALREADY_HAS_EVENT' });
        continue;
      }
    }

    const session = sessionPool[poolIndex++];
    const event = await prisma.calendarEvent.create({
      data: {
        userId: input.coachUserId,
        sessionId: session.id,
        sessionRefCode: session.refCode,
        scheduledDate,
        durationMin: session.durationMin || 60,
        notes: 'Auto-populated by DOC Hub',
        originalCoachId: input.coachUserId,
        assignedByUserId: scope.requesterUserId,
      },
    });
    created.push(serializeEvent(event, session));
  }

  return {
    weekStart: bounds.weekStartStr,
    weekEnd: bounds.weekEndStr,
    created,
    skipped,
  };
}

export async function reassignCalendarEvent(
  scope: RequesterScope,
  input: {
    eventId: string;
    toCoachUserId: string;
    scheduledDate?: Date | null;
    notes?: string | null;
    allowConflict?: boolean;
  }
) {
  const event = await prisma.calendarEvent.findUnique({
    where: { id: input.eventId },
  });
  if (!event || event.cancelled) {
    throw new ClubCalendarAssignError(404, 'EVENT_NOT_FOUND', 'Calendar event not found');
  }

  // Must manage both current owner and substitute
  await assertRequesterManagesCoach(scope, event.userId);
  await assertRequesterManagesCoach(scope, input.toCoachUserId);

  if (event.userId === input.toCoachUserId && !input.scheduledDate && input.notes == null) {
    throw new ClubCalendarAssignError(
      400,
      'NO_CHANGE',
      'Substitute coach is already the event owner'
    );
  }

  const nextDate = input.scheduledDate || event.scheduledDate;
  if (!input.allowConflict) {
    const conflicts = (await findDayConflicts(input.toCoachUserId, nextDate)).filter(
      (c) => c.id !== event.id
    );
    if (conflicts.length > 0) {
      throw new ClubCalendarAssignError(
        409,
        'DAY_CONFLICT',
        'Substitute coach already has a session that day',
        { conflicts }
      );
    }
  }

  const updated = await prisma.calendarEvent.update({
    where: { id: event.id },
    data: {
      userId: input.toCoachUserId,
      scheduledDate: nextDate,
      originalCoachId: event.originalCoachId || event.userId,
      reassignedBy: scope.requesterUserId,
      reassignedAt: new Date(),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
  });

  const session = await prisma.session.findUnique({
    where: { id: updated.sessionId },
    select: { id: true, refCode: true, title: true, durationMin: true },
  });

  return serializeEvent(updated, session || undefined);
}
