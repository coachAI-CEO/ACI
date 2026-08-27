jest.mock("../prisma", () => ({
  prisma: {
    team: { findUniqueOrThrow: jest.fn(), findUnique: jest.fn() },
    subprinciple: { findUniqueOrThrow: jest.fn() },
    trainingPriority: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  createTrainingPriority,
  getActivePriorityForCurrentWeek,
  getTrainingPriorityForClub,
  listTrainingPrioritiesForTeam,
  resolveTrainingPriority,
  resolveTrainingPriorityMatchForTopic,
  SubprincipleNotEligibleError,
  TrainingPriorityError,
} from "../services/training-priority";

const mockTeamFind = prisma.team.findUniqueOrThrow as jest.Mock;
const mockTeamFindUnique = prisma.team.findUnique as jest.Mock;
const mockSubprincipleFind = prisma.subprinciple.findUniqueOrThrow as jest.Mock;
const mockCreate = prisma.trainingPriority.create as jest.Mock;
const mockPriorityFind = prisma.trainingPriority.findUniqueOrThrow as jest.Mock;
const mockFindMany = prisma.trainingPriority.findMany as jest.Mock;
const mockUpdate = prisma.trainingPriority.update as jest.Mock;
const mockPriorityFindFirst = prisma.trainingPriority.findFirst as jest.Mock;

describe("createTrainingPriority", () => {
  beforeEach(() => {
    mockTeamFind.mockReset();
    mockSubprincipleFind.mockReset();
    mockCreate.mockReset();
  });

  test("creates a TrainingPriority when the subprinciple's tier is eligible for the team", async () => {
    mockTeamFind.mockResolvedValue({ id: "team-1", clubId: "club-1", ageGroup: "U16", readinessOverride: null });
    mockSubprincipleFind.mockResolvedValue({
      id: "sub-1",
      readiness: "ADVANCED",
      trigger: "t",
      response: "r",
      principle: { clubId: "club-1" },
    });
    mockCreate.mockResolvedValue({ id: "priority-1" });

    const result = await createTrainingPriority({
      clubId: "club-1",
      teamId: "team-1",
      subprincipleId: "sub-1",
      weekStart: new Date("2026-09-07"),
      rationale: "test",
    });

    expect(result.id).toBe("priority-1");
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        teamId: "team-1",
        subprincipleId: "sub-1",
        weekStart: new Date("2026-09-07"),
        rationale: "test",
        createdByUserId: undefined,
      },
    });
  });

  // Regression guard: this is the exact real scenario verified by hand
  // during the build (a U9 team, an ADVANCED subprinciple) -- must keep
  // rejecting it without a DB write.
  test("rejects an ADVANCED subprinciple for a U9 team with no readiness override", async () => {
    mockTeamFind.mockResolvedValue({ id: "team-u9", clubId: "club-1", ageGroup: "U9", readinessOverride: null });
    mockSubprincipleFind.mockResolvedValue({
      id: "sub-advanced",
      readiness: "ADVANCED",
      trigger: "t",
      response: "r",
      principle: { clubId: "club-1" },
    });

    await expect(
      createTrainingPriority({
        clubId: "club-1",
        teamId: "team-u9",
        subprincipleId: "sub-advanced",
        weekStart: new Date("2026-09-14"),
        rationale: "test",
      })
    ).rejects.toBeInstanceOf(SubprincipleNotEligibleError);

    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("allows an ADVANCED subprinciple for a U9 team when the DOC has raised the readiness override", async () => {
    mockTeamFind.mockResolvedValue({ id: "team-u9", clubId: "club-1", ageGroup: "U9", readinessOverride: "ADVANCED" });
    mockSubprincipleFind.mockResolvedValue({
      id: "sub-advanced",
      readiness: "ADVANCED",
      trigger: "t",
      response: "r",
      principle: { clubId: "club-1" },
    });
    mockCreate.mockResolvedValue({ id: "priority-2" });

    const result = await createTrainingPriority({
      clubId: "club-1",
      teamId: "team-u9",
      subprincipleId: "sub-advanced",
      weekStart: new Date("2026-09-14"),
      rationale: "DOC unlocked this early",
    });

    expect(result.id).toBe("priority-2");
    expect(mockCreate).toHaveBeenCalled();
  });

  // Regression guard for the IDOR risk found while wiring the doc-hub route:
  // a team from a different club must be rejected before any eligibility
  // check runs, not just filtered out in the UI.
  test("rejects when the team belongs to a different club", async () => {
    mockTeamFind.mockResolvedValue({ id: "team-other", clubId: "club-2", ageGroup: "U16", readinessOverride: null });

    await expect(
      createTrainingPriority({
        clubId: "club-1",
        teamId: "team-other",
        subprincipleId: "sub-1",
        weekStart: new Date("2026-09-07"),
        rationale: "test",
      })
    ).rejects.toBeInstanceOf(TrainingPriorityError);

    expect(mockSubprincipleFind).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("rejects when the subprinciple belongs to a different club", async () => {
    mockTeamFind.mockResolvedValue({ id: "team-1", clubId: "club-1", ageGroup: "U16", readinessOverride: null });
    mockSubprincipleFind.mockResolvedValue({
      id: "sub-other",
      readiness: "FOUNDATIONAL",
      trigger: "t",
      response: "r",
      principle: { clubId: "club-2" },
    });

    await expect(
      createTrainingPriority({
        clubId: "club-1",
        teamId: "team-1",
        subprincipleId: "sub-other",
        weekStart: new Date("2026-09-07"),
        rationale: "test",
      })
    ).rejects.toBeInstanceOf(TrainingPriorityError);

    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("getTrainingPriorityForClub", () => {
  beforeEach(() => mockPriorityFind.mockReset());

  test("returns the priority when it belongs to the given club", async () => {
    mockPriorityFind.mockResolvedValue({ id: "priority-1", team: { clubId: "club-1" } });

    const result = await getTrainingPriorityForClub("priority-1", "club-1");

    expect(result.id).toBe("priority-1");
  });

  test("rejects when the priority's team belongs to a different club", async () => {
    mockPriorityFind.mockResolvedValue({ id: "priority-1", team: { clubId: "club-2" } });

    await expect(getTrainingPriorityForClub("priority-1", "club-1")).rejects.toBeInstanceOf(
      TrainingPriorityError
    );
  });
});

describe("listTrainingPrioritiesForTeam", () => {
  beforeEach(() => {
    mockTeamFind.mockReset();
    mockFindMany.mockReset();
  });

  test("lists priorities for a team in the given club", async () => {
    mockTeamFind.mockResolvedValue({ id: "team-1", clubId: "club-1" });
    mockFindMany.mockResolvedValue([{ id: "priority-1" }]);

    const result = await listTrainingPrioritiesForTeam({ clubId: "club-1", teamId: "team-1" });

    expect(result).toEqual([{ id: "priority-1" }]);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { teamId: "team-1", status: undefined } })
    );
  });

  test("rejects when the team belongs to a different club", async () => {
    mockTeamFind.mockResolvedValue({ id: "team-1", clubId: "club-2" });

    await expect(
      listTrainingPrioritiesForTeam({ clubId: "club-1", teamId: "team-1" })
    ).rejects.toBeInstanceOf(TrainingPriorityError);

    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

describe("resolveTrainingPriority", () => {
  beforeEach(() => {
    mockPriorityFind.mockReset();
    mockUpdate.mockReset();
  });

  test("marks a priority RESOLVED with its outcome", async () => {
    mockPriorityFind.mockResolvedValue({ id: "priority-1", team: { clubId: "club-1" } });
    mockUpdate.mockResolvedValue({ id: "priority-1", status: "RESOLVED", outcome: "CONSISTENTLY" });

    const result = await resolveTrainingPriority({
      clubId: "club-1",
      trainingPriorityId: "priority-1",
      outcome: "CONSISTENTLY" as any,
      outcomeNotes: "Team locked this in by week 3.",
    });

    expect(result.status).toBe("RESOLVED");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "priority-1" },
      data: { status: "RESOLVED", outcome: "CONSISTENTLY", outcomeNotes: "Team locked this in by week 3." },
    });
  });

  test("rejects when the priority belongs to a different club", async () => {
    mockPriorityFind.mockResolvedValue({ id: "priority-1", team: { clubId: "club-2" } });

    await expect(
      resolveTrainingPriority({
        clubId: "club-1",
        trainingPriorityId: "priority-1",
        outcome: "RARELY" as any,
      })
    ).rejects.toBeInstanceOf(TrainingPriorityError);

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("getActivePriorityForCurrentWeek", () => {
  beforeEach(() => {
    mockTeamFindUnique.mockReset();
    mockPriorityFindFirst.mockReset();
  });

  test("resolves the team's active season week and looks up that week's priority", async () => {
    // A season that started exactly on this week's Monday -> weekIndex 1,
    // so the resolved weekStart should equal the season's own startDate.
    const now = new Date();
    const day = now.getUTCDay();
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    monday.setUTCDate(monday.getUTCDate() + (day === 0 ? -6 : 1 - day));

    mockTeamFindUnique.mockResolvedValue({ seasons: [{ startDate: monday }] });
    mockPriorityFindFirst.mockResolvedValue({ id: "priority-1" });

    const result = await getActivePriorityForCurrentWeek("team-1");

    expect(result).toEqual({ id: "priority-1" });
    const callArgs = mockPriorityFindFirst.mock.calls[0][0];
    expect(callArgs.where.teamId).toBe("team-1");
    expect(callArgs.where.weekStart.gte.toISOString().slice(0, 10)).toBe(monday.toISOString().slice(0, 10));
  });

  test("returns null when the team has no active season", async () => {
    mockTeamFindUnique.mockResolvedValue({ seasons: [] });

    const result = await getActivePriorityForCurrentWeek("team-1");

    expect(result).toBeNull();
    expect(mockPriorityFindFirst).not.toHaveBeenCalled();
  });
});

describe("resolveTrainingPriorityMatchForTopic", () => {
  const activePriority = {
    id: "priority-1",
    rationale: "test",
    subprinciple: {
      id: "sub-1",
      trigger: "Opponent presses out wide and isolates our fullback",
      response: "Play through the pivot",
      antiPattern: null,
      principle: { moment: "ATTACKING_ORGANIZATION" },
    },
  } as any;

  test("no active priority -> no tag, no warning", () => {
    const result = resolveTrainingPriorityMatchForTopic("Anything the coach typed", null);
    expect(result).toEqual({
      targetSubprincipleId: undefined,
      trainingPriorityId: undefined,
      deviationWarning: null,
    });
  });

  test("exact match (case-insensitive) tags the session, no warning", () => {
    const result = resolveTrainingPriorityMatchForTopic(
      "opponent presses out wide and isolates our fullback",
      activePriority
    );
    expect(result.targetSubprincipleId).toBe("sub-1");
    expect(result.trainingPriorityId).toBe("priority-1");
    expect(result.deviationWarning).toBeNull();
  });

  test("mismatched topic -> no tag, returns deviationWarning with both values", () => {
    const result = resolveTrainingPriorityMatchForTopic("Finishing in the box", activePriority);
    expect(result.targetSubprincipleId).toBeUndefined();
    expect(result.trainingPriorityId).toBeUndefined();
    expect(result.deviationWarning).toEqual({
      assignedTrigger: "Opponent presses out wide and isolates our fullback",
      providedTopic: "Finishing in the box",
    });
  });

  // Regression guard: an empty/missing topic must still surface the warning
  // (with providedTopic: null) rather than being silently treated as a match.
  test("empty topic -> no tag, deviationWarning has providedTopic: null", () => {
    const result = resolveTrainingPriorityMatchForTopic("", activePriority);
    expect(result.targetSubprincipleId).toBeUndefined();
    expect(result.deviationWarning).toEqual({
      assignedTrigger: "Opponent presses out wide and isolates our fullback",
      providedTopic: null,
    });
  });
});
