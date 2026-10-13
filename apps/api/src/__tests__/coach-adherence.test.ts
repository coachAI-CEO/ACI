jest.mock("../prisma", () => ({
  prisma: {
    team: { findMany: jest.fn() },
    session: { findMany: jest.fn() },
  },
}));

import { prisma } from "../prisma";
import { getCoachAdherenceRanking } from "../services/coach-adherence";

const mockTeamFindMany = prisma.team.findMany as jest.Mock;
const mockSessionFindMany = prisma.session.findMany as jest.Mock;

describe("getCoachAdherenceRanking", () => {
  beforeEach(() => {
    mockTeamFindMany.mockReset();
    mockSessionFindMany.mockReset();
  });

  test("ranks a coach higher when more assigned priorities were matched by a generated session", async () => {
    mockTeamFindMany.mockResolvedValue([
      {
        id: "team-1",
        name: "U16 Boys",
        coaches: [{ userId: "coach-1", user: { name: "Coach A", email: "a@rocklinfc.org" } }],
        trainingPriorities: [{ id: "p1" }, { id: "p2" }],
      },
      {
        id: "team-2",
        name: "U10 Boys",
        coaches: [{ userId: "coach-2", user: { name: "Coach B", email: "b@rocklinfc.org" } }],
        trainingPriorities: [{ id: "p3" }, { id: "p4" }],
      },
    ]);
    // coach-1's team: both priorities matched. coach-2's team: neither matched.
    mockSessionFindMany.mockResolvedValue([
      { trainingPriorityId: "p1" },
      { trainingPriorityId: "p2" },
    ]);

    const ranking = await getCoachAdherenceRanking("club-1");

    expect(ranking[0].userId).toBe("coach-1");
    expect(ranking[0].rate).toBe(1);
    expect(ranking[1].userId).toBe("coach-2");
    expect(ranking[1].rate).toBe(0);
  });

  test("a team with no priorities ever assigned contributes null, not zero", async () => {
    mockTeamFindMany.mockResolvedValue([
      {
        id: "team-1",
        name: "U8 Boys",
        coaches: [{ userId: "coach-1", user: { name: "Coach A", email: null } }],
        trainingPriorities: [],
      },
    ]);
    mockSessionFindMany.mockResolvedValue([]);

    const ranking = await getCoachAdherenceRanking("club-1");

    expect(ranking[0].rate).toBeNull();
    expect(mockSessionFindMany).not.toHaveBeenCalled();
  });

  test("a coach on two teams gets combined assigned/matched counts", async () => {
    mockTeamFindMany.mockResolvedValue([
      {
        id: "team-1",
        name: "U16 Boys",
        coaches: [{ userId: "coach-1", user: { name: "Coach A", email: null } }],
        trainingPriorities: [{ id: "p1" }],
      },
      {
        id: "team-2",
        name: "U16 Girls",
        coaches: [{ userId: "coach-1", user: { name: "Coach A", email: null } }],
        trainingPriorities: [{ id: "p2" }],
      },
    ]);
    mockSessionFindMany.mockResolvedValue([{ trainingPriorityId: "p1" }]);

    const ranking = await getCoachAdherenceRanking("club-1");

    expect(ranking).toHaveLength(1);
    expect(ranking[0].assigned).toBe(2);
    expect(ranking[0].matched).toBe(1);
    expect(ranking[0].rate).toBe(0.5);
    expect(ranking[0].teams).toHaveLength(2);
  });
});
