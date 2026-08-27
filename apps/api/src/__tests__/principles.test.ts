jest.mock("../prisma", () => ({
  prisma: {
    principle: { findMany: jest.fn() },
  },
}));

import { prisma } from "../prisma";
import { listPrinciplesForClub } from "../services/principles";

const mockFindMany = prisma.principle.findMany as jest.Mock;

describe("listPrinciplesForClub", () => {
  beforeEach(() => mockFindMany.mockReset());

  test("scopes to the given club and orders by moment then order", async () => {
    mockFindMany.mockResolvedValue([
      { id: "p1", moment: "ATTACKING_ORGANIZATION", statement: "s", order: 0, subprinciples: [] },
    ]);

    const result = await listPrinciplesForClub("club-1");

    expect(result).toHaveLength(1);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clubId: "club-1" },
        orderBy: [{ moment: "asc" }, { order: "asc" }],
      })
    );
  });
});
