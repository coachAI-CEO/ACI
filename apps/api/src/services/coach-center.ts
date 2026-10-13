import {
  ClubRole,
  GameModelId,
  Prisma,
  SeasonPhase,
  TeamCoachRole,
} from "@prisma/client";
import { prisma } from "../prisma";
import { generateText } from "../gemini";
import { getClubPhilosophy, philosophyHasContent } from "./club-philosophy";
import { getGameModelTemplatePhilosophy } from "./game-model-templates";
import { clubVaultWhere } from "./club-session-visibility";
import { generateGameDayPdf } from "./pdf-export";
import { generateMatchRecapPdf } from "./match-recap-pdf";
import { parseMatchRecap } from "./match-recap";
import { upsertClubMembership, TEAM_ASSIGNABLE_ROLES } from "./club-memberships";
import {
  buildDefaultCurriculumWeeks,
  buildWeekKnowledge,
  currentWeekIndex,
  sessionAudience,
  sessionBuilderQuery,
} from "./coach-center-curriculum";
import { catalogForClub, catalogNotes } from "./club-team-catalog";
import { getActiveTrainingPriorityForTeamWeek } from "./training-priority";

const GAME_MODEL_LABELS: Record<string, string> = {
  POSSESSION: "Possession",
  PRESSING: "Pressing",
  TRANSITION: "Transition",
  COACHAI: "Balanced (CoachAI)",
  ROCKLIN_FC: "Rocklin FC",
};

const AGE_GROUPS = [
  "U8",
  "U9",
  "U10",
  "U11",
  "U12",
  "U13",
  "U14",
  "U15",
  "U16",
  "U17",
  "U18",
];

export class CoachCenterError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

const teamInclude = {
  club: { select: { id: true, name: true, gameModelId: true } },
  section: { select: { id: true, name: true } },
  coaches: {
    include: { user: { select: { id: true, name: true, email: true, coachLevel: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  seasons: {
    where: { active: true },
    include: { weeks: { orderBy: { weekIndex: "asc" as const } } },
    take: 1,
  },
};

export function serializeTeam(team: any, viewer?: { userId?: string }) {
  const season = team.seasons?.[0] || null;
  const weekIndex = season ? currentWeekIndex(season.startDate) : 1;
  const coaches = team.coaches || [];
  const assigned = viewer?.userId ? coaches.find((c: any) => c.userId === viewer.userId) : null;
  const head = coaches.find((c: any) => c.role === "HEAD") || coaches[0] || null;
  const source = assigned || head;
  const audience = sessionAudience({
    coachLevel: source?.user?.coachLevel || null,
    ageGroup: team.ageGroup,
    teamName: team.name,
    playerLevel: team.playerLevel,
  });
  const generated = buildDefaultCurriculumWeeks({
    playerLevel: audience.playerLevel,
    coachLevel: audience.coachLevel,
    teamName: team.name,
  });
  const storedWeeks = season?.weeks || [];
  const weeks = generated.map((draft) => {
    const stored = storedWeeks.find((w: any) => w.weekIndex === draft.weekIndex);
    return {
      id: stored?.id || `week-${draft.weekIndex}`,
      weekIndex: draft.weekIndex,
      theme: draft.theme,
      moment: draft.moment,
      phase: draft.phase,
      zone: draft.zone,
      focus: draft.focus,
      notes: draft.notes,
      generateHref: sessionBuilderQuery({
        ageGroup: team.ageGroup,
        gameModelId: team.gameModelId,
        phase: draft.phase,
        zone: draft.zone,
        topic: draft.theme,
        coachLevel: audience.coachLevel,
        playerLevel: audience.playerLevel,
        teamName: team.name,
        teamId: team.id,
      }),
      knowledge: buildWeekKnowledge({
        theme: draft.theme,
        moment: draft.moment,
        phase: draft.phase,
        zone: draft.zone,
        focus: draft.focus,
        ageGroup: team.ageGroup,
        playerLevel: audience.playerLevel,
        coachLevel: audience.coachLevel,
      }),
    };
  });
  const currentWeek = weeks.find((w) => w.weekIndex === weekIndex) || weeks[0] || null;
  const generateHref = sessionBuilderQuery({
    ageGroup: team.ageGroup,
    gameModelId: team.gameModelId,
    phase: currentWeek?.phase,
    zone: currentWeek?.zone,
    topic: currentWeek?.theme,
    coachLevel: audience.coachLevel,
    playerLevel: audience.playerLevel,
    teamName: team.name,
    teamId: team.id,
  });
  return {
    id: team.id,
    name: team.name,
    ageGroup: team.ageGroup,
    clubId: team.clubId,
    clubName: team.club?.name || null,
    sectionId: team.sectionId,
    sectionName: team.section?.name || null,
    gameModelId: team.gameModelId,
    gameModelLabel: GAME_MODEL_LABELS[team.gameModelId] || team.gameModelId,
    seasonLabel: team.seasonLabel,
    notes: team.notes,
    playerLevelOverride: team.playerLevel || null,
    band: audience.band,
    audienceSource: audience.source,
    coachLevel: audience.coachLevel,
    playerLevel: audience.playerLevel,
    coaches: (team.coaches || []).map((c: any) => ({
      userId: c.userId,
      name: c.user?.name || c.user?.email || "Coach",
      role: c.role,
      coachLevel: c.user?.coachLevel || null,
    })),
    season: season
      ? {
          id: season.id,
          name: season.name,
          startDate: season.startDate.toISOString().slice(0, 10),
          endDate: season.endDate.toISOString().slice(0, 10),
          phase: season.phase,
          currentWeekIndex: weekIndex,
          weeks,
          currentWeek,
        }
      : null,
    generateHref,
  };
}

const MOMENT_ENUM_TO_CAMEL: Record<string, string> = {
  ATTACKING_ORGANIZATION: "attackingOrganization",
  DEFENSIVE_TRANSITION: "defensiveTransition",
  DEFENSIVE_ORGANIZATION: "defensiveOrganization",
  ATTACKING_TRANSITION: "attackingTransition",
};

function weekStartDateForIndex(seasonStartDate: Date, weekIndex: number): Date {
  const date = new Date(seasonStartDate);
  date.setUTCDate(date.getUTCDate() + (weekIndex - 1) * 7);
  return date;
}

/**
 * Overlay a DOC-assigned TrainingPriority onto a curriculum week's
 * theme/moment/focus/notes. phase/zone are left as the generic curriculum
 * picked them -- a Subprinciple doesn't carry phase/zone, only moment, so
 * there's nothing more specific to derive them from yet.
 */
function applyTrainingPriorityToWeek(
  week: any,
  priority: NonNullable<Awaited<ReturnType<typeof getActiveTrainingPriorityForTeamWeek>>>,
  team: { id: string; ageGroup: string; gameModelId: string; name: string },
  audience: { coachLevel?: string | null; playerLevel?: string | null }
) {
  const sub = priority.subprinciple;
  const moment = MOMENT_ENUM_TO_CAMEL[sub.principle.moment] || week.moment;
  return {
    ...week,
    theme: sub.trigger,
    moment,
    focus: sub.response,
    notes: sub.antiPattern ? `Avoid: ${sub.antiPattern}` : week.notes,
    source: "training_priority" as const,
    trainingPriorityId: priority.id,
    trainingPrioritySubprincipleId: sub.id,
    generateHref: sessionBuilderQuery({
      ageGroup: team.ageGroup,
      gameModelId: team.gameModelId,
      phase: week.phase,
      zone: week.zone,
      topic: sub.trigger,
      coachLevel: audience.coachLevel,
      playerLevel: audience.playerLevel,
      teamName: team.name,
      teamId: team.id,
    }),
  };
}

/**
 * serializeTeam plus the DOC Hub integration: if the team's DOC has an
 * ACTIVE TrainingPriority for the current calendar week, it overrides the
 * generic default-curriculum week everywhere "this week's topic" is shown
 * or used (overview, recommendations, chat assistant) -- otherwise every
 * team, including ones with a real club game model, would keep surfacing
 * generic BEGINNER/INTERMEDIATE/ADVANCED curriculum copy regardless of what
 * the DOC actually assigned.
 */
export async function serializeTeamWithActivePriority(team: any, viewer?: { userId?: string }) {
  const serialized = serializeTeam(team, viewer);
  const season = team.seasons?.[0];
  const currentWeek = serialized.season?.currentWeek;
  if (!season || !currentWeek) return serialized;

  const weekStart = weekStartDateForIndex(season.startDate, currentWeek.weekIndex);
  const priority = await getActiveTrainingPriorityForTeamWeek(team.id, weekStart);
  if (!priority) return serialized;

  const overriddenWeek = applyTrainingPriorityToWeek(currentWeek, priority, team, {
    coachLevel: serialized.coachLevel,
    playerLevel: serialized.playerLevel,
  });
  serialized.season!.currentWeek = overriddenWeek;
  serialized.season!.weeks = serialized.season!.weeks.map((w: any) =>
    w.weekIndex === overriddenWeek.weekIndex ? overriddenWeek : w
  );
  serialized.generateHref = overriddenWeek.generateHref;
  return serialized;
}

export async function listAllTeams(viewerUserId?: string) {
  const teams = await prisma.team.findMany({
    include: teamInclude,
    orderBy: [{ name: "asc" }],
    take: 500,
  });
  return teams.map((team) => serializeTeam(team, viewerUserId ? { userId: viewerUserId } : undefined));
}

export async function listTeamsForUser(userId: string) {
  const assignments = await prisma.teamCoach.findMany({
    where: { userId },
    include: { team: { include: teamInclude } },
    orderBy: { createdAt: "desc" },
  });
  return assignments.map((row) => serializeTeam(row.team, { userId }));
}

export async function requireTeamAccess(userId: string, teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: teamInclude,
  });
  if (!team) throw new CoachCenterError(404, "NOT_FOUND", "Team not found");
  const assigned = team.coaches.some((c) => c.userId === userId);
  if (assigned) return team;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { adminRole: true, clubMemberships: { select: { clubId: true, role: true } } },
  });
  if (user?.adminRole === "SUPER_ADMIN") return team;
  if (
    team.clubId &&
    user?.clubMemberships.some(
      (m) => m.clubId === team.clubId && (m.role === "DOC" || m.role === "SECTION_DIRECTOR")
    )
  ) {
    return team;
  }
  throw new CoachCenterError(403, "FORBIDDEN", "You are not assigned to this team");
}

export async function getCoachCenterAccess(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      adminRole: true,
      coachLevel: true,
      teamAgeGroups: true,
      clubMemberships: {
        select: {
          clubId: true,
          role: true,
          sectionId: true,
          club: { select: { id: true, name: true, gameModelId: true } },
          section: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!user) throw new CoachCenterError(401, "UNAUTHENTICATED", "Authentication required");

  const canViewAllTeams = user.adminRole === "SUPER_ADMIN";
  const teams = canViewAllTeams ? await listAllTeams(userId) : await listTeamsForUser(userId);
  return {
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      teamAgeGroups: user.teamAgeGroups,
    },
    canViewAllTeams,
    clubs: user.clubMemberships.map((m) => ({
      clubId: m.clubId,
      clubName: m.club.name,
      role: m.role as ClubRole,
      sectionId: m.sectionId,
      sectionName: m.section?.name || null,
      gameModelId: m.club.gameModelId,
    })),
    teams,
  };
}

export async function createTeam(
  userId: string,
  input: {
    name: string;
    ageGroup: string;
    gameModelId?: string;
    clubId?: string | null;
    seasonLabel?: string | null;
    notes?: string | null;
  }
) {
  const name = String(input.name || "").trim().slice(0, 80);
  if (!name) throw new CoachCenterError(400, "INVALID", "Team name is required");
  const ageGroup = String(input.ageGroup || "").trim().toUpperCase();
  if (!AGE_GROUPS.includes(ageGroup)) {
    throw new CoachCenterError(400, "INVALID", `ageGroup must be one of ${AGE_GROUPS.join(", ")}`);
  }

  let clubId: string | null = input.clubId || null;
  let gameModelId: GameModelId = (input.gameModelId as GameModelId) || GameModelId.COACHAI;

  if (clubId) {
    const membership = await prisma.clubMembership.findUnique({
      where: { userId_clubId: { userId, clubId } },
      include: { club: { select: { gameModelId: true } } },
    });
    if (!membership) throw new CoachCenterError(403, "FORBIDDEN", "You are not a member of that club");
    gameModelId = membership.club.gameModelId;
  } else if (input.gameModelId) {
    if (!Object.values(GameModelId).includes(input.gameModelId as GameModelId)) {
      throw new CoachCenterError(400, "INVALID", "Invalid game model");
    }
    gameModelId = input.gameModelId as GameModelId;
  } else {
    const membership = await prisma.clubMembership.findFirst({
      where: { userId },
      include: { club: { select: { id: true, gameModelId: true } } },
    });
    if (membership) {
      clubId = membership.club.id;
      gameModelId = membership.club.gameModelId;
    }
  }

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const day = start.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + mondayOffset);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 16 * 7 - 1);

  const year = start.getUTCFullYear();
  const seasonLabel = (input.seasonLabel || `${year} season`).slice(0, 40);
  const weeks = buildDefaultCurriculumWeeks({ teamName: name });

  const team = await prisma.team.create({
    data: {
      name,
      ageGroup,
      clubId,
      gameModelId,
      seasonLabel,
      notes: input.notes?.trim().slice(0, 2000) || null,
      createdByUserId: userId,
      coaches: { create: { userId, role: TeamCoachRole.HEAD } },
      seasons: {
        create: {
          name: seasonLabel,
          startDate: start,
          endDate: end,
          phase: SeasonPhase.IN_SEASON,
          active: true,
          weeks: {
            create: weeks.map((w) => ({
              weekIndex: w.weekIndex,
              theme: w.theme,
              moment: w.moment,
              phase: w.phase,
              zone: w.zone,
              focus: w.focus,
              notes: w.notes,
            })),
          },
        },
      },
    },
    include: teamInclude,
  });

  return serializeTeam(team, { userId });
}

export async function updateTeam(
  userId: string,
  teamId: string,
  patch: {
    name?: string;
    notes?: string | null;
    seasonLabel?: string | null;
    phase?: SeasonPhase;
    playerLevel?: string | null;
  }
) {
  await requireTeamAccess(userId, teamId);
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim().slice(0, 80);
    if (!name) throw new CoachCenterError(400, "INVALID", "Team name is required");
    data.name = name;
  }
  if (patch.notes !== undefined) data.notes = patch.notes?.trim().slice(0, 2000) || null;
  if (patch.seasonLabel !== undefined) data.seasonLabel = patch.seasonLabel?.trim().slice(0, 40) || null;
  if (patch.playerLevel !== undefined) {
    const value = String(patch.playerLevel || "").trim().toUpperCase();
    if (!value || value === "AUTO") data.playerLevel = null;
    else if (value === "BEGINNER" || value === "INTERMEDIATE" || value === "ADVANCED") data.playerLevel = value;
    else throw new CoachCenterError(400, "INVALID", "playerLevel must be AUTO, BEGINNER, INTERMEDIATE, or ADVANCED");
  }

  const team = await prisma.team.update({
    where: { id: teamId },
    data,
    include: teamInclude,
  });

  if (patch.phase && team.seasons[0]) {
    await prisma.teamSeason.update({
      where: { id: team.seasons[0].id },
      data: { phase: patch.phase },
    });
  }

  return serializeTeam(await prisma.team.findUniqueOrThrow({ where: { id: teamId }, include: teamInclude }));
}

function defaultSeasonWindow() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const day = start.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + mondayOffset);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 16 * 7 - 1);
  return { start, end, seasonLabel: `${start.getUTCFullYear()} season`.slice(0, 40) };
}

function seasonCreateData(seasonLabel: string, teamName?: string) {
  const { start, end } = defaultSeasonWindow();
  const weeks = buildDefaultCurriculumWeeks({ teamName });
  return {
    name: seasonLabel,
    startDate: start,
    endDate: end,
    phase: SeasonPhase.IN_SEASON,
    active: true,
    weeks: {
      create: weeks.map((w) => ({
        weekIndex: w.weekIndex,
        theme: w.theme,
        moment: w.moment,
        phase: w.phase,
        zone: w.zone,
        focus: w.focus,
        notes: w.notes,
      })),
    },
  };
}

export async function listTeamAssignmentsForUsers(userIds: string[]) {
  const byUser = new Map<
    string,
    Array<{
      id: string;
      name: string;
      ageGroup: string;
      clubId: string | null;
      clubName: string | null;
      format: string | null;
      role: string;
    }>
  >();
  if (userIds.length === 0) return byUser;

  const rows = await prisma.teamCoach.findMany({
    where: { userId: { in: userIds } },
    select: {
      userId: true,
      role: true,
      team: {
        select: {
          id: true,
          name: true,
          ageGroup: true,
          clubId: true,
          notes: true,
          club: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push({
      id: row.team.id,
      name: row.team.name,
      ageGroup: row.team.ageGroup,
      clubId: row.team.clubId,
      clubName: row.team.club?.name ?? null,
      format: row.team.notes || null,
      role: row.role,
    });
    byUser.set(row.userId, list);
  }
  return byUser;
}

export async function syncCoachTeams(userId: string, teamIds: string[]) {
  const uniqueIds = [...new Set(teamIds.filter(Boolean))];
  const current = await prisma.teamCoach.findMany({
    where: { userId },
    select: { teamId: true },
  });
  const currentIds = new Set(current.map((row) => row.teamId));
  const nextIds = new Set(uniqueIds);

  for (const teamId of nextIds) {
    if (!currentIds.has(teamId)) {
      await assignCoachToTeam(teamId, userId, TeamCoachRole.HEAD);
    }
  }
  for (const row of current) {
    if (!nextIds.has(row.teamId)) {
      await unassignCoachFromTeam(row.teamId, userId);
    }
  }
}

async function dedupeClubCatalogTeams() {
  const teams = await prisma.team.findMany({
    where: { clubId: { not: null } },
    select: { id: true, clubId: true, name: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const keeperByKey = new Map<string, string>();
  const extras: Array<{ extraId: string; keeperId: string }> = [];
  for (const team of teams) {
    const key = `${team.clubId}|${team.name.trim().toLowerCase()}`;
    const keeperId = keeperByKey.get(key);
    if (keeperId) extras.push({ extraId: team.id, keeperId });
    else keeperByKey.set(key, team.id);
  }
  if (extras.length === 0) return;

  for (const { extraId, keeperId } of extras) {
    const coaches = await prisma.teamCoach.findMany({ where: { teamId: extraId } });
    for (const coach of coaches) {
      await prisma.teamCoach.upsert({
        where: { teamId_userId: { teamId: keeperId, userId: coach.userId } },
        create: { teamId: keeperId, userId: coach.userId, role: coach.role },
        update: {},
      });
    }
  }

  await prisma.team.deleteMany({ where: { id: { in: extras.map((row) => row.extraId) } } });
}

let catalogEnsureInFlight: Promise<void> | null = null;

export async function ensureKnownClubTeamCatalogs(adminUserId: string) {
  if (catalogEnsureInFlight) return catalogEnsureInFlight;
  catalogEnsureInFlight = (async () => {
    await dedupeClubCatalogTeams();

    const clubs = await prisma.club.findMany({
      where: { active: true },
      select: { id: true, name: true, code: true, gameModelId: true },
    });

    for (const club of clubs) {
      const catalog = catalogForClub(club);
      if (catalog.length === 0) continue;

      const existing = await prisma.team.findMany({
        where: { clubId: club.id },
        select: { id: true, name: true, notes: true },
      });
      const byName = new Map(existing.map((row) => [row.name.trim().toLowerCase(), row]));
      const missing = catalog.filter((entry) => !byName.has(entry.name.trim().toLowerCase()));

      for (const entry of catalog) {
        const row = byName.get(entry.name.trim().toLowerCase());
        const notes = catalogNotes(entry);
        if (row && row.notes !== notes) {
          await prisma.team.update({ where: { id: row.id }, data: { notes } });
        }
      }

      await Promise.all(
        missing.map((entry) => {
          const seasonLabel = defaultSeasonWindow().seasonLabel;
          return prisma.team.create({
            data: {
              name: entry.name.slice(0, 80),
              ageGroup: entry.ageGroup,
              clubId: club.id,
              gameModelId: club.gameModelId,
              seasonLabel,
              notes: catalogNotes(entry),
              createdByUserId: adminUserId,
              seasons: { create: seasonCreateData(seasonLabel, entry.name) },
            },
          });
        })
      );
    }
  })().finally(() => {
    catalogEnsureInFlight = null;
  });
  return catalogEnsureInFlight;
}

export async function listTeamsAdmin(adminUserId?: string) {
  if (adminUserId) {
    await ensureKnownClubTeamCatalogs(adminUserId);
  }
  const teams = await prisma.team.findMany({
    include: teamInclude,
    orderBy: [{ clubId: "asc" }, { ageGroup: "asc" }, { name: "asc" }],
    take: 500,
  });
  return teams.map((team) => serializeTeam(team));
}

async function ensureClubCoachMembership(userId: string, clubId: string | null) {
  if (!clubId) return;
  const existing = await prisma.clubMembership.findUnique({
    where: { userId_clubId: { userId, clubId } },
    select: { id: true },
  });
  if (existing) return;
  await upsertClubMembership({ userId, clubId, role: ClubRole.COACH });
  const club = await prisma.club.findUnique({ where: { id: clubId }, select: { name: true } });
  if (club?.name) {
    await prisma.user.update({
      where: { id: userId },
      data: { organizationName: club.name },
    });
  }
}

export async function adminCreateTeam(
  adminUserId: string,
  input: {
    name: string;
    ageGroup: string;
    coachUserId: string;
    clubId?: string | null;
    sectionId?: string | null;
    gameModelId?: string;
    seasonLabel?: string | null;
    notes?: string | null;
    role?: TeamCoachRole;
  }
) {
  const coach = await prisma.user.findUnique({
    where: { id: input.coachUserId },
    select: { id: true, email: true, name: true },
  });
  if (!coach) throw new CoachCenterError(404, "NOT_FOUND", "Coach not found");

  const name = String(input.name || "").trim().slice(0, 80);
  if (!name) throw new CoachCenterError(400, "INVALID", "Team name is required");
  const ageGroup = String(input.ageGroup || "").trim().toUpperCase();
  if (!AGE_GROUPS.includes(ageGroup)) {
    throw new CoachCenterError(400, "INVALID", `ageGroup must be one of ${AGE_GROUPS.join(", ")}`);
  }

  let clubId: string | null = input.clubId || null;
  let gameModelId: GameModelId = GameModelId.COACHAI;
  if (clubId) {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true, gameModelId: true },
    });
    if (!club) throw new CoachCenterError(404, "NOT_FOUND", "Club not found");
    gameModelId = club.gameModelId;
  } else if (input.gameModelId) {
    if (!Object.values(GameModelId).includes(input.gameModelId as GameModelId)) {
      throw new CoachCenterError(400, "INVALID", "Invalid game model");
    }
    gameModelId = input.gameModelId as GameModelId;
  }

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const day = start.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + mondayOffset);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 16 * 7 - 1);
  const seasonLabel = (input.seasonLabel || `${start.getUTCFullYear()} season`).slice(0, 40);
  const weeks = buildDefaultCurriculumWeeks({ teamName: name });
  const role = input.role === TeamCoachRole.ASSISTANT ? TeamCoachRole.ASSISTANT : TeamCoachRole.HEAD;

  const team = await prisma.team.create({
    data: {
      name,
      ageGroup,
      clubId,
      sectionId: input.sectionId || null,
      gameModelId,
      seasonLabel,
      notes: input.notes?.trim().slice(0, 2000) || null,
      createdByUserId: adminUserId,
      coaches: { create: { userId: coach.id, role } },
      seasons: {
        create: {
          name: seasonLabel,
          startDate: start,
          endDate: end,
          phase: SeasonPhase.IN_SEASON,
          active: true,
          weeks: {
            create: weeks.map((w) => ({
              weekIndex: w.weekIndex,
              theme: w.theme,
              moment: w.moment,
              phase: w.phase,
              zone: w.zone,
              focus: w.focus,
              notes: w.notes,
            })),
          },
        },
      },
    },
    include: teamInclude,
  });

  await ensureClubCoachMembership(coach.id, clubId);
  return serializeTeam(team);
}

export async function assignCoachToTeam(
  teamId: string,
  coachUserId: string,
  role: TeamCoachRole = TeamCoachRole.HEAD
) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: teamInclude,
  });
  if (!team) throw new CoachCenterError(404, "NOT_FOUND", "Team not found");

  const coach = await prisma.user.findUnique({
    where: { id: coachUserId },
    select: { id: true },
  });
  if (!coach) throw new CoachCenterError(404, "NOT_FOUND", "Coach not found");

  await prisma.teamCoach.upsert({
    where: { teamId_userId: { teamId, userId: coachUserId } },
    create: { teamId, userId: coachUserId, role },
    update: { role },
  });
  await ensureClubCoachMembership(coachUserId, team.clubId);

  return serializeTeam(
    await prisma.team.findUniqueOrThrow({ where: { id: teamId }, include: teamInclude })
  );
}

export async function unassignCoachFromTeam(teamId: string, coachUserId: string) {
  const existing = await prisma.teamCoach.findUnique({
    where: { teamId_userId: { teamId, userId: coachUserId } },
  });
  if (!existing) throw new CoachCenterError(404, "NOT_FOUND", "Coach is not assigned to this team");

  await prisma.teamCoach.delete({
    where: { teamId_userId: { teamId, userId: coachUserId } },
  });

  return serializeTeam(
    await prisma.team.findUniqueOrThrow({ where: { id: teamId }, include: teamInclude })
  );
}

async function requireClubCoach(
  clubId: string,
  coachUserId: string,
  sectionId?: string | null
) {
  const membership = await prisma.clubMembership.findUnique({
    where: { userId_clubId: { userId: coachUserId, clubId } },
    select: { role: true, sectionId: true },
  });
  if (!membership || !TEAM_ASSIGNABLE_ROLES.includes(membership.role)) {
    throw new CoachCenterError(400, "INVALID", "Pick someone who already belongs to this club");
  }
  if (
    sectionId &&
    membership.role !== ClubRole.DOC &&
    membership.sectionId !== sectionId
  ) {
    throw new CoachCenterError(403, "FORBIDDEN", "That coach is outside your section");
  }
}

async function requireClubTeam(clubId: string, teamId: string, sectionId?: string | null) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, clubId: true, sectionId: true },
  });
  if (!team || team.clubId !== clubId) {
    throw new CoachCenterError(404, "NOT_FOUND", "Team not found in this club");
  }
  if (sectionId && team.sectionId && team.sectionId !== sectionId) {
    throw new CoachCenterError(403, "FORBIDDEN", "Team is outside your section");
  }
  return team;
}

export async function listClubTeams(
  clubId: string,
  sectionId?: string | null,
  actorUserId?: string
) {
  if (actorUserId) {
    await ensureKnownClubTeamCatalogs(actorUserId);
  }
  const teams = await prisma.team.findMany({
    where: {
      clubId,
      ...(sectionId ? { sectionId } : {}),
    },
    include: teamInclude,
    orderBy: { name: "asc" },
  });
  return teams.map((team) => serializeTeam(team));
}

export async function createClubTeamForCoach(
  actorUserId: string,
  clubId: string,
  sectionId: string | null,
  input: {
    name: string;
    ageGroup: string;
    coachUserId: string;
    seasonLabel?: string | null;
    role?: TeamCoachRole;
  }
) {
  await requireClubCoach(clubId, input.coachUserId, sectionId);
  return adminCreateTeam(actorUserId, {
    name: input.name,
    ageGroup: input.ageGroup,
    coachUserId: input.coachUserId,
    clubId,
    sectionId,
    seasonLabel: input.seasonLabel,
    role: input.role,
  });
}

export async function assignClubTeamCoach(
  clubId: string,
  sectionId: string | null,
  teamId: string,
  coachUserId: string,
  role: TeamCoachRole
) {
  await requireClubTeam(clubId, teamId, sectionId);
  await requireClubCoach(clubId, coachUserId, sectionId);
  return assignCoachToTeam(teamId, coachUserId, role);
}

export async function unassignClubTeamCoach(
  clubId: string,
  sectionId: string | null,
  teamId: string,
  coachUserId: string
) {
  await requireClubTeam(clubId, teamId, sectionId);
  return unassignCoachFromTeam(teamId, coachUserId);
}

export async function syncClubCoachTeams(
  clubId: string,
  sectionId: string | null,
  coachUserId: string,
  teamIds: string[],
  role: TeamCoachRole
) {
  await requireClubCoach(clubId, coachUserId, sectionId);

  const uniqueIds = [...new Set(teamIds.filter(Boolean))];
  const clubTeams = await prisma.team.findMany({
    where: {
      clubId,
      ...(sectionId ? { sectionId } : {}),
    },
    select: { id: true },
  });
  const clubTeamIds = new Set(clubTeams.map((team) => team.id));

  for (const teamId of uniqueIds) {
    if (!clubTeamIds.has(teamId)) {
      throw new CoachCenterError(400, "INVALID", "Team is not in this club");
    }
  }

  const current = await prisma.teamCoach.findMany({
    where: { userId: coachUserId, teamId: { in: [...clubTeamIds] } },
    select: { teamId: true },
  });
  const currentIds = new Set(current.map((row) => row.teamId));
  const nextIds = new Set(uniqueIds);

  for (const teamId of nextIds) {
    if (!currentIds.has(teamId)) {
      await assignCoachToTeam(teamId, coachUserId, role);
    }
  }
  for (const row of current) {
    if (!nextIds.has(row.teamId)) {
      await unassignCoachFromTeam(row.teamId, coachUserId);
    }
  }

  return listClubTeams(clubId, sectionId);
}

export async function syncClubTeamCoaches(
  clubId: string,
  sectionId: string | null,
  teamId: string,
  coachUserIds: string[],
  role: TeamCoachRole
) {
  await requireClubTeam(clubId, teamId, sectionId);

  const uniqueIds = [...new Set(coachUserIds.filter(Boolean))];
  for (const coachUserId of uniqueIds) {
    await requireClubCoach(clubId, coachUserId, sectionId);
  }

  const current = await prisma.teamCoach.findMany({
    where: { teamId },
    select: { userId: true },
  });
  const currentIds = new Set(current.map((row) => row.userId));
  const nextIds = new Set(uniqueIds);

  for (const coachUserId of nextIds) {
    if (!currentIds.has(coachUserId)) {
      await assignCoachToTeam(teamId, coachUserId, role);
    }
  }
  for (const row of current) {
    if (!nextIds.has(row.userId)) {
      await unassignCoachFromTeam(teamId, row.userId);
    }
  }

  return serializeTeam(
    await prisma.team.findUniqueOrThrow({ where: { id: teamId }, include: teamInclude })
  );
}

async function teamDna(team: { clubId: string | null; gameModelId: GameModelId; club?: { name: string } | null }) {
  if (team.clubId) {
    const club = await getClubPhilosophy(team.clubId);
    if (club && philosophyHasContent(club.philosophy)) {
      return { source: club.clubName, philosophy: club.philosophy };
    }
  }
  const template = await getGameModelTemplatePhilosophy(team.gameModelId);
  return {
    source: GAME_MODEL_LABELS[team.gameModelId] || team.gameModelId,
    philosophy: template,
  };
}

export async function getTeamOverview(userId: string, teamId: string) {
  const team = await requireTeamAccess(userId, teamId);
  const serialized = await serializeTeamWithActivePriority(team, { userId });
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 14);

  const [upcoming, recent, nextMatch, recommendations] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        userId,
        cancelled: false,
        scheduledDate: { gte: now, lte: weekEnd },
        OR: [{ teamId }, { teamName: team.name }],
      },
      orderBy: { scheduledDate: "asc" },
      take: 6,
    }),
    prisma.calendarEvent.findMany({
      where: {
        userId,
        cancelled: false,
        scheduledDate: { lt: now },
        OR: [{ teamId }, { teamName: team.name }],
      },
      orderBy: { scheduledDate: "desc" },
      take: 4,
    }),
    prisma.gameDayDocument.findFirst({
      where: { teamId, matchDate: { gte: now } },
      orderBy: { matchDate: "asc" },
    }),
    recommendSessions(userId, teamId),
  ]);

  const sessionIds = [...upcoming, ...recent].map((e) => e.sessionId);
  const sessions = sessionIds.length
    ? await prisma.session.findMany({
        where: { id: { in: sessionIds } },
        select: { id: true, title: true, refCode: true, durationMin: true, ageGroup: true },
      })
    : [];
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));

  const mapEvent = (event: (typeof upcoming)[number]) => ({
    id: event.id,
    scheduledDate: event.scheduledDate.toISOString(),
    location: event.location,
    completed: event.completed,
    session: sessionMap.get(event.sessionId) || null,
  });

  return {
    team: serialized,
    upcoming: upcoming.map(mapEvent),
    recent: recent.map(mapEvent),
    nextMatch,
    recommendations: recommendations.slice(0, 3),
  };
}

export async function getTeamCalendar(userId: string, teamId: string, weekStartIso: string) {
  const team = await requireTeamAccess(userId, teamId);
  const start = new Date(`${weekStartIso}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) throw new CoachCenterError(400, "INVALID", "Invalid weekStart");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);

  const events = await prisma.calendarEvent.findMany({
    where: {
      userId,
      cancelled: false,
      scheduledDate: { gte: start, lt: end },
    },
    orderBy: { scheduledDate: "asc" },
  });

  const sessions = await prisma.session.findMany({
    where: { id: { in: events.map((e) => e.sessionId) } },
    select: { id: true, title: true, refCode: true, durationMin: true, ageGroup: true },
  });
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + i);
    const iso = date.toISOString().slice(0, 10);
    return {
      date: iso,
      dayLabel: date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      events: events
        .filter((e) => e.scheduledDate.toISOString().slice(0, 10) === iso)
        .map((e) => ({
          id: e.id,
          time: e.scheduledDate.toISOString().slice(11, 16),
          location: e.location,
          completed: e.completed,
          forThisTeam: e.teamId === team.id || e.teamName === team.name,
          session: sessionMap.get(e.sessionId) || null,
        })),
    };
  });

  return { weekStart: weekStartIso, days, team: serializeTeam(team, { userId }) };
}

export async function recommendSessions(userId: string, teamId: string, weekIndex?: number | null) {
  const team = await requireTeamAccess(userId, teamId);
  const serialized = await serializeTeamWithActivePriority(team, { userId });
  const weeks = serialized.season?.weeks || [];
  const week =
    (weekIndex ? weeks.find((w: { weekIndex: number }) => w.weekIndex === weekIndex) : null) ||
    serialized.season?.currentWeek;
  const matches = await prisma.session.findMany({
    where: {
      savedToVault: true,
      ageGroup: team.ageGroup,
      ...clubVaultWhere({ clubId: team.clubId, gameModelId: team.gameModelId }),
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      title: true,
      refCode: true,
      ageGroup: true,
      durationMin: true,
      gameModelId: true,
      targetSubprincipleId: true,
      json: true,
    },
  });

  const scored = matches
    .map((session) => {
      const json = (session.json || {}) as { phase?: string; zone?: string; topic?: string };
      let score = 1;
      const reasons: string[] = [];
      if (
        (week as any)?.trainingPriorityId &&
        session.targetSubprincipleId &&
        session.targetSubprincipleId === (week as any)?.trainingPrioritySubprincipleId
      ) {
        score += 5;
        reasons.push("built for this week's assigned priority");
      }
      if (week?.phase && json.phase === week.phase) {
        score += 3;
        reasons.push("same phase");
      }
      if (week?.zone && json.zone === week.zone) {
        score += 2;
        reasons.push("same zone");
      }
      if (week?.theme && String(json.topic || session.title || "").toLowerCase().includes(week.theme.toLowerCase().slice(0, 12))) {
        score += 2;
        reasons.push("theme match");
      }
      return {
        id: session.id,
        title: session.title,
        refCode: session.refCode,
        ageGroup: session.ageGroup,
        durationMin: session.durationMin,
        gameModelId: session.gameModelId,
        phase: json.phase || null,
        zone: json.zone || null,
        score,
        matchReason: reasons.join(" · ") || "Same age group and game model",
        href: `/vault?sessionId=${session.id}`,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return scored;
}

export async function listChat(userId: string, teamId: string) {
  await requireTeamAccess(userId, teamId);
  const messages = await prisma.coachCenterMessage.findMany({
    where: { teamId, userId },
    orderBy: { createdAt: "asc" },
    take: 40,
  });
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function sendChat(userId: string, teamId: string, content: string) {
  const team = await requireTeamAccess(userId, teamId);
  const text = content.trim().slice(0, 4000);
  if (!text) throw new CoachCenterError(400, "INVALID", "Message is required");

  const serialized = await serializeTeamWithActivePriority(team, { userId });
  const dna = await teamDna(team);
  const history = await listChat(userId, teamId);
  const upcoming = await prisma.calendarEvent.findMany({
    where: {
      userId,
      cancelled: false,
      scheduledDate: { gte: new Date() },
      OR: [{ teamId }, { teamName: team.name }],
    },
    orderBy: { scheduledDate: "asc" },
    take: 5,
  });
  const nextMatch = await prisma.gameDayDocument.findFirst({
    where: { teamId, matchDate: { gte: new Date() } },
    orderBy: { matchDate: "asc" },
  });

  await prisma.coachCenterMessage.create({
    data: { teamId, userId, role: "user", content: text },
  });

  const week = serialized.season?.currentWeek;
  const prompt = [
    "You are the Coach Center assistant for a youth soccer coach.",
    "Talk like a staff member who knows this team and this season. Be concrete. Short paragraphs.",
    "Help with training, curriculum progression, next-session ideas, and game-day prep.",
    "Do not invent player names. If you recommend a session, name the theme, phase, and zone.",
    "",
    `Team: ${serialized.name} (${serialized.ageGroup})`,
    `Game model: ${serialized.gameModelLabel}`,
    serialized.clubName ? `Club: ${serialized.clubName}` : "",
    serialized.season
      ? `Season: ${serialized.season.name}, week ${serialized.season.currentWeekIndex} of 16, phase ${serialized.season.phase}`
      : "",
    week
      ? `This week's curriculum: ${week.theme} (${week.phase} / ${week.zone}). Focus: ${week.focus}`
      : "",
    dna.philosophy
      ? [
          `Playing DNA (${dna.source}):`,
          dna.philosophy.attackingOrganization ? `Attacking: ${dna.philosophy.attackingOrganization}` : "",
          dna.philosophy.defensiveOrganization ? `Defending: ${dna.philosophy.defensiveOrganization}` : "",
          dna.philosophy.attackingTransition ? `Attacking transition: ${dna.philosophy.attackingTransition}` : "",
          dna.philosophy.defensiveTransition ? `Defensive transition: ${dna.philosophy.defensiveTransition}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "",
    upcoming.length
      ? `Upcoming training: ${upcoming
          .map((e) => e.scheduledDate.toISOString().slice(0, 10))
          .join(", ")}`
      : "No upcoming training on the calendar.",
    nextMatch
      ? `Next match: ${nextMatch.matchDate.toISOString().slice(0, 10)} vs ${nextMatch.opponent || "TBD"}`
      : "No game-day sheet prepared yet.",
    "",
    "Recent conversation:",
    ...history.slice(-8).map((m) => `${m.role === "user" ? "Coach" : "Assistant"}: ${m.content}`),
    `Coach: ${text}`,
    "Assistant:",
  ]
    .filter(Boolean)
    .join("\n");

  let reply: string;
  try {
    reply = (await generateText(prompt, { maxOutputTokens: 900 })).trim();
  } catch (error: any) {
    reply =
      "I could not reach the model just now. Use this week's curriculum theme as the next session, and we can pick it up again shortly.";
    if (process.env.NODE_ENV !== "production") {
      console.warn("[COACH_CENTER] chat generate failed", error?.message || error);
    }
  }

  const saved = await prisma.coachCenterMessage.create({
    data: { teamId, userId, role: "assistant", content: reply },
  });

  return {
    id: saved.id,
    role: "assistant" as const,
    content: reply,
    createdAt: saved.createdAt.toISOString(),
    generateHref: serialized.generateHref,
  };
}

function serializeGameDay(doc: {
  id: string;
  matchDate: Date;
  opponent: string | null;
  venue: string | null;
  competition: string | null;
  kickoffTime: string | null;
  formation: string | null;
  keyFocus: string | null;
  attackingNotes: string | null;
  defendingNotes: string | null;
  setPieces: string | null;
  lineupJson: unknown;
}) {
  return {
    id: doc.id,
    matchDate: doc.matchDate.toISOString(),
    opponent: doc.opponent,
    venue: doc.venue,
    competition: doc.competition,
    kickoffTime: doc.kickoffTime,
    formation: doc.formation,
    keyFocus: doc.keyFocus,
    attackingNotes: doc.attackingNotes,
    defendingNotes: doc.defendingNotes,
    setPieces: doc.setPieces,
    recap: parseMatchRecap(doc.lineupJson as unknown),
  };
}

export async function listGameDays(userId: string, teamId: string) {
  await requireTeamAccess(userId, teamId);
  const items = await prisma.gameDayDocument.findMany({
    where: { teamId },
    orderBy: { matchDate: "desc" },
    take: 20,
  });
  return items.map(serializeGameDay);
}

type GameDayInput = {
  matchDate: string;
  opponent?: string;
  venue?: string;
  competition?: string;
  kickoffTime?: string;
  formation?: string;
  keyFocus?: string;
  recap?: unknown;
};

export async function createGameDay(userId: string, teamId: string, input: GameDayInput) {
  const team = await requireTeamAccess(userId, teamId);
  const matchDate = new Date(input.matchDate);
  if (Number.isNaN(matchDate.getTime())) {
    throw new CoachCenterError(400, "INVALID", "matchDate is required");
  }

  const serialized = serializeTeam(team, { userId });
  const dna = await teamDna(team);
  const week = serialized.season?.currentWeek;
  const recap = parseMatchRecap(input.recap);
  const keyFocus =
    input.keyFocus?.trim() ||
    week?.focus ||
    `Play our ${serialized.gameModelLabel} model with this week's theme: ${week?.theme || "team identity"}.`;

  const created = await prisma.gameDayDocument.create({
    data: {
      teamId,
      userId,
      matchDate,
      opponent: input.opponent?.trim().slice(0, 80) || recap?.opponentLabel?.slice(0, 80) || null,
      venue: input.venue?.trim().slice(0, 80) || recap?.location?.slice(0, 80) || null,
      competition: input.competition?.trim().slice(0, 120) || null,
      kickoffTime: input.kickoffTime?.trim().slice(0, 20) || null,
      formation: input.formation?.trim().slice(0, 20) || null,
      keyFocus: keyFocus.slice(0, 500),
      attackingNotes: (dna.philosophy?.attackingOrganization || week?.notes || "").slice(0, 2000) || null,
      defendingNotes: (dna.philosophy?.defensiveOrganization || "").slice(0, 2000) || null,
      setPieces:
        "Defensive: mark, screen, win first clearance, rest-defense for the second ball. Attacking: near-post screen, penalty-spot runner, far-post attack.",
      lineupJson: recap ? (recap as unknown as Prisma.InputJsonValue) : undefined,
    },
  });
  return serializeGameDay(created);
}

export async function updateGameDay(
  userId: string,
  teamId: string,
  gameDayId: string,
  input: Partial<GameDayInput>
) {
  await requireTeamAccess(userId, teamId);
  const existing = await prisma.gameDayDocument.findFirst({
    where: { id: gameDayId, teamId },
  });
  if (!existing) throw new CoachCenterError(404, "NOT_FOUND", "Game day document not found");

  const recap = input.recap !== undefined ? parseMatchRecap(input.recap) : parseMatchRecap(existing.lineupJson as unknown);
  const matchDate = input.matchDate ? new Date(input.matchDate) : existing.matchDate;
  if (Number.isNaN(matchDate.getTime())) {
    throw new CoachCenterError(400, "INVALID", "matchDate is invalid");
  }

  const updated = await prisma.gameDayDocument.update({
    where: { id: existing.id },
    data: {
      matchDate,
      opponent:
        input.opponent !== undefined
          ? input.opponent.trim().slice(0, 80) || null
          : recap?.opponentLabel?.slice(0, 80) || existing.opponent,
      venue:
        input.venue !== undefined
          ? input.venue.trim().slice(0, 80) || null
          : recap?.location?.slice(0, 80) || existing.venue,
      competition:
        input.competition !== undefined
          ? input.competition.trim().slice(0, 120) || null
          : existing.competition,
      kickoffTime:
        input.kickoffTime !== undefined ? input.kickoffTime.trim().slice(0, 20) || null : existing.kickoffTime,
      formation: input.formation !== undefined ? input.formation.trim().slice(0, 20) || null : existing.formation,
      keyFocus: input.keyFocus !== undefined ? input.keyFocus.trim().slice(0, 500) || null : existing.keyFocus,
      lineupJson: recap ? (recap as unknown as Prisma.InputJsonValue) : existing.lineupJson ?? undefined,
    },
  });
  return serializeGameDay(updated);
}

export async function gameDayPdfBuffer(userId: string, teamId: string, gameDayId: string) {
  const team = await requireTeamAccess(userId, teamId);
  const doc = await prisma.gameDayDocument.findFirst({
    where: { id: gameDayId, teamId },
  });
  if (!doc) throw new CoachCenterError(404, "NOT_FOUND", "Game day document not found");
  const serialized = serializeTeam(team, { userId });
  const recap = parseMatchRecap(doc.lineupJson as unknown);
  if (recap) {
    return generateMatchRecapPdf({
      teamName: serialized.name,
      clubName: serialized.clubName || serialized.name,
      ageGroup: serialized.ageGroup,
      matchDate: doc.matchDate,
      opponent: doc.opponent,
      venue: doc.venue,
      competition: doc.competition,
      recap,
    });
  }
  return generateGameDayPdf({
    teamName: serialized.name,
    ageGroup: serialized.ageGroup,
    gameModelLabel: serialized.gameModelLabel,
    matchDate: doc.matchDate,
    opponent: doc.opponent,
    venue: doc.venue,
    competition: doc.competition,
    kickoffTime: doc.kickoffTime,
    formation: doc.formation,
    keyFocus: doc.keyFocus,
    attackingNotes: doc.attackingNotes,
    defendingNotes: doc.defendingNotes,
    setPieces: doc.setPieces,
  });
}
