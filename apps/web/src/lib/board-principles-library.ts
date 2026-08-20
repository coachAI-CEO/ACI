import type { PlayOutShape } from "@/lib/board-play-out-curriculum";
import type { PrincipleTopic } from "@/lib/board-principle-topics";

export type ShapeStyle = { title: string; body: string };

export type ShapeProfile = {
  lineage: string;
  history: string;
  historyDeep: string;
  idea: string;
  inPossession: string;
  outOfPossession: string;
  styles: ShapeStyle[];
};

export type GameModelStyle = {
  label: string;
  summary: string;
  attacking: string;
  loss: string;
  defending: string;
  regain: string;
};

export type AgeDevelopment = {
  format: string;
  headline: string;
  body: string;
  canDo: string[];
  notYet: string[];
};

/** History and styles of THIS shape only. Never restack into another formation. */
export const SHAPE_PROFILES: Record<PlayOutShape, ShapeProfile> = {
  "4-3-3": {
    lineage: "Dutch Total Football → positional play",
    history:
      "The 4-3-3 is the modern picture of Dutch Total Football: a back four, one holder in front, two 8s, and a front three. Ajax and the 1974 Netherlands side stretched the pitch with wingers and a roaming centre-forward. Later Barcelona and Spain kept the same skeleton and asked the 6 to be a deep passer, the 9 to drop, and the 7 and 11 to cut inside while full-backs gave the width.",
    historyDeep:
      "Cruyff’s Ajax/Barça used the 4-3-3 as a positional grid: roughly no more than three on a line, no more than two stacked in a channel. Guardiola’s juego de posición kept the single #6 as the screen and deep playmaker (Busquets), with a false nine (Messi) dragging centre-backs so inverted wingers could slice. The risk has always been the same: one holder can be jumped. The designed answer is a bounce into an 8, not a long boot.",
    idea: "One holder. Width in the 7 and 11. The 9 is a target (or a false nine only after the first line is beaten).",
    inPossession:
      "Make the pitch big. Split centre-backs, 6 in front (or briefly between them vs two strikers), full-backs and wingers holding width, 9 high or dropping into a pocket. Play through the free player behind their first press.",
    outOfPossession:
      "Front three start the press. The 6 screens the centre. The nearest 8 is rest defence — not both 8s flying. If the press is beaten, compact into a mid block; do not flatten the 6 into a second centre-back as the first answer.",
    styles: [
      {
        title: "Positional build",
        body:
          "Circulate to move their first press, then break a line. The 6 is the helper. If they jump the 6, the next pass is an 8. Wingers stay high so the middle is not a crowd. This is possession 4-3-3 — still this shape.",
      },
      {
        title: "Press and rest",
        body:
          "Play-out is also the next press. Keep rest-defence distances short: 6 plus the nearest 8. Prefer a vertical option when it is on. Do not sterile-circulate until the 6 is the only player behind the ball.",
      },
      {
        title: "Front-three attack",
        body:
          "After the first line is beaten, the 9 can drop to drag a centre-back, and a winger cuts inside while a full-back overlaps. That is a later picture — not the first pass from a goal kick.",
      },
    ],
  },
  "4-2-3-1": {
    lineage: "Lillo’s doble pivot → #10 pocket",
    history:
      "The 4-2-3-1 was shaped so a team could play four attackers without emptying the middle. Two holders (the doble pivot) sit in front of the back four. A 10 lives in the hole. Wide attackers can invert. Juanma Lillo described it as symmetry: one holder can be jumped and the other is still free.",
    historyDeep:
      "Lillo’s idea was four forwards with cover — not a 4-3-3 with an extra 6. The 10 (trequartista / enganche) orchestrates between their midfield and back line and does not come get the first pass. Pep, Mou, and a generation of national teams used the double screen so full-backs could go. On loss the pivots stay; the front four drop toward a 4-4-2 or 4-5-1. The shape on the grass is still 4-2-3-1.",
    idea: "Two holders. The 10 stays in the pocket. One can be jumped; the other is the pass.",
    inPossession:
      "Split centre-backs, two holders as a pair, 10 between lines, wide attackers high, 9 pinning. Build through the free pivot. The 10 receives after the bounce, not as the first helper.",
    outOfPossession:
      "The two holders are a permanent rest-defence screen. One never both join the first attack. Front players drop on loss; do not leave a hole in front of the centre-backs.",
    styles: [
      {
        title: "Double-screen build",
        body:
          "One shows, one stays. If they jump the 6, play the 8. That is the whole 4-2-3-1 play-out idea. Full-backs can step because the middle is occupied twice.",
      },
      {
        title: "10 in the hole",
        body:
          "The 10 is why this shape exists. Keep them between their lines. Wingers occupy inside channels after the bounce; full-backs overlap only once the 10 has the pocket.",
      },
      {
        title: "Press from a screen",
        body:
          "Play-out sets the next press. Pivots stay connected so a loss does not become a 3v5 in the back. Vertical when the press has already forced chaos; secure if not.",
      },
    ],
  },
  "4-4-2": {
    lineage: "Maslov / Sacchi short team",
    history:
      "The 4-4-2 is two banks of four and a pair of strikers. Viktor Maslov’s pressing 4-4-2 and Arrigo Sacchi’s Milan made it a system: zonal marking, a sliding back four, and a short team — roughly 25 metres from deepest defender to striker. Width is a wide mid or an overlapping full-back, not a 4-3-3 winger parked on the touchline as a third attacker.",
    historyDeep:
      "Sacchi’s lock was collective distances, not star roles. One wide mid tucks, the other stays wide; a target holds and a runner goes. The two centre-mids are a pair of 8s, not a single 6. English and many US youth sides still live here because the picture is honest: two lines, two strikers, slide together.",
    idea: "Two banks of four. A pair of 8s. Target and runner up top. Keep the short team.",
    inPossession:
      "Play along the line of four, then into a striker. One wide mid can tuck to free an overlapping full-back. Do not invent a single 6 in front of a 4-3-3.",
    outOfPossession:
      "Instant two banks of four. Lateral slide. Harass and squeeze. Rest defence is the two 8s plus the nearest full-back.",
    styles: [
      {
        title: "Short-team block",
        body:
          "Distances first. If the back four and the mid four split, the 4-4-2 is dead. Replay the restart until the free 8 is obvious and the block has moved as a unit.",
      },
      {
        title: "Target and runner",
        body:
          "One 9 shows to feet, one stays high. Play-out is not finished until a striker is a problem for their centre-backs.",
      },
      {
        title: "Tuck and overlap",
        body:
          "Asymmetry after the first line is beaten: one wide mid tucks, opposite full-back overlaps. That is a second picture, not the goal-kick.",
      },
    ],
  },
  "3-5-2": {
    lineage: "Bilardo / Piontek back three + wing-backs",
    history:
      "The 3-5-2 puts three centre-backs, two wing-backs, a midfield three (or five with the wing-backs), and two strikers. Carlos Bilardo, Ciro Blažević, and Sepp Piontek used it so a playmaker could live inside a secure back three. Width is the wing-backs. There is no 4-3-3 7 and 11.",
    historyDeep:
      "A libero or stepping middle centre-back plus a holding mid as a sluice. Wing-backs start high in possession and must recover on loss or the back three becomes a 3v5. Twin strikers pin. On loss this shape often becomes a 5-3-2 — that is the rest picture of the same team, not a new formation for the board unless the coach names it.",
    idea: "Back three. Wing-backs for width. A holder in front of the three. Two strikers.",
    inPossession:
      "GK to a side centre-back or the holder. Middle centre-back can carry. Wing-backs stretch the press. One striker shows, one pins.",
    outOfPossession:
      "Wing-backs recover. Three centre-backs stay tight. Mid trio shields. Force wide, then isolate. Do not chase with a centre-back as the first answer.",
    styles: [
      {
        title: "Libero and sluice",
        body:
          "The middle centre-back or holder is the first helper. If they are jumped, play the side centre-back. Stay in the back three.",
      },
      {
        title: "Wing-back width",
        body:
          "Width is not a winger. If both wing-backs drop into a back five on the first pass, you have stopped playing 3-5-2 in possession.",
      },
      {
        title: "Two strikers",
        body:
          "One can come get it and one stays a target. That is the 3-5-2 attack, not a lone 9 with two wingers.",
      },
    ],
  },
  "4-1-4-1": {
    lineage: "Single 6 + flat four",
    history:
      "The 4-1-4-1 is a back four, one holder, a flat four in midfield, and one striker. Clubs have used it as a 4-4-2 with one striker dropped, or as a 4-3-3 with the wide players as mids instead of high wingers. The 6 is the lock. Width is the wide mids.",
    historyDeep:
      "Mourinho’s Chelsea and several tournament sides used the 6 as the rest-defence lock with two 8s and two wide mids screening. There is no 10 in the pocket unless the coach names a change. On loss the four drop as a unit. Do not invent a 4-2-3-1 10 because it feels sophisticated.",
    idea: "One holder. Flat midfield four. One striker. Wide mids, not high wingers.",
    inPossession:
      "GK to a split centre-back or the 6. 8s are the next pass if the 6 is jumped. Wide mids hold the sides. 9 stays a target.",
    outOfPossession:
      "The 6 plus the nearest 8. The four screen the centre. Do not empty the middle so both wide mids can join the first attack.",
    styles: [
      {
        title: "6 as lock",
        body:
          "If they jump the 6, bounce into an 8. Keep the midfield four. That is play-out in this shape.",
      },
      {
        title: "Wide mids, not wingers",
        body:
          "They can tuck after the first line is beaten. Until then they hold width so the 6 is not receiving in a crowd.",
      },
      {
        title: "Rest as a four",
        body:
          "On loss the midfield four drops together. The 6 does not become a third centre-back on the first pass.",
      },
    ],
  },
  "5-3-2": {
    lineage: "Back five as the rest shape",
    history:
      "The 5-3-2 is three centre-backs, two wing-backs starting deeper, a midfield three, and two strikers. It is the older catenaccio cousin and the modern low or mid block: Conte and others have used the five as the rest shape. Width is still the wing-backs, but they begin deeper than in a 3-5-2.",
    historyDeep:
      "If the coach pushes the wing-backs up, this becomes a 3-5-2 in possession. Until they name that change, stay in a back five. Play-out is into a mid, then a striker. On loss the five is already set — do not chase with a centre-back.",
    idea: "Back five. Midfield three. Two strikers. Wing-backs start deeper.",
    inPossession:
      "GK to a side centre-back. One of the three mids shows. One 9 shows, one stays high. Wing-backs give the sides without emptying the five.",
    outOfPossession:
      "The five is the rest. Mid three shields. Force wide. Second balls matter.",
    styles: [
      {
        title: "Play out from a five",
        body:
          "Side centre-back or nearer mid is the helper. If jumped, play another mid — not a long diagonal as the first idea.",
      },
      {
        title: "Wing-backs with cover",
        body:
          "They give width. They do not both fly on the first pass or you no longer have a five.",
      },
      {
        title: "Two strikers vs a packed box",
        body:
          "One shows, one pins. Patience: the five is behind you, so you can wait for the free mid.",
      },
    ],
  },
  "2-3-1": {
    lineage: "7v7: two backs, helper, width, one striker",
    history:
      "US and Canadian 7v7 has long used a 2-3-1 as the first ‘real’ picture: two backs, a friend in front of the goalkeeper, two wide players, one striker. It is not a mini 4-3-3. It exists so a seven-year-old’s goalkeeper has a helper and the sides are not empty.",
    historyDeep:
      "Grassroots governing bodies picked 7v7 so children meet the game with enough space and a simple job. The 2-3-1 is the attacking version of that: one helper (#6), width in the 7 and 11, a 9 as target. Do not import 11v11 rest defence, false nines, or inverted wingers.",
    idea: "GK finds a friend. Helper in front of two backs. Stay wide. One striker.",
    inPossession: "Pass to a back or the 6. If they run at the 6, play wide. 9 stays high.",
    outOfPossession: "Get behind the ball as a group. Do not lecture cover shadow.",
    styles: [
      {
        title: "Goalkeeper finds a friend",
        body: "The whole style at this age. Not a boot. Celebrate the first pass that stays in.",
      },
      {
        title: "If they run at the 6, play wide",
        body: "That is the only second picture. Replay it.",
      },
      {
        title: "Stay wide so the middle is not a crowd",
        body: "7 and 11 hold the sides. Fun, space, one job.",
      },
    ],
  },
  "3-2-1": {
    lineage: "7v7: three backs, two helpers, one striker",
    history:
      "The 3-2-1 is the more covered 7v7 picture: three backs, two mids, one striker. Coaches use it when they want a middle back as cover and two helpers in front. Still not 11v11. Still one striker.",
    historyDeep:
      "It rhymes with a back three, but the jobs are child-sized: GK to a side back, middle back covers, two mids — one shows, one stays. Do not invent wingers from a 4-3-3.",
    idea: "Three backs. Two mids as helpers. One striker.",
    inPossession: "GK to a side back. If they jump one mid, play the other.",
    outOfPossession: "Three backs stay a group. Two mids recover. No rest-defence lecture.",
    styles: [
      {
        title: "Cover in the middle",
        body: "The middle back is cover, not a libero stepping into midfield like an adult 3-5-2.",
      },
      {
        title: "Two helpers",
        body: "One shows, one stays. That is the whole 3-2-1 play-out.",
      },
      {
        title: "One target",
        body: "The 9 stays high. Do not drop them to the six-yard box to ‘help’ the build.",
      },
    ],
  },
  "3-2-3": {
    lineage: "9v9 step toward a front three",
    history:
      "9v9 3-2-3 is three backs, two mids, front three. Many US youth clubs use it as the bridge toward a later 4-3-3 without being a 4-3-3. Two helpers in midfield. Wingers stay high and wide. 9 is the target.",
    historyDeep:
      "The two mids are the bounce: if they jump one, play the other or a wide player. Do not stack 11v11 6-8-10 jobs onto nine players. Format is 9v9; language stays one job per shirt.",
    idea: "Three backs, two mids, front three. Helpers are the two mids.",
    inPossession: "GK to a split back or a mid. 7 and 11 hold the touchline. 9 stays high.",
    outOfPossession: "Front three start the press if you want it; two mids are the screen. Keep it simple.",
    styles: [
      {
        title: "Two helpers",
        body: "One shows, one stays. Next pass is the other mid or a wide player — not back to the keeper as a habit.",
      },
      {
        title: "Front three stay high",
        body: "If the 7 and 11 drop into a back five on the first pass, you have lost the 3-2-3.",
      },
      {
        title: "Still 9v9",
        body: "Generous time on the ball. Scan, receive, pass. No 1–2 touch lock.",
      },
    ],
  },
  "2-3-2-1": {
    lineage: "9v9: a 6, 8s, two 10s, a 9",
    history:
      "The 2-3-2-1 gives 9v9 a holding 6, two 8s, two attacking mids, and a 9. It is how some clubs introduce a pocket without 11 players. The 6 is the first helper. The 10s stay higher — they do not come get the first pass.",
    historyDeep:
      "It rhymes with a 4-2-3-1 idea (helper, then hole) on a smaller field. Do not rename it 4-2-3-1 or drop the 10s onto the goalkeeper. Two backs, not four.",
    idea: "6 first. 8s next. Attacking mids stay in the hole. One 9.",
    inPossession: "GK to a back or the 6. If the 6 is jumped, an 8. 10s wait between the lines.",
    outOfPossession: "6 screens. 8s recover. 10s do not both hunt as the first idea.",
    styles: [
      {
        title: "6 then 8",
        body: "The bounce is the 8. Teach that sentence. Stop.",
      },
      {
        title: "10s stay in the hole",
        body: "If they drop onto the keeper, this shape has collapsed.",
      },
      {
        title: "Two backs",
        body: "Do not invent a back four. This is 9v9.",
      },
    ],
  },
  "3-3-2": {
    lineage: "9v9: three backs, three mids, two strikers",
    history:
      "The 3-3-2 is a 9v9 two-striker picture: three backs, three mids, two 9s. One mid is the helper; the other two stay a step higher. One striker shows, one stays.",
    historyDeep:
      "It rhymes with 3-5-2 / 4-4-2 ideas (two strikers, a helper) without 11 shirts. Do not flatten it into a 4-3-3 front three.",
    idea: "Helper in midfield. Two strikers — one shows, one stays. Wide mids give the sides.",
    inPossession: "GK to a side back or the holding mid. One 9 to feet, one high.",
    outOfPossession: "Three backs, three mids recover as a group. Two strikers drop on cue, not as a lecture.",
    styles: [
      {
        title: "Two strikers",
        body: "One can come get it. One stays a target. That is the point of this shape.",
      },
      {
        title: "One helper",
        body: "If they jump the holder, play a higher mid or a side back.",
      },
      {
        title: "Stay 3-3-2",
        body: "Do not restack the two 9s into a 7-9-11.",
      },
    ],
  },
};

export const GAME_MODEL_STYLES: Record<string, GameModelStyle> = {
  POSSESSION: {
    label: "Possession",
    summary: "Ball security, support angles, and controlled progression through the thirds.",
    attacking:
      "Height, width, and depth so the ball-carrier always has a safe option and a line-break. Receive open, scan early, circulate to move their press, then penetrate. Overloads and a third-man only when this age can hold a second picture.",
    loss:
      "Nearest players counterpress 3–5 seconds if numbers are there. If not, recover compact and deny the centre. Younger ages: ‘get it back or get behind the ball’ — not a named gegenpress.",
    defending:
      "Compact, protect the centre, force wide. Pressure–cover–balance when the age can hear two jobs; otherwise first defender and a friend covering.",
    regain:
      "First forward option if they are broken. If not, secure, expand, restart. Do not waste a regain on a hopeful boot at U10, or on sterile keeping at U17.",
  },
  PRESSING: {
    label: "Pressing",
    summary: "Coordinated regains — triggers, compactness, lock-side pressure.",
    attacking:
      "Play-out prepares the next press. Progress with purpose. Keep rest-defence distances short. Prefer vertical when on; do not sterile-circulate into a broken rest shape.",
    loss:
      "Hunt on a cue (poor touch, back pass, sideways under pressure) for 3–5 seconds. Lock the strong side. If it fails, sprint recover — never jog into a broken shape.",
    defending:
      "High or mid block with a shared trigger. Jump together. Cover behind the first presser. Force one way. Protect space in behind.",
    regain:
      "Attack the open space immediately. If numbers are not there, one or two passes then vertical so the press advantage is not wasted.",
  },
  TRANSITION: {
    label: "Transition",
    summary: "First actions after regain and loss — speed of decision over settled play.",
    attacking:
      "Even in settled play, body open to go forward. Support that can become a counter in one action. Enough security to survive a loss. Bias the next 3–6 seconds, not endless patience.",
    loss:
      "Name it early: press or drop. The unit must not split. Window is 3–6 seconds.",
    defending:
      "Organise to create the next transition: compact block, denied centre, hurried opponent. A regain should be able to become a forward attack, not a slow build under no pressure.",
    regain:
      "First forward pass, run, or dribble while they are disorganised. If the counter is not on, secure and expand, then the next penetration before they reset.",
  },
  ROCKLIN_FC: {
    label: "Rocklin FC",
    summary: "Advance through the thirds; steal it back or compact; counter if it is on.",
    attacking:
      "Advance to the attacking third with passing, dribbling, and movement. Height, width, depth. Forward runs, support under pressure, overloads. Break lines or take space. In the final third: through balls, crosses, 1v1s, numbers in the box — at an age-honest intensity.",
    loss:
      "Immediately steal it back or force an error. If not, compact defensive shape. Defenders push up to cover the next threat rather than dropping into a parked bus as the first idea.",
    defending:
      "Stop the advance. Compact vertically and horizontally. Pressure as a unit, cover and balance, no cheap switches, protect in behind. Narrow to deny the finish.",
    regain:
      "Counter if it is on. If not, keep the ball and expand attacking shape.",
  },
  COACHAI: {
    label: "Balanced",
    summary: "Security and penetration — not only sterile keeping, not only forced directness.",
    attacking:
      "Build with support angles and height/width/depth, then break a line when the picture is on. Mix circulation with a purposeful forward action.",
    loss:
      "Counterpress when numbers and cues are right; otherwise recover compact and deny the centre. One shared decision.",
    defending:
      "Pressure–cover–balance, compact, force predictable play. Block height follows the session. Protect space in behind.",
    regain:
      "Forward if advantage exists; secure and expand if not. Rehearse both answers.",
  },
};

const MODEL_ON_SHAPE: Partial<Record<string, Partial<Record<PlayOutShape, string>>>> = {
  POSSESSION: {
    "4-3-3":
      "Circulate until the 6 or an 8 is free. Wingers hold width so the first pass is not a crowd. Penetrate after the press has moved — not with the first hopeful ball into the 9.",
    "4-2-3-1":
      "The free pivot is the safe option; the 10 is the line-break after the bounce. Do not use the 10 as the first helper.",
    "4-4-2":
      "Play along the four, then into a striker. Keep the short team while you circulate. Switching the point of attack is a later picture.",
    "3-5-2":
      "Use the back three and holder to move the first press, then the far wing-back. Two strikers — one to feet, one high.",
    "4-1-4-1":
      "The 6 is security. 8s and wide mids give the next pass. The 9 waits. Patience is the model; emptying the four is not.",
    "5-3-2":
      "The five lets you wait. Play into a mid, then a striker. Do not skip the mid as a habit.",
    "2-3-1": "Find a friend. If they run at the 6, play wide. That is possession at 7v7.",
    "3-2-1": "Side back, then the free mid. Time on the ball.",
    "3-2-3": "Two mids as the circulate-and-break. Front three stay high.",
    "2-3-2-1": "6 then 8, 10s wait. Circulate without dropping the hole.",
    "3-3-2": "Helper, then a striker who shows. The other 9 stays a target.",
  },
  PRESSING: {
    "4-3-3":
      "Do not play out into a broken rest shape. 6 plus nearest 8 stay connected. Vertical when the front three have already set a trap.",
    "4-2-3-1":
      "Pivots are the screen for the next press. One stays. The 10 does not both jump with a winger on the first loss.",
    "4-4-2":
      "Two banks stay short so the press has a home. If the four and four split, you cannot press.",
    "3-5-2":
      "Wing-backs must be able to recover. Press with the front and holder; do not leave a 3v5.",
    "4-1-4-1":
      "The 6 is the rest lock. Wide mids can jump only if the 8s still screen.",
    "5-3-2":
      "The five is already the rest. Press with the three and strikers; do not break the five to hunt.",
    "2-3-1": "After a loss: get it back or get behind the ball. No named trigger lecture.",
    "3-2-1": "Three backs stay a group. Two mids recover together.",
    "3-2-3": "Front three can start the hunt. Two mids are the screen.",
    "2-3-2-1": "6 stays. 10s do not both chase the first loss.",
    "3-3-2": "Two strikers start the hunt. Three mids recover as a group.",
  },
  TRANSITION: {
    "4-3-3":
      "Body open on the 6 and 8s. First action after a loss is press or drop — name it. First action after a regain is forward if the 7/11/9 are on the shoulder.",
    "4-2-3-1":
      "Pivots survive the loss so a regain can go into the 10. If both pivots have gone, there is no transition — only a counter against you.",
    "4-4-2":
      "The pair of 8s and a striker runner are the counter line. Keep them connected in settled play so the 3–6 seconds exist.",
    "3-5-2":
      "Regain into a striker or far wing-back. Loss: wing-backs recover now, not after the next pass.",
    "4-1-4-1":
      "Regain into an 8 or the 9. Loss: the four drops as a unit in one decision.",
    "5-3-2":
      "The five is already recovered. Regain is a mid-to-striker counter. Do not treat every regain as a slow build.",
    "2-3-1": "The restart is a rehearsal of the next 3 seconds: pass to a friend, or get behind the ball.",
    "3-2-1": "First pass or recover. Two pictures, lots of reps.",
    "3-2-3": "Regain wide or into the free mid. Loss: two mids get behind the ball.",
    "2-3-2-1": "Regain into an 8 or a 10 who stayed high. Loss: 6 screens.",
    "3-3-2": "Regain into the runner 9. Loss: helper plus backs.",
  },
  ROCKLIN_FC: {
    "4-3-3":
      "Advance through the thirds with the 6 as helper and 7/11 for width. On loss, steal it back; if not, compact with the 6 and nearest 8. On regain, counter if the 9 or a winger is on.",
    "4-2-3-1":
      "Advance with a free pivot and a 10 in the hole. Steal it back with the screen intact. Counter into the 10 or 9 if it is on.",
    "4-4-2":
      "Advance along the four into a striker. Compact two banks if the steal fails. Counter with the runner 9.",
    "3-5-2":
      "Advance with wing-back width and two strikers. Steal or compact to a five. Counter into a 9 or far wing-back.",
    "4-1-4-1":
      "Advance with the 6 and a flat four. Steal or compact as a four. Counter into the 9.",
    "5-3-2":
      "Advance into a mid then a striker. The five is compact if the steal fails. Counter if a 9 is on.",
    "2-3-1": "Advance: friend, then wide or the 9. Steal it back or get behind the ball.",
    "3-2-1": "Advance to a mid, then the 9. Compact three backs if you cannot steal.",
    "3-2-3": "Advance through a mid into the front three. Steal or compact the two mids.",
    "2-3-2-1": "Advance 6 → 8 → hole. Steal with the 6 at home.",
    "3-3-2": "Advance into a showing 9. Steal or compact the three mids.",
  },
  COACHAI: {
    "4-3-3":
      "Mix a safe 6 with a line-break into an 8 or wide. Do not live only in sterile keeping or a first-time ball into the 9.",
    "4-2-3-1":
      "Safe pivot and a 10 hole when the picture is on. Both answers in the same shape.",
    "4-4-2":
      "Safe pass along the four, then a striker when it is on. Keep the short team either way.",
    "3-5-2":
      "Safe helper in front of the three, then a striker or wing-back when it is on.",
    "4-1-4-1":
      "Safe 6, then an 8 or wide mid. The 9 when the picture is on.",
    "5-3-2":
      "Safe five, then a mid, then a striker. No forced diagonal as the only idea.",
    "2-3-1": "Safe friend. Wide or 9 when it is on. Still 7v7.",
    "3-2-1": "Safe side back. Free mid. 9 when it is on.",
    "3-2-3": "Safe mid. Front three when it is on.",
    "2-3-2-1": "Safe 6. 8. Hole when it is on.",
    "3-3-2": "Safe helper. Showing 9 when it is on; other 9 stays.",
  },
};

export function shapeProfile(shape: PlayOutShape): ShapeProfile {
  return SHAPE_PROFILES[shape];
}

export function gameModelStyle(gameModelId?: string | null): GameModelStyle {
  const id = String(gameModelId || "COACHAI").toUpperCase();
  return GAME_MODEL_STYLES[id] || GAME_MODEL_STYLES.COACHAI;
}

export function howModelUsesShape(
  gameModelId: string | null | undefined,
  shape: PlayOutShape
): string | null {
  const id = String(gameModelId || "COACHAI").toUpperCase();
  const table = MODEL_ON_SHAPE[id] || MODEL_ON_SHAPE.COACHAI;
  return table?.[shape] || MODEL_ON_SHAPE.COACHAI?.[shape] || null;
}

export function gameModelMomentForTopic(
  topic: PrincipleTopic
): "attacking" | "loss" | "defending" | "regain" | "all" {
  if (topic === "attacking_combo" || topic === "play_out") return "attacking";
  if (topic === "defensive_transition") return "loss";
  if (topic === "press") return "defending";
  if (topic === "attacking_transition") return "regain";
  return "all";
}

const MODEL_ON_COMBO: Partial<Record<string, Partial<Record<PlayOutShape, string>>>> = {
  ROCKLIN_FC: {
    "4-3-3":
      "In this 4-3-3 combination: advance through their third on 6 → 8/10 → 9 → 11. Height is the 9, width is 7 and 11, depth is the 6. Break the last line with the 9’s layoff or the 11’s arrival — at an age-honest intensity.",
  },
  POSSESSION: {
    "4-3-3":
      "Circulate only enough to free the 6. Then the combination: 8/10 between the lines, 9, 11. Do not sterile-keep instead of playing the path.",
  },
  PRESSING: {
    "4-3-3":
      "Play the path with purpose. 6 into 8/10, 9, 11. Prefer the forward combination when it is on — this is attacking play, not a press cue.",
  },
  TRANSITION: {
    "4-3-3":
      "Body open on the 6 and 8/10 so the combination can go forward in one action: 9, then 11.",
  },
  COACHAI: {
    "4-3-3":
      "Safe receive on 8/10, then the line-break into 9 and 11. Mix security and penetration on this path only.",
  },
};

export function howModelUsesTopic(
  gameModelId: string | null | undefined,
  shape: PlayOutShape,
  topic: PrincipleTopic
): string | null {
  if (topic === "attacking_combo") {
    const id = String(gameModelId || "COACHAI").toUpperCase();
    return (
      MODEL_ON_COMBO[id]?.[shape] ||
      MODEL_ON_COMBO.COACHAI?.[shape] ||
      `In this ${shape}: stay on the attacking combination on the live shirts. Height, width, and the named path — not a loss, not a press, not a goal-kick play-out.`
    );
  }
  return howModelUsesShape(gameModelId, shape);
}

export function gameModelTitleForTopic(
  model: GameModelStyle,
  topic: PrincipleTopic
): string {
  const moment = gameModelMomentForTopic(topic);
  if (moment === "attacking") {
    const first = model.attacking.split(". ")[0];
    return first.endsWith(".") ? first : `${first}.`;
  }
  if (moment === "loss") return model.loss.split(". ")[0] + ".";
  if (moment === "defending") return model.defending.split(". ")[0] + ".";
  if (moment === "regain") return model.regain.split(". ")[0] + ".";
  return model.summary;
}

export const AGE_DEVELOPMENT: Record<string, AgeDevelopment> = {
  "U8–U10": {
    format: "7v7",
    headline: "Concrete, one job, lots of ball",
    body:
      "This age thinks in pictures they can see, not systems. Attention is short. Coordination is still arriving. The game is 7v7 so every child can have a friend and a bit of space. Play-out means: the goalkeeper finds a teammate. Fun is not a garnish — it is how they learn. Language is ordinary: helper, next pass, stay wide. They cannot hold rest defence, pressing triggers, or three cues at once.",
    canDo: [
      "Receive and pass with time on the ball",
      "One job per shirt, one picture per session",
      "Replay the same restart until the first pass is not a boot",
      "Stay wide so the middle is not a crowd",
    ],
    notYet: [
      "1–2 touch lock or timed technical windows",
      "Named rest defence, cover shadow, or third-man",
      "11v11 jobs, false nine, inverted wingers",
      "Two opposing instructions at the same time",
    ],
  },
  "U11–U12": {
    format: "9v9",
    headline: "Scan, still one job, still generous time",
    body:
      "9v9 is the first time a midfield feels like a midfield. They can begin to scan before the ball arrives. Abstract tactics are still thin. They can hold a second picture if you sequence it (first this, then that) — not if you stack it. Still beginner–intermediate: scan, receive, pass. No 1–2 touch lock. Helpers in midfield; wingers stay wide.",
    canDo: [
      "Scan, then receive, then pass",
      "If they jump one helper, play the other",
      "Three or four arrows on one picture",
      "A little more running without losing the job",
    ],
    notYet: [
      "Rest-defence lectures or cover-shadow stacking",
      "1–2 touch as a default constraint",
      "Assuming 11v11 4-3-3 jobs on a 9v9 board",
      "Three concepts in one restart",
    ],
  },
  U13: {
    format: "11v11",
    headline: "First full pitch — one picture, ordinary words",
    body:
      "U13 is the first full 11v11 year. The pitch is suddenly huge, fatigue is real, and shirts have adult names. Demand stays beginner–intermediate: scan, receive, pass, generous time. Bounce is ‘the next pass,’ not rest defence. One picture, three or four arrows, one caption. Stop and replay the same restart. Do not say overload, half-space, third-man, or pressing trigger unless you immediately show it in a sentence they already know.",
    canDo: [
      "One job per shirt on a full field",
      "Helper, next pass, stay wide — with 11 players",
      "If they jump the first helper, play the designed next pass",
      "Replay a goal kick until the picture is obvious",
    ],
    notYet: [
      "1–2 touch lock",
      "Rest defence as the main teaching point",
      "Sequence filmstrips with three phases in one go",
      "False nine / inverted winger as the first session",
    ],
  },
  "U14–U15": {
    format: "11v11",
    headline: "Courage to receive — one named concept",
    body:
      "Early 11v11 with more speed and more social fear of the tight ball. Intermediate: scan plus a support angle. Name one idea (support angle, bounce, or switch) and explain it in the next sentence. Time on the ball first — especially if the group skips the 6 because it feels tight. Reward the receive. Coach the picture, not the duel. Do not stack rest defence and cover shadow and a third-man in the same cue. Light combined reads only.",
    canDo: [
      "One named concept, shown and repeated",
      "Support angle: body open, open side of the press",
      "Bounce into the free player when the first helper is jumped",
      "Replay until the next pass is obvious",
    ],
    notYet: [
      "1–2 touch as a default",
      "Rest-defence / cover-shadow stacking",
      "Three constraints in one activity",
      "Game-realistic time/space as the first demand of the session",
    ],
  },
  "U16–U18": {
    format: "11v11",
    headline: "Game-realistic pressure — several reads at once",
    body:
      "This is when time and space shrink toward the adult game. Advanced: rest defence and bounce are expected. Play-out shapes the next press. Name the coalition (GK–CB–pivot–8), not only the ball-carrier. Filmstrip: start, then the play. Compress time. They can hold a rest-defence lock and a bounce and a first action after loss in the same session if you sequence the pictures — start, then the play — not as one shouted paragraph.",
    canDo: [
      "Tight time/space with a designed bounce",
      "Rest defence as part of play-out, not an afterthought",
      "Press or drop named in 3–6 seconds",
      "Sequence frames: restart, then the next action",
    ],
    notYet: [
      "Dumping three new systems in one week",
      "Changing attacking shape unless the coach names it",
      "Treating every regain as sterile circulation",
      "Leaving the holder as the only rest-defence player while both 8s have gone",
    ],
  },
};

export const AGE_SHAPE_EXPECT: Record<string, Partial<Record<PlayOutShape, string>>> = {
  "U8–U10": {
    "2-3-1":
      "Expect a messy first pass and a crowd in the middle. Success is the GK finding the 6 or a back, and a wide player staying wide. If they run at the 6, playing wide once is a win. Do not grade rest defence.",
    "3-2-1":
      "Expect the middle back to wander. Success is GK to a side back, two mids not both arriving on the same ball, 9 staying high. If they jump one mid, the other showing once is the session.",
  },
  "U11–U12": {
    "3-2-3":
      "Expect wingers to drop because the pitch feels big. Success is two mids as helpers and a front three that stays a front three. If they jump a mid, the next pass is the other mid or a wide player.",
    "2-3-2-1":
      "Expect the 10s to come get the first pass. Success is the 6 as helper and the 10s staying higher. The bounce into an 8 is the stretch goal, not the warm-up.",
    "3-3-2":
      "Expect both 9s to come to the ball. Success is one showing and one staying high, with a helper in midfield.",
  },
  U13: {
    "4-3-3":
      "Expect the 6 to hide and the wingers to drop. Success is a split back four, a 6 in front of the GK, 7 and 11 on the touchline, 9 as a target. Bounce into an 8 is the week’s extra — not rest defence.",
    "4-2-3-1":
      "Expect both holders to run or the 10 to drop onto the GK. Success is one shows / one stays, 10 in the hole, 9 pinning. Two holders as a second helper is the whole U13 idea.",
    "4-4-2":
      "Expect the two fours to split and both 9s to come short. Success is a short team, a pair of 8s, one 9 showing and one high.",
    "3-5-2":
      "Expect wing-backs to start as full-backs and never go, or both to fly. Success is a back three, width from wing-backs, two strikers with one showing.",
    "4-1-4-1":
      "Expect the 6 to be skipped and wide mids to become wingers. Success is a 6 as helper, a flat four, one 9. Do not invent a 10.",
    "5-3-2":
      "Expect a back five that never plays forward. Success is a side centre-back or mid as the first pass, then a striker. Wing-backs give sides without emptying the five.",
  },
  "U14–U15": {
    "4-3-3":
      "Expect them to skip the 6 because it feels tight. Reward the receive. Name support angle. Bounce into the 8 is the next picture, not the same cue. Time on the ball. No rest-defence as the main point.",
    "4-2-3-1":
      "Expect the 10 to come get it. Name bounce: if they jump one holder, the other is the pass. Keep the 10 in the pocket. Courage to receive between the two holders.",
    "4-4-2":
      "Expect a funnel in the middle. Name the nearer 8 as the support angle. One wide mid stays wide. Replay until the free 8 is obvious.",
    "3-5-2":
      "Expect wing-backs to drop into a five on the first pass. Name the middle centre-back or holder as the first helper. Reward the receive in front of the three.",
    "4-1-4-1":
      "Expect a missing 10 they will try to invent. Stay on the 6 as support angle. Bounce into an 8. Wide mids hold width.",
    "5-3-2":
      "Expect no one to show in front of the five. Name the nearer mid. Time on the ball. One 9 shows, one pins.",
  },
  "U16–U18": {
    "4-3-3":
      "Expect adult press on the 6. Bounce into the 8 is mandatory when jumped — not back to GK. Rest defence is 6 plus nearest 8. Sequence: restart, then the play. False nine only after the first line is beaten.",
    "4-2-3-1":
      "Expect both pivots to step. One never both join the first attack. Bounce into the second pivot is designed. 10 in the pocket. Rest screen stays.",
    "4-4-2":
      "Expect distances to stretch past 25m. Short team is the lock. Bounce into the other 8. Rest is the two 8s plus nearest full-back. Target and runner after the bounce.",
    "3-5-2":
      "Expect a 3v5 if wing-backs do not recover. Libero/holder as sluice. On loss the rest picture can become a five — still this team’s 3-5-2 unless the coach changes shape.",
    "4-1-4-1":
      "Expect the 6 to be isolated. Bounce into an 8. Rest is 6 plus nearest 8. Do not invent a 10. Wide mids tuck only after the first line is beaten.",
    "5-3-2":
      "Expect a parked five that never plays. Bounce into the free mid. The five is already rest defence. First forward pass after the bounce is a striker or far wing-back.",
  },
};

export function developmentForAge(age: string): AgeDevelopment | null {
  return AGE_DEVELOPMENT[age] || null;
}

export function ageExpectForShape(age: string, shape: PlayOutShape): string | null {
  return AGE_SHAPE_EXPECT[age]?.[shape] || null;
}
