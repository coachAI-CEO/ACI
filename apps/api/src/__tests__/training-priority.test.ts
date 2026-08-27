jest.mock("../prisma", () => ({
  prisma: {
    team: { findUniqueOrThrow: jest.fn() },
    subprinciple: { findUniqueOrThrow: jest.fn() },
    trainingPriority: { create: jest.fn() },
  },
}));

import { prisma } from "../prisma";
import { createTrainingPriority, SubprincipleNotEligibleError } from "../services/training-priority";

const mockTeamFind = prisma.team.findUniqueOrThrow as jest.Mock;
const mockSubprincipleFind = prisma.subprinciple.findUniqueOrThrow as jest.Mock;
const mockCreate = prisma.trainingPriority.create as jest.Mock;

describe("createTrainingPriority", () => {
  beforeEach(() => {
    mockTeamFind.mockReset();
    mockSubprincipleFind.mockReset();
    mockCreate.mockReset();
  });

  test("creates a TrainingPriority when the subprinciple's tier is eligible for the team", async () => {
    mockTeamFind.mockResolvedValue({ id: "team-1", ageGroup: "U16", readinessOverride: null });
    mockSubprincipleFind.mockResolvedValue({ id: "sub-1", readiness: "ADVANCED", trigger: "t", response: "r" });
    mockCreate.mockResolvedValue({ id: "priority-1" });

    const result = await createTrainingPriority({
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
    mockTeamFind.mockResolvedValue({ id: "team-u9", ageGroup: "U9", readinessOverride: null });
    mockSubprincipleFind.mockResolvedValue({ id: "sub-advanced", readiness: "ADVANCED", trigger: "t", response: "r" });

    await expect(
      createTrainingPriority({
        teamId: "team-u9",
        subprincipleId: "sub-advanced",
        weekStart: new Date("2026-09-14"),
        rationale: "test",
      })
    ).rejects.toBeInstanceOf(SubprincipleNotEligibleError);

    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("allows an ADVANCED subprinciple for a U9 team when the DOC has raised the readiness override", async () => {
    mockTeamFind.mockResolvedValue({ id: "team-u9", ageGroup: "U9", readinessOverride: "ADVANCED" });
    mockSubprincipleFind.mockResolvedValue({ id: "sub-advanced", readiness: "ADVANCED", trigger: "t", response: "r" });
    mockCreate.mockResolvedValue({ id: "priority-2" });

    const result = await createTrainingPriority({
      teamId: "team-u9",
      subprincipleId: "sub-advanced",
      weekStart: new Date("2026-09-14"),
      rationale: "DOC unlocked this early",
    });

    expect(result.id).toBe("priority-2");
    expect(mockCreate).toHaveBeenCalled();
  });
});
