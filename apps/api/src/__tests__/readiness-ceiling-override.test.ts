jest.mock("../prisma", () => ({
  prisma: {
    readinessCeilingOverride: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import { getDefaultReadinessCeiling } from "../services/game-model-readiness";
import {
  ReadinessCeilingOverrideError,
  getReadinessCeilingsForClub,
  resolveClubDefaultReadinessCeiling,
  setReadinessCeilingOverride,
} from "../services/readiness-ceiling-override";

const mockFindMany = prisma.readinessCeilingOverride.findMany as jest.Mock;
const mockFindUnique = prisma.readinessCeilingOverride.findUnique as jest.Mock;
const mockUpsert = prisma.readinessCeilingOverride.upsert as jest.Mock;
const mockDeleteMany = prisma.readinessCeilingOverride.deleteMany as jest.Mock;

describe("getReadinessCeilingsForClub", () => {
  beforeEach(() => mockFindMany.mockReset());

  test("returns all 11 known age groups, using the club's override where one exists", async () => {
    mockFindMany.mockResolvedValue([
      { ageGroup: "U9", ceiling: "ADVANCED", updatedAt: new Date("2026-01-01"), updatedBy: "user-1" },
    ]);

    const rows = await getReadinessCeilingsForClub("club-1");

    expect(rows).toHaveLength(11);
    const u9 = rows.find((r) => r.ageGroup === "U9")!;
    expect(u9.ceiling).toBe("ADVANCED");
    expect(u9.isCustom).toBe(true);

    const u16 = rows.find((r) => r.ageGroup === "U16")!;
    expect(u16.ceiling).toBe(getDefaultReadinessCeiling("U16"));
    expect(u16.isCustom).toBe(false);
  });
});

describe("setReadinessCeilingOverride", () => {
  beforeEach(() => {
    mockUpsert.mockReset();
    mockDeleteMany.mockReset();
  });

  test("rejects an unknown age group", async () => {
    await expect(
      setReadinessCeilingOverride({ clubId: "club-1", ageGroup: "U99", ceiling: "ADVANCED" as any })
    ).rejects.toBeInstanceOf(ReadinessCeilingOverrideError);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  test("upserts a custom ceiling", async () => {
    mockUpsert.mockResolvedValue({
      ageGroup: "U9",
      ceiling: "ADVANCED",
      updatedAt: new Date("2026-01-01"),
      updatedBy: "user-1",
    });

    const result = await setReadinessCeilingOverride({
      clubId: "club-1",
      ageGroup: "U9",
      ceiling: "ADVANCED" as any,
      updatedBy: "user-1",
    });

    expect(result.ceiling).toBe("ADVANCED");
    expect(result.isCustom).toBe(true);
  });

  test("ceiling: null resets back to the shared default instead of storing anything", async () => {
    mockDeleteMany.mockResolvedValue({ count: 1 });

    const result = await setReadinessCeilingOverride({ clubId: "club-1", ageGroup: "U9", ceiling: null });

    expect(result.isCustom).toBe(false);
    expect(result.ceiling).toBe(getDefaultReadinessCeiling("U9"));
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

describe("resolveClubDefaultReadinessCeiling", () => {
  beforeEach(() => mockFindUnique.mockReset());

  test("returns the club's override when one exists", async () => {
    mockFindUnique.mockResolvedValue({ ceiling: "ADVANCED" });

    const ceiling = await resolveClubDefaultReadinessCeiling("club-1", "U9");

    expect(ceiling).toBe("ADVANCED");
  });

  test("falls back to the shared default when no override exists", async () => {
    mockFindUnique.mockResolvedValue(null);

    const ceiling = await resolveClubDefaultReadinessCeiling("club-1", "U9");

    expect(ceiling).toBe(getDefaultReadinessCeiling("U9"));
  });

  test("returns the shared default without hitting the DB when clubId is null", async () => {
    const ceiling = await resolveClubDefaultReadinessCeiling(null, "U9");

    expect(ceiling).toBe(getDefaultReadinessCeiling("U9"));
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});
