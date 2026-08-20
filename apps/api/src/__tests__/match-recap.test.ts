import { parseMatchRecap, showcaseRecap } from "../services/match-recap";
import { generateMatchRecapPdf } from "../services/match-recap-pdf";

test("showcase recap parses and keeps the 0-0 sample score", () => {
  const recap = parseMatchRecap(showcaseRecap({ opponent: "Davis Legacy" }));
  expect(recap).not.toBeNull();
  expect(recap?.type).toBe("MATCH_RECAP");
  expect(recap?.usScore).toBe(0);
  expect(recap?.themScore).toBe(0);
  expect(recap?.stats.possessionPct).toEqual({ us: 43, them: 57 });
  expect(recap?.pillars).toHaveLength(4);
  expect(recap?.opponentLabel).toBe("Davis Legacy");
});

test("match recap PDF renders a buffer", async () => {
  const recap = showcaseRecap({ opponent: "Davis Legacy" });
  const pdf = await generateMatchRecapPdf({
    teamName: "U13 GA Aspire",
    clubName: "Rocklin FC",
    ageGroup: "U13",
    matchDate: new Date("2025-07-24T12:00:00.000Z"),
    opponent: "Davis Legacy",
    venue: "Davis, CA",
    competition: "Davis Legacy College Showcase",
    recap,
  });
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.length).toBeGreaterThan(1000);
});
