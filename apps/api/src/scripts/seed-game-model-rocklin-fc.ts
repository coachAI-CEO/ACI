/**
 * Seed the structured Principle/Subprinciple hierarchy for Rocklin FC, from
 * docs/game-models/rocklin-fc.md (kept in sync by hand -- this is pilot seed
 * data for one club, not a markdown parser).
 *
 * Usage (from apps/api):
 *   pnpm seed:game-model-rocklin-fc
 *   pnpm seed:game-model-rocklin-fc -- --apply
 *
 * Dry-run (default): prints planned writes, no commits.
 * Re-running with --apply REPLACES this club's existing Principle rows
 * (cascade-deletes their Subprinciples) before recreating them -- this
 * script is the authoritative source for Rocklin FC's seed content, not a
 * merge/upsert. Don't hand-edit principles in the DB and expect them to
 * survive a re-run; edit docs/game-models/rocklin-fc.md and re-seed instead.
 */
import path from "path";
import { config as loadEnv } from "dotenv";
import { GameModelMoment, PrismaClient, SubprincipleReadiness } from "@prisma/client";

const rootEnv = path.resolve(process.cwd(), "../../.env");
const localEnv = path.resolve(process.cwd(), ".env");
loadEnv({ path: rootEnv });
loadEnv({ path: localEnv });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing. Load from repo-root .env or apps/api/.env before running.");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const CLUB_NAME = "Rocklin FC";

type SubprincipleSpec = {
  trigger: string;
  response: string;
  antiPattern?: string;
  // Draft tagging -- flag anything wrong, this is a first pass, not your call to inherit.
  readiness: SubprincipleReadiness;
};
type PrincipleSpec = { statement: string; subprinciples: SubprincipleSpec[] };
type MomentSpec = { moment: GameModelMoment; principles: PrincipleSpec[] };

// Mirrors docs/game-models/rocklin-fc.md exactly. Keep them in sync by hand.
const MOMENTS: MomentSpec[] = [
  {
    moment: GameModelMoment.ATTACKING_ORGANIZATION,
    principles: [
      {
        statement: "Create attacking team shape to stretch the opponent across height, width, and depth.",
        subprinciples: [
          {
            trigger: "Goalkeeper or center-backs secure controlled possession in the defensive third/build-up phase.",
            response:
              "Center-backs split to create depth, fullbacks push wide to the touchlines, and central midfielders stagger at varied vertical depths to form passing triangles.",
            antiPattern:
              "Positioning flat across lines or clustering toward the ball carrier without offering vertical release options.",
            readiness: SubprincipleReadiness.FOUNDATIONAL,
          },
          {
            trigger: "Opponent clogs central channels and blocks direct vertical penetration.",
            response:
              "Circulate possession across the back line to shift the opposing block, draw pressure, and switch play rapidly to isolate wide 2v1 or 1v1 overloads.",
            antiPattern: "Forcing low-percentage central passes into congested lanes without shifting the defensive block.",
            readiness: SubprincipleReadiness.DEVELOPING,
          },
        ],
      },
      {
        statement: "Attack with intensity in the final third and break lines with purposeful movement.",
        subprinciples: [
          {
            trigger: "Ball reaches the attacking third with wide isolation or numerical advantage (2v1/3v2).",
            response:
              "Wide players aggressively take space by dribbling or combining via overlaps/underlaps to deliver driven cutbacks or crosses into designated box zones.",
            antiPattern: "Slowing down the play to let the opponent recover numbers and organize their low block.",
            readiness: SubprincipleReadiness.DEVELOPING,
          },
          {
            trigger: "Central midfielder faces forward between lines with space ahead.",
            response:
              "Forwards make dynamic, coordinated runs behind the defensive line while supporting midfielders crash the box edge for second balls and cutbacks; take open shooting lanes immediately.",
            antiPattern: "Over-passing inside the 18-yard box instead of pulling the trigger when a clear shooting lane opens.",
            readiness: SubprincipleReadiness.ADVANCED,
          },
        ],
      },
      {
        statement: "Manipulate the opponent's defensive shape through rotational positioning in central areas.",
        subprinciples: [
          {
            trigger: "Opponent's holding midfielder tracks our #6 tightly, congesting the central passing lane.",
            response:
              "Our #6 and the near-side #8 rotate positions -- the #8 drops to receive between the lines while the #6 pushes forward, dragging the marker out of position and opening the lane.",
            antiPattern: "Both midfielders occupying the same central channel simultaneously, clogging the lane instead of rotating through it.",
            readiness: SubprincipleReadiness.ADVANCED,
          },
          {
            trigger: "Opponent sets a low, compact block with no clear passing lanes through the middle or wide overloads available.",
            response:
              "Fullback inverts into a central midfield position temporarily, overloading the double pivot and forcing one of the opponent's midfielders to step out of the block to follow, creating the gap he just vacated.",
            antiPattern: "Forcing the same wide combination repeatedly against a well-set block instead of changing the picture with a rotation.",
            readiness: SubprincipleReadiness.ADVANCED,
          },
        ],
      },
    ],
  },
  {
    moment: GameModelMoment.DEFENSIVE_TRANSITION,
    principles: [
      {
        statement: "Hunt the ball immediately upon turnover to disrupt counter-attacks.",
        subprinciples: [
          {
            trigger: "Possession is lost in the middle or attacking third.",
            response:
              "The nearest 2-3 players immediately sprint to swarm the ball carrier, while surrounding teammates step up to intercept first-phase outlet passes.",
            antiPattern: "Hesitating, turning away to gesture, or retreating immediately without challenging the initial carrier.",
            readiness: SubprincipleReadiness.FOUNDATIONAL,
          },
          {
            trigger: "Opponent ball carrier turns toward the sideline under heavy pressure.",
            response: "Lock the opponent against the touchline, eliminate the backward escape pass, and execute an aggressive double-team tackle.",
            antiPattern: "Over-committing centrally and opening up an easy diagonal switch of play.",
            readiness: SubprincipleReadiness.DEVELOPING,
          },
        ],
      },
      {
        statement: "Maintain rest defense structure and recover broken pressure.",
        subprinciples: [
          {
            trigger: "The team is progressing forward in the attacking third (anticipate loss).",
            response: "Rest-defense defenders push up to the halfway line, locking the opponent's strikers and anticipating direct clearances.",
            antiPattern: "Remaining deep near our own penalty box while the rest of the team attacks, leaving a massive vertical gap.",
            readiness: SubprincipleReadiness.ADVANCED,
          },
          {
            trigger: "Opponent bypasses the initial counterpress with a controlled forward pass.",
            response:
              "Nearest recovery defender closes down to delay forward momentum while the remaining outfielders sprint centrally to establish defensive compactness.",
            antiPattern: "Diving into reckless recovery challenges from behind, giving away dangerous transitional fouls or getting bypassed.",
            readiness: SubprincipleReadiness.DEVELOPING,
          },
        ],
      },
      {
        statement: "Recognize when counterpressing isn't available and transition into organized recovery instead.",
        subprinciples: [
          {
            trigger: "Possession is lost with 3+ opponents already positioned between the ball and our own goal.",
            response:
              "Nearest player delays/jockeys the ball carrier without diving in, while the rest of the team sprints to reform a compact defensive shape rather than committing to the press.",
            antiPattern: "The nearest defender diving in recklessly to counterpress anyway, getting bypassed and leaving the whole team exposed in a bad transition moment.",
            readiness: SubprincipleReadiness.ADVANCED,
          },
          {
            trigger: "The ball is lost in our own defensive third with numbers already stretched forward.",
            response:
              "The deepest available defender immediately identifies and communicates the most dangerous space to protect (usually central), directing recovery runs there before chasing the ball.",
            antiPattern: "Players randomly sprinting toward the ball itself rather than to the dangerous space, leaving the middle exposed for the killer pass.",
            readiness: SubprincipleReadiness.ADVANCED,
          },
        ],
      },
    ],
  },
  {
    moment: GameModelMoment.DEFENSIVE_ORGANIZATION,
    principles: [
      {
        statement: "Establish a compact defensive block and build coordinated pressure to make opponent play predictable.",
        subprinciples: [
          {
            trigger: "Opponent initiates backline build-up without direct forward pressure.",
            response:
              "Front line curves runs to channel the opponent wide into a trap; midfield and defensive lines shift horizontally to maintain tight spacing between lines.",
            antiPattern: "Pressing individually as a lone forward while the midfield line remains static.",
            readiness: SubprincipleReadiness.DEVELOPING,
          },
          {
            trigger: "Opponent plays a loose lateral pass, miscontrols the ball, or plays backward.",
            response: "Entire team steps up as a single unit, compresses space, and actively challenges to intercept the next pass or contest the second ball.",
            antiPattern: "Dropping off during backward opponent passes, conceding easy field position.",
            readiness: SubprincipleReadiness.FOUNDATIONAL,
          },
        ],
      },
      {
        statement: "Deny penetration in the defensive third and protect the box.",
        subprinciples: [
          {
            trigger: "Opponent enters the final third centrally.",
            response:
              "Collapse centrally to deny through-balls; center-backs and midfielders communicate, track blindside runners, and step decisively to block shots.",
            antiPattern: "Turning sideways or backing into the goalkeeper's lap without stepping to contest the shooter.",
            readiness: SubprincipleReadiness.DEVELOPING,
          },
          {
            trigger: "Opponent isolates on the flank preparing to deliver a cross.",
            response:
              "Outside back closes down the angle to block or force a negative pass; central defenders take goal-side/ball-side position to clear across the width of the goal.",
            antiPattern: "Ball-watching and letting opposing runners attack the blind back post unattended.",
            readiness: SubprincipleReadiness.FOUNDATIONAL,
          },
        ],
      },
      {
        statement: "Coordinate a synchronized backline to control the timing of opponent runs in behind.",
        subprinciples: [
          {
            trigger: "Opponent forward times a run in behind with a through-ball attempt, played from outside the defensive line's peripheral vision.",
            response:
              "The entire back line steps up in one synchronized movement the instant the ball is struck, using the furthest defender from the ball as the reference point to hold the line and catch the run offside.",
            antiPattern: "One defender stepping early or late while others hold -- a single mistimed step breaks the trap for the whole line.",
            readiness: SubprincipleReadiness.ADVANCED,
          },
          {
            trigger: "Opponent runner breaks beyond the back line before the pass is actually played (early movement, no ball threat yet).",
            response: "Defenders hold their line and refuse to react to the runner alone -- the trigger is the pass being struck, not the run starting.",
            antiPattern: "Reacting to the run itself and stepping too early, gifting a soft onside position before the passer has committed.",
            readiness: SubprincipleReadiness.ADVANCED,
          },
        ],
      },
    ],
  },
  {
    moment: GameModelMoment.ATTACKING_TRANSITION,
    principles: [
      {
        statement: "Exploit disorganized opponent shape with direct forward momentum and early passes.",
        subprinciples: [
          {
            trigger: "Ball is won cleanly with open space behind the opponent's back line.",
            response:
              "First pass is played forward immediately into the path of breaking attackers; supporting midfielders sprint ahead to create 2v1 and 3v2 overloads.",
            antiPattern: "Taking unnecessary lateral or backward touches when a direct line to goal is open.",
            readiness: SubprincipleReadiness.FOUNDATIONAL,
          },
          {
            trigger: "Ball winner is pressured instantly after the turnover but has an open weak-side teammate.",
            response: "Play a rapid, one-touch switch pass into space on the opposite side to bypass the opponent's counterpress.",
            antiPattern: "Dribbling into congested central traffic inside our defensive third.",
            readiness: SubprincipleReadiness.ADVANCED,
          },
        ],
      },
      {
        statement: "Secure the escape pass and expand into team attacking shape when a counter is unavailable.",
        subprinciples: [
          {
            trigger: "Ball is won in a crowded area with no vertical options available.",
            response: "Ball winner shields and connects a clean negative or sideways pass to a center-back or goalkeeper to reset play.",
            antiPattern: "Forcing an impossible forward pass into a stacked opposing defensive line.",
            readiness: SubprincipleReadiness.FOUNDATIONAL,
          },
          {
            trigger: "Escape pass is completed and pressure is relieved.",
            response: "Team rapidly expands into maximum height and width, moving into open passing angles to re-enter the attacking organization phase.",
            antiPattern: "Remaining narrow and compressed, inviting secondary opponent pressure.",
            readiness: SubprincipleReadiness.DEVELOPING,
          },
        ],
      },
      {
        statement: "Recognize when the counter isn't on and shift into controlled possession without losing tempo.",
        subprinciples: [
          {
            trigger: "Ball won with numbers even or unfavorable in transition (no clear overload ahead).",
            response:
              "Nearest players secure short, safe options first to retain the ball, using one or two quick combinations to draw the opponent's recovering shape before committing forward.",
            antiPattern: "Forcing a low-percentage forward pass into a numbers-even picture just because the ball was won cleanly, gifting possession straight back.",
            readiness: SubprincipleReadiness.ADVANCED,
          },
          {
            trigger: "A single defender is goal-side and recovering at pace against our ball carrier in transition, with no support arriving in time.",
            response: "Ball carrier changes the angle of the run or delays the release by half a second to let a support option arrive, rather than forcing a 1v1 they don't need to take alone.",
            antiPattern: "Attempting a hero 1v1 dribble against a recovering defender when a simple support pass keeps the move alive with better odds.",
            readiness: SubprincipleReadiness.ADVANCED,
          },
        ],
      },
    ],
  },
];

const prisma = new PrismaClient();

async function main() {
  console.log(`[seed-game-model-rocklin-fc] mode=${APPLY ? "APPLY" : "DRY-RUN"}`);

  const club = await prisma.club.findFirst({
    where: { name: { equals: CLUB_NAME, mode: "insensitive" } },
    select: { id: true, name: true },
  });

  if (!club) {
    console.error(`Club "${CLUB_NAME}" not found. Run the club membership backfill first.`);
    process.exit(1);
  }

  console.log(`Club: ${club.name} (${club.id})`);

  const existingCount = await prisma.principle.count({ where: { clubId: club.id } });
  const totalSubprinciples = MOMENTS.reduce((sum, m) => sum + m.principles.reduce((s, p) => s + p.subprinciples.length, 0), 0);
  const totalPrinciples = MOMENTS.reduce((sum, m) => sum + m.principles.length, 0);

  console.log(
    `  ${existingCount > 0 ? `REPLACE ${existingCount} existing principle(s)` : "CREATE"} with ${totalPrinciples} principles / ${totalSubprinciples} subprinciples across ${MOMENTS.length} moments`
  );

  if (!APPLY) {
    for (const m of MOMENTS) {
      console.log(`  WOULD WRITE moment=${m.moment}: ${m.principles.length} principles`);
    }
    console.log("Dry run complete. Re-run with --apply to write.");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
    // Cascade-deletes Subprinciples via the FK's onDelete: Cascade.
    await tx.principle.deleteMany({ where: { clubId: club.id } });

    for (const m of MOMENTS) {
      for (let pi = 0; pi < m.principles.length; pi++) {
        const p = m.principles[pi];
        await tx.principle.create({
          data: {
            clubId: club.id,
            moment: m.moment,
            statement: p.statement,
            order: pi,
            subprinciples: {
              create: p.subprinciples.map((s, si) => ({
                trigger: s.trigger,
                response: s.response,
                antiPattern: s.antiPattern ?? null,
                readiness: s.readiness,
                order: si,
              })),
            },
          },
        });
      }
    }
    },
    { timeout: 20000 }
  );

  console.log(`Applied: ${totalPrinciples} principles / ${totalSubprinciples} subprinciples written for ${club.name}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
