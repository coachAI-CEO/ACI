jest.mock("../prisma", () => ({
  prisma: {},
}));
jest.mock("../gemini", () => ({
  generateText: jest.fn(),
}));
jest.mock("../services/training-priority", () => ({
  getActiveTrainingPriorityForTeamWeek: jest.fn(),
}));

import { getActiveTrainingPriorityForTeamWeek } from "../services/training-priority";
import { serializeTeamWithActivePriority } from "../services/coach-center";

const mockGetActivePriority = getActiveTrainingPriorityForTeamWeek as jest.Mock;

function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

function buildTeam() {
  const startDate = mondayOf(new Date());
  return {
    id: "team-1",
    name: "Rocklin U16 Boys",
    ageGroup: "U16",
    clubId: "club-1",
    club: { id: "club-1", name: "Rocklin FC", gameModelId: "ROCKLIN_FC" },
    sectionId: null,
    section: null,
    gameModelId: "ROCKLIN_FC",
    seasonLabel: "2026 season",
    notes: null,
    playerLevel: null,
    coaches: [],
    seasons: [
      {
        id: "season-1",
        name: "2026 season",
        startDate,
        endDate: new Date(startDate.getTime() + 16 * 7 * 86_400_000),
        phase: "IN_SEASON",
        weeks: [],
      },
    ],
  };
}

describe("serializeTeamWithActivePriority", () => {
  beforeEach(() => mockGetActivePriority.mockReset());

  // Regression guard for the Coach Center / DOC Hub integration gap found
  // while wiring this: without this override, every team -- including ones
  // with a real club game model -- would always show the generic default
  // curriculum's canned theme instead of what the DOC actually assigned.
  test("overrides the current week's theme/moment/focus from an ACTIVE TrainingPriority", async () => {
    mockGetActivePriority.mockResolvedValue({
      id: "priority-1",
      rationale: "test",
      subprinciple: {
        id: "sub-1",
        trigger: "Opponent presses out wide and isolates our fullback",
        response: "Play through the pivot to switch the point of attack",
        antiPattern: "Force a long ball under pressure",
        principle: { moment: "ATTACKING_ORGANIZATION" },
      },
    });

    const serialized = await serializeTeamWithActivePriority(buildTeam(), { userId: "user-1" });

    expect(serialized.season?.currentWeek?.theme).toBe("Opponent presses out wide and isolates our fullback");
    expect(serialized.season?.currentWeek?.moment).toBe("attackingOrganization");
    expect(serialized.season?.currentWeek?.focus).toBe("Play through the pivot to switch the point of attack");
    expect(serialized.season?.currentWeek?.notes).toBe("Avoid: Force a long ball under pressure");
    expect((serialized.season?.currentWeek as any)?.source).toBe("training_priority");
    expect((serialized.season?.currentWeek as any)?.trainingPriorityId).toBe("priority-1");

    // The override must also be reflected in the weeks list, not just currentWeek.
    const weekIndex = serialized.season!.currentWeekIndex;
    const sameWeekInList = serialized.season?.weeks.find((w: any) => w.weekIndex === weekIndex);
    expect((sameWeekInList as any)?.source).toBe("training_priority");
  });

  test("falls back to the generic curriculum when there's no active priority", async () => {
    mockGetActivePriority.mockResolvedValue(null);

    const serialized = await serializeTeamWithActivePriority(buildTeam(), { userId: "user-1" });

    expect((serialized.season?.currentWeek as any)?.source).toBeUndefined();
    expect(serialized.season?.currentWeek?.theme).toBeTruthy();
  });
});
