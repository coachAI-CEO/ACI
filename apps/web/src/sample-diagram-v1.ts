import type { DiagramV1 } from "@/types/diagram";

export const SAMPLE_DIAGRAM_V1: DiagramV1 = {
  pitch: {
    variant: "HALF",
    orientation: "HORIZONTAL",
    showZones: true,
    zones: {
      leftWide: false,
      leftHalfSpace: false,
      centralChannel: true,
      rightHalfSpace: true,
      rightWide: true,
    },
  },

  players: [
    { id: "A1", number: 9, team: "ATT", role: "ST", x: 70, y: 40 },
    { id: "A2", number: 10, team: "ATT", role: "AM", x: 60, y: 55 },
    { id: "A3", number: 11, team: "ATT", role: "W", x: 80, y: 60 },

    { id: "D1", number: 4, team: "DEF", role: "CB", x: 40, y: 40 },
    { id: "D2", number: 6, team: "DEF", role: "DM", x: 45, y: 55 },
    { id: "D3", number: 3, team: "DEF", role: "FB", x: 35, y: 70 },
  ],

  coach: { x: 10, y: 80, label: "Coach" },

  balls: [],
  cones: [],

  goals: [
    { id: "G1", type: "MINI", width: 10, x: 90, y: 20, facingAngle: 270, teamAttacks: "ATT" },
    { id: "G2", type: "MINI", width: 10, x: 90, y: 80, facingAngle: 270, teamAttacks: "ATT" }
  ],

  arrows: [
    { from: { playerId: "D1" }, to: { playerId: "D2" }, type: "pass", style: "solid", weight: "normal" },
    { from: { playerId: "D2" }, to: { playerId: "D3" }, type: "pass", style: "dashed", weight: "normal" },
    { from: { playerId: "A2" }, to: { playerId: "A1" }, type: "run", style: "dotted", weight: "bold" },
  ],

  areas: [],
  labels: [],
};
