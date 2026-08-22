/**
 * Canonical `CalendarEvent` shape used by the mobile app, the webapp,
 * and the API. Mirrors what `/calendar/events` returns from
 * `apps/api/src/services/calendar.ts` (`CalendarEventWithSession`).
 *
 * Kept here so all consumers (mobile services, web pages, future
 * shared hooks) agree on the shape. The old stub shape
 * (`title`, `startAt`, `endAt`, `date`, `time`) is preserved as
 * optional fields so the (currently-unused) web reference still
 * type-checks; in practice the backend returns `scheduledDate` and
 * the mobile's `session` join.
 *
 * DOC Hub audit fields (`originalCoachId`, `assignedByUserId`,
 * `reassignedBy`, `reassignedAt`) are populated only by the
 * `/doc-hub/...` endpoints — mobile self-calendar endpoints never
 * set them.
 */

export type CalendarSessionRef = {
  id: string;
  title?: string;
  refCode?: string;
  durationMin?: number;
  ageGroup?: string;
  gameModelId?: string;
};

export type CalendarEvent = {
  id: string;
  userId?: string;
  sessionId?: string;
  sessionRefCode?: string;
  scheduledDate?: string;
  durationMin?: number;
  notes?: string;
  location?: string;
  teamName?: string;
  teamId?: string;
  completed?: boolean;
  cancelled?: boolean;
  /** Hydrated by `/calendar/events` via N+1 join. Optional everywhere else. */
  session?: CalendarSessionRef | null;
  // DOC Hub audit trail — only set by `/doc-hub/...` endpoints.
  originalCoachId?: string;
  assignedByUserId?: string;
  reassignedBy?: string;
  reassignedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  // Legacy loose fields kept for back-compat. Backend does not return these.
  title?: string;
  startAt?: string;
  endAt?: string;
  date?: string;
  time?: string;
};