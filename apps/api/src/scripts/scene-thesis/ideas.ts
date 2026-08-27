import type { FieldFormat } from "../../data/field-dimensions";

export type ThesisIdea = {
  id: string;
  title: string;
  /** What a coach would read on the session card. Both paths see this. */
  card: string;
  drillType: string;
  fieldFormat: FieldFormat;
  spaceConstraint: "FULL" | "HALF" | "THIRD" | "QUARTER";
  formationAttacking: string;
  formationDefending: string;
  goalsAvailable: number;
  /** Outfield per side for the naive compiler dump (no GKs). */
  outfieldPerSide: number;
  keepers: boolean;
  why: string;
  /** How the practice should sit on the pitch. */
  picture?: "rondo" | "center" | "matchup" | "block";
  /** Diagram detail dial. Default SIMPLE / D. */
  coachLevel?: "USSF_D" | "USSF_C" | "USSF_B_PLUS";
  /** Optional compare-set tag. `--set new` filters batch "new". */
  batch?: "new";
};

export const THESIS_IDEAS: ThesisIdea[] = [
  {
    id: "5v5-repeat",
    title: "U10 5v5 diamond (repeat)",
    drillType: "WARMUP",
    fieldFormat: "7V7",
    spaceConstraint: "THIRD",
    formationAttacking: "2-1-2",
    formationDefending: "2-1-2",
    goalsAvailable: 0,
    outfieldPerSide: 5,
    keepers: false,
    why: "Known compiler fail: even minis become two columns instead of a 2-1-2 diamond.",
    card: `WARMUP U10. 5v5, no GKs, mini-goals only.
Each team a 2-1-2 DIAMOND (2-1-2), never two columns of five.
Blue left, red right, facing each other. 10 shirts. Two mini goals. Four cones.
2-4 pass arrows that miss shirts.`,
  },
  {
    id: "u9-open-teammate",
    title: "U9 pass to the open teammate",
    drillType: "TECHNICAL",
    fieldFormat: "7V7",
    spaceConstraint: "QUARTER",
    formationAttacking: "4-1",
    formationDefending: "1-1",
    goalsAvailable: 0,
    outfieldPerSide: 6,
    keepers: false,
    picture: "rondo",
    why: "Small-sided rondo — compiler tends to dump a match picture.",
    card: `TECHNICAL U9 D-license. Passing to the teammate who is free.
ONE 4v1 or 5v2 RONDO: a small square in the MIDDLE of the pitch.
Not 11v11. Not two games on the wings. Not stretched to the touchlines.
No full goals. Cones mark that one small square.
Red defender(s) in the CENTRE of the ring. Blues around the square.
Arrow: pass to the OPEN player, around the ring, not through the defender.`,
  },
  {
    id: "u11-nearby",
    title: "U11 teammate nearby who can help",
    drillType: "TECHNICAL",
    fieldFormat: "9V9",
    spaceConstraint: "HALF",
    formationAttacking: "3-2-1",
    formationDefending: "3-2-1",
    goalsAvailable: 1,
    outfieldPerSide: 6,
    keepers: true,
    why: "One full goal + help nearby — not a second 11v11.",
    card: `TECHNICAL U11. Combination: someone close should be ready to help.
6v6 plus one full-size goal with GK on the RIGHT. Mini goals opposite.
Attacking toward that one full goal. Not a full match. ~14 shirts including 1 GK in black.
Show a wall-pass / nearby support arrow.`,
  },
  {
    id: "u14-first-pass",
    title: "U14 first pass after we win it",
    drillType: "CONDITIONED_GAME",
    fieldFormat: "7V7",
    spaceConstraint: "FULL",
    formationAttacking: "2-3-1",
    formationDefending: "3-2-1",
    goalsAvailable: 2,
    outfieldPerSide: 8,
    keepers: true,
    why: "8v8 conditioned game — closest to a generated session drill.",
    card: `CONDITIONED GAME U14. Topic: first pass after we win the ball.
8v8 outfield + 2 GKs, two full goals, 7v7-sized pitch (not a tiny rondo, not a second 11v11).
Blue just won it in midfield — first pass must go FORWARD or wide, not back into pressure.
Red counterpress. Distinct teams, both halves used.`,
  },
  {
    id: "u16-rest-defence",
    title: "U16 rest defence after we lose it",
    drillType: "TACTICAL",
    fieldFormat: "11V11",
    spaceConstraint: "THIRD",
    formationAttacking: "3-5-2",
    formationDefending: "4-3-3",
    goalsAvailable: 2,
    outfieldPerSide: 10,
    keepers: true,
    why: "3-5-2 wing-backs high and wide — formation lock pressure.",
    card: `TACTICAL U16. Rest defence after we lose it in the middle third.
Blue in a 3-5-2: back THREE, wing-backs HIGH AND WIDE, three CMs, two strikers. Not a 5-across midfield.
Red 4-3-3. Middle-third picture (~70x50), two full goals but this is NOT a second 11v11 match — compact block.
Show recover/press arrows after the loss. ~22 shirts + GKs if the goals are full.`,
  },
  {
    id: "u8-1v1",
    title: "U8 1v1 to beat the defender",
    drillType: "TECHNICAL",
    fieldFormat: "7V7",
    spaceConstraint: "QUARTER",
    formationAttacking: "1-0",
    formationDefending: "1-0",
    goalsAvailable: 0,
    outfieldPerSide: 4,
    keepers: false,
    picture: "center",
    why: "1v1 is a short channel — compiler still dumps a squad.",
    card: `TECHNICAL U8. 1v1 to beat the defender and finish.
A SHORT CHANNEL in the MIDDLE of the pitch. Not 11v11. Not two teams of five.
One blue attacker, one red defender, one MINI goal at the end of the channel.
Maybe a second pair waiting — still the picture is the 1v1, not a match.
Arrow: take-on / beat the defender toward the mini goal.`,
  },
  {
    id: "u10-4v4-minis",
    title: "U10 4v4 two mini goals",
    drillType: "WARMUP",
    fieldFormat: "7V7",
    spaceConstraint: "THIRD",
    formationAttacking: "2-2",
    formationDefending: "2-2",
    goalsAvailable: 0,
    outfieldPerSide: 4,
    keepers: false,
    why: "Even 4v4 becomes columns; want two mini-goal boxes facing.",
    card: `WARMUP U10. 4v4, no GKs, two mini goals.
Blue left, red right, facing each other. 8 shirts. Mini goals on the two ends.
Each team a 2-2, not a column of four. Small box, not a full 7v7.
2-3 pass or dribble arrows. Four cones mark the box.`,
  },
  {
    id: "u12-press-unit",
    title: "U12 press as a unit",
    drillType: "TACTICAL",
    fieldFormat: "9V9",
    spaceConstraint: "THIRD",
    formationAttacking: "3-2-1",
    formationDefending: "3-2-1",
    goalsAvailable: 0,
    outfieldPerSide: 6,
    keepers: false,
    why: "Pressing is a compact pack — not shirts parked in two 11v11 halves.",
    card: `TACTICAL U12. Press as a unit after they take their first touch.
6v6 in the MIDDLE THIRD. No full 9v9 match. No GKs. Mini goals or none.
Blue has the ball in a tight pack. THREE reds press TOGETHER toward the ball (not five individuals).
Show press arrows that converge. Compact: both teams in the central box, not stretched sideline to sideline.`,
  },
  {
    id: "u13-gk-out",
    title: "U13 play out from the GK",
    drillType: "TECHNICAL",
    fieldFormat: "9V9",
    spaceConstraint: "HALF",
    formationAttacking: "3-2",
    formationDefending: "2-2",
    goalsAvailable: 1,
    outfieldPerSide: 5,
    keepers: true,
    why: "Build-out from one goal — compiler often draws a second 11v11.",
    card: `TECHNICAL U13. Play out from the goalkeeper.
ONE full goal on the LEFT with a black GK. Blue back three + GK. Two reds pressing the first pass.
Attacking out toward the RIGHT (no second full goal, maybe mini goals high).
~9 shirts. Arrows: GK to an open centre-back or wide, NOT a hoof. Not a full match.`,
  },
  {
    id: "u15-switch",
    title: "U15 switch the point of attack",
    drillType: "CONDITIONED_GAME",
    fieldFormat: "9V9",
    spaceConstraint: "FULL",
    formationAttacking: "3-2-1",
    formationDefending: "3-2-1",
    goalsAvailable: 2,
    outfieldPerSide: 7,
    keepers: true,
    picture: "matchup",
    why: "Switch of play needs width; compiler often keeps everyone in one channel.",
    card: `CONDITIONED GAME U15. Switch the point of attack.
7v7 outfield + 2 GKs, two full goals, 9v9-sized pitch.
Blue has it on the LEFT. First idea is stuck. Switch: pass across to the FAR winger on the RIGHT.
Red shifted over — they are compact on the ball side, weak side open.
Show the switch arrow across. Use both flanks, not a rondo in the middle.`,
  },
  {
    id: "c-press-unit",
    title: "C · U13 press as a unit",
    drillType: "TACTICAL",
    fieldFormat: "9V9",
    spaceConstraint: "THIRD",
    formationAttacking: "3-2-1",
    formationDefending: "3-2-1",
    goalsAvailable: 0,
    outfieldPerSide: 6,
    keepers: false,
    coachLevel: "USSF_C",
    why: "C diagram ask: one named idea, 5–7 arrows, 3–4 labels, 1–2 zones.",
    card: `USSF_C DIAGRAM. TACTICAL U13. Pressing as a unit — ONE concept.
6v6 in the middle third. No GKs. Mini goals or none.
Blue has the ball in a pack. Three reds press TOGETHER on the first touch; the others cover the next pass (not five 1v1s).
DRAW: 5-7 arrows (press + cover + one escape pass). 3-4 annotations naming the idea in C words (pressing trigger, supporting angle) — one idea, explained.
1-2 small zones (ball-side press, cover behind). Not a full-pitch overlay.
Leave air between shirts. Full goals left/right only if you use them, y=50.`,
  },
  {
    id: "c-first-pass",
    title: "C · U14 first pass after we win it",
    drillType: "CONDITIONED_GAME",
    fieldFormat: "7V7",
    spaceConstraint: "FULL",
    formationAttacking: "2-3-1",
    formationDefending: "3-2-1",
    goalsAvailable: 2,
    outfieldPerSide: 8,
    keepers: true,
    coachLevel: "USSF_C",
    why: "C diagram ask on a conditioned game: switch/first-pass as one idea, not a quiet 2-arrow card.",
    card: `USSF_C DIAGRAM. CONDITIONED GAME U14. Topic: first pass after we win the ball.
8v8 + 2 GKs, two full goals on LEFT and RIGHT (y=50). 7v7-sized pitch.
Blue just won it in midfield. First pass FORWARD or WIDE — not back into the press.
DRAW: 5-7 arrows (win, first pass, support angle, red counterpress). 3-4 annotations.
1-2 zones (where we won it, the forward lane). Name "first pass forward" or "switch of play" once and explain it next.
GKs on the goal line, centred. Not a rondo. Not 11v11.`,
  },
  {
    id: "c-switch",
    title: "C · U15 switch the point of attack",
    drillType: "CONDITIONED_GAME",
    fieldFormat: "9V9",
    spaceConstraint: "FULL",
    formationAttacking: "3-2-1",
    formationDefending: "3-2-1",
    goalsAvailable: 2,
    outfieldPerSide: 7,
    keepers: true,
    coachLevel: "USSF_C",
    picture: "matchup",
    why: "C diagram ask: the switch has to be visible — weak-side run + ball-side shift.",
    card: `USSF_C DIAGRAM. CONDITIONED GAME U15. Switch the point of attack — ONE concept.
7v7 + 2 GKs, two full goals left and right, y=50.
Blue stuck on the LEFT. Switch across to the FAR winger. Red shifted ball-side; weak side open.
Red's BACK LINE stays in THEIR half (between the ball and their GK). Not a high line on the halfway. Mids can step; the four do not.
DRAW: 5-7 arrows (stuck pass, switch, far-side receive, reds sliding). 3-4 annotations.
1-2 zones (ball-side cluster, weak-side target). Do not stack rest-defence or cover-shadow on this card — that is B+.
Use both flanks.`,
  },
  {
    id: "bplus-rest-defence",
    title: "B+ · U16 rest defence after we lose it",
    drillType: "TACTICAL",
    fieldFormat: "11V11",
    spaceConstraint: "THIRD",
    formationAttacking: "3-5-2",
    formationDefending: "4-3-3",
    goalsAvailable: 2,
    outfieldPerSide: 10,
    keepers: true,
    coachLevel: "USSF_B_PLUS",
    why: "B+ diagram ask: rest defence plus the next moment — 7–10 arrows, 4–6 labels, 2–3 zones. Will get tight.",
    card: `USSF_B_PLUS DIAGRAM. TACTICAL U16. Rest defence after we lose it high — LAYERED.
Blue 3-5-2 (back three, wing-backs high and wide, 3 CMs, 2 strikers). Red 4-3-3. Middle-third picture. Two full goals LEFT/RIGHT y=50. ~22 shirts + GKs.
We lose it in their half. Rest-defence shape already covers the counter WHILE the far winger occupies their last line.
DRAW: 7-10 arrows (loss, recover, cover the counter channel, far-side pin, press on the ball). 4-6 annotations in B+ language (rest defence, cover shadow, next-phase).
2-3 zones: rest-defence pocket, counter channel, far-side stretch. Zones are pockets — not a box over the whole pitch.
GKs centred on the posts. This will be busy; still leave a little air between shirts.`,
  },
  {
    id: "bplus-compact-lines",
    title: "B+ · U15 compactness between lines",
    drillType: "TACTICAL",
    fieldFormat: "11V11",
    spaceConstraint: "HALF",
    formationAttacking: "3-4-3",
    formationDefending: "3-4-3",
    goalsAvailable: 2,
    outfieldPerSide: 10,
    keepers: true,
    coachLevel: "USSF_B_PLUS",
    why: "B+ diagram ask: two lines as a system, not one flat wall.",
    card: `USSF_B_PLUS DIAGRAM. TACTICAL U15. Compactness between lines — LAYERED.
3-4-3 both sides. Half pitch, two full goals left/right y=50. ADVANCED.
Defensive line and midfield line stay CLOSE vertically so nothing is played through. If they split, the 10 plays between.
DRAW: 7-10 arrows (through-ball attempt, line step, cover shadow on the 10, wide recycle). 4-6 annotations.
2-3 zones: the gap we refuse, the line of 3, the line of 4. Show BOTH lines, not one row of 10.
GKs on the goal line, centred.`,
  },
  {
    id: "new-3v2",
    title: "U10 3v2 to a mini goal",
    drillType: "TECHNICAL",
    fieldFormat: "7V7",
    spaceConstraint: "QUARTER",
    formationAttacking: "2-1",
    formationDefending: "2-0",
    goalsAvailable: 0,
    outfieldPerSide: 3,
    keepers: false,
    picture: "center",
    batch: "new",
    why: "Overload in a short channel — compiler still dumps two teams of five.",
    card: `TECHNICAL U10 D-license. 3v2 to finish at a mini goal.
A SHORT CHANNEL in the MIDDLE. Three blues, two reds, ONE orange mini at the far end of that channel.
Not 11v11. Not 5v5. Not two games on the wings.
Blues must use the extra player — wall pass or third man into the mini. Reds delay, do not dive in.
2-4 arrows. 1-2 annotations. Grass words.`,
  },
  {
    id: "new-overlap",
    title: "C · U12 overlap 2v1 on the wing",
    drillType: "TECHNICAL",
    fieldFormat: "9V9",
    spaceConstraint: "HALF",
    formationAttacking: "2-1",
    formationDefending: "1-1",
    goalsAvailable: 1,
    outfieldPerSide: 4,
    keepers: true,
    coachLevel: "USSF_C",
    batch: "new",
    why: "Wide 2v1 — compiler parks everyone in two columns down the spine.",
    card: `USSF_C DIAGRAM. TECHNICAL U12. Overlap — ONE concept.
RIGHT-FLANK CHANNEL. 2v1: blue winger + overlapping full-back vs one red. One full goal on the RIGHT, y=50, GK on the line.
Not a 9v9 match. Not a rondo in the middle. ~8 shirts including the GK.
DRAW: 5-7 arrows (hold up, overlap run, pass into stride, finish or cutback). 3-4 annotations naming the overlap.
1-2 small zones (the 2v1 lane, the space the runner attacks). Leave the weak side empty on purpose.`,
  },
  {
    id: "new-third-man",
    title: "C · U14 third-man run",
    drillType: "CONDITIONED_GAME",
    fieldFormat: "7V7",
    spaceConstraint: "HALF",
    formationAttacking: "2-2-1",
    formationDefending: "3-1",
    goalsAvailable: 1,
    outfieldPerSide: 5,
    keepers: true,
    coachLevel: "USSF_C",
    batch: "new",
    why: "Third man is a picture of three — compiler cannot draw the runner beyond the wall.",
    card: `USSF_C DIAGRAM. CONDITIONED GAME U14. Third-man run — ONE concept.
Attacking toward ONE full goal on the RIGHT, y=50. 5v5 + GK in that net. Mini goals opposite if you need them.
Blue: passer, wall, runner BEYOND. The ball goes A to B and the third man arrives on the far side of the wall.
Red: one on the ball, one on the wall, the rest recover. Not five 1v1s.
DRAW: 5-7 arrows (pass, wall, third-man run, press). 3-4 annotations. 1-2 zones (wall, runner's lane).
GKs on the goal line. Not 11v11.`,
  },
  {
    id: "new-counter",
    title: "C · U15 counter after we win it",
    drillType: "CONDITIONED_GAME",
    fieldFormat: "9V9",
    spaceConstraint: "FULL",
    formationAttacking: "2-3-1",
    formationDefending: "3-2-1",
    goalsAvailable: 2,
    outfieldPerSide: 6,
    keepers: true,
    coachLevel: "USSF_C",
    picture: "matchup",
    batch: "new",
    why: "Counter needs vertical stretch — compiler keeps both teams as two midfield clumps.",
    card: `USSF_C DIAGRAM. CONDITIONED GAME U15. Counter after we win it — ONE concept.
6v6 + 2 GKs, two full goals left and right, y=50.
Blue wins it in THEIR own half (left). First action is FORWARD into the space behind red's last line — not a safe pass back.
Red's back four are in THEIR half (right), a little high after they lost it. Weak side and the channel in behind are open.
DRAW: 5-7 arrows (win, first pass in behind, support run, red recover). 3-4 annotations.
1-2 zones (where we won it, the space in behind). Not a rondo. Not a switch-of-play card.`,
  },
  {
    id: "new-cutback",
    title: "C · U13 cutback from the byline",
    drillType: "TACTICAL",
    fieldFormat: "9V9",
    spaceConstraint: "HALF",
    formationAttacking: "2-2-1",
    formationDefending: "3-1",
    goalsAvailable: 1,
    outfieldPerSide: 5,
    keepers: true,
    coachLevel: "USSF_C",
    batch: "new",
    why: "Cutback is a byline picture — compiler cannot put a runner on the goal line.",
    card: `USSF_C DIAGRAM. TACTICAL U13. Cutback from the byline — ONE concept.
Attacking the RIGHT full goal, y=50. Half pitch. 5v5 + GK.
Blue winger drives to the BYLINE (not a hopeful cross from 40 yards). Cutback to a runner at the penalty spot. Near-post decoy.
Red: one on the winger, one on the cutback, GK stays. Back line in their box, not on the halfway.
DRAW: 5-7 arrows (drive, cutback, near-post run, recover). 3-4 annotations. 1-2 zones (byline, penalty-spot arrival).
GKs on the goal line. Not a full 9v9 dump.`,
  },
];
