import { GameModelId } from '@prisma/client';
import { prisma } from '../prisma';
import type { ClubPhilosophyStages } from './club-philosophy';
import { philosophyHasContent } from './club-philosophy';

export type GameModelTemplateRecord = {
  gameModelId: GameModelId;
  label: string;
  summary: string | null;
  exclusive: boolean;
  philosophy: ClubPhilosophyStages;
  updatedAt: Date;
  updatedBy: string | null;
  filledStages: number;
};

const DEFAULT_TEMPLATES: Array<{
  gameModelId: GameModelId;
  label: string;
  summary: string;
  exclusive: boolean;
  attackingOrganization: string;
  defensiveTransition: string;
  defensiveOrganization: string;
  attackingTransition: string;
}> = [
  {
    gameModelId: 'POSSESSION',
    label: 'Possession',
    summary: 'Ball security, support angles, and controlled progression through the thirds.',
    exclusive: false,
    attackingOrganization:
      'In possession we prioritise ball security and positional support to progress with control. Create height, width, and depth so the ball-carrier always has a safe option and a line-breaking option. Receive open, scan early, and circulate to move the opponent before penetrating with a pass or dribble. Use overloads and third-man combinations to break pressure; switch the point of attack when one side locks. In the final third, keep patience under pressure — create 2v1s, cutbacks, and quality entries rather than forced speculative balls.',
    defensiveTransition:
      'On ball loss, the nearest players apply an immediate organised counterpress for 3–5 seconds to win it back or force a negative touch. If the ball is not won, the rest of the unit recovers compact distances quickly and denies central progression while we reorganise.',
    defensiveOrganization:
      'Out of possession we stay compact vertically and horizontally, protect the centre, and force play into predictable wide areas. Pressure–cover–balance stays organised: the first defender engages on a trigger, the second covers the lane, and the rest balance space in behind. Deny switches when possible and compete for second balls after blocks or clearances.',
    attackingTransition:
      'On regain, take the first forward option if the opponent is disorganised. If the forward lane is closed, secure the ball with a simple pass, expand shape immediately, and restart controlled progression without inviting a second loss.',
  },
  {
    gameModelId: 'PRESSING',
    label: 'Pressing',
    summary: 'Coordinated regains via triggers, compactness, and aggressive lock-side pressure.',
    exclusive: false,
    attackingOrganization:
      'In possession we prepare the next press as we attack: progress with purpose, keep rest-defence distances short, and avoid sterile circulation that leaves us exposed on loss. Prefer vertical options when on, and secure enough to set traps if not. Final-third play should finish quickly when the press has already forced chaos higher up.',
    defensiveTransition:
      'On loss, hunt immediately. Nearest players jump on clear triggers (poor touch, back pass, sideways under pressure) within a 3–5 second window. Lock the strong side, cut the inside lane, and force the predictable exit. If the counterpress fails, sprint recover into a compact block — never jog into a broken shape.',
    defensiveOrganization:
      'Out of possession the default is coordinated high or mid-block pressing with clear triggers and roles. Stay compact, jump together, and keep cover behind the first presser. Force play one way, prevent switches, and protect space in behind. When broken, delay, re-compact, and reset the next press rather than chasing individually.',
    attackingTransition:
      'On regain from the press, attack the open space immediately — first look forward to exploit the disorganised opponent. If numbers are not there, secure and play the next vertical action within one or two passes so the press advantage is not wasted.',
  },
  {
    gameModelId: 'TRANSITION',
    label: 'Transition',
    summary: 'First actions after regain/loss in short windows — speed of decision over settled play.',
    exclusive: false,
    attackingOrganization:
      'In settled possession we still train transition readiness: rest-defence, body orientation to play forward, and support that can become a counter line in one action. Keep enough security to survive a loss, but bias decisions toward preparing the next 3–6 second moment rather than endless patient phases.',
    defensiveTransition:
      'On ball loss, the first action is decisive within 3–6 seconds: counterpress to regain or foul the rhythm, otherwise recover at sprint speed into compact distances. Communication must name the choice early — “press” or “drop” — so the unit does not split.',
    defensiveOrganization:
      'Out of possession we organise to create transition opportunities: compact block, denied centre, and triggers that force hurried decisions. When we cannot press high, we stay connected so a regain can instantly become a forward attack rather than a slow build under no pressure.',
    attackingTransition:
      'On regain, prioritise the first forward pass, run, or dribble while the opponent is disorganised. If the counter is not on within the first action, secure and expand quickly, then take the next penetration before the opponent resets into a block.',
  },
  {
    gameModelId: 'COACHAI',
    label: 'Balanced (CoachAI)',
    summary: 'Flexible balanced model — adaptable sessions across possession, pressing, and transition moments.',
    exclusive: false,
    attackingOrganization:
      'In possession we balance security and penetration. Build with support angles and clear height/width/depth, then break lines when the picture is on. Mix circulation to move the opponent with purposeful forward actions — do not live only in one extreme of sterile keeping or forced directness.',
    defensiveTransition:
      'On loss, react in a short window: counterpress when numbers and cues are right; otherwise recover compact and deny the centre. The team must share one decision so we neither overcommit nor passively concede space.',
    defensiveOrganization:
      'Out of possession we organise with pressure–cover–balance, remain compact, and force predictable play. Adapt block height to the session focus while always protecting space in behind and staying ready to jump on clear triggers.',
    attackingTransition:
      'On regain, choose quickly: attack forward if advantage exists, or secure and expand if not. Sessions should regularly rehearse both answers so players recognise the picture without hesitation.',
  },
  {
    gameModelId: 'ROCKLIN_FC',
    label: 'Rocklin FC',
    summary: 'Club-exclusive vertical-possession identity with immediate regain intent.',
    exclusive: true,
    attackingOrganization:
      'In possession we want to advance the ball to the attacking third through passing, dribbling, and movement off the ball to create chances and score goals. Principles include creating attacking team shape with height, width, and depth where players find optimal space in relation to each other. We use movement off the ball to create attacking options through forward runs behind defending lines, movement away from defenders, supporting the player on the ball under pressure, and creating overloads. We advance the ball based on defensive shape and pressure by breaking lines with passes or dribbles, creating 2v1 and 3v2 numerical advantages, switching the field, and taking space. In the attacking third, we play with high intensity utilizing through balls, crosses into the box, 1v1 opportunities, and supporting in numbers. Key player actions with the ball include ball control, passing, shooting, dribbling, taking space, shielding, and attacking moves, while off-ball actions involve movement and runs, scanning, adapting body shape, and communication.',
    defensiveTransition:
      'Upon losing possession, we want to immediately steal the ball back or force an error through applying intense pressure. If we cannot win it back immediately, the team will settle into a compact defensive shape. We anticipate losing possession by having defenders push up the field and cover potential attacking threats.',
    defensiveOrganization:
      'When we can\'t have possession, we want to stop the opponent from advancing the ball and creating goal-scoring chances, regaining possession through a compact defensive shape and coordinated pressure. We create defensive team shape by making the team compact vertically and horizontally with optimal distances between players. We build pressure on the ball by moving collectively as a unit to make play predictable, initiating pressure, engaging or stealing when opportunities present, organizing into cover and balance, preventing switches of play, and protecting in behind. If pressure is broken, we instantly reapply pressure, delay the attack, and compete for second balls. To deny the finish, we get narrow to collapse the center, cut off through balls, mark and track opponents, deny crosses to force negative passes, and challenge to prevent attempts on goal. Key player actions against the ball include intercepting, pressing, challenging, delaying, and blocking, supported by spatial and positional awareness actions like scanning, body shape adjustment, covering, marking, and communicating.',
    attackingTransition:
      'Upon regaining possession, we look to counter-attack quickly to create a goal-scoring chance. If we cannot counter immediately, we look to maintain possession and expand our attacking shape.',
  },
];

function countFilled(philosophy: ClubPhilosophyStages): number {
  return [
    philosophy.attackingOrganization,
    philosophy.defensiveTransition,
    philosophy.defensiveOrganization,
    philosophy.attackingTransition,
  ].filter((v) => Boolean(v && String(v).trim())).length;
}

function mapRow(row: {
  gameModelId: GameModelId;
  label: string;
  summary: string | null;
  exclusive: boolean;
  attackingOrganization: string | null;
  defensiveTransition: string | null;
  defensiveOrganization: string | null;
  attackingTransition: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}): GameModelTemplateRecord {
  const philosophy = {
    attackingOrganization: row.attackingOrganization,
    defensiveTransition: row.defensiveTransition,
    defensiveOrganization: row.defensiveOrganization,
    attackingTransition: row.attackingTransition,
  };
  return {
    gameModelId: row.gameModelId,
    label: row.label,
    summary: row.summary,
    exclusive: row.exclusive,
    philosophy,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
    filledStages: countFilled(philosophy),
  };
}

/** Ensure all five templates exist (idempotent). */
export async function ensureGameModelTemplatesSeeded(): Promise<void> {
  for (const t of DEFAULT_TEMPLATES) {
    await prisma.gameModelTemplate.upsert({
      where: { gameModelId: t.gameModelId },
      create: {
        gameModelId: t.gameModelId,
        label: t.label,
        summary: t.summary,
        exclusive: t.exclusive,
        attackingOrganization: t.attackingOrganization,
        defensiveTransition: t.defensiveTransition,
        defensiveOrganization: t.defensiveOrganization,
        attackingTransition: t.attackingTransition,
      },
      update: {},
    });
  }
}

export async function listGameModelTemplates(): Promise<GameModelTemplateRecord[]> {
  await ensureGameModelTemplatesSeeded();
  const rows = await prisma.gameModelTemplate.findMany({
    orderBy: { gameModelId: 'asc' },
  });
  return rows.map(mapRow);
}

export async function getGameModelTemplate(
  gameModelId: string
): Promise<GameModelTemplateRecord | null> {
  if (!Object.values(GameModelId).includes(gameModelId as GameModelId)) return null;
  await ensureGameModelTemplatesSeeded();
  const row = await prisma.gameModelTemplate.findUnique({
    where: { gameModelId: gameModelId as GameModelId },
  });
  return row ? mapRow(row) : null;
}

export async function getGameModelTemplatePhilosophy(
  gameModelId: string
): Promise<ClubPhilosophyStages | null> {
  const template = await getGameModelTemplate(gameModelId);
  if (!template || !philosophyHasContent(template.philosophy)) return null;
  return template.philosophy;
}

export async function updateGameModelTemplate(
  gameModelId: string,
  patch: Partial<ClubPhilosophyStages> & {
    label?: string;
    summary?: string | null;
  },
  updatedByUserId: string
): Promise<GameModelTemplateRecord | null> {
  if (!Object.values(GameModelId).includes(gameModelId as GameModelId)) {
    throw new Error('Invalid game model');
  }
  await ensureGameModelTemplatesSeeded();

  const clamp = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    if (!text) return null;
    return text.slice(0, 4000);
  };

  const row = await prisma.gameModelTemplate.update({
    where: { gameModelId: gameModelId as GameModelId },
    data: {
      ...(patch.label !== undefined ? { label: String(patch.label).trim().slice(0, 80) } : {}),
      ...(patch.summary !== undefined
        ? { summary: patch.summary === null ? null : String(patch.summary).trim().slice(0, 500) }
        : {}),
      ...(patch.attackingOrganization !== undefined
        ? { attackingOrganization: clamp(patch.attackingOrganization) }
        : {}),
      ...(patch.defensiveTransition !== undefined
        ? { defensiveTransition: clamp(patch.defensiveTransition) }
        : {}),
      ...(patch.defensiveOrganization !== undefined
        ? { defensiveOrganization: clamp(patch.defensiveOrganization) }
        : {}),
      ...(patch.attackingTransition !== undefined
        ? { attackingTransition: clamp(patch.attackingTransition) }
        : {}),
      updatedBy: updatedByUserId,
    },
  });

  return mapRow(row);
}
