import {
  clubVaultWhere,
  sessionInClubVaultScope,
  sessionVisibleToClub,
} from "../services/club-session-visibility";
import { drillDiagramVisible } from "../services/diagram-svg-access";

test("stamped clubId wins over matching game model", () => {
  expect(
    sessionVisibleToClub({
      sessionClubId: "club-a",
      sessionGameModelId: "POSSESSION",
      clubId: "club-b",
      clubGameModelId: "POSSESSION",
    })
  ).toBe(false);
});

test("same clubId is visible even if models were copied", () => {
  expect(
    sessionVisibleToClub({
      sessionClubId: "club-a",
      sessionGameModelId: "POSSESSION",
      clubId: "club-a",
      clubGameModelId: "POSSESSION",
    })
  ).toBe(true);
});

test("legacy null clubId falls back to game-model match", () => {
  expect(
    sessionVisibleToClub({
      sessionClubId: null,
      sessionGameModelId: "POSSESSION",
      clubId: "club-a",
      clubGameModelId: "POSSESSION",
    })
  ).toBe(true);
  expect(
    sessionVisibleToClub({
      sessionClubId: null,
      sessionGameModelId: "PRESSING",
      clubId: "club-a",
      clubGameModelId: "POSSESSION",
    })
  ).toBe(false);
});

test("clubVaultWhere stamps club rows plus unstamped same-model legacy", () => {
  expect(clubVaultWhere({ clubId: "club-a", gameModelId: "POSSESSION" })).toEqual({
    OR: [
      { clubId: "club-a" },
      { clubId: null, gameModelId: "POSSESSION" },
    ],
  });
});

test("clubVaultWhere without clubId keeps game-model filter", () => {
  expect(clubVaultWhere({ gameModelId: "POSSESSION" })).toEqual({
    gameModelId: "POSSESSION",
  });
  expect(clubVaultWhere({})).toEqual({});
});

test("sessionInClubVaultScope hides other-club rows with the same model", () => {
  const scope = { clubId: "club-a", gameModelId: "POSSESSION" };
  expect(
    sessionInClubVaultScope({ clubId: "club-b", gameModelId: "POSSESSION" }, scope)
  ).toBe(false);
  expect(
    sessionInClubVaultScope({ clubId: "club-a", gameModelId: "POSSESSION" }, scope)
  ).toBe(true);
  expect(
    sessionInClubVaultScope({ clubId: null, gameModelId: "POSSESSION" }, scope)
  ).toBe(true);
  expect(
    sessionInClubVaultScope({ clubId: null, gameModelId: "PRESSING" }, scope)
  ).toBe(false);
});

test("sessionInClubVaultScope is open when there is no club scope", () => {
  expect(
    sessionInClubVaultScope(
      { clubId: "club-b", gameModelId: "POSSESSION" },
      { clubId: null, gameModelId: null }
    )
  ).toBe(true);
});

test("drillDiagramVisible allows owner and admin, not a peer's private drill", () => {
  const scope = { clubId: "club-a", gameModelId: "POSSESSION" };
  expect(
    drillDiagramVisible({
      generatedBy: "u1",
      savedToVault: false,
      gameModelId: "POSSESSION",
      userId: "u1",
      isAdmin: false,
      vaultScope: scope,
    })
  ).toBe(true);
  expect(
    drillDiagramVisible({
      generatedBy: "u1",
      savedToVault: false,
      gameModelId: "POSSESSION",
      userId: "u2",
      isAdmin: false,
      vaultScope: scope,
    })
  ).toBe(false);
  expect(
    drillDiagramVisible({
      generatedBy: "u1",
      savedToVault: false,
      gameModelId: "POSSESSION",
      userId: "u2",
      isAdmin: true,
      vaultScope: scope,
    })
  ).toBe(true);
});

test("drillDiagramVisible allows club vault drills on the club model only", () => {
  const scope = { clubId: "club-a", gameModelId: "POSSESSION" };
  expect(
    drillDiagramVisible({
      generatedBy: "other",
      savedToVault: true,
      gameModelId: "POSSESSION",
      userId: "u2",
      isAdmin: false,
      vaultScope: scope,
    })
  ).toBe(true);
  expect(
    drillDiagramVisible({
      generatedBy: "other",
      savedToVault: true,
      gameModelId: "PRESSING",
      userId: "u2",
      isAdmin: false,
      vaultScope: scope,
    })
  ).toBe(false);
});

