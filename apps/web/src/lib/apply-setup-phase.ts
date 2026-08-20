"use client";

import { applySetupPhaseToDiagram } from "@/lib/chassis/board-phase-placement";
import type { DiagramV1 } from "@/types/diagram";
import type {
  BoardSetupPhase,
  BoardSetupZone,
  BoardSetupChannel,
} from "@/lib/board-phase-setup";

/** Same chassis as the API — runs in the browser, no network. */
export function placeSetupPhaseLocally(
  diagram: DiagramV1,
  input: {
    phase: BoardSetupPhase;
    zone: BoardSetupZone;
    channel: BoardSetupChannel;
    attFormation?: string;
    defFormation?: string;
    showOpposition?: boolean;
  }
): DiagramV1 {
  const placed = applySetupPhaseToDiagram(diagram, input);
  return {
    ...placed,
    pitch: {
      ...diagram.pitch,
      ...placed.pitch,
      format: diagram.pitch.format,
      variant: diagram.pitch.variant,
      orientation: diagram.pitch.orientation,
      showZones: diagram.pitch.showZones,
      showThirds: diagram.pitch.showThirds,
    },
    goals: diagram.goals?.length ? diagram.goals : placed.goals,
  };
}
