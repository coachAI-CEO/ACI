import { SubprincipleReadiness } from "@prisma/client";
import {
  getAgeGroupMaturityNote,
  getDefaultReadinessCeiling,
  resolveTeamReadinessCeiling,
  getEligibleTiers,
  isReadinessEligibleForTeam,
  getDefaultPlayerAndCoachLevel,
} from "../services/game-model-readiness";

describe("getDefaultReadinessCeiling", () => {
  test("7v7 age band (U8-U10) ceilings at FOUNDATIONAL", () => {
    expect(getDefaultReadinessCeiling("U9")).toBe(SubprincipleReadiness.FOUNDATIONAL);
  });

  test("9v9 age band (U11-U12) ceilings at DEVELOPING", () => {
    expect(getDefaultReadinessCeiling("U11")).toBe(SubprincipleReadiness.DEVELOPING);
  });

  test("11v11 age band (U13+) ceilings at ADVANCED", () => {
    expect(getDefaultReadinessCeiling("U16")).toBe(SubprincipleReadiness.ADVANCED);
  });

  // Regression guard for the within-11v11 sub-banding: U13/U14 (still
  // growing into the format) default-cap lower than U15+ (established),
  // even though both are the same 11v11 format band.
  test("U13 and U14 (youngest in 11v11) default-cap at DEVELOPING, not ADVANCED", () => {
    expect(getDefaultReadinessCeiling("U13")).toBe(SubprincipleReadiness.DEVELOPING);
    expect(getDefaultReadinessCeiling("U14")).toBe(SubprincipleReadiness.DEVELOPING);
  });

  test("U15 through U18 (established in 11v11) default to ADVANCED", () => {
    for (const ageGroup of ["U15", "U16", "U17", "U18"]) {
      expect(getDefaultReadinessCeiling(ageGroup)).toBe(SubprincipleReadiness.ADVANCED);
    }
  });
});

describe("resolveTeamReadinessCeiling", () => {
  test("uses the age/format default when no override is set", () => {
    expect(resolveTeamReadinessCeiling({ ageGroup: "U9", readinessOverride: null })).toBe(
      SubprincipleReadiness.FOUNDATIONAL
    );
  });

  test("a DOC override on a young team raises the ceiling above the age default", () => {
    expect(
      resolveTeamReadinessCeiling({ ageGroup: "U9", readinessOverride: SubprincipleReadiness.ADVANCED })
    ).toBe(SubprincipleReadiness.ADVANCED);
  });
});

describe("getEligibleTiers", () => {
  test("DEVELOPING ceiling includes FOUNDATIONAL and DEVELOPING, not ADVANCED", () => {
    expect(getEligibleTiers(SubprincipleReadiness.DEVELOPING)).toEqual([
      SubprincipleReadiness.FOUNDATIONAL,
      SubprincipleReadiness.DEVELOPING,
    ]);
  });

  test("ADVANCED ceiling includes all three tiers", () => {
    expect(getEligibleTiers(SubprincipleReadiness.ADVANCED)).toHaveLength(3);
  });
});

describe("isReadinessEligibleForTeam", () => {
  test("a U9 team is eligible for a FOUNDATIONAL subprinciple", () => {
    expect(isReadinessEligibleForTeam({ ageGroup: "U9", readinessOverride: null }, SubprincipleReadiness.FOUNDATIONAL)).toBe(
      true
    );
  });

  test("a U9 team is NOT eligible for an ADVANCED subprinciple without an override", () => {
    expect(isReadinessEligibleForTeam({ ageGroup: "U9", readinessOverride: null }, SubprincipleReadiness.ADVANCED)).toBe(
      false
    );
  });

  test("a U16 team is eligible for all three tiers", () => {
    const team = { ageGroup: "U16", readinessOverride: null };
    expect(isReadinessEligibleForTeam(team, SubprincipleReadiness.FOUNDATIONAL)).toBe(true);
    expect(isReadinessEligibleForTeam(team, SubprincipleReadiness.DEVELOPING)).toBe(true);
    expect(isReadinessEligibleForTeam(team, SubprincipleReadiness.ADVANCED)).toBe(true);
  });

  // Regression guard for the within-11v11 sub-banding: a U13 team is 11v11
  // but not yet "established" -- it should NOT be eligible for ADVANCED
  // subprinciples without an explicit DOC override, even though older
  // 11v11 teams (U16) are.
  test("a U13 team is NOT eligible for ADVANCED without an override, unlike U16", () => {
    const team = { ageGroup: "U13", readinessOverride: null };
    expect(isReadinessEligibleForTeam(team, SubprincipleReadiness.FOUNDATIONAL)).toBe(true);
    expect(isReadinessEligibleForTeam(team, SubprincipleReadiness.DEVELOPING)).toBe(true);
    expect(isReadinessEligibleForTeam(team, SubprincipleReadiness.ADVANCED)).toBe(false);
  });

  test("a U13 team's DOC can still override up to ADVANCED", () => {
    const team = { ageGroup: "U13", readinessOverride: SubprincipleReadiness.ADVANCED };
    expect(isReadinessEligibleForTeam(team, SubprincipleReadiness.ADVANCED)).toBe(true);
  });
});

describe("getDefaultPlayerAndCoachLevel", () => {
  // Regression guard for the level-defaulting bug found in eng review: a
  // hardcoded INTERMEDIATE/USSF_C default previously fired for every team
  // regardless of age, violating the existing "BEGINNER only pairs with
  // USSF_D" rule for every U8-U10 team.
  test("U9 (7v7) defaults to BEGINNER + USSF_D", () => {
    expect(getDefaultPlayerAndCoachLevel("U9")).toEqual({ playerLevel: "BEGINNER", coachLevel: "USSF_D" });
  });

  test("U12 (9v9) defaults to INTERMEDIATE + USSF_C", () => {
    expect(getDefaultPlayerAndCoachLevel("U12")).toEqual({ playerLevel: "INTERMEDIATE", coachLevel: "USSF_C" });
  });

  test("U16 (11v11) defaults to ADVANCED + USSF_B_PLUS", () => {
    expect(getDefaultPlayerAndCoachLevel("U16")).toEqual({ playerLevel: "ADVANCED", coachLevel: "USSF_B_PLUS" });
  });
});

describe("getAgeGroupMaturityNote", () => {
  const ALL_AGE_GROUPS = ["U8", "U9", "U10", "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18"];

  test("every real age group has a distinct, non-empty note", () => {
    const notes = ALL_AGE_GROUPS.map(getAgeGroupMaturityNote);
    expect(notes.every((note) => note.length > 0)).toBe(true);
    expect(new Set(notes).size).toBe(ALL_AGE_GROUPS.length);
  });

  // Regression guard for the actual gap this was built to close: U13 and U18
  // share the same playerLevel/coachLevel defaults (both 11v11 -> ADVANCED)
  // but must not share the same maturity note, or the two ages are still
  // indistinguishable to the generator.
  test("U13 and U18 (same 11v11 band) get different notes", () => {
    expect(getAgeGroupMaturityNote("U13")).not.toBe(getAgeGroupMaturityNote("U18"));
  });

  test("is case-insensitive and returns empty string for an unknown age group", () => {
    expect(getAgeGroupMaturityNote("u9")).toBe(getAgeGroupMaturityNote("U9"));
    expect(getAgeGroupMaturityNote("U99")).toBe("");
  });
});
