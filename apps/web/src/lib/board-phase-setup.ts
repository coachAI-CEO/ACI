/**
 * Setup phase/zone/channel types + UI helpers.
 * Placement geometry lives on the API (board-phase-placement chassis).
 * Default view = no phase / zone / channel (natural formation only).
 */

export type BoardSetupPhase = "ATTACKING" | "DEFENDING" | "TRANSITION";
export type BoardSetupZone = "DEFENSIVE_THIRD" | "MIDDLE_THIRD" | "ATTACKING_THIRD";
export type BoardSetupChannel = "LEFT" | "CENTER" | "RIGHT";

export type BoardSetupPhaseOrNone = BoardSetupPhase | "";
export type BoardSetupZoneOrNone = BoardSetupZone | "";
export type BoardSetupChannelOrNone = BoardSetupChannel | "";

/** Subject of the phase highlight in Setup UI. */
export function subjectForPhase(phase: BoardSetupPhaseOrNone): "ATT" | "DEF" | null {
  if (!phase) return null;
  return phase === "DEFENDING" ? "DEF" : "ATT";
}

export function hasFullSetup(
  phase: BoardSetupPhaseOrNone,
  zone: BoardSetupZoneOrNone,
  channel: BoardSetupChannelOrNone
): phase is BoardSetupPhase {
  return Boolean(phase && zone && channel);
}

export const BOARD_SETUP_PHASES: { id: BoardSetupPhase; label: string }[] = [
  { id: "ATTACKING", label: "Attacking" },
  { id: "DEFENDING", label: "Defending" },
  { id: "TRANSITION", label: "Transition" },
];

export const BOARD_SETUP_ZONES: { id: BoardSetupZone; label: string }[] = [
  { id: "DEFENSIVE_THIRD", label: "Def third" },
  { id: "MIDDLE_THIRD", label: "Middle" },
  { id: "ATTACKING_THIRD", label: "Att third" },
];

export const BOARD_SETUP_CHANNELS: { id: BoardSetupChannel; label: string }[] = [
  { id: "LEFT", label: "Left" },
  { id: "CENTER", label: "Center" },
  { id: "RIGHT", label: "Right" },
];
