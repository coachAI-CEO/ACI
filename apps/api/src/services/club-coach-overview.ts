import { ClubRole } from '@prisma/client';
import { prisma } from '../prisma';
import { TEAM_ASSIGNABLE_ROLES } from './club-memberships';

export type CoachUsageStatus = 'heavy' | 'active' | 'low' | 'inactive';

export type ClubCoachRow = {
  userId: string;
  name: string;
  email: string | null;
  roleLabel: string;
  sectionId: string | null;
  sectionName: string | null;
  teamAgeGroups: string[];
  coachLevel: string | null;
  lastLoginAt: Date | null;
};

function displayName(user: { name: string | null; email: string | null }): string {
  const name = String(user.name || '').trim();
  if (name) return name;
  const email = String(user.email || '').trim();
  if (email) return email.split('@')[0] || email;
  return 'Coach';
}

function roleLabelFor(row: {
  clubRole: ClubRole;
  sectionName: string | null;
  teamAgeGroups: string[];
  coachLevel: string | null;
}): string {
  if (row.clubRole === ClubRole.DOC) return 'DOC';
  if (row.clubRole === ClubRole.SECTION_DIRECTOR) return row.sectionName || 'Section Dir';
  if (row.sectionName) return row.sectionName;
  if (row.teamAgeGroups.length > 0) return row.teamAgeGroups[0];
  if (row.coachLevel) return row.coachLevel.replace(/_/g, ' ');
  return 'Coach';
}

export function usageStatusForRuns(runs: number): CoachUsageStatus {
  if (runs >= 15) return 'heavy';
  if (runs >= 5) return 'active';
  if (runs >= 1) return 'low';
  return 'inactive';
}

export function formatLastActiveLabel(
  lastActiveAt: Date | null,
  now: Date = new Date()
): string {
  if (!lastActiveAt) return 'No activity';
  const ms = now.getTime() - lastActiveAt.getTime();
  if (ms < 0) return lastActiveAt.toLocaleString();
  const hours = ms / (1000 * 60 * 60);
  if (hours < 18) {
    return `Today, ${lastActiveAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (hours < 42) return 'Yesterday';
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days} days ago`;
  return lastActiveAt.toLocaleDateString();
}

function formatEventTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const suffix = h >= 12 ? 'p' : 'a';
  const hour12 = h % 12 || 12;
  if (m === 0) return `${hour12}${suffix}`;
  return `${hour12}:${String(m).padStart(2, '0')}${suffix}`;
}

/** Monday 00:00 UTC for the week containing `date` (or of weekStart YYYY-MM-DD). */
export function resolveWeekBounds(weekStartParam?: string | null): {
  weekStart: Date;
  weekEnd: Date;
  weekStartStr: string;
  weekEndStr: string;
} {
  let anchor: Date;
  if (weekStartParam && /^\d{4}-\d{2}-\d{2}$/.test(weekStartParam)) {
    const [y, m, d] = weekStartParam.split('-').map(Number);
    anchor = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  } else {
    const now = new Date();
    anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  // JS getUTCDay: 0=Sun … 1=Mon. Shift so Monday is start.
  const day = anchor.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(anchor);
  weekStart.setUTCDate(anchor.getUTCDate() + mondayOffset);
  weekStart.setUTCHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
  // exclusive end at next Monday 00:00

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const weekEndInclusive = new Date(weekEnd.getTime() - 1);

  return {
    weekStart,
    weekEnd,
    weekStartStr: iso(weekStart),
    weekEndStr: iso(weekEndInclusive),
  };
}

/**
 * Resolve section filter: SECTION_DIRECTOR is locked to their section;
 * DOC / SUPER_ADMIN may pass optional sectionId.
 */
export function resolveSectionScope(input: {
  membershipSectionId?: string | null;
  membershipRole?: ClubRole | null;
  viaSuperAdmin?: boolean;
  requestedSectionId?: string | null;
}): string | null {
  if (
    input.membershipRole === ClubRole.SECTION_DIRECTOR &&
    input.membershipSectionId
  ) {
    return input.membershipSectionId;
  }
  const requested = String(input.requestedSectionId || '').trim();
  return requested || null;
}

export async function listClubCoaches(input: {
  clubId: string;
  sectionId?: string | null;
}): Promise<ClubCoachRow[]> {
  const memberships = await prisma.clubMembership.findMany({
    where: {
      clubId: input.clubId,
      role: { in: TEAM_ASSIGNABLE_ROLES },
      ...(input.sectionId
        ? {
            OR: [{ sectionId: input.sectionId }, { role: ClubRole.DOC }],
          }
        : {}),
    },
    select: {
      role: true,
      sectionId: true,
      section: { select: { id: true, name: true } },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          coachLevel: true,
          teamAgeGroups: true,
          lastLoginAt: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return memberships.map((m) => {
    const sectionName = m.section?.name ?? null;
    const teamAgeGroups = m.user.teamAgeGroups || [];
    const coachLevel = m.user.coachLevel ? String(m.user.coachLevel) : null;
    return {
      userId: m.user.id,
      name: displayName(m.user),
      email: m.user.email,
      roleLabel: roleLabelFor({
        clubRole: m.role,
        sectionName,
        teamAgeGroups,
        coachLevel,
      }),
      sectionId: m.sectionId,
      sectionName,
      teamAgeGroups,
      coachLevel,
      lastLoginAt: m.user.lastLoginAt,
    };
  });
}

export async function getCoachUsageSnapshot(input: {
  clubId: string;
  sectionId?: string | null;
  days?: number;
}) {
  const days = Math.min(Math.max(Number(input.days) || 7, 1), 90);
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - days * 24 * 60 * 60 * 1000);

  const coaches = await listClubCoaches({
    clubId: input.clubId,
    sectionId: input.sectionId,
  });
  const coachIds = coaches.map((c) => c.userId);

  const sessionStats =
    coachIds.length === 0
      ? []
      : await prisma.session.groupBy({
          by: ['generatedBy'],
          where: {
            generatedBy: { in: coachIds },
            createdAt: { gte: windowStart, lte: windowEnd },
          },
          _count: { _all: true },
          _max: { createdAt: true },
        });

  const statsByUser = new Map(
    sessionStats
      .filter((s) => s.generatedBy)
      .map((s) => [
        s.generatedBy as string,
        { runs: s._count._all, lastSessionAt: s._max.createdAt },
      ])
  );

  const rows = coaches.map((c) => {
    const stats = statsByUser.get(c.userId);
    const runs = stats?.runs ?? 0;
    const lastActiveAt = stats?.lastSessionAt || c.lastLoginAt || null;
    return {
      userId: c.userId,
      name: c.name,
      email: c.email,
      roleLabel: c.roleLabel,
      sectionId: c.sectionId,
      sectionName: c.sectionName,
      teamAgeGroups: c.teamAgeGroups,
      runs,
      lastActiveAt,
      lastActiveLabel: formatLastActiveLabel(lastActiveAt, windowEnd),
      lastLoginAt: c.lastLoginAt,
      status: usageStatusForRuns(runs),
    };
  });

  // Heavy first, then by runs desc, then name
  const statusRank: Record<CoachUsageStatus, number> = {
    heavy: 0,
    active: 1,
    low: 2,
    inactive: 3,
  };
  rows.sort((a, b) => {
    const sr = statusRank[a.status] - statusRank[b.status];
    if (sr !== 0) return sr;
    if (b.runs !== a.runs) return b.runs - a.runs;
    return a.name.localeCompare(b.name);
  });

  const activeCoaches = rows.filter((r) => r.status !== 'inactive').length;
  const weeklyAiSessions = rows.reduce((sum, r) => sum + r.runs, 0);

  return {
    clubId: input.clubId,
    sectionId: input.sectionId ?? null,
    windowDays: days,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    summary: {
      coachesManaged: rows.length,
      activeCoaches,
      inactiveThisWeek: rows.length - activeCoaches,
      weeklyAiSessions,
    },
    coaches: rows,
  };
}

export type CalendarCellEvent = {
  eventId: string;
  sessionId: string;
  title: string;
  code: string;
  time: string;
  scheduledDate: string;
  durationMin: number | null;
  cancelled: boolean;
  completed: boolean;
  savedToVault: boolean;
  originalCoachId: string | null;
  assignedByUserId: string | null;
  reassignedBy: string | null;
  isCoverage: boolean;
};

export async function getClubCalendarWeek(input: {
  clubId: string;
  sectionId?: string | null;
  weekStart?: string | null;
  coachUserId?: string | null;
}) {
  const bounds = resolveWeekBounds(input.weekStart);
  let coaches = await listClubCoaches({
    clubId: input.clubId,
    sectionId: input.sectionId,
  });

  const filterCoach = String(input.coachUserId || '').trim();
  if (filterCoach) {
    coaches = coaches.filter((c) => c.userId === filterCoach);
  }

  const coachIds = coaches.map((c) => c.userId);
  const events =
    coachIds.length === 0
      ? []
      : await prisma.calendarEvent.findMany({
          where: {
            userId: { in: coachIds },
            scheduledDate: { gte: bounds.weekStart, lt: bounds.weekEnd },
            cancelled: false,
          },
          select: {
            id: true,
            userId: true,
            sessionId: true,
            sessionRefCode: true,
            scheduledDate: true,
            durationMin: true,
            completed: true,
            cancelled: true,
            originalCoachId: true,
            assignedByUserId: true,
            reassignedBy: true,
          },
          orderBy: { scheduledDate: 'asc' },
        });

  const sessionIds = [...new Set(events.map((e) => e.sessionId).filter(Boolean))];
  const sessions =
    sessionIds.length === 0
      ? []
      : await prisma.session.findMany({
          where: { id: { in: sessionIds } },
          select: {
            id: true,
            title: true,
            refCode: true,
            savedToVault: true,
            durationMin: true,
          },
        });
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
  const days: Array<{
    date: string;
    dayLabel: string;
    cells: Record<string, CalendarCellEvent[]>;
  }> = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(bounds.weekStart);
    d.setUTCDate(bounds.weekStart.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({
      date: dateStr,
      dayLabel: dayLabels[i],
      cells: Object.fromEntries(coachIds.map((id) => [id, [] as CalendarCellEvent[]])),
    });
  }

  const dayIndex = new Map(days.map((d, idx) => [d.date, idx]));

  for (const event of events) {
    const dateStr = event.scheduledDate.toISOString().slice(0, 10);
    const idx = dayIndex.get(dateStr);
    if (idx === undefined) continue;
    const session = sessionById.get(event.sessionId);
    const cell: CalendarCellEvent = {
      eventId: event.id,
      sessionId: event.sessionId,
      title: session?.title || 'Scheduled session',
      code: event.sessionRefCode || session?.refCode || '—',
      time: formatEventTime(event.scheduledDate),
      scheduledDate: event.scheduledDate.toISOString(),
      durationMin: event.durationMin ?? session?.durationMin ?? null,
      cancelled: event.cancelled,
      completed: event.completed,
      savedToVault: Boolean(session?.savedToVault),
      originalCoachId: event.originalCoachId,
      assignedByUserId: event.assignedByUserId,
      reassignedBy: event.reassignedBy,
      isCoverage: Boolean(
        event.originalCoachId && event.originalCoachId !== event.userId
      ),
    };
    days[idx].cells[event.userId]?.push(cell);
  }

  return {
    clubId: input.clubId,
    sectionId: input.sectionId ?? null,
    weekStart: bounds.weekStartStr,
    weekEnd: bounds.weekEndStr,
    coaches: coaches.map((c) => ({
      userId: c.userId,
      name: c.name,
      roleLabel: c.roleLabel,
      sectionName: c.sectionName,
    })),
    days,
  };
}
