import type { DiagramV1 } from "@/types/diagram";
import {
  applyFormationToTeam,
  type FormationId,
} from "@/lib/board-formations";

/** Diagram shape used by the Setup chassis (same as the API WebDiagramV1). */
export type WebDiagramV1 = DiagramV1;

/** Roster for a named 11v11 shape. xy is overwritten by placePhaseSnapshot. */
export function build11v11FormationPlayers(
  formation: string,
  team: "ATT" | "DEF"
): DiagramV1["players"] {
  const empty: DiagramV1 = {
    pitch: { variant: "FULL", orientation: "HORIZONTAL", format: "11V11" },
    players: [],
    arrows: [],
    areas: [],
    labels: [],
  };
  const next = applyFormationToTeam(
    empty,
    team,
    formation as FormationId,
    team === "ATT" ? "home" : "away"
  );
  return (next.players || []).filter((p) => p.team === team);
}
