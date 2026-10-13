jest.mock("../prisma", () => ({
  prisma: {
    ageGroupMaturityNote: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import { getAgeGroupMaturityNote as getDefaultNote } from "../services/game-model-readiness";
import {
  AgeGroupMaturityError,
  getAgeGroupMaturityNotesForClub,
  resolveAgeGroupMaturityNote,
  setAgeGroupMaturityNote,
} from "../services/age-group-maturity";

const mockFindMany = prisma.ageGroupMaturityNote.findMany as jest.Mock;
const mockFindUnique = prisma.ageGroupMaturityNote.findUnique as jest.Mock;
const mockUpsert = prisma.ageGroupMaturityNote.upsert as jest.Mock;
const mockDeleteMany = prisma.ageGroupMaturityNote.deleteMany as jest.Mock;

describe("getAgeGroupMaturityNotesForClub", () => {
  beforeEach(() => mockFindMany.mockReset());

  test("returns all 11 known age groups, using the club's override where one exists", async () => {
    mockFindMany.mockResolvedValue([
      { ageGroup: "U13", note: "Custom U13 note for this club.", updatedAt: new Date("2026-01-01"), updatedBy: "user-1" },
    ]);

    const rows = await getAgeGroupMaturityNotesForClub("club-1");

    expect(rows).toHaveLength(11);
    const u13 = rows.find((r) => r.ageGroup === "U13")!;
    expect(u13.note).toBe("Custom U13 note for this club.");
    expect(u13.isCustom).toBe(true);
    expect(u13.updatedBy).toBe("user-1");

    const u18 = rows.find((r) => r.ageGroup === "U18")!;
    expect(u18.note).toBe(getDefaultNote("U18"));
    expect(u18.isCustom).toBe(false);
    expect(u18.updatedAt).toBeNull();
  });
});

describe("setAgeGroupMaturityNote", () => {
  beforeEach(() => {
    mockUpsert.mockReset();
    mockDeleteMany.mockReset();
  });

  test("rejects an unknown age group", async () => {
    await expect(
      setAgeGroupMaturityNote({ clubId: "club-1", ageGroup: "U99", note: "x" })
    ).rejects.toBeInstanceOf(AgeGroupMaturityError);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  test("rejects an empty note instead of silently storing a blank override", async () => {
    await expect(
      setAgeGroupMaturityNote({ clubId: "club-1", ageGroup: "U13", note: "   " })
    ).rejects.toBeInstanceOf(AgeGroupMaturityError);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  test("upserts a trimmed custom note", async () => {
    mockUpsert.mockResolvedValue({
      ageGroup: "U13",
      note: "Trimmed note.",
      updatedAt: new Date("2026-01-01"),
      updatedBy: "user-1",
    });

    const result = await setAgeGroupMaturityNote({
      clubId: "club-1",
      ageGroup: "U13",
      note: "  Trimmed note.  ",
      updatedBy: "user-1",
    });

    expect(result.note).toBe("Trimmed note.");
    expect(result.isCustom).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clubId_ageGroup: { clubId: "club-1", ageGroup: "U13" } },
      })
    );
  });

  test("note: null resets back to the shared default instead of storing anything", async () => {
    mockDeleteMany.mockResolvedValue({ count: 1 });

    const result = await setAgeGroupMaturityNote({ clubId: "club-1", ageGroup: "U13", note: null });

    expect(result.isCustom).toBe(false);
    expect(result.note).toBe(getDefaultNote("U13"));
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { clubId: "club-1", ageGroup: "U13" } });
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

describe("resolveAgeGroupMaturityNote", () => {
  beforeEach(() => mockFindUnique.mockReset());

  test("returns the club's custom note when one exists", async () => {
    mockFindUnique.mockResolvedValue({ note: "Club-specific U16 note." });

    const note = await resolveAgeGroupMaturityNote("club-1", "U16");

    expect(note).toBe("Club-specific U16 note.");
  });

  test("falls back to the shared default when no custom row exists", async () => {
    mockFindUnique.mockResolvedValue(null);

    const note = await resolveAgeGroupMaturityNote("club-1", "U16");

    expect(note).toBe(getDefaultNote("U16"));
  });

  // Regression guard: independent coaches (no club) must not crash trying
  // to look up a club-scoped override.
  test("returns the shared default without hitting the DB when clubId is null", async () => {
    const note = await resolveAgeGroupMaturityNote(null, "U16");

    expect(note).toBe(getDefaultNote("U16"));
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});
