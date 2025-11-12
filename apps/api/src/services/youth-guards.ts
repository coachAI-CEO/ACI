export function applyYouthGuards(drill: any, input: any) {
  const isU9U12 = /^U(9|10|11|12)\b/i.test(input?.ageGroup || "");
  if (!isU9U12) return;

  const ensureArr = (v: any) => Array.isArray(v) ? v : [];
  const ensureObj = (v: any) => (v && typeof v === 'object') ? v : {};

  // Canonical U12 format we enforce post-generation
  const ATK = 4;
  const DEF = 3;
  const hasGK = (input?.goalsAvailable ?? 0) >= 1;

  // === 1) Time: switch to 90s work / 90s rest (1:1), short high-quality bouts
  drill.loadNotes = {
    structure: "8 x 90s with 90s rest (1:1) — rotate groups briskly",
    rationale: "Short work intervals preserve decision quality and avoid excessive fatigue for U12."
  };

  // === 2) Area: reduce from half pitch → “18-yard-box width to halfway” (~44x35yd U12)
  const areaText = "Width of the 18-yard box to the halfway line (~44x35yd for U12)";
  drill.setup =
    `Set up ${ATK}v${DEF}${hasGK?'+GK':''} in ${areaText}. ` +
    `Coach at midfield with balls. Mark a wide channel (for winger isolation) and a cutback zone. Start from CAM on coach restart.`;
  drill.organization =
    `Format: ${ATK}v${DEF}${hasGK?'+GK':''} (U12). Area: ${areaText}. ` +
    `Objective: POSSESSION principles (switch → third-man timing → cutback). Rotation via 90s bouts (1:1 rest).`;

  // === 3) Diagram coherence (counts, shapes, custom size), arrows for combo → endline → cutback + box run
  drill.diagram = ensureObj(drill.diagram);
  drill.diagram.pitch = "CUSTOM";
  (drill.diagram as any).fieldSize = { widthYards: 44, lengthYards: 35 };
  drill.diagram.miniGoals = (input?.goalsAvailable === 2 ? 2 : (drill.diagram.miniGoals ?? 0));
  drill.diagram.teams = [
    { label: "Attack", count: ATK, color: "blue" },
    { label: "Defend", count: DEF, color: "red" },
    ...(hasGK ? [{ label: "GK", count: 1, color: "green" }] : [])
  ];
  (drill.diagram as any).startingShapeAttack = "2-1-1"; // Build-L, Build-R, CAM, Winger
  (drill.diagram as any).startingShapeDefend = "2-1-0"; // CB-L, CB-R, DM

  const pos = [
    { id: "A1", label: "Build-L",  team: "Attack", x: 35, y: 70 },
    { id: "A2", label: "Build-R",  team: "Attack", x: 60, y: 68 },
    { id: "A3", label: "CAM",      team: "Attack", x: 50, y: 55 },
    { id: "A4", label: "Winger",   team: "Attack", x: 85, y: 48 },
    { id: "D1", label: "CB-L",     team: "Defend", x: 45, y: 40 },
    { id: "D2", label: "CB-R",     team: "Defend", x: 55, y: 40 },
    { id: "D3", label: "DM",       team: "Defend", x: 50, y: 52 },
    ...(hasGK ? [{ id: "G1", label: "GK", team: "GK", x: 50, y: 20 }] : []),
    { id: "M1", label: "Endline",      team: "Marker", x: 92, y: 18 },
    { id: "M2", label: "CutbackSpot",  team: "Marker", x: 56, y: 30 },
    { id: "M3", label: "BoxRun",       team: "Marker", x: 54, y: 34 }
  ];
  (drill.diagram as any).startingPositions = pos;
  const id = (label: string) => pos.find(p => p.label.toLowerCase() === label.toLowerCase())?.id || null;
  drill.diagram.arrows = [
    { type: "pass",    from: "Build-L", to: "CAM",         style: "solid",  fromId: id("Build-L"), toId: id("CAM") },
    { type: "pass",    from: "CAM",     to: "Winger",      style: "solid",  fromId: id("CAM"),     toId: id("Winger") },
    { type: "dribble", from: "Winger",  to: "Endline",     style: "dotted", fromId: id("Winger"),  toId: id("Endline") },
    { type: "pass",    from: "Endline", to: "CutbackSpot", style: "solid",  fromId: id("Endline"), toId: id("CutbackSpot") },
    { type: "run",     from: "Build-R", to: "BoxRun",      style: "dashed", fromId: id("Build-R"), toId: id("BoxRun") }
  ];
  (drill.diagram as any).coach = { x: 10, y: 80, restart: "Coach plays into CAM to start each 90s rep" };

  // === 4) Constraints: controlled start; remove any “third-man must” mandates
  const constraintsIn  = ensureArr(drill.constraints);
  const constraintsOut: string[] = [];
  let hasControlledStart = false;
  for (const c of constraintsIn) {
    if (typeof c !== "string") continue;
    const s = c.trim();
    // drop unrealistic “defenders remain in half”
    if (/defend(er|ers).*(must|should).*remain.*defensive\s+half/i.test(s)) continue;
    // drop “third-man is mandatory” patterns
    if (/third-?man.*(must|required|only)/i.test(s)) continue;
    if (/controlled start|first touch/i.test(s)) hasControlledStart = true;
    constraintsOut.push(s);
  }
  if (!hasControlledStart) {
    constraintsOut.unshift("Controlled start: Defenders cannot press beyond the CAM’s starting line until after the CAM’s first touch.");
  }
  drill.constraints = constraintsOut;

  // === 5) Progressions: reframe “third-man” as coaching challenge, not a rule; keep one recovering-def step
  const progIn = ensureArr(drill.progression);
  const progOut: string[] = [];
  let addedRecovering = false;
  for (const p of progIn) {
    if (typeof p !== "string") continue;
    let s = p.trim();
    // strip any “third-man mandatory” phrasing
    if (/third-?man.*(must|required|only)/i.test(s)) {
      s = "Coaching challenge: Encourage third-man runs with guided questions and freeze moments.";
    }
    // collapse big escalations to a single recovering-def step
    if (/\b(5v5|6v6|7v7|8v8|9v9|10v10|11v11)\b/i.test(s)) {
      if (!addedRecovering) {
        progOut.push("Add one recovering defender from halfway on coach signal → creates 4v4 momentary transition.");
        addedRecovering = true;
      }
      continue;
    }
    // no “Structure:” here—timing lives in loadNotes
    if (/^structure:/i.test(s)) continue;
    progOut.push(s);
  }
  if (!progOut.length) {
    progOut.push("Coaching challenge: Encourage third-man runs with guided questions and freeze moments.");
  }
  if (!addedRecovering) {
    progOut.push("Add one recovering defender from halfway on coach signal → creates 4v4 momentary transition.");
  }
  drill.progression = progOut;

  // === 6) Scoring: make third-man a bonus (not mandatory)
  const scoring = ensureArr((drill as any).scoringHints);
  if (!scoring.some((s: string) => /third-?man/i.test(s || ""))) {
    scoring.push("+1 bonus point for a goal scored by a third-man runner (e.g., CAM timing beyond the 9).");
  }
  (drill as any).scoringHints = scoring;

  // === 7) GK coaching point safeguard if goals are in play
  drill.coachingPoints = ensureArr(drill.coachingPoints);
  if (hasGK && !drill.coachingPoints.some((p: string) => /^GK\b|^Goalkeeper\b/i.test(p))) {
    drill.coachingPoints.push("GK: starting position & communication on cutbacks; quick distribution on saves.");
  }
}
