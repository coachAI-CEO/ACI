export function applyYouthGuards(drill: any, input: any) {
  const isU9U12 = /^U(9|10|11|12)\b/i.test(input?.ageGroup || "");
  if (!isU9U12) return;

  const ensureArr = (v: any) => (Array.isArray(v) ? v : []);
  const hasGK = (input?.goalsAvailable ?? 0) >= 1;
  const ageGroup = input?.ageGroup || "U12";

  // Timing only. Do not rewrite the diagram, roster, or practice area —
  // a U10 rondo is not a canned 4v3 cutback picture.
  drill.loadNotes = {
    structure: "8 x 90s with 90s rest (1:1) — rotate groups briskly",
    rationale: `Short work intervals preserve decision quality and avoid excessive fatigue for ${ageGroup}.`,
  };

  if (typeof drill.organization === "object" && drill.organization !== null) {
    if (!drill.organization.setupSteps) {
      drill.organization.setupSteps = [
        "Mark the practice area using cones.",
        "Split players into two teams and assign colored bibs.",
        "Position players according to the starting formation.",
        "Place the coach at the designated restart position.",
        "Prepare multiple balls at the coach's position.",
        "Explain the objective and scoring rules to all players.",
      ];
    }
    if (!drill.organization.rotation) {
      drill.organization.rotation = "Rotate players every 2-3 minutes or after scoring events.";
    }
    if (!drill.organization.restarts) {
      drill.organization.restarts = "Coach restarts play after goals, out of bounds, or stoppages.";
    }
    if (!drill.organization.scoring) {
      drill.organization.scoring = "Standard scoring: 1 point per goal.";
    }
  }

  const constraintsIn = ensureArr(drill.constraints);
  const constraintsOut: string[] = [];
  let hasControlledStart = false;
  for (const c of constraintsIn) {
    if (typeof c !== "string") continue;
    const s = c.trim();
    if (/defend(er|ers).*(must|should).*remain.*defensive\s+half/i.test(s)) continue;
    if (/third-?man.*(must|required|only)/i.test(s)) continue;
    if (/controlled start|first touch/i.test(s)) hasControlledStart = true;
    constraintsOut.push(s);
  }
  if (!hasControlledStart) {
    constraintsOut.unshift(
      "Controlled start: Defenders cannot press beyond the CAM’s starting line until after the CAM’s first touch."
    );
  }
  drill.constraints = constraintsOut;

  const progIn = ensureArr(drill.progression ?? drill.progressions);
  const progOut: string[] = [];
  let addedRecovering = false;
  for (const p of progIn) {
    if (typeof p !== "string") continue;
    let s = p.trim();
    if (/third-?man.*(must|required|only)/i.test(s)) {
      s = "Coaching challenge: Encourage third-man runs with guided questions and freeze moments.";
    }
    if (/\b(5v5|6v6|7v7|8v8|9v9|10v10|11v11)\b/i.test(s)) {
      if (!addedRecovering) {
        progOut.push("Add one recovering defender from halfway on coach signal → creates 4v4 momentary transition.");
        addedRecovering = true;
      }
      continue;
    }
    if (/^structure:/i.test(s)) continue;
    progOut.push(s);
  }
  if (!progOut.length) {
    progOut.push("Coaching challenge: Encourage third-man runs with guided questions and freeze moments.");
  }
  if (!addedRecovering) {
    progOut.push("Add one recovering defender from halfway on coach signal → creates 4v4 momentary transition.");
  }
  drill.progressions = progOut;
  if (drill.progression) delete drill.progression;

  const scoring = ensureArr((drill as any).scoringHints);
  if (!scoring.some((s: string) => /third-?man/i.test(s || ""))) {
    scoring.push("+1 bonus point for a goal scored by a third-man runner (e.g., CAM timing beyond the 9).");
  }
  (drill as any).scoringHints = scoring;

  drill.coachingPoints = ensureArr(drill.coachingPoints);
  if (hasGK && !drill.coachingPoints.some((p: string) => /^GK\b|^Goalkeeper\b/i.test(p))) {
    drill.coachingPoints.push("GK: starting position & communication on cutbacks; quick distribution on saves.");
  }
}
