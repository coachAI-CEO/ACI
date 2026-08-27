jest.mock("../prisma", () => ({
  prisma: {
    team: { findUniqueOrThrow: jest.fn() },
    subprinciple: { findUniqueOrThrow: jest.fn() },
    trainingPriority: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  createTrainingPriority,
  getTrainingPriorityForClub,
  SubprincipleNotEligibleError,
  TrainingPriorityError,
} from "../services/training-priority";

const mockTeamFind = prisma.team.findUniqueOrThrow as jest.Mock;
const mockSubprincipleFind = prisma.subprinciple.findUniqueOrThrow as jest.Mock;
const mockCreate = prisma.trainingPriority.create as jest.Mock;
const mockPriorityFind = prisma.trainingPriority.findUniqueOrThrow as jest.Mock;

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
