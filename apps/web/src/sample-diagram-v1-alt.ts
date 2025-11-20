export const SAMPLE_DIAGRAM_V1_ALT = {
  title: "Pressing Trap: Wide Right Channel",
  gameModelId: "PRESSING",
  phase: "DEFENDING",
  zone: "MIDDLE_THIRD",
  diagramV1: {
    // Simple “who stands where” for a pressing trap in the right half-space
    players: [
      // Defending team (pressing)
      { id: "D1", team: "DEF", number: 4, role: "CB", x: 40, y: 40 },
      { id: "D2", team: "DEF", number: 5, role: "CB", x: 52, y: 40 },
      { id: "D3", team: "DEF", number: 6, role: "DM", x: 46, y: 55 },
      { id: "D4", team: "DEF", number: 8, role: "CM", x: 58, y: 60 },
      { id: "D5", team: "DEF", number: 7, role: "W", x: 68, y: 52 },
      { id: "D6", team: "DEF", number: 11, role: "W", x: 35, y: 52 },

      // Attacking team in possession
      { id: "A1", team: "ATT", number: 2, role: "RB", x: 72, y: 60 },
      { id: "A2", team: "ATT", number: 8, role: "CM", x: 62, y: 50 },
      { id: "A3", team: "ATT", number: 10, role: "AM", x: 55, y: 45 },
      { id: "A4", team: "ATT", number: 9, role: "ST", x: 65, y: 35 },

      // GK just to anchor the goal
      { id: "GK1", team: "ATT", number: 1, role: "GK", x: 50, y: 15 }
    ],

    // Ball path + pressing / covering runs
    arrows: [
      // Build-up pass from GK to right-back
      {
        id: "P1",
        type: "pass",
        style: "solid",
        from: { playerId: "GK1" },
        to: { playerId: "A1" }
      },
      // CM support pass option inside
      {
        id: "P2",
        type: "pass",
        style: "solid",
        from: { playerId: "A1" },
        to: { playerId: "A2" }
      },

      // Press from wide player onto the RB
      {
        id: "R1",
        type: "press",
        style: "solid",
        from: { playerId: "D5" }, // DEF 7
        to: { playerId: "A1" }   // ATT 2
      },
      // DM steps across to take away inside pass
      {
        id: "R2",
        type: "run",
        style: "dashed",
        from: { playerId: "D3" }, // DEF 6
        to: { playerId: "A2" }    // ATT 8
      },
      // CB squeezes across to cover space behind the press
      {
        id: "R3",
        type: "run",
        style: "dashed",
        from: { playerId: "D2" }, // DEF 5
        to: { playerId: "A4" }    // ATT 9 (zone behind)
      }
    ],

    goals: [
      {
        id: "G1",
        type: "BIG",
        x: 50,   // centered
        y: 8,
        width: 24
      }
    ],

    coach: {
      x: 20,
      y: 80
    }
  }
} as const;
