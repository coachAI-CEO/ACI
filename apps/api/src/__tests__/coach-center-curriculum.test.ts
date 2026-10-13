import { buildDefaultCurriculumWeeks, buildWeekKnowledge, currentWeekIndex, sessionAudience, sessionBuilderQuery, teamBandFromName } from "../services/coach-center-curriculum";

test("default curriculum covers 16 weeks and four game-model moments", () => {
  const weeks = buildDefaultCurriculumWeeks();
  expect(weeks).toHaveLength(16);
  expect(weeks[0].weekIndex).toBe(1);
  expect(weeks[15].weekIndex).toBe(16);
  const moments = new Set(weeks.map((w) => w.moment));
  expect(moments).toEqual(
    new Set([
      "attackingOrganization",
      "attackingTransition",
      "defensiveOrganization",
      "defensiveTransition",
    ])
  );
});

test("current week index stays inside the season window", () => {
  const start = new Date("2026-08-17T00:00:00.000Z");
  expect(currentWeekIndex(start, new Date("2026-08-17T00:00:00.000Z"))).toBe(1);
  expect(currentWeekIndex(start, new Date("2026-08-24T00:00:00.000Z"))).toBe(2);
  expect(currentWeekIndex(start, new Date("2026-12-31T00:00:00.000Z"))).toBe(16);
  expect(currentWeekIndex(start, new Date("2026-08-01T00:00:00.000Z"))).toBe(1);
});

test("session builder query carries curriculum fields and coach/player defaults", () => {
  expect(
    sessionBuilderQuery({
      ageGroup: "U14",
      gameModelId: "POSSESSION",
      phase: "ATTACKING",
      zone: "MIDDLE_THIRD",
      topic: "Breaking lines",
    })
  ).toBe(
    "/demo/session?ageGroup=U14&gameModelId=POSSESSION&coachLevel=USSF_D&playerLevel=INTERMEDIATE&phase=ATTACKING&zone=MIDDLE_THIRD&topic=Breaking+lines"
  );
});

test("NPL teams are advanced, Navy intermediate, White/Grey beginner on D", () => {
  expect(teamBandFromName("2013 Girls NPL")).toBe("NPL");
  expect(teamBandFromName("09 Girls Navy")).toBe("NAVY");
  expect(teamBandFromName("2010 Girls White")).toBe("DEVELOPMENT");
  expect(teamBandFromName("2010 Girls Grey")).toBe("DEVELOPMENT");

  expect(sessionAudience({ teamName: "2013 Girls NPL", coachLevel: "USSF_C" })).toMatchObject({
    playerLevel: "ADVANCED",
    coachLevel: "USSF_C",
    source: "name",
  });
  expect(sessionAudience({ teamName: "09 Girls Navy", coachLevel: "USSF_C" })).toMatchObject({
    playerLevel: "INTERMEDIATE",
    coachLevel: "USSF_C",
    source: "name",
  });
  expect(sessionAudience({ teamName: "2012 Girls White", coachLevel: "USSF_C" })).toMatchObject({
    playerLevel: "BEGINNER",
    coachLevel: "USSF_D",
    source: "name",
  });
});

test("curriculum copy changes with player and coach level", () => {
  const beginner = buildDefaultCurriculumWeeks({ teamName: "2012 Girls White" });
  const navy = buildDefaultCurriculumWeeks({ teamName: "09 Girls Navy", coachLevel: "USSF_C" });
  const npl = buildDefaultCurriculumWeeks({ teamName: "2013 Girls NPL", coachLevel: "USSF_B_PLUS" });
  expect(beginner[0].theme).toBe("First pass out of the back");
  expect(navy[0].theme).toBe("Playing out under pressure");
  expect(npl[0].theme).toBe("Playing out vs a high press");
  expect(beginner[0].notes).toMatch(/D license/);
  expect(navy[0].notes).toMatch(/C license/);
  expect(npl[0].notes).toMatch(/B\+ license/);
});

test("player level override wins over team name", () => {
  expect(sessionAudience({ teamName: "2013 Girls NPL", playerLevel: "BEGINNER" })).toMatchObject({
    playerLevel: "BEGINNER",
    coachLevel: "USSF_D",
    source: "override",
  });
});

test("week knowledge is written for the team's age and player level", () => {
  const beginner = buildWeekKnowledge({
    theme: "First pass out of the back",
    moment: "attackingOrganization",
    phase: "ATTACKING",
    zone: "DEFENSIVE_THIRD",
    focus: "Receive with a good first touch.",
    ageGroup: "U10",
    playerLevel: "BEGINNER",
    coachLevel: "USSF_D",
  });
  expect(beginner.audienceLabel).toMatch(/U10/);
  expect(beginner.format).toBe("7v7");
  expect(beginner.ideas).toHaveLength(4);
  expect(beginner.why).toMatch(/beginners/i);

  const npl = buildWeekKnowledge({
    theme: "Playing out vs a high press",
    moment: "attackingOrganization",
    phase: "ATTACKING",
    zone: "DEFENSIVE_THIRD",
    focus: "Split the first line.",
    ageGroup: "U16",
    playerLevel: "ADVANCED",
    coachLevel: "USSF_B_PLUS",
  });
  expect(npl.format).toBe("11v11");
  expect(npl.why).toMatch(/advanced/i);
});
