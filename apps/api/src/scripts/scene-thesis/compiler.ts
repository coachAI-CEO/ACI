import { isWarmupPicture, practiceSpaceYards } from "../../data/field-dimensions";
import { drillToDrawerParams } from "../../mappers/drill-to-drawer-params";
import type { DrawerParams, DrawerPlayer } from "../../types/drawer";
import type { ThesisIdea } from "./ideas";
import { snapKeepersToGoals } from "./space";

function naiveOutfield(team: "ATT" | "DEF", n: number): Array<{
  id: string;
  team: "ATT" | "DEF";
  role: string;
  x: number;
  y: number;
  number: number;
}> {
  return Array.from({ length: n }, (_, i) => ({
    id: `${team}-${i + 1}`,
    team,
    role: "CM",
    x: team === "ATT" ? 30 : 70,
    y: 18 + (i % 5) * 16,
    number: i + 2,
  }));
}

function naiveGk(team: "ATT" | "DEF", x: number) {
  return { id: `GK-${team}`, team, role: "GK" as const, x, y: 50, number: 1 };
}

/** Current production path: stub diagram + drillToDrawerParams. */
export function compilerParams(idea: ThesisIdea): DrawerParams {
  const players = [
    ...naiveOutfield("ATT", idea.outfieldPerSide),
    ...naiveOutfield("DEF", idea.outfieldPerSide),
    ...(idea.keepers ? [naiveGk("ATT", 6), naiveGk("DEF", 94)] : []),
  ];
  const goals =
    idea.goalsAvailable >= 2
      ? [
          { id: "G-L", type: "full", x: 0, y: 50, width: 8 },
          { id: "G-R", type: "full", x: 100, y: 50, width: 8 },
        ]
      : idea.goalsAvailable === 1
        ? [{ id: "G-R", type: "full", x: 100, y: 50, width: 8 }]
        : [];
  const params = drillToDrawerParams({
    title: idea.title,
    drillType: idea.drillType,
    json: {
      drillType: idea.drillType,
      fieldFormat: idea.fieldFormat,
      spaceConstraint: idea.spaceConstraint,
      goalsAvailable: idea.goalsAvailable,
      formationAttacking: idea.formationAttacking,
      formationDefending: idea.formationDefending,
      diagram: { players, goals },
    },
  });
  return { ...params, players: snapKeepersToGoals(params.players, params.goals) };
}

export function spaceFor(idea: ThesisIdea) {
  return practiceSpaceYards(idea.fieldFormat, idea.spaceConstraint);
}

export function hideMatchMarkings(idea: ThesisIdea): boolean {
  return isWarmupPicture(idea.drillType) || idea.spaceConstraint !== "FULL";
}

export function countByTeam(players: DrawerPlayer[]) {
  const home = players.filter((p) => p.team === "home" || p.team === "gk").length;
  const away = players.filter((p) => p.team === "away").length;
  const other = players.length - home - away;
  return { home, away, other, total: players.length };
}
