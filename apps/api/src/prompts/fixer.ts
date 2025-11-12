export function buildDrillFixerPrompt(args: {
  originalDrill: any;
  qa: any;
  guard: {
    gameModelId: "COACHAI"|"POSSESSION"|"PRESSING"|"TRANSITION";
    ageGroup: string;
    phase: string;
    zone: string;
    goalsAvailable: 0|1|2;
    durationMin: number;
  }
}) {
  const { originalDrill, qa, guard } = args;
  return `You are a UEFA A-License coach and drill editor.
Given a drill JSON and its QA review, produce a REVISED drill JSON that:
- fixes every "mustFix" item,
- removes all "redFlags",
- keeps the same theme/intention,
- keeps fields and types identical to the original spec,
- and ensures age-appropriateness and safety.

Hard rules:
- If QA ageAppropriateness < 3 for U9–U12, **reduce active players** to small-sided (target 4v3+GK; acceptable 3v2+GK–5v4+GK) and add a rotation plan for extras.
- Complete the diagram: shapes, startingPositions with x,y, ≥3 arrows (pass, run, dribble), and coach {x,y,restart}.
- Age ${guard.ageGroup}: limit concurrent constraints to ≤2; keep player numbers simple; include clear work:rest within duration ${guard.durationMin} minutes.
- GoalsAvailable=${guard.goalsAvailable}: if ≥1, include a Goalkeeper role and coaching cue.
- Diagram completeness: include starting positions (labels ok), at least 3 key arrows (pass/run/dribble) reflecting the intended pattern.

Return ONLY the full corrected drill JSON (no markdown):

Original:
${JSON.stringify(originalDrill)}

QA:
${JSON.stringify(qa)}
`;
}
