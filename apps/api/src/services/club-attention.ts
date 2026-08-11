import {
  getClubCalendarWeek,
  getCoachUsageSnapshot,
  resolveWeekBounds,
  usageStatusForRuns,
  type CoachUsageStatus,
} from './club-coach-overview';

export type AttentionSeverity = 'high' | 'medium' | 'low';
export type AttentionRuleId =
  | 'INACTIVE_7D'
  | 'EMPTY_WEEK'
  | 'LOW_ADOPTION'
  | 'COVERAGE';
export type AttentionActionType = 'assign' | 'calendar' | 'none';

export type AttentionItem = {
  id: string;
  ruleId: AttentionRuleId;
  severity: AttentionSeverity;
  coachUserId: string;
  coachName: string;
  title: string;
  detail: string;
  weekStart: string;
  action: { type: AttentionActionType };
};

const RULE_PRIORITY: Record<AttentionRuleId, number> = {
  INACTIVE_7D: 0,
  EMPTY_WEEK: 1,
  LOW_ADOPTION: 2,
  COVERAGE: 3,
};

const SEVERITY_RANK: Record<AttentionSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function dayLabelThrough(weekStart: Date, now: Date): string {
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const fri = new Date(weekStart);
  fri.setUTCDate(weekStart.getUTCDate() + 4); // Friday
  const through = todayUtc < fri ? todayUtc : fri;
  const offset = Math.round(
    (through.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000)
  );
  const clamped = Math.max(0, Math.min(4, offset));
  return DAY_LABELS[clamped];
}

function emptyThroughEnd(weekStart: Date, now: Date): Date {
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  ); // exclusive end of today
  const friEnd = new Date(weekStart);
  friEnd.setUTCDate(weekStart.getUTCDate() + 5); // Saturday 00:00 = end of Fri
  return todayUtc < friEnd ? todayUtc : friEnd;
}

function buildCandidate(input: {
  ruleId: AttentionRuleId;
  severity: AttentionSeverity;
  coachUserId: string;
  coachName: string;
  title: string;
  detail: string;
  weekStart: string;
  action: AttentionActionType;
}): AttentionItem {
  return {
    id: `${input.ruleId}:${input.coachUserId}:${input.weekStart}`,
    ruleId: input.ruleId,
    severity: input.severity,
    coachUserId: input.coachUserId,
    coachName: input.coachName,
    title: input.title,
    detail: input.detail,
    weekStart: input.weekStart,
    action: { type: input.action },
  };
}

/**
 * Club Attention v1 — compute-only Director Alerts from usage + calendar.
 * One highest-priority rule per coach. No ack persistence (Phase 4.1).
 */
export async function getClubAttention(input: {
  clubId: string;
  sectionId?: string | null;
  weekStart?: string | null;
}) {
  const bounds = resolveWeekBounds(input.weekStart);
  const now = new Date();
  const throughLabel = dayLabelThrough(bounds.weekStart, now);
  const emptyRangeEnd = emptyThroughEnd(bounds.weekStart, now);
  const warnings: string[] = [];

  const usage = await getCoachUsageSnapshot({
    clubId: input.clubId,
    sectionId: input.sectionId,
    days: 7,
  });

  let calendar: Awaited<ReturnType<typeof getClubCalendarWeek>> | null = null;
  try {
    calendar = await getClubCalendarWeek({
      clubId: input.clubId,
      sectionId: input.sectionId,
      weekStart: bounds.weekStartStr,
    });
  } catch {
    warnings.push('CALENDAR_UNAVAILABLE');
  }

  const eventsByCoach = new Map<string, { countThrough: number; coverageCount: number }>();
  if (calendar) {
    for (const coach of calendar.coaches) {
      eventsByCoach.set(coach.userId, { countThrough: 0, coverageCount: 0 });
    }
    for (const day of calendar.days) {
      const dayDate = new Date(`${day.date}T00:00:00.000Z`);
      for (const [coachId, cells] of Object.entries(day.cells || {})) {
        const bucket = eventsByCoach.get(coachId) || {
          countThrough: 0,
          coverageCount: 0,
        };
        for (const ev of cells) {
          if (dayDate < emptyRangeEnd) {
            bucket.countThrough += 1;
          }
          // Full Mon–Fri week for coverage awareness
          const dayIdx = Math.round(
            (dayDate.getTime() - bounds.weekStart.getTime()) / (24 * 60 * 60 * 1000)
          );
          if (dayIdx >= 0 && dayIdx <= 4 && ev.isCoverage) {
            bucket.coverageCount += 1;
          }
        }
        eventsByCoach.set(coachId, bucket);
      }
    }
  }

  const items: AttentionItem[] = [];

  for (const coach of usage.coaches) {
    const runs = coach.runs;
    const status: CoachUsageStatus = usageStatusForRuns(runs);
    const cal = eventsByCoach.get(coach.userId);
    const candidates: AttentionItem[] = [];

    if (status === 'inactive') {
      candidates.push(
        buildCandidate({
          ruleId: 'INACTIVE_7D',
          severity: 'high',
          coachUserId: coach.userId,
          coachName: coach.name,
          title: 'No AI sessions in the last 7 days',
          detail: calendar
            ? `0 generations · also check Mon–${throughLabel} calendar coverage`
            : '0 generations in the last 7 days',
          weekStart: bounds.weekStartStr,
          action: 'assign',
        })
      );
    }

    if (calendar && cal && cal.countThrough === 0) {
      candidates.push(
        buildCandidate({
          ruleId: 'EMPTY_WEEK',
          severity: 'high',
          coachUserId: coach.userId,
          coachName: coach.name,
          title: 'No sessions on the calendar this week',
          detail: `Empty Mon–${throughLabel} for week of ${bounds.weekStartStr}`,
          weekStart: bounds.weekStartStr,
          action: 'assign',
        })
      );
    }

    if (status === 'low') {
      candidates.push(
        buildCandidate({
          ruleId: 'LOW_ADOPTION',
          severity: 'medium',
          coachUserId: coach.userId,
          coachName: coach.name,
          title: 'Low session generation',
          detail: `${runs} runs in the last 7 days`,
          weekStart: bounds.weekStartStr,
          action: 'calendar',
        })
      );
    }

    if (calendar && cal && cal.coverageCount > 0) {
      candidates.push(
        buildCandidate({
          ruleId: 'COVERAGE',
          severity: 'low',
          coachUserId: coach.userId,
          coachName: coach.name,
          title: 'Coverage sessions this week',
          detail: `${cal.coverageCount} reassigned/coverage event(s)`,
          weekStart: bounds.weekStartStr,
          action: 'calendar',
        })
      );
    }

    if (candidates.length === 0) continue;
    candidates.sort(
      (a, b) => RULE_PRIORITY[a.ruleId] - RULE_PRIORITY[b.ruleId]
    );
    items.push(candidates[0]);
  }

  items.sort((a, b) => {
    const sr = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sr !== 0) return sr;
    const pr = RULE_PRIORITY[a.ruleId] - RULE_PRIORITY[b.ruleId];
    if (pr !== 0) return pr;
    return a.coachName.localeCompare(b.coachName);
  });

  const emptyWeekCount = items.filter((i) => i.ruleId === 'EMPTY_WEEK').length;

  return {
    clubId: input.clubId,
    weekStart: bounds.weekStartStr,
    weekEnd: bounds.weekEndStr,
    generatedAt: now.toISOString(),
    warnings: warnings.length ? warnings : undefined,
    summary: {
      coachesManaged: usage.summary.coachesManaged,
      activeCoaches: usage.summary.activeCoaches,
      emptyWeekCount: calendar ? emptyWeekCount : 0,
      weeklyAiSessions: usage.summary.weeklyAiSessions,
    },
    items,
  };
}
