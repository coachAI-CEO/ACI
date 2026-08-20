/**
 * Named attacking-combination filmstrip.
 *
 * Geometry is solved here from live shirts + the coach’s path (6 → 8/10 → 9 → 11).
 * License only changes density: D = one slide of straight passes; C = + support run;
 * B+ = one pass per beat, curved arrival, numbered passes, hold + jump on the same path.
 * Not a topic×shape library — the ask is the schema.
 */

import { defaultCurveControl } from './board-lines';
import type { WebDiagramV1 } from './web-diagram-v1';

export type ComboCoachLevel = 'USSF_D' | 'USSF_C' | 'USSF_B_PLUS';

export type ComboSlot = { numbers: number[] };

type Shirt = WebDiagramV1['players'][number];
type Arrow = WebDiagramV1['arrows'][number];
type Frame = NonNullable<WebDiagramV1['sequence']>['frames'][number];

const PASSING_SEQUENCE_ASK =
  /\b(pass(?:ing)? sequence|sequence of pass(?:es)?|passing pattern|create a (?:pass|passing)|pass(?:ing)? from)\b/i;
const FROM_TO_SHIRTS = /\bfrom (?:the )?#?\d+\b/i;
const TO_SHIRT = /\bto (?:the )?#?\d+\b/i;
const CHAIN =
  /\b#?\d+\s*(?:\/\s*#?\d+)?(?:\s*(?:to|then|and then|→|->)\s*(?:the )?#?\d+(?:\s*\/\s*#?\d+)?){1,}/i;
const COMBO_WORD =
  /\b(combination|combo|wall[- ]?pass|third[- ]man|give[- ]and[- ]go|one[- ]two|triangle|pattern)\b/i;
const NOT_COMBO_ACTIVITY =
  /\b(rondo|ssg|high press|mid[- ]?block|low[- ]?block|play(?:ing)?[\s-]?out|goal[- ]?kick|scale.{0,40}11\s*v\s*11)\b/i;

export function isPassingSequenceAsk(raw: string): boolean {
  const m = String(raw || '');
  if (PASSING_SEQUENCE_ASK.test(m)) return true;
  if (FROM_TO_SHIRTS.test(m) && TO_SHIRT.test(m)) return true;
  if (CHAIN.test(m)) return true;
  return false;
}

export function parseComboSlots(raw: string): ComboSlot[] {
  const nums = [...String(raw || '').matchAll(/\b(?:#|the )?(\d{1,2})(?:\s*\/\s*(?:#)?(\d{1,2}))?/gi)];
  const slots: ComboSlot[] = [];
  const seen = new Set<string>();
  for (const x of nums) {
    const a = Number(x[1]);
    const b = x[2] ? Number(x[2]) : null;
    if (!Number.isFinite(a) || a < 1 || a > 99) continue;
    const numbers = b && Number.isFinite(b) && b !== a ? [a, b] : [a];
    const key = numbers.slice().sort((p, q) => p - q).join('/');
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push({ numbers });
  }
  return slots;
}

export function shouldComposeAttackingCombo(message: string): boolean {
  const m = String(message || '');
  if (!m.trim()) return false;
  if (/\b(play(?:ing)?[\s-]?out|playout|goal[-\s]?kick|build[-\s]?up|build(?:ing)?[\s-]?out)\b/i.test(m)) {
    return false;
  }
  if (NOT_COMBO_ACTIVITY.test(m) && !isPassingSequenceAsk(m)) return false;
  const slots = parseComboSlots(m);
  if (slots.length < 2) return false;
  return isPassingSequenceAsk(m) || COMBO_WORD.test(m);
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}

function clonePlayers(players: WebDiagramV1['players']): WebDiagramV1['players'] {
  return (players || []).map((p) => ({ ...p }));
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** ATT attacks toward decreasing y — more advanced = lower y. */
function pickShirt(
  players: WebDiagramV1['players'],
  slot: ComboSlot,
  used: Set<string>,
  toward?: Shirt | null
): Shirt | null {
  const att = players.filter(
    (p) => p.team === 'ATT' && typeof p.number === 'number' && slot.numbers.includes(p.number) && !used.has(p.id)
  );
  const pool = att.length
    ? att
    : players.filter(
        (p) => typeof p.number === 'number' && slot.numbers.includes(p.number) && !used.has(p.id)
      );
  if (!pool.length) return null;
  if (toward) {
    return [...pool].sort((a, b) => dist(a, toward) - dist(b, toward))[0];
  }
  return [...pool].sort((a, b) => a.y - b.y)[0];
}

export function resolveComboChain(
  players: WebDiagramV1['players'],
  slots: ComboSlot[]
): Shirt[] {
  const used = new Set<string>();
  const chain: Shirt[] = [];
  for (let i = 0; i < slots.length; i++) {
    const nextSlot = slots[i + 1];
    const towardHint =
      nextSlot && chain.length
        ? players.find(
            (p) =>
              p.team === 'ATT' &&
              typeof p.number === 'number' &&
              nextSlot.numbers.includes(p.number) &&
              !used.has(p.id)
          ) || null
        : null;
    const shirt = pickShirt(players, slots[i], used, towardHint);
    if (!shirt) continue;
    used.add(shirt.id);
    chain.push(shirt);
  }
  return chain;
}

function passArrow(from: Shirt, to: Shirt, order: number): Arrow {
  return {
    from: { playerId: from.id },
    to: { playerId: to.id },
    type: 'pass',
    style: 'solid',
    weight: 'bold',
    arrowhead: true,
    order,
  };
}

function runArrow(
  from: Shirt,
  to: { x: number; y: number } | Shirt,
  opts: { curved?: boolean; bulge?: number }
): Arrow {
  const landing =
    'id' in to ? { playerId: to.id } : { x: clamp(to.x), y: clamp(to.y) };
  const toPt = 'id' in to ? { x: to.x, y: to.y } : to;
  const control = opts.curved
    ? defaultCurveControl(from, toPt, opts.bulge ?? 0.32)
    : undefined;
  return {
    from: { playerId: from.id },
    to: landing,
    type: 'run',
    style: 'dashed',
    weight: 'normal',
    arrowhead: true,
    ...(control ? { control } : {}),
  };
}

function pressArrow(from: Shirt, to: Shirt): Arrow {
  return {
    from: { playerId: from.id },
    to: { playerId: to.id },
    type: 'press',
    style: 'dashed',
    weight: 'normal',
    arrowhead: true,
  };
}

function findHoldWinger(players: WebDiagramV1['players'], chain: Shirt[]): Shirt | null {
  const used = new Set(chain.map((p) => p.id));
  const last = chain[chain.length - 1];
  if (!last || typeof last.number !== 'number') return null;
  const other = last.number === 11 ? 7 : last.number === 7 ? 11 : null;
  if (!other) return null;
  return (
    players.find((p) => p.team === 'ATT' && p.number === other && !used.has(p.id)) || null
  );
}

function nearestDef(players: WebDiagramV1['players'], target: Shirt): Shirt | null {
  const defs = players.filter((p) => p.team === 'DEF' && p.number !== 1);
  if (!defs.length) return null;
  return [...defs].sort((a, b) => dist(a, target) - dist(b, target))[0];
}

function wingerArrivePoint(winger: Shirt, target: Shirt): { x: number; y: number } {
  const wide = winger.x >= 50 ? 1 : -1;
  return {
    x: clamp(winger.x + wide * 2),
    y: clamp(Math.min(winger.y, target.y) - 8),
  };
}

function holdPoint(winger: Shirt): { x: number; y: number } {
  const wide = winger.x >= 50 ? 1 : -1;
  return { x: clamp(winger.x + wide * 5), y: clamp(winger.y - 2) };
}

function checkToFeet(nine: Shirt, bounce: Shirt): { x: number; y: number } {
  return {
    x: clamp(nine.x * 0.55 + bounce.x * 0.45),
    y: clamp(nine.y * 0.7 + bounce.y * 0.3),
  };
}

function captionSide(chain: Shirt[]): { x: number; y: number } {
  const avgX = chain.reduce((s, p) => s + p.x, 0) / Math.max(chain.length, 1);
  return { x: avgX >= 50 ? 16 : 84, y: 78 };
}

function shirtTag(p: Shirt) {
  return typeof p.number === 'number' ? `#${p.number}` : p.id;
}

function pathLabel(chain: Shirt[]) {
  return chain.map(shirtTag).join(' → ');
}

function captionsFor(
  level: ComboCoachLevel,
  chain: Shirt[],
  beat: 'all' | 'bounce' | 'link' | 'finish'
): string[] {
  const path = pathLabel(chain);
  const a = chain[0] ? shirtTag(chain[0]) : '#6';
  const b = chain[1] ? shirtTag(chain[1]) : 'the next';
  const c = chain[2] ? shirtTag(chain[2]) : 'the 9';
  const d = chain[3] ? shirtTag(chain[3]) : 'the winger';
  if (level === 'USSF_D') {
    return [`${a} passes to ${b}, then ${c}, then ${d}. Same friends, same order.`];
  }
  if (level === 'USSF_C') {
    if (beat === 'bounce') return [`${a} into ${b} between the lines. ${c} stays a target.`];
    if (beat === 'finish') return [`Then ${c} to ${d}. Wide player waits until the ${c} plays.`];
    return [`One path: ${path}. Next pass is obvious. Wide player waits.`];
  }
  if (beat === 'bounce') {
    return [
      `${a} weighted ball into ${b} between the lines. ${c} checks to feet. ${d} stays high and wide — do not start the run yet.`,
    ];
  }
  if (beat === 'link') {
    return [
      `${b} half-turn into ${c}. ${d}’s arrival starts with the ${c}’s first touch — not after they have already turned.`,
    ];
  }
  if (beat === 'finish') {
    return [
      `${c} to feet or layoff — still a target, not a fourth midfielder. ${d} arrives. Weak-side winger holds width.`,
    ];
  }
  return [`Settled attacking combination: ${path}. Sequence the actions. Stay on these shirts.`];
}

function frameOf(
  original: WebDiagramV1,
  chain: Shirt[],
  opts: {
    id: string;
    title: string;
    arrows: Arrow[];
    labels: string[];
    ballOn?: Shirt | null;
    durationMs?: number;
  }
): Frame {
  const anchor = captionSide(chain.length ? chain : (original.players || []).slice(0, 4));
  const ball = opts.ballOn
    ? [{ x: opts.ballOn.x, y: opts.ballOn.y }]
    : original.balls
      ? original.balls.map((b) => ({ ...b }))
      : [];
  return {
    id: opts.id,
    title: opts.title,
    durationMs: opts.durationMs ?? 1600,
    players: clonePlayers(original.players),
    arrows: opts.arrows,
    areas: original.areas ? original.areas.map((a) => ({ ...a })) : [],
    labels: opts.labels.map((text, i) => ({
      text: text.slice(0, 200),
      x: clamp(anchor.x),
      y: clamp(anchor.y + i * 10),
    })),
    balls: ball,
    goals: original.goals,
    coach: original.coach,
    cones: original.cones,
    elements: original.elements,
  };
}

function applyRootFromFrame(original: WebDiagramV1, frame: Frame): WebDiagramV1 {
  return {
    ...original,
    players: frame.players,
    arrows: frame.arrows,
    areas: frame.areas,
    labels: frame.labels,
    balls: frame.balls,
    goals: frame.goals,
    coach: frame.coach,
    cones: frame.cones,
    elements: frame.elements,
    sequence: original.sequence,
  };
}

export function buildComboGrammarGuidance(message: string, coachLevel: ComboCoachLevel): string {
  if (!shouldComposeAttackingCombo(message)) return '';
  const slots = parseComboSlots(message);
  const path = slots.map((s) => s.numbers.join('/')).join(' → ');
  const density =
    coachLevel === 'USSF_B_PLUS'
      ? 'B+ filmstrip: one pass per teaching frame, numbered bold passes (order 1,2,3), dashed curved runs, hold on the weak-side winger, dashed press only if they jump the first shirt. Stay on this path — no rest defence, no play-out, no extra shirts.'
      : coachLevel === 'USSF_C'
        ? 'C: one or two teaching frames. Straight passes in order plus one support run on the last shirt. One concept per caption.'
        : 'D: one teaching frame. Straight passes only, ordinary words, no extra runs.';
  return [
    'NAMED PASSING COMBINATION (mandatory this turn — code will filmstrip the geometry):',
    `- Path from the ask: ${path || 'named shirts in order'}.`,
    '- Frame 1 = current board unchanged. Teaching frames freeze those x/y. Arrows + captions + ball only.',
    '- actions[] / arrows follow that order only (pass then the next). Do not add an initiator or overlap the coach did not name.',
    '- Do NOT apply the generic “6–8 arrows including DEF press/cover / rest defence” density rule.',
    `- ${density}`,
    '- Captions name the shirts in the path and the timing (when the last run starts).',
  ].join('\n');
}

/**
 * Overlay a license-scaled combination filmstrip on the live roster.
 * Returns null if the path cannot be resolved to ≥2 shirts.
 */
export function applyAttackingComboComposer(
  original: WebDiagramV1,
  message: string,
  coachLevel: ComboCoachLevel
): WebDiagramV1 | null {
  if (!shouldComposeAttackingCombo(message)) return null;
  const slots = parseComboSlots(message);
  const chain = resolveComboChain(original.players || [], slots);
  if (chain.length < 2) return null;

  const start = frameOf(original, chain, {
    id: 'f-start',
    title: 'Start (board)',
    arrows: [],
    labels: [],
    ballOn: chain[0],
    durationMs: 1200,
  });

  const nine = chain.find((p) => p.number === 9) || chain[2] || null;
  const finisher = chain[chain.length - 1];
  const bounce = chain[1];
  const hold = findHoldWinger(original.players || [], chain);
  const jumper = nearestDef(original.players || [], chain[0]);
  const finisherIsWide = finisher.number === 7 || finisher.number === 11;
  const arrive = finisherIsWide && nine ? wingerArrivePoint(finisher, nine) : null;
  const wideBulge = finisher.x >= 50 ? 0.34 : -0.34;

  const teaching: Frame[] = [];

  if (coachLevel === 'USSF_D') {
    teaching.push(
      frameOf(original, chain, {
        id: 'f-2',
        title: pathLabel(chain),
        arrows: chain.slice(0, -1).map((from, i) => passArrow(from, chain[i + 1], i + 1)),
        labels: captionsFor(coachLevel, chain, 'all'),
        ballOn: finisher,
      })
    );
  } else if (coachLevel === 'USSF_C') {
    const arrows: Arrow[] = chain.slice(0, -1).map((from, i) => passArrow(from, chain[i + 1], i + 1));
    if (arrive) arrows.push(runArrow(finisher, arrive, { curved: false }));
    teaching.push(
      frameOf(original, chain, {
        id: 'f-2',
        title: pathLabel(chain),
        arrows,
        labels: captionsFor(coachLevel, chain, 'all'),
        ballOn: finisher,
      })
    );
  } else {
    const passCount = chain.length - 1;
    const beats: Array<'bounce' | 'link' | 'finish'> =
      passCount >= 3 ? ['bounce', 'link', 'finish'] : passCount === 2 ? ['bounce', 'finish'] : ['finish'];

    beats.forEach((beat, beatIdx) => {
      const passIdx = Math.min(beatIdx, passCount - 1);
      const arrows: Arrow[] = [];
      const from = chain[passIdx];
      const to = chain[passIdx + 1];
      if (from && to) arrows.push(passArrow(from, to, passIdx + 1));

      if (beat === 'bounce') {
        if (nine && bounce && nine.id !== bounce.id) {
          arrows.push(runArrow(nine, checkToFeet(nine, bounce), { curved: true, bulge: 0.22 }));
        }
        if (jumper) arrows.push(pressArrow(jumper, chain[0]));
      }
      if (beat === 'link' || (beat === 'finish' && beats.length < 3)) {
        if (arrive) {
          arrows.push(runArrow(finisher, arrive, { curved: true, bulge: wideBulge }));
        }
      }
      if (beat === 'finish') {
        if (arrive && !arrows.some((a) => a.type === 'run' && a.from.playerId === finisher.id)) {
          arrows.push(runArrow(finisher, arrive, { curved: true, bulge: wideBulge }));
        }
        if (hold) arrows.push(runArrow(hold, holdPoint(hold), { curved: false }));
      }

      teaching.push(
        frameOf(original, chain, {
          id: `f-${beatIdx + 2}`,
          title:
            beat === 'bounce'
              ? `${shirtTag(chain[0])} → ${shirtTag(bounce)}`
              : beat === 'link'
                ? `${shirtTag(bounce)} → ${shirtTag(nine || chain[2])}`
                : `${shirtTag(nine || chain[chain.length - 2])} → ${shirtTag(finisher)}`,
          arrows,
          labels: captionsFor(coachLevel, chain, beat),
          ballOn: to || finisher,
        })
      );
    });
  }

  const frames = [start, ...teaching];
  const active = frames[1] || frames[0];
  return {
    ...applyRootFromFrame(original, active),
    sequence: {
      activeFrameId: active.id,
      frames,
    },
  };
}
