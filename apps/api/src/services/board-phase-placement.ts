/**
 * Phase placement for tactical boards.
 * Formation = relative slots; phase = where the block sits vs the focus.
 * Default play-out = goal kick with DEF high to the ATT box.
 * Chassis overlays from formation-principles-v2 (Chassis & Spacing).
 *
 * See docs/tactical-board-phase-positioning.md
 */

import type { WebDiagramV1 } from './web-diagram-v1';
import { build11v11FormationPlayers } from './web-diagram-v1';
import {
  type FormationId11,
  boardCuesFor,
  inferFormationsFromMessage,
  normalizeFormationSpellings,
  phaseKeyForPlayOut,
  playOutCaptions,
} from './formation-principles';

export type RoleBand = 'GK' | 'BACK' | 'MID' | 'FRONT';
export type DefBlockHeight = 'high' | 'mid' | 'low';
export type PlayOutSubPhase = 'goal_kick' | 'pocket' | 'final_third';

type Player = WebDiagramV1['players'][number];
type Arrow = WebDiagramV1['arrows'][number];
type SeqFrame = NonNullable<WebDiagramV1['sequence']>['frames'][number];

const clamp = (n: number) => Math.max(2, Math.min(98, n));

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function boardLooksLikeBuildOut(diagram?: WebDiagramV1): boolean {
  if (!diagram) return false;
  const ball = diagram.balls?.[0];
  if (ball && typeof ball.y === 'number' && ball.y >= 67) return true;
  const attGk = (diagram.players || []).find(
    (p) => p.team === 'ATT' && (p.number === 1 || String(p.role || '').toUpperCase() === 'GK')
  );
  if (
    ball &&
    attGk &&
    typeof ball.y === 'number' &&
    ball.y >= 60 &&
    dist(ball, attGk) < 20
  ) {
    return true;
  }
  const labels = (diagram.labels || []).map((l) => String(l.text || '')).join(' ');
  return /Def third|RIGHT third|build-out|build-up|between\/?\s*beside CBs/i.test(labels);
}

export function isPlayOutRequest(message: string, diagram?: WebDiagramV1): boolean {
  const m = String(message || '');
  if (
    /\b(play(?:ing)? out(?: the back)?|build(?:ing)? out|from the back|build from (?:the )?back|goal[-\s]?kick|build[-\s]?up)\b/i.test(
      m
    )
  ) {
    return true;
  }
  // “build to midfield” / “progress to midfield” / “using the central channel”
  if (
    /\b(build(?:ing)?|progress(?:ing|ion)?|play(?:ing)?)\b[\s\S]{0,48}\b(midfield|middle third|central channel)\b/i.test(
      m
    )
  ) {
    return true;
  }
  if (
    /\b(midfield|central channel|middle third)\b[\s\S]{0,48}\b(build(?:ing)?|progress(?:ing|ion)?)\b/i.test(
      m
    )
  ) {
    return true;
  }
  // “based on how the board is set up” + first-line language
  if (
    /\b(board|set[\s-]?up|what's in|whats in|what is in)\b/i.test(m) &&
    /\b(midfield|central channel|middle third|build|progress|first line)\b/i.test(m)
  ) {
    return true;
  }
  const named = normalizeFormationSpellings(m);
  if (
    /\b(vs|versus|against)\b/i.test(named) &&
    /\b(4-2-3-1|4-4-2|4-3-3|3-5-2)\b/i.test(named) &&
    /\b(midfield|channel|progress|build|play out|from the back|first line)\b/i.test(named)
  ) {
    return true;
  }
  if (
    boardLooksLikeBuildOut(diagram) &&
    /\b(midfield|central channel|progress|build|pocket|first line)\b/i.test(m)
  ) {
    return true;
  }
  return false;
}

const PLAYOUT_FORCE_DRAW =
  /\b(just draw|draw it|use defaults?|don'?t ask|do not ask|no questions|go ahead|apply (?:it|now)|skip clarif)\b/i;

const PLAYOUT_MOTIF_NAMED =
  /(?:#6 drop|\b6 drops|\bdropping? (?:the )?(?:#?6|pivot)|false nine|flank triangle|wide sluice|third[-\s]?man|split (?:the )?c(?:entre|enter)[-\s]?backs)/i;

const PLAYOUT_CONFIRM =
  /^(1|2|yes|y|yeah|yep|ok|okay|do it|draw that|that one|the first|the second|go ahead)\.?$/i;

const PLAYOUT_OFFER_MARK =
  /#6 drop|split CBs|playbook default|Reply \*\*1\*\*|known (?:central )?build-out|first-line shape/i;

export function assistantOfferedPlayOutMotif(
  history: { role: string; content: string }[] = []
): boolean {
  return history.some((h) => h.role === 'assistant' && PLAYOUT_OFFER_MARK.test(h.content || ''));
}

/** Coach already named or confirmed a known chassis motif. */
export function hasPlayOutMotifLock(
  message: string,
  history: { role: string; content: string }[] = []
): boolean {
  const m = String(message || '').trim();
  if (PLAYOUT_FORCE_DRAW.test(m)) return true;
  if (PLAYOUT_MOTIF_NAMED.test(m)) return true;
  if (PLAYOUT_CONFIRM.test(m) && assistantOfferedPlayOutMotif(history)) return true;
  return false;
}

/**
 * Vague “best way to build to midfield from this board” should confirm a known
 * game-model pattern before we draw.
 */
export function needsPlayOutMotifClarification(
  message: string,
  history: { role: string; content: string }[] = [],
  diagram?: WebDiagramV1
): boolean {
  if (hasPlayOutMotifLock(message, history)) return false;
  return isPlayOutRequest(message, diagram);
}

export function playOutMotifOptions(
  att: FormationId11 | null
): { id: '1' | '2'; title: string; detail: string }[] {
  if (att === '4-2-3-1') {
    return [
      {
        id: '1',
        title: 'Doble pivot (default)',
        detail: 'Split CBs, #6+#8 as the platform, #10 in the pocket vs their first line.',
      },
      {
        id: '2',
        title: 'FB overlap',
        detail: 'Pivots hold; full-back high-wide if their winger tucks.',
      },
    ];
  }
  if (att === '4-4-2') {
    return [
      {
        id: '1',
        title: 'CM screen (default)',
        detail: 'Back four as an arc, two CMs screen, full-backs as safe outlets.',
      },
      {
        id: '2',
        title: 'Asymmetric tuck',
        detail: 'One wide mid stays high; the opposite mid tucks inside.',
      },
    ];
  }
  if (att === '3-5-2') {
    return [
      {
        id: '1',
        title: 'Libero + wing-backs (default)',
        detail: '#4 drops to the GK, open CBs, wing-backs high with the #10.',
      },
      {
        id: '2',
        title: 'Midfield box',
        detail: '#6/#8/#7/#9 rectangle; wing-backs stretch the press.',
      },
    ];
  }
  return [
    {
      id: '1',
      title: '#6 drop (default)',
      detail:
        'Split CBs, #6 between them vs their first line, then the bounce into #8/#10 through the central channel.',
    },
    {
      id: '2',
      title: 'Flank triangle',
      detail: 'FB + #8 + winger on one side; switch if they squeeze the middle.',
    },
  ];
}

export function inferDefBlockHeight(message: string): DefBlockHeight {
  const m = String(message || '').toLowerCase();
  if (/\b(low[-\s]?block|deep block|park the bus|very deep)\b/.test(m)) return 'low';
  if (/\b(mid[-\s]?block|middle block|medium block)\b/.test(m)) return 'mid';
  if (/\b(high[-\s]?press|high[-\s]?block|press high|as high as the box)\b/.test(m)) {
    return 'high';
  }
  return 'high'; // default play-out
}

export function inferChannelX(message: string): number {
  const m = String(message || '').toLowerCase();
  if (/\b(left)\s+(channel|side|wing|flank|half)\b/.test(m) || /\bon the left\b/.test(m)) {
    return 28;
  }
  if (/\b(right)\s+(channel|side|wing|flank|half)\b/.test(m) || /\bon the right\b/.test(m)) {
    return 72;
  }
  return 50; // central default
}

export function roleBand(p: { number?: number; role?: string }): RoleBand {
  const role = String(p.role || '').toUpperCase();
  const n = p.number;
  if (n === 1 || role === 'GK') return 'GK';
  // Wide attackers / inverted wingers (4-2-3-1 RAM/LAM count as FRONT for chassis)
  if (/^(ST|CF|SS|RW|LW|RF|LF|RAM|LAM)$/.test(role)) return 'FRONT';
  // Flat wide mids stay MID (4-4-2 RM/LM)
  if (/^(CM|CDM|CAM|DM|AM|RM|LM|RCM|LCM)$/.test(role)) return 'MID';
  if (/^(CB|RB|LB|RCB|LCB|RWB|LWB|FB|WB)$/.test(role)) return 'BACK';
  if (typeof n === 'number') {
    if ([9].includes(n)) return 'FRONT';
    if ([7, 11].includes(n)) return 'FRONT';
    if ([6, 8, 10].includes(n)) return 'MID';
    if ([2, 3, 4, 5].includes(n)) return 'BACK';
  }
  return 'MID';
}

function byBand(players: Player[], team: 'ATT' | 'DEF', band: RoleBand): Player[] {
  return players
    .filter((p) => p.team === team && roleBand(p) === band)
    .sort((a, b) => (a.number ?? 99) - (b.number ?? 99));
}

function roleOf(p: Player): string {
  return String(p.role || '').toUpperCase();
}

function isFb(p: Player): boolean {
  const r = roleOf(p);
  if (/^(RB|LB|FB)$/.test(r)) return true;
  if (/^(CB|RCB|LCB|RWB|LWB|WB|GK)$/.test(r)) return false;
  return p.number === 2 || p.number === 3;
}

function isWb(p: Player): boolean {
  const r = roleOf(p);
  if (/^(RWB|LWB|WB)$/.test(r)) return true;
  if (/^(RB|LB|FB|CB|RCB|LCB|GK)$/.test(r)) return false;
  return false;
}

function isCb(p: Player): boolean {
  const r = roleOf(p);
  if (/^(CB|RCB|LCB)$/.test(r)) return true;
  if (/^(RB|LB|FB|RWB|LWB|WB|GK)$/.test(r)) return false;
  return p.number === 4 || p.number === 5;
}

/** Read the side already on the board when the coach only names the opposition. */
export function inferFormationFromPlayers(
  players: Player[],
  team: 'ATT' | 'DEF'
): FormationId11 | null {
  const side = players.filter((p) => p.team === team);
  if (side.length < 8) return null;
  const roles = side.map((p) => roleOf(p));
  const count = (re: RegExp) => roles.filter((r) => re.test(r)).length;

  if (count(/^(CB|RCB|LCB)$/) >= 3 && count(/^(RWB|LWB|WB)$/) >= 1) return '3-5-2';
  if (count(/^(ST|CF)$/) >= 2 && count(/^(RM|LM)$/) >= 1) return '4-4-2';
  if (count(/^(CDM|DM)$/) >= 2 || count(/^(RAM|LAM|CAM)$/) >= 1) return '4-2-3-1';
  if (count(/^(RW|LW)$/) >= 1) return '4-3-3';

  const back = byBand(side, team, 'BACK').length;
  const front = byBand(side, team, 'FRONT').length;
  if (back >= 4 && front >= 3) return '4-3-3';
  if (back >= 4 && front >= 2) return '4-4-2';
  if (back >= 3 && front >= 2) return '3-5-2';
  return null;
}

function resolvePlayOutFormations(
  roster: Player[],
  message: string
): { att: FormationId11; def: FormationId11 } {
  const inferred = inferFormationsFromMessage(message);
  return {
    att: inferred.att || inferFormationFromPlayers(roster, 'ATT') || '4-3-3',
    def: inferred.def || inferFormationFromPlayers(roster, 'DEF') || '4-4-2',
  };
}

function splitBacks(backs: Player[]): { cbs: Player[]; fbs: Player[]; wbs: Player[] } {
  const wbs = backs.filter(isWb);
  const fbs = backs.filter((p) => isFb(p) && !isWb(p));
  const cbs = backs.filter((p) => !fbs.includes(p) && !wbs.includes(p));
  // Heuristic when roles missing: outer x = FB, inner = CB
  if (!fbs.length && !wbs.length && backs.length >= 4) {
    const sorted = [...backs].sort((a, b) => a.x - b.x);
    return {
      cbs: [sorted[1], sorted[2]].filter(Boolean),
      fbs: [sorted[0], sorted[3]].filter(Boolean),
      wbs: [],
    };
  }
  if (!cbs.length && backs.length >= 3 && wbs.length) {
    // 3-5-2 style: remaining backs are CBs
    return { cbs: backs.filter((p) => !wbs.includes(p)), fbs: [], wbs };
  }
  return { cbs: cbs.length ? cbs : backs.filter(isCb), fbs, wbs };
}

function pickByNumber(list: Player[], n: number): Player | undefined {
  return list.find((p) => p.number === n);
}

/** Prefer role match, then shirt number, across the whole team list. */
function pickRole(
  list: Player[],
  roleRe: RegExp,
  number?: number,
  exclude: Player[] = []
): Player | undefined {
  const pool = list.filter((p) => !exclude.includes(p));
  if (number != null) {
    const byNum = pool.find((p) => p.number === number);
    if (byNum) return byNum;
  }
  return pool.find((p) => roleRe.test(roleOf(p)));
}

function separate(players: Player[], minGap = 5.5): Player[] {
  const next = players.map((p) => ({ ...p }));
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < next.length; i++) {
      for (let j = i + 1; j < next.length; j++) {
        const a = next[i];
        const b = next[j];
        let d = dist(a, b);
        // Exact / near-exact stack: invent a lateral split so depth stays coach-true
        if (d < 0.01) {
          const push = minGap / 2;
          next[i] = { ...a, x: clamp(a.x - push) };
          next[j] = { ...b, x: clamp(b.x + push) };
          d = dist(next[i], next[j]);
        }
        // Don't let separation shove structure across thirds — same-team soft push only
        if (a.team !== b.team) {
          if (d >= minGap - 1) continue;
          const ux = (next[j].x - next[i].x) / d;
          const need = (minGap - 1 - d) / 2;
          // Prefer lateral separation vs DEF so depth (y) stays coach-true
          next[i] = { ...next[i], x: clamp(next[i].x - ux * need * 1.2) };
          next[j] = { ...next[j], x: clamp(next[j].x + ux * need * 1.2) };
          continue;
        }
        if (d >= minGap) continue;
        const ux = (next[j].x - next[i].x) / Math.max(d, 0.01);
        const uy = (next[j].y - next[i].y) / Math.max(d, 0.01);
        const need = (minGap - d) / 2;
        next[i] = {
          ...next[i],
          x: clamp(next[i].x - ux * need),
          y: clamp(next[i].y - uy * need * 0.35),
        };
        next[j] = {
          ...next[j],
          x: clamp(next[j].x + ux * need),
          y: clamp(next[j].y + uy * need * 0.35),
        };
      }
    }
  }
  return next;
}

/**
 * Hard rule: no two players share the same spot.
 * Prefer sliding on x (width) so formation depth (y) stays intact.
 * Same-team pairs get a full minGap; opposite teams a slightly softer gap.
 */
function enforceNoOverlap(players: Player[], minGap = 6): Player[] {
  const next = players.map((p) => ({ ...p }));
  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (let i = 0; i < next.length; i++) {
      for (let j = i + 1; j < next.length; j++) {
        const a = next[i];
        const b = next[j];
        const gap = a.team === b.team ? minGap : minGap - 1;
        let d = dist(a, b);
        if (d < 0.01) {
          // Stacked: GK stays put when paired with a CB; otherwise split left/right
          const aIsGk = roleBand(a) === 'GK';
          const bIsGk = roleBand(b) === 'GK';
          if (aIsGk && !bIsGk) {
            next[j] = { ...b, x: clamp(b.x + gap) };
          } else if (bIsGk && !aIsGk) {
            next[i] = { ...a, x: clamp(a.x + gap) };
          } else {
            next[i] = { ...a, x: clamp(a.x - gap / 2) };
            next[j] = { ...b, x: clamp(b.x + gap / 2) };
          }
          moved = true;
          d = dist(next[i], next[j]);
        }
        if (d >= gap) continue;
        const ux = (next[j].x - next[i].x) / Math.max(d, 0.01);
        const need = (gap - d) / 2;
        // Mostly lateral — keep y unless they share almost the same x and still collide
        const lateral = Math.abs(ux) < 0.25 ? 1 : ux;
        next[i] = { ...next[i], x: clamp(next[i].x - lateral * need) };
        next[j] = { ...next[j], x: clamp(next[j].x + lateral * need) };
        moved = true;
      }
    }
    if (!moved) break;
  }
  return next;
}

function placeLine(
  list: Player[],
  focus: { x: number; y: number },
  y: number,
  spread: number
): Map<string, { x: number; y: number }> {
  const targets = new Map<string, { x: number; y: number }>();
  if (!list.length) return targets;
  const startX = focus.x - ((list.length - 1) * spread) / 2;
  list.forEach((p, i) => {
    targets.set(p.id, { x: clamp(startX + i * spread), y: clamp(y) });
  });
  return targets;
}

/** Full-pitch width anchors — in possession we stretch; never park everyone on the channel. */
const WIDTH = {
  /** FB / WB — hard on the touchline (separate() must not pull these in) */
  touchR: 96,
  touchL: 4,
  halfR: 72,
  halfL: 28,
  /**
   * 4-back build-out: CBs split inside the penalty area (box ≈ x 19–81).
   * Ball-side CB sits on the channel; far CB stays inside the box.
   * RB/LB stay on the touchline and high of the CBs.
   */
  boxCbR: 66,
  boxCbL: 34,
  /** Legacy aliases used by pocket / final-third chassis */
  cbR: 64,
  cbL: 36,
  midR: 62,
  midL: 38,
} as const;

/**
 * Shared 4-back build-out (own box):
 * - Ball-side CB on the channel (where the ball is)
 * - Far CB still inside the box, spread
 * - Both fullbacks hard on the touchline and high
 */
function placeAttFourBackBuildOut(
  targets: Map<string, { x: number; y: number }>,
  cbs: Player[],
  rb: Player | undefined,
  lb: Player | undefined,
  focusY: number,
  channelX: number
) {
  const rcb =
    cbs.find((p) => p.number === 4 || /^RCB$/i.test(roleOf(p))) ||
    [...cbs].sort((a, b) => b.x - a.x)[0];
  const lcb =
    cbs.find((p) => p !== rcb && (p.number === 5 || /^LCB$/i.test(roleOf(p)))) ||
    [...cbs].filter((p) => p !== rcb).sort((a, b) => a.x - b.x)[0];

  // Inside the box (ATT goal at y≈100; 18-yard line ≈ y 83)
  const cbY = clamp(Math.max(focusY + 2, 87));
  // Clearly higher than CBs (toward halfway), on the touchline
  const fbY = clamp(Math.min(focusY - 18, cbY - 14));

  const rightChannel = channelX >= 58;
  const leftChannel = channelX <= 42;

  if (rightChannel) {
    // Right CB = ball; left CB stays inside box; RB glued to top touchline
    setT(targets, rcb, channelX, cbY);
    setT(targets, lcb, WIDTH.boxCbL, cbY);
    setT(targets, rb, WIDTH.touchR, fbY);
    setT(targets, lb, WIDTH.touchL, fbY);
  } else if (leftChannel) {
    setT(targets, lcb, channelX, cbY);
    setT(targets, rcb, WIDTH.boxCbR, cbY);
    setT(targets, lb, WIDTH.touchL, fbY);
    setT(targets, rb, WIDTH.touchR, fbY);
  } else {
    setT(targets, rcb, WIDTH.boxCbR, cbY);
    setT(targets, lcb, WIDTH.boxCbL, cbY);
    setT(targets, rb, WIDTH.touchR, fbY);
    setT(targets, lb, WIDTH.touchL, fbY);
  }
}

function isFourBackFormation(formation: FormationId11): boolean {
  return formation.startsWith('4-');
}

/** Place a back/mid line across the pitch (centered on 50), not on the channel focus. */
function placeWideLine(
  list: Player[],
  y: number,
  spread: number
): Map<string, { x: number; y: number }> {
  return placeLine(list, { x: 50, y }, y, spread);
}

function applyTargets(players: Player[], targets: Map<string, { x: number; y: number }>): Player[] {
  return players.map((p) => {
    const t = targets.get(p.id);
    if (!t) return p;
    return { ...p, x: t.x, y: t.y };
  });
}

function setT(
  targets: Map<string, { x: number; y: number }>,
  p: Player | undefined,
  x: number,
  y: number
) {
  if (!p) return;
  targets.set(p.id, { x: clamp(x), y: clamp(y) });
}

function arrow(
  fromId: string,
  toId: string,
  type: Arrow['type'],
  style: Arrow['style'] = 'solid'
): Arrow {
  return {
    from: { playerId: fromId },
    to: { playerId: toId },
    type,
    style,
    weight: type === 'pass' ? 'bold' : 'normal',
    arrowhead: true,
  };
}

type PhaseGeom = {
  focus: { x: number; y: number };
  area: { x: number; y: number; width: number; height: number; shape: 'rect'; label?: string };
  title: string;
};

function geomForPhase(
  phase: PlayOutSubPhase,
  channelX: number,
  attFormation: FormationId11
): PhaseGeom {
  const short = attFormation;
  if (phase === 'goal_kick') {
    const focus = { x: channelX, y: 86 };
    return {
      focus,
      area: {
        x: 18,
        y: 68,
        width: 64,
        height: 26,
        shape: 'rect',
        label: `${short} build-out`,
      },
      title: `1. Goal-kick build-up (${short})`,
    };
  }
  if (phase === 'pocket') {
    const focus = { x: channelX, y: 50 };
    // Central midfield duel — yellow box on the center circle
    const centered = Math.abs(channelX - 50) <= 10;
    return {
      focus,
      area: centered
        ? {
            x: 24,
            y: 38,
            width: 52,
            height: 24,
            shape: 'rect',
            label: `${short} midfield`,
          }
        : {
            x: 20,
            y: 40,
            width: 60,
            height: 28,
            shape: 'rect',
            label: `${short} progression`,
          },
      title: `2. Midfield pocket (${short})`,
    };
  }
  const focus = { x: clamp(channelX), y: 22 };
  // Attacking-third yellow box (central edge-of-box zone)
  if (
    attFormation === '4-4-2' ||
    attFormation === '3-5-2' ||
    attFormation === '4-2-3-1' ||
    attFormation === '4-3-3'
  ) {
    const tall = attFormation === '3-5-2';
    return {
      focus: { x: 50, y: attFormation === '4-3-3' ? 22 : tall ? 20 : 18 },
      area: {
        x: 24,
        y: tall ? 8 : 4,
        width: 52,
        height: tall ? 32 : attFormation === '4-3-3' ? 30 : 28,
        shape: 'rect',
        label: `${short} attack`,
      },
      title: `3. Final-third progression (${short})`,
    };
  }
  return {
    focus,
    area: {
      x: 16,
      y: 6,
      width: 68,
      height: 30,
      shape: 'rect',
      label: `${short} attack`,
    },
    title: `3. Final-third progression (${short})`,
  };
}

/**
 * Park captions on the quiet half — opposite the yellow emphasis along goal→goal (y),
 * and off the active channel on x so text isn’t on top of shirts.
 *
 * Pitch is HORIZONTAL: screen X = pitch y, screen Y = pitch x (inverted).
 * Stack along pitch **x** so chips read top→bottom and don’t overlap sideways.
 */
export function labelStackAwayFromEmphasis(
  area: { x: number; y: number; width?: number; height?: number },
  count: number,
  focusX?: number
): { x: number; y: number }[] {
  const cy = area.y + (area.height ?? 20) / 2;
  const fx = typeof focusX === 'number' ? focusX : area.x + (area.width ?? 40) / 2;

  // Opposite third along goal→goal (= screen horizontal)
  const baseY = cy < 45 ? 78 : cy > 58 ? 16 : 82;
  // Opposite flank from the channel (= screen vertical column)
  const preferTop = fx < 55;
  const startX = preferTop ? 90 : 12;
  const dir = preferTop ? -1 : 1; // grow toward midfield so chips stay on that half
  const step = count > 3 ? 11 : 13;

  return Array.from({ length: Math.max(0, count) }, (_, i) => ({
    x: clamp(startX + dir * i * step),
    y: clamp(baseY),
  }));
}

function placeDefBlock(
  targets: Map<string, { x: number; y: number }>,
  def: { gk: Player[]; back: Player[]; mid: Player[]; front: Player[] },
  focus: { x: number; y: number },
  phase: PlayOutSubPhase,
  block: DefBlockHeight,
  defFormation: FormationId11
) {
  for (const p of def.gk) setT(targets, p, 50, 6);

  if (phase === 'goal_kick') {
    /**
     * High-press vs ATT build-out (matches coach reference):
     *   ST on the ball · wide forwards on both touchlines · pivots in half-spaces ·
     *   back four HIGH near the center circle with FBs on the touchlines.
     * Mid/low block only when asked — deeper floors.
     */
    const pressOff = block === 'low' ? 18 : block === 'mid' ? 12 : 6;
    const coverOff = block === 'low' ? 32 : block === 'mid' ? 22 : 18;
    const backOff = block === 'low' ? 50 : block === 'mid' ? 38 : 34;
    const backFloor = block === 'low' ? 26 : block === 'mid' ? 40 : 50;

    const pressY = clamp(focus.y - pressOff);
    const coverY = clamp(focus.y - coverOff);
    const backY = clamp(Math.max(backFloor, focus.y - backOff));
    // No L/R channel shift on DEF yet — keep the block centered like Center channel
    // until ATT channel shift is locked in.
    const midX = 50;

    const { cbs, fbs, wbs } = splitBacks(def.back);
    const rcb =
      cbs.find((p) => p.number === 4 || /^RCB$/i.test(roleOf(p))) ||
      [...cbs].sort((a, b) => b.x - a.x)[0];
    const lcb =
      cbs.find((p) => p !== rcb && (p.number === 5 || /^LCB$/i.test(roleOf(p)))) ||
      [...cbs].filter((p) => p !== rcb).sort((a, b) => a.x - b.x)[0];
    const rb =
      fbs.find((p) => p.number === 2 || /^RB$/i.test(roleOf(p))) ||
      fbs[0] ||
      wbs[0];
    const lb =
      fbs.find((p) => p !== rb && (p.number === 3 || /^LB$/i.test(roleOf(p)))) ||
      fbs[1] ||
      wbs[1];

    /** High back four: CBs near center circle, FBs glued to touchlines. */
    const placeHighBackFour = () => {
      setT(targets, rcb, WIDTH.boxCbR, backY);
      setT(targets, lcb, WIDTH.boxCbL, backY);
      setT(targets, rb, WIDTH.touchR, backY);
      setT(targets, lb, WIDTH.touchL, backY);
    };

    if (defFormation === '4-4-2') {
      const sts = def.front.slice(0, 2);
      setT(targets, sts[0], clamp(midX + 6), pressY);
      setT(targets, sts[1], clamp(midX - 6), pressY);
      const rm =
        def.mid.find((p) => p.number === 7 || /^RM$/i.test(roleOf(p))) || def.mid[0];
      const lm =
        def.mid.find((p) => p !== rm && (p.number === 11 || /^LM$/i.test(roleOf(p)))) ||
        def.mid[1];
      const cms = def.mid.filter((p) => p !== rm && p !== lm).slice(0, 2);
      setT(targets, rm, WIDTH.touchR, coverY);
      setT(targets, lm, WIDTH.touchL, coverY);
      setT(targets, cms[0], WIDTH.midR, coverY);
      setT(targets, cms[1], WIDTH.midL, coverY);
      placeHighBackFour();
      return;
    }

    if (defFormation === '4-2-3-1') {
      const pool = [...def.front, ...def.mid];
      const st =
        pool.find((p) => p.number === 9 || /^(ST|CF)$/i.test(roleOf(p))) ||
        def.front[0];
      const ten =
        pool.find((p) => p.number === 10 || /^(CAM|AM)$/i.test(roleOf(p))) ||
        def.mid.find((p) => p.number === 10);
      const seven =
        pool.find((p) => p !== st && (p.number === 7 || /^(RAM|RM|RW)$/i.test(roleOf(p))));
      const eleven =
        pool.find(
          (p) =>
            p !== st &&
            p !== seven &&
            (p.number === 11 || /^(LAM|LM|LW)$/i.test(roleOf(p)))
        );
      const pivots = def.mid
        .filter((p) => p !== ten && p !== seven && p !== eleven)
        .slice(0, 2);

      // #9 central press; #7/#11 on BOTH touchlines at the PRESS line (not behind ATT)
      setT(targets, st, midX, pressY);
      setT(targets, seven, WIDTH.touchR, pressY);
      setT(targets, eleven, WIDTH.touchL, pressY);
      // #10 screens just behind the ST; #6/#8 pivots in half-spaces (never touchline)
      setT(targets, ten, midX, coverY + 2);
      setT(targets, pivots[0], WIDTH.halfR, coverY);
      setT(targets, pivots[1], WIDTH.halfL, coverY);
      placeHighBackFour();
      return;
    }

    if (defFormation === '3-5-2') {
      const pool = [...def.front, ...def.mid, ...def.back];
      const st9 =
        pool.find((p) => p.number === 9 || /^(ST|CF)$/i.test(roleOf(p))) || def.front[0];
      const st10 =
        pool.find(
          (p) => p !== st9 && (p.number === 10 || /^(ST|CF)$/i.test(roleOf(p)))
        ) || def.front[1];
      const six =
        pool.find((p) => p.number === 6 || /^(CDM|DM)$/i.test(roleOf(p))) || def.mid[0];
      const eight =
        pool.find((p) => p.number === 8 || (/^CM$/i.test(roleOf(p)) && p.number !== 7)) ||
        def.mid.find((p) => p !== six);
      const seven =
        pool.find((p) => p !== eight && (p.number === 7 || /^CM$/i.test(roleOf(p)))) ||
        def.mid.find((p) => p !== six && p !== eight);
      const rwb =
        pool.find((p) => p.number === 2 || /^RWB$/i.test(roleOf(p))) ||
        wbs.find((p) => /RWB/i.test(roleOf(p))) ||
        wbs[0] ||
        fbs[0];
      const lwb =
        pool.find((p) => p !== rwb && (p.number === 11 || /^LWB$/i.test(roleOf(p)))) ||
        wbs.find((p) => p !== rwb) ||
        fbs[1];
      const three = (cbs.length >= 3 ? cbs : def.back.filter((p) => !isWb(p))).slice(0, 3);
      const cbR =
        three.find((p) => p.number === 4) || [...three].sort((a, b) => b.x - a.x)[0];
      const cbC =
        three.find((p) => p !== cbR && p.number === 5) ||
        three.find((p) => p !== cbR);
      const cbL =
        three.find((p) => p !== cbR && p !== cbC && p.number === 3) ||
        three.find((p) => p !== cbR && p !== cbC) ||
        [...three].sort((a, b) => a.x - b.x)[0];

      // Twin STs press the box — clearly split (no stack)
      setT(targets, st9, clamp(midX + 11), pressY);
      setT(targets, st10, clamp(midX - 11), pressY);
      // #6 just behind the press, central
      setT(targets, six, midX, coverY + 5);
      // WBs high-wide marking ATT FBs — slightly inside the touchline, ahead of the mid trio
      setT(targets, rwb, WIDTH.touchR - 3, clamp(pressY + 3));
      setT(targets, lwb, WIDTH.touchL + 3, clamp(pressY + 3));
      // CMs in half-spaces at cover depth — clear of WBs and #6
      setT(targets, eight, WIDTH.halfR, coverY - 3);
      setT(targets, seven, WIDTH.halfL, coverY - 3);
      // Back three near center circle — wide lateral gaps (~28 units)
      setT(targets, cbR, 78, backY);
      setT(targets, cbC, midX, backY);
      setT(targets, cbL, 22, backY);
      return;
    }

    // default / 4-3-3 — #9 central, #7/#11 touchline press, mid trio cover, high back four
    {
      const nine =
        def.front.find((p) => p.number === 9 || /^(ST|CF)$/i.test(roleOf(p))) ||
        def.front[0];
      const seven =
        def.front.find((p) => p !== nine && (p.number === 7 || /^(RW|RM)$/i.test(roleOf(p)))) ||
        def.front[1];
      const eleven =
        def.front.find(
          (p) => p !== nine && p !== seven && (p.number === 11 || /^(LW|LM)$/i.test(roleOf(p)))
        ) || def.front[2];
      setT(targets, nine, midX, pressY);
      setT(targets, seven, WIDTH.touchR, pressY);
      setT(targets, eleven, WIDTH.touchL, pressY);
      const six =
        def.mid.find((p) => p.number === 6 || /^(CDM|DM)$/i.test(roleOf(p))) || def.mid[0];
      const eight =
        def.mid.find((p) => p !== six && (p.number === 8 || /^CM$/i.test(roleOf(p)))) ||
        def.mid[1];
      const ten =
        def.mid.find((p) => p !== six && p !== eight) || def.mid[2];
      setT(targets, six, midX, coverY);
      setT(targets, eight, WIDTH.halfR, coverY);
      setT(targets, ten, WIDTH.halfL, coverY);
      placeHighBackFour();
      return;
    }
  }

  if (phase === 'pocket') {
    // Middle third — formation-specific. Center = balanced midfield duel (see 433 reference).
    const midX = 50;
    const { cbs, fbs, wbs } = splitBacks(def.back);
    const rcb =
      cbs.find((p) => p.number === 4 || /^RCB$/i.test(roleOf(p))) ||
      [...cbs].sort((a, b) => b.x - a.x)[0];
    const lcb =
      cbs.find((p) => p !== rcb && (p.number === 5 || /^LCB$/i.test(roleOf(p)))) ||
      [...cbs].filter((p) => p !== rcb).sort((a, b) => a.x - b.x)[0];
    const rb =
      fbs.find((p) => p.number === 2 || /^RB$/i.test(roleOf(p))) || fbs[0] || wbs[0];
    const lb =
      fbs.find((p) => p !== rb && (p.number === 3 || /^LB$/i.test(roleOf(p)))) ||
      fbs[1] ||
      wbs[1];

    if (defFormation === '4-3-3') {
      // Mirror ATT midfield duel: #6/#8/#10 in the yellow box; #9 between lines; wings high-wide
      const nine =
        def.front.find((p) => p.number === 9 || /^(ST|CF)$/i.test(roleOf(p))) ||
        def.front[0];
      const seven =
        def.front.find(
          (p) => p !== nine && (p.number === 7 || /^(RW|RM)$/i.test(roleOf(p)))
        ) || def.front[1];
      const eleven =
        def.front.find(
          (p) =>
            p !== nine && p !== seven && (p.number === 11 || /^(LW|LM)$/i.test(roleOf(p)))
        ) || def.front[2];
      const six =
        def.mid.find((p) => p.number === 6 || /^(CDM|DM)$/i.test(roleOf(p))) ||
        def.mid[0];
      const eight =
        def.mid.find((p) => p !== six && (p.number === 8 || /^CM$/i.test(roleOf(p)))) ||
        def.mid[1];
      const ten = def.mid.find((p) => p !== six && p !== eight) || def.mid[2];

      // Back four in own half — CBs central, FBs wide
      // DEF attacks +y: their right = touchL (bottom), their left = touchR (top)
      setT(targets, rcb, WIDTH.cbL, 28);
      setT(targets, lcb, WIDTH.cbR, 28);
      setT(targets, rb, WIDTH.touchL, 32);
      setT(targets, lb, WIDTH.touchR, 32);
      // Mid trio in the box — #6 deeper (own side of center), #8/#10 mark ATT 8/10
      setT(targets, six, midX, 44);
      setT(targets, eight, WIDTH.midR + 4, 48);
      setT(targets, ten, WIDTH.midL - 4, 48);
      // #9 steps into the pocket (ATT side of halfway); wings high-wide on DEF flanks
      setT(targets, nine, midX, 58);
      setT(targets, seven, WIDTH.touchL, 62);
      setT(targets, eleven, WIDTH.touchR, 62);
      return;
    }

    if (defFormation === '4-2-3-1') {
      // Middle Center vs ATT 433: back four · #6+#8 pivot · #10 on the ball ·
      // #7/#11 wide at halfway · #9 between lines (ATT side of the yellow box)
      const pool = [...def.mid, ...def.front];
      const six =
        pool.find((p) => p.number === 6 || /^(CDM|DM)$/i.test(roleOf(p))) || def.mid[0];
      const eight =
        pool.find(
          (p) => p !== six && (p.number === 8 || /^(CDM|DM|CM)$/i.test(roleOf(p)))
        ) || def.mid[1];
      const ten =
        pool.find(
          (p) => p !== six && p !== eight && (p.number === 10 || /^(CAM|AM)$/i.test(roleOf(p)))
        ) || def.mid.find((p) => p.number === 10);
      const nine =
        def.front.find((p) => p.number === 9 || /^(ST|CF)$/i.test(roleOf(p))) ||
        def.front[0];
      const seven =
        def.front.find(
          (p) => p !== nine && (p.number === 7 || /^(RAM|RM|RW)$/i.test(roleOf(p)))
        ) || def.front[1];
      const eleven =
        def.front.find(
          (p) =>
            p !== nine &&
            p !== seven &&
            (p.number === 11 || /^(LAM|LM|LW)$/i.test(roleOf(p)))
        ) || def.front[2];

      // Back four deep in own half (DEF right = touchL)
      setT(targets, rcb, WIDTH.cbL, 26);
      setT(targets, lcb, WIDTH.cbR, 26);
      setT(targets, rb, WIDTH.touchL, 30);
      setT(targets, lb, WIDTH.touchR, 30);
      // Double pivot screening — own side of the yellow box
      setT(targets, eight, WIDTH.midR, 40);
      setT(targets, six, WIDTH.midL, 40);
      // #10 on the center spot (ball); wide AMs at halfway
      setT(targets, ten, midX, 50);
      // Mirrored shirts: DEF #7 (RAM) → bottom, #11 (LAM) → top
      setT(targets, seven, WIDTH.touchL, 50);
      setT(targets, eleven, WIDTH.touchR, 50);
      // #9 between the lines on the ATT side of the box
      setT(targets, nine, midX, 60);
      return;
    }

    if (defFormation === '4-4-2') {
      // Middle Center vs ATT 433: flat back four · flat mid four · twin STs in the yellow box
      const rm =
        def.mid.find((p) => p.number === 7 || /^RM$/i.test(roleOf(p))) || def.mid[0];
      const lm =
        def.mid.find((p) => p !== rm && (p.number === 11 || /^LM$/i.test(roleOf(p)))) ||
        def.mid[1];
      const cms = def.mid.filter((p) => p !== rm && p !== lm).slice(0, 2);
      const six =
        cms.find((p) => p.number === 6 || /^(CM|CDM)$/i.test(roleOf(p))) || cms[0];
      const eight = cms.find((p) => p !== six) || cms[1];
      const nine =
        def.front.find((p) => p.number === 9 || /^(ST|CF)$/i.test(roleOf(p))) ||
        def.front[0];
      const ten =
        def.front.find((p) => p !== nine && (p.number === 10 || /^(ST|CF)$/i.test(roleOf(p)))) ||
        def.front[1];

      // Flat back four in own half (DEF left = touchR / top)
      setT(targets, lb, WIDTH.touchR, 28);
      setT(targets, lcb, WIDTH.cbR, 26);
      setT(targets, rcb, WIDTH.cbL, 26);
      setT(targets, rb, WIDTH.touchL, 28);
      // Flat midfield four — #11/#8/#6/#7 top→bottom, own side of halfway
      setT(targets, lm, WIDTH.touchR, 42);
      setT(targets, eight, WIDTH.midR, 42);
      setT(targets, six, WIDTH.midL, 42);
      setT(targets, rm, WIDTH.touchL, 42);
      // Twin STs in the yellow box, just past halfway
      setT(targets, ten, 58, 56);
      setT(targets, nine, 42, 56);
      return;
    }

    if (defFormation === '3-5-2') {
      // Middle Center vs ATT 433: back three · WBs high-wide · #8/#6/#10 mid trio ·
      // #10 on the center · twin forwards (#9/#7) in ATT half
      const pool = [...def.back, ...def.mid, ...def.front];
      const { cbs, wbs, fbs } = splitBacks(def.back);
      const three = (cbs.length >= 3 ? cbs : def.back.filter((p) => !isWb(p))).slice(0, 3);
      const cb5 =
        pickByNumber(pool, 5) ||
        three.find((p) => p.number === 5) ||
        [...three].sort((a, b) => b.x - a.x)[0];
      const cb4 =
        pickByNumber(pool, 4) ||
        three.find((p) => p !== cb5 && p.number === 4) ||
        three.find((p) => p !== cb5);
      const cb3 =
        pickByNumber(pool, 3) ||
        three.find((p) => p !== cb5 && p !== cb4) ||
        [...three].sort((a, b) => a.x - b.x)[0];
      const rwb =
        pickByNumber(pool, 2) ||
        wbs.find((p) => /RWB/i.test(roleOf(p))) ||
        wbs[0] ||
        fbs[0];
      const lwb =
        pickByNumber(pool, 11) ||
        wbs.find((p) => p !== rwb) ||
        fbs[1];
      const eight = pickByNumber(pool, 8) || def.mid[0];
      const six = pickByNumber(pool, 6) || def.mid[1];
      // Screenshot: #10 links on the center spot (may be rostered as ST)
      const ten = pickByNumber(pool, 10) || def.mid[2] || def.front[1];
      const nine = pickByNumber(pool, 9) || def.front[0];
      // Screenshot: #7 is the second forward (may be rostered as CM)
      const seven = pickByNumber(pool, 7) || def.front[1] || def.mid[2];

      // Back three just outside the box
      setT(targets, cb5, WIDTH.halfR, 24);
      setT(targets, cb4, midX, 22);
      setT(targets, cb3, WIDTH.halfL, 24);
      // Wing-backs high-wide, own side of halfway
      setT(targets, lwb, WIDTH.touchR, 44);
      setT(targets, rwb, WIDTH.touchL, 44);
      // Mid trio in the yellow box — #8/#6 deeper, #10 on the center
      setT(targets, eight, WIDTH.midR, 42);
      setT(targets, six, WIDTH.midL, 42);
      setT(targets, ten, midX, 48);
      // Twin forwards in ATT half (counter outlets)
      setT(targets, nine, 58, 62);
      setT(targets, seven, 42, 62);
      return;
    }

    // Fallback: compact vertically, still wide
    const coverFocus = { x: clamp(50 + (focus.x - 50) * 0.4), y: focus.y };
    placeLine(def.front.slice(0, 3), focus, clamp(focus.y + 14), 16).forEach((v, k) =>
      targets.set(k, v)
    );
    placeLine(def.mid.slice(0, 4), coverFocus, clamp(focus.y - 10), 18).forEach((v, k) =>
      targets.set(k, v)
    );
    placeLine(
      def.back.slice(0, 4),
      { x: clamp(50 + (focus.x - 50) * 0.25), y: focus.y },
      clamp(focus.y - 22),
      22
    ).forEach((v, k) => targets.set(k, v));
    return;
  }

  // final third — recover compact to the box but keep lateral stretch
  if (defFormation === '4-3-3') {
    // Recovering to the box vs ATT 433: back four on the 18 · mid trio cover ·
    // front three delay higher in their half
    const midX = 50;
    const { cbs, fbs, wbs } = splitBacks(def.back);
    const rcb =
      cbs.find((p) => p.number === 4 || /^RCB$/i.test(roleOf(p))) ||
      [...cbs].sort((a, b) => b.x - a.x)[0];
    const lcb =
      cbs.find((p) => p !== rcb && (p.number === 5 || /^LCB$/i.test(roleOf(p)))) ||
      [...cbs].filter((p) => p !== rcb).sort((a, b) => a.x - b.x)[0];
    const rb =
      fbs.find((p) => p.number === 2 || /^RB$/i.test(roleOf(p))) || fbs[0] || wbs[0];
    const lb =
      fbs.find((p) => p !== rb && (p.number === 3 || /^LB$/i.test(roleOf(p)))) ||
      fbs[1] ||
      wbs[1];
    const nine =
      def.front.find((p) => p.number === 9 || /^(ST|CF)$/i.test(roleOf(p))) ||
      def.front[0];
    const seven =
      def.front.find(
        (p) => p !== nine && (p.number === 7 || /^(RW|RM)$/i.test(roleOf(p)))
      ) || def.front[1];
    const eleven =
      def.front.find(
        (p) =>
          p !== nine && p !== seven && (p.number === 11 || /^(LW|LM)$/i.test(roleOf(p)))
      ) || def.front[2];
    const six =
      def.mid.find((p) => p.number === 6 || /^(CDM|DM)$/i.test(roleOf(p))) ||
      def.mid[0];
    const eight =
      def.mid.find((p) => p !== six && (p.number === 8 || /^CM$/i.test(roleOf(p)))) ||
      def.mid[1];
    const ten = def.mid.find((p) => p !== six && p !== eight) || def.mid[2];

    // DEF attacks +y: right = touchL. Back four on the box.
    setT(targets, rcb, WIDTH.cbL, 12);
    setT(targets, lcb, WIDTH.cbR, 12);
    setT(targets, rb, WIDTH.touchL, 14);
    setT(targets, lb, WIDTH.touchR, 14);
    // Mid trio covering just ahead of the box
    setT(targets, six, midX, 26);
    setT(targets, eight, WIDTH.midR + 4, 28);
    setT(targets, ten, WIDTH.midL - 4, 28);
    // Front three delay — #9 central, wings wide
    setT(targets, nine, midX, 40);
    setT(targets, seven, WIDTH.touchL, 42);
    setT(targets, eleven, WIDTH.touchR, 42);
    return;
  }
  if (defFormation === '3-5-2') {
    const { cbs, wbs, fbs } = splitBacks(def.back);
    const wings = wbs.length ? wbs : fbs;
    placeWideLine(cbs.slice(0, 3), 12, 16).forEach((v, k) => targets.set(k, v));
    if (wings[0]) setT(targets, wings[0], WIDTH.touchR, 16);
    if (wings[1]) setT(targets, wings[1], WIDTH.touchL, 18);
    placeWideLine(def.mid.slice(0, 3), 26, 18).forEach((v, k) => targets.set(k, v));
    placeLine(def.front.slice(0, 2), focus, 38, 16).forEach((v, k) => targets.set(k, v));
    return;
  }
  placeWideLine(def.back.slice(0, 4), 12, 22).forEach((v, k) => targets.set(k, v));
  placeWideLine(def.mid.slice(0, 4), 26, 20).forEach((v, k) => targets.set(k, v));
  placeLine(def.front.slice(0, 3), focus, 40, 18).forEach((v, k) => targets.set(k, v));
}

/** Formation-specific ATT chassis for one play-out sub-phase. */
function placeAttChassis(
  targets: Map<string, { x: number; y: number }>,
  att: { gk: Player[]; back: Player[]; mid: Player[]; front: Player[]; all: Player[] },
  focus: { x: number; y: number },
  phase: PlayOutSubPhase,
  formation: FormationId11,
  channelX: number
) {
  for (const p of att.gk) setT(targets, p, 50, 94);
  const { cbs, fbs, wbs } = splitBacks(att.back);
  const team = att.all;
  const six =
    pickRole(team, /^(CDM|DM)$/, 6) || pickByNumber(att.mid, 6) || att.mid[0];
  const eight =
    pickRole(team, /^(CM|CDM|DM)$/, 8, six ? [six] : []) ||
    att.mid.find((p) => p !== six);
  const ten =
    pickRole(team, /^(CAM|AM|CM)$/, 10, [six, eight].filter(Boolean) as Player[]) ||
    pickByNumber(team, 10);
  const nine = pickRole(team, /^(ST|CF)$/, 9) || att.front[0];
  const seven =
    pickRole(team, /^(RW|RM|RAM|RF)$/, 7, nine ? [nine] : []) ||
    pickByNumber(team, 7);
  const eleven =
    pickRole(team, /^(LW|LM|LAM|LF)$/, 11, [nine, seven].filter(Boolean) as Player[]) ||
    pickByNumber(team, 11);

  const rb =
    pickRole(att.back, /^RB$/, 2) ||
    fbs.find((p) => p.number === 2 || /RB/i.test(roleOf(p))) ||
    fbs[0] ||
    wbs.find((p) => /RWB/i.test(roleOf(p))) ||
    wbs[0];
  const lb =
    pickRole(att.back, /^LB$/, 3, rb ? [rb] : []) ||
    fbs.find((p) => p !== rb && (p.number === 3 || /LB/i.test(roleOf(p)))) ||
    fbs[1] ||
    wbs.find((p) => p !== rb) ||
    wbs[1];
  const rwb =
    pickRole(att.back, /^RWB$/, 2) || wbs.find((p) => /RWB/i.test(roleOf(p))) || wbs[0];
  const lwb =
    pickRole(att.back, /^LWB$/, 11, rwb ? [rwb] : []) ||
    wbs.find((p) => p !== rwb) ||
    wbs[1];

  const activeRight = channelX >= 50;
  // Action bias for ST/#10 only — structure stays pitch-wide
  const lane = clamp(Math.max(38, Math.min(62, focus.x)));

  if (phase === 'goal_kick') {
    // Every 4-back: CBs inside the box (spread); RB/LB outside + high
    if (isFourBackFormation(formation)) {
      placeAttFourBackBuildOut(targets, cbs, rb, lb, focus.y, channelX);
    }

    if (formation === '4-3-3') {
      // Playbook: split CBs + #6 drops BETWEEN them (temp back-three vs first-line press)
      const cbY = clamp(Math.max(focus.y + 2, 87));
      setT(targets, six, 50, cbY);
      setT(targets, eight, WIDTH.halfL, focus.y - 24);
      setT(targets, ten, WIDTH.halfR, focus.y - 24);
      setT(targets, seven, WIDTH.touchR - 4, 50);
      setT(targets, nine, 50, 46);
      setT(targets, eleven, WIDTH.touchL + 4, 50);
      return;
    }
    if (formation === '4-4-2') {
      // Def-third: CB square · CM square · #2/#3 between those lines ·
      // #7/#11 open in the wide channels · #9+#10 on own half at halfway
      const cbY = clamp(Math.max(focus.y + 2, 87));
      const midY = clamp(focus.y - 16); // ~70 — screening platform
      const fbY = clamp((cbY + midY) / 2); // between CB line and midfield line
      const frontY = 51; // own half, right on the halfway line

      setT(targets, eight, WIDTH.midR, midY);
      setT(targets, six, WIDTH.midL, midY);
      // Override shared FB depth — sit between CB and CM lines, touchline width
      setT(targets, rb, WIDTH.touchR, fbY);
      setT(targets, lb, WIDTH.touchL, fbY);

      const rm = pickRole(team, /^RM$/, 7) || seven;
      const lm = pickRole(team, /^LM$/, 11) || eleven;
      // Open in the wide channel (outside half-space, not tucked)
      setT(targets, rm, WIDTH.halfR + 14, frontY);
      setT(targets, lm, WIDTH.halfL - 14, frontY);

      const sts = team.filter((p) => /^(ST|CF)$/.test(roleOf(p))).slice(0, 2);
      if (sts.length >= 2) {
        setT(targets, sts[0], 58, frontY);
        setT(targets, sts[1], 42, frontY);
      } else {
        placeWideLine(att.front.slice(0, 2), frontY, 16).forEach((v, k) => targets.set(k, v));
      }
      return;
    }
    if (formation === '4-2-3-1') {
      // Ideal Def-third playout: split CBs · #6+#8 platform · #2/#3 in line with pivots ·
      // #7/#11 just outside the half-spaces (not on absolute touchline) · #10/#9 high
      const pivotSix =
        att.mid.find((p) => p.number === 6 || /^(CDM|DM)$/i.test(roleOf(p))) || six;
      const pivotEight =
        att.mid.find(
          (p) => p !== pivotSix && (p.number === 8 || /^(CDM|DM)$/i.test(roleOf(p)))
        ) || eight;

      const platformY = focus.y - 14;
      // Double pivot platform in front of split CBs (#8 top / #6 bottom)
      setT(targets, pivotEight, WIDTH.midR, platformY);
      setT(targets, pivotSix, WIDTH.midL, platformY);
      // FBs on the touchline, SAME depth as #6/#8
      setT(targets, rb, WIDTH.touchR, platformY);
      setT(targets, lb, WIDTH.touchL, platformY);
      // #10 between platform and halfway — not on the first line
      setT(targets, ten, 50, 58);
      // #7/#9/#11 on own half, right on the halfway line (#7/#11 just outside half-spaces)
      const frontY = 51;
      setT(targets, seven, WIDTH.halfR + 10, frontY);
      setT(targets, eleven, WIDTH.halfL - 10, frontY);
      setT(targets, nine, 50, frontY);
      return;
    }
    if (formation === '3-5-2') {
      // Def-third: #4 drops to GK · other 2 CBs open · #6/#8/#7/#9 box ·
      // #10 links the box · WBs #2/#11 high as #10
      const three = (cbs.length >= 3 ? cbs : att.back.filter((p) => !isWb(p))).slice(0, 3);
      const four =
        pickByNumber(team, 4) ||
        three.find((p) => p.number === 4) ||
        three.find((p) => p.number === 5) ||
        three[1] ||
        three[0];
      const openCbs = three.filter((p) => p !== four).slice(0, 2);
      const openR =
        openCbs.find((p) => p.number === 5) ||
        [...openCbs].sort((a, b) => b.x - a.x)[0];
      const openL = openCbs.find((p) => p !== openR) || openCbs[1];

      const dropY = 90; // same deep band as GK, but not on top of the keeper
      const openCbY = clamp(Math.max(focus.y + 2, 87));
      // #4 drops to GK level — slide off the keeper (GK stays central)
      setT(targets, four, 58, dropY);
      setT(targets, openR, WIDTH.boxCbR, openCbY);
      setT(targets, openL, WIDTH.boxCbL, openCbY);

      // Midfield box: #6+#8 deep, #7+#9 high (same lanes → clean rectangle)
      const boxBackY = clamp(focus.y - 16); // ~70
      const boxFrontY = clamp(focus.y - 28); // ~58
      const linkY = clamp((boxBackY + boxFrontY) / 2); // #10 links between the lines
      const sevenCm = pickByNumber(team, 7) || seven;
      const tenLink = pickByNumber(team, 10) || ten;

      setT(targets, six, WIDTH.midL, boxBackY);
      setT(targets, eight, WIDTH.midR, boxBackY);
      setT(targets, sevenCm, WIDTH.midL, boxFrontY);
      setT(targets, nine, WIDTH.midR, boxFrontY);
      setT(targets, tenLink, 50, linkY);

      // Wing-backs high as the #10, hard on the touchline
      setT(targets, rwb || rb || pickByNumber(team, 2), WIDTH.touchR, linkY);
      setT(targets, lwb || pickByNumber(team, 11) || lb, WIDTH.touchL, linkY);
      return;
    }
  }

  if (phase === 'pocket') {
    if (formation === '4-3-3') {
      // Middle-third Center: balanced midfield duel (#6/#8/#10 in the yellow box)
      const centered = Math.abs(channelX - 50) <= 10;
      if (centered) {
        const rcb =
          cbs.find((p) => p.number === 4 || /^RCB$/i.test(roleOf(p))) ||
          [...cbs].sort((a, b) => b.x - a.x)[0];
        const lcb =
          cbs.find((p) => p !== rcb && (p.number === 5 || /^LCB$/i.test(roleOf(p)))) ||
          [...cbs].filter((p) => p !== rcb).sort((a, b) => a.x - b.x)[0];
        setT(targets, rcb, WIDTH.cbR, 72);
        setT(targets, lcb, WIDTH.cbL, 72);
        setT(targets, rb, WIDTH.touchR, 48);
        setT(targets, lb, WIDTH.touchL, 48);
        // Pivot deeper on own side of center; #8/#10 either side of halfway
        setT(targets, six, 50, 56);
        setT(targets, eight, WIDTH.midR + 4, 50);
        setT(targets, ten, WIDTH.midL - 4, 50);
        // #9 between lines (opp side of center); wings high-wide
        setT(targets, nine, 50, 40);
        setT(targets, seven, WIDTH.touchR, 28);
        setT(targets, eleven, WIDTH.touchL, 32);
        return;
      }
      // L/R channel: active-flank triangle + opposite stretch
      setT(targets, cbs[0], WIDTH.cbR, focus.y + 18);
      setT(targets, cbs[1], WIDTH.cbL, focus.y + 18);
      setT(targets, six, lane, focus.y);
      setT(targets, activeRight ? rb : lb, activeRight ? WIDTH.touchR : WIDTH.touchL, focus.y + 4);
      setT(targets, activeRight ? eight : ten, activeRight ? WIDTH.halfR : WIDTH.halfL, focus.y - 6);
      setT(
        targets,
        activeRight ? seven : eleven,
        activeRight ? WIDTH.touchR - 6 : WIDTH.touchL + 6,
        focus.y - 14
      );
      setT(targets, activeRight ? lb : rb, activeRight ? WIDTH.touchL : WIDTH.touchR, focus.y + 8);
      setT(
        targets,
        activeRight ? eleven : seven,
        activeRight ? WIDTH.touchL + 6 : WIDTH.touchR - 6,
        focus.y - 8
      );
      setT(targets, nine, lane, focus.y - 18);
      setT(targets, activeRight ? ten : eight, activeRight ? WIDTH.midL : WIDTH.midR, focus.y - 4);
      return;
    }
    if (formation === '4-4-2') {
      setT(targets, lb, WIDTH.touchL, focus.y + 14);
      setT(targets, cbs[1], WIDTH.cbL, focus.y + 16);
      setT(targets, cbs[0], WIDTH.cbR, focus.y + 16);
      setT(targets, rb, WIDTH.touchR, focus.y + 14);
      setT(targets, six, WIDTH.midL, focus.y);
      setT(targets, eight, WIDTH.midR, focus.y);
      // Asymmetry: one wide, one tuck
      setT(targets, seven, activeRight ? WIDTH.touchR : WIDTH.halfR, focus.y - 6);
      setT(targets, eleven, activeRight ? WIDTH.halfL : WIDTH.touchL, focus.y - 4);
      placeWideLine(att.front.slice(0, 2), focus.y - 16, 14).forEach((v, k) =>
        targets.set(k, v)
      );
      return;
    }
    if (formation === '4-2-3-1') {
      setT(targets, cbs[0], WIDTH.cbR, focus.y + 18);
      setT(targets, cbs[1], WIDTH.cbL, focus.y + 18);
      setT(targets, six, WIDTH.midL, focus.y + 8);
      setT(targets, eight, WIDTH.midR, focus.y + 8);
      setT(targets, ten, lane, focus.y - 4);
      setT(targets, activeRight ? rb : lb, activeRight ? WIDTH.touchR : WIDTH.touchL, focus.y);
      setT(
        targets,
        activeRight ? seven : eleven,
        activeRight ? WIDTH.halfR + 4 : WIDTH.halfL - 4,
        focus.y - 12
      );
      setT(
        targets,
        activeRight ? eleven : seven,
        activeRight ? WIDTH.halfL : WIDTH.halfR,
        focus.y - 8
      );
      setT(targets, nine, lane, focus.y - 18);
      setT(targets, activeRight ? lb : rb, activeRight ? WIDTH.touchL : WIDTH.touchR, focus.y + 8);
      return;
    }
    if (formation === '3-5-2') {
      const three = (cbs.length >= 3 ? cbs : att.back.filter((p) => !isWb(p))).slice(0, 3);
      setT(targets, three[0], WIDTH.halfR, focus.y + 18);
      setT(targets, three[1], 50, focus.y + 8);
      setT(targets, three[2], WIDTH.halfL, focus.y + 18);
      setT(targets, six, 50, focus.y + 2);
      setT(targets, eight, WIDTH.midR, focus.y - 4);
      setT(targets, ten, WIDTH.midL, focus.y - 4);
      setT(targets, rwb || rb, WIDTH.touchR, focus.y - 8);
      setT(targets, lwb || lb, WIDTH.touchL, focus.y - 8);
      placeWideLine(att.front.slice(0, 2), focus.y - 16, 14).forEach((v, k) =>
        targets.set(k, v)
      );
      return;
    }
  }

  // ── final_third / attack — max width from FBs/WBs; interiors in half-spaces ──
  if (formation === '4-3-3') {
    // Attacking third: CBs near halfway · #6 rest-defense · #8/#10 late ·
    // false-nine #9 drops · inverted #7/#11 · FBs high-wide for cutbacks
    const rcb =
      cbs.find((p) => p.number === 4 || /^RCB$/i.test(roleOf(p))) ||
      [...cbs].sort((a, b) => b.x - a.x)[0];
    const lcb =
      cbs.find((p) => p !== rcb && (p.number === 5 || /^LCB$/i.test(roleOf(p)))) ||
      [...cbs].filter((p) => p !== rcb).sort((a, b) => a.x - b.x)[0];
    const sixP = pickByNumber(team, 6) || six;
    const eightP = pickByNumber(team, 8) || eight;
    const tenP = pickByNumber(team, 10) || ten;
    const nineP = pickByNumber(team, 9) || nine;
    const sevenP = pickByNumber(team, 7) || seven;
    const elevenP = pickByNumber(team, 11) || eleven;

    setT(targets, rcb, WIDTH.cbR, 52);
    setT(targets, lcb, WIDTH.cbL, 52);
    setT(targets, sixP, 50, 40);
    // Late midfield arrivals toward the box
    setT(targets, eightP, WIDTH.midR, 28);
    setT(targets, tenP, WIDTH.midL, 28);
    // False nine drops between midfield and the back line
    setT(targets, nineP, 50, 22);
    // Inverted wingers in the half-spaces
    setT(targets, sevenP, WIDTH.halfR, 14);
    setT(targets, elevenP, WIDTH.halfL, 16);
    // FBs overlap high-wide for cutbacks
    setT(targets, rb, WIDTH.touchR, 14);
    setT(targets, lb, WIDTH.touchL, 18);
    return;
  }
  if (formation === '4-4-2') {
    // Attacking third: CBs near halfway · FBs high-wide · #6/#8 edge of box ·
    // #7/#11 at box corners · twin STs #9/#10 in the box
    const rcb =
      cbs.find((p) => p.number === 4 || /^RCB$/i.test(roleOf(p))) ||
      [...cbs].sort((a, b) => b.x - a.x)[0];
    const lcb =
      cbs.find((p) => p !== rcb && (p.number === 5 || /^LCB$/i.test(roleOf(p)))) ||
      [...cbs].filter((p) => p !== rcb).sort((a, b) => a.x - b.x)[0];
    const rm = pickRole(team, /^RM$/, 7) || seven;
    const lm = pickRole(team, /^LM$/, 11) || eleven;
    const sts = team.filter((p) => /^(ST|CF)$/.test(roleOf(p))).slice(0, 2);
    const st9 = sts.find((p) => p.number === 9) || sts[0];
    const st10 = sts.find((p) => p !== st9) || sts[1];

    setT(targets, rcb, WIDTH.cbR, 52);
    setT(targets, lcb, WIDTH.cbL, 52);
    // FBs provide width — #2 highest, #3 slightly deeper
    setT(targets, rb, WIDTH.touchR, 22);
    setT(targets, lb, WIDTH.touchL, 30);
    // CMs just outside the box (yellow zone)
    setT(targets, eight, WIDTH.midR, 26);
    setT(targets, six, WIDTH.midL, 26);
    // Wide mids at the corners of the 18
    setT(targets, rm, WIDTH.halfR + 10, 14);
    setT(targets, lm, WIDTH.halfL - 10, 16);
    // Twin STs inside / on the edge of the box
    setT(targets, st9, 58, 12);
    setT(targets, st10, 42, 12);
    return;
  }
  if (formation === '4-2-3-1') {
    // Attacking third: CBs near halfway · FBs high-wide · #6+#8 pivot ·
    // #7/#11 in half-spaces · #10 on the ball · #9 at the D
    const rcb =
      cbs.find((p) => p.number === 4 || /^RCB$/i.test(roleOf(p))) ||
      [...cbs].sort((a, b) => b.x - a.x)[0];
    const lcb =
      cbs.find((p) => p !== rcb && (p.number === 5 || /^LCB$/i.test(roleOf(p)))) ||
      [...cbs].filter((p) => p !== rcb).sort((a, b) => a.x - b.x)[0];
    const pivotSix =
      pickByNumber(team, 6) ||
      pickRole(team, /^(CDM|DM)$/, 6) ||
      six;
    const pivotEight =
      pickByNumber(team, 8) ||
      pickRole(team, /^(CDM|DM)$/, 8, pivotSix ? [pivotSix] : []) ||
      eight;
    const tenP = pickByNumber(team, 10) || ten;
    const sevenP = pickByNumber(team, 7) || seven;
    const elevenP = pickByNumber(team, 11) || eleven;
    const nineP = pickByNumber(team, 9) || nine;

    setT(targets, rcb, WIDTH.cbR, 52);
    setT(targets, lcb, WIDTH.cbL, 52);
    // Overlapping FBs — width high up the flanks
    setT(targets, rb, WIDTH.touchR, 20);
    setT(targets, lb, WIDTH.touchL, 24);
    // Double pivot at the back of the yellow box
    setT(targets, pivotEight, WIDTH.midR, 36);
    setT(targets, pivotSix, WIDTH.midL, 36);
    // Wide AMs in the half-spaces inside the yellow box
    setT(targets, sevenP, WIDTH.halfR, 18);
    setT(targets, elevenP, WIDTH.halfL, 18);
    // #10 between the lines on the ball; #9 at the D
    setT(targets, tenP, 50, 20);
    setT(targets, nineP, 50, 12);
    return;
  }
  // 3-5-2 attack: back three on halfway · WBs high-wide · #8/#6 platform ·
  // #10 between lines on the ball · twin forwards #9/#7 at the D
  {
    const three = (cbs.length >= 3 ? cbs : att.back.filter((p) => !isWb(p))).slice(0, 3);
    const cb5 =
      pickByNumber(team, 5) ||
      three.find((p) => p.number === 5) ||
      [...three].sort((a, b) => b.x - a.x)[0];
    const cb4 =
      pickByNumber(team, 4) ||
      three.find((p) => p !== cb5 && p.number === 4) ||
      three.find((p) => p !== cb5);
    const cb3 =
      pickByNumber(team, 3) ||
      three.find((p) => p !== cb5 && p !== cb4) ||
      [...three].sort((a, b) => a.x - b.x)[0];
    const eightP = pickByNumber(team, 8) || eight;
    const sixP = pickByNumber(team, 6) || six;
    // Screenshot: #10 links centrally (may be rostered as ST)
    const tenP = pickByNumber(team, 10) || ten;
    const nineP = pickByNumber(team, 9) || nine;
    // Screenshot: #7 is the second forward (may be rostered as CM)
    const sevenP = pickByNumber(team, 7) || seven;

    setT(targets, cb5, WIDTH.halfR, 50);
    setT(targets, cb4, 50, 48);
    setT(targets, cb3, WIDTH.halfL, 50);
    // Wing-backs high-wide, level with the mid platform
    setT(targets, rwb || rb || pickByNumber(team, 2), WIDTH.touchR, 32);
    setT(targets, lwb || lb || pickByNumber(team, 11), WIDTH.touchL, 32);
    // #8/#6 at the back of the yellow box
    setT(targets, eightP, WIDTH.midR, 34);
    setT(targets, sixP, WIDTH.midL, 34);
    // #10 between the lines, on the ball
    setT(targets, tenP, 50, 20);
    // Twin forwards at the corners of the D
    setT(targets, nineP, 58, 14);
    setT(targets, sevenP, 42, 14);
  }
}

function motifArrows(
  phase: PlayOutSubPhase,
  formation: FormationId11,
  att: { gk: Player[]; back: Player[]; mid: Player[]; front: Player[]; all: Player[] },
  def: { front: Player[]; mid: Player[] },
  channelX: number
): Arrow[] {
  const arrows: Arrow[] = [];
  const id = (p?: Player) => p?.id;
  const { cbs, fbs, wbs } = splitBacks(att.back);
  const team = att.all;
  const six = pickRole(team, /^(CDM|DM)$/, 6) || att.mid[0];
  const eight =
    pickRole(team, /^(CM|CDM|DM)$/, 8, six ? [six] : []) || att.mid.find((p) => p !== six);
  const ten = pickRole(team, /^(CAM|AM|CM)$/, 10) || pickByNumber(team, 10);
  const nine = pickRole(team, /^(ST|CF)$/, 9) || att.front[0];
  const seven =
    pickRole(team, /^(RW|RM|RAM|RF)$/, 7, nine ? [nine] : []) || pickByNumber(team, 7);
  const eleven =
    pickRole(team, /^(LW|LM|LAM|LF)$/, 11, [nine, seven].filter(Boolean) as Player[]) ||
    pickByNumber(team, 11);
  const rb =
    pickRole(att.back, /^RB$/, 2) || fbs[0] || wbs[0];
  const lb =
    pickRole(att.back, /^LB$/, 3, rb ? [rb] : []) || fbs.find((p) => p !== rb) || wbs[1];
  const press = def.front[0];
  const cover = def.mid[0];
  const activeRight = channelX >= 50;

  if (phase === 'goal_kick') {
    const gk = att.gk[0];
    const cb = cbs[0] || att.back[0];
    if (id(gk) && id(cb)) arrows.push(arrow(id(gk)!, id(cb)!, 'pass', 'solid'));
    if (formation === '4-3-3' && id(six) && id(cb)) {
      arrows.push(arrow(id(six)!, id(cb)!, 'run', 'dashed')); // drop between
    }
    if (formation === '4-2-3-1' && id(six) && id(cb)) {
      arrows.push(arrow(id(cb)!, id(six)!, 'pass', 'solid'));
    }
    if (formation === '3-5-2' && id(cbs[1]) && id(six)) {
      arrows.push(arrow(id(cbs[1])!, id(six)!, 'pass', 'dashed')); // libero → sluice
    }
    if (id(press) && id(cb)) arrows.push(arrow(id(press)!, id(cb)!, 'press', 'solid'));
    if (id(def.front[1]) && id(cbs[1])) {
      arrows.push(arrow(id(def.front[1])!, id(cbs[1])!, 'press', 'dashed'));
    }
    return arrows;
  }

  if (phase === 'pocket') {
    const feeder = cbs[0] || rb || att.back[0];
    if (formation === '4-3-3') {
      const wing = activeRight ? seven : eleven;
      const fb = activeRight ? rb : lb;
      const cm = activeRight ? eight || ten : ten || eight;
      if (id(feeder) && id(six)) arrows.push(arrow(id(feeder)!, id(six)!, 'pass', 'solid'));
      if (id(six) && id(cm)) arrows.push(arrow(id(six)!, id(cm)!, 'pass', 'dashed'));
      if (id(fb) && id(wing)) arrows.push(arrow(id(fb)!, id(wing)!, 'run', 'dashed')); // flank triangle
      if (id(cover) && id(six)) arrows.push(arrow(id(cover)!, id(six)!, 'press', 'solid'));
      if (id(press) && id(six)) arrows.push(arrow(id(press)!, id(six)!, 'cover', 'dotted'));
      return arrows;
    }
    if (formation === '4-4-2') {
      if (id(feeder) && id(six)) arrows.push(arrow(id(feeder)!, id(six)!, 'pass', 'solid'));
      if (id(six) && id(eight)) arrows.push(arrow(id(six)!, id(eight)!, 'pass', 'solid'));
      const wide = activeRight ? seven : eleven;
      const tuck = activeRight ? eleven : seven;
      if (id(eight) && id(wide)) arrows.push(arrow(id(eight)!, id(wide)!, 'pass', 'dashed'));
      if (id(tuck) && id(nine)) arrows.push(arrow(id(tuck)!, id(nine)!, 'run', 'dashed')); // tuck
      if (id(cover) && id(six)) arrows.push(arrow(id(cover)!, id(six)!, 'press', 'solid'));
      return arrows;
    }
    if (formation === '4-2-3-1') {
      if (id(six) && id(ten)) arrows.push(arrow(id(six)!, id(ten)!, 'pass', 'solid')); // into #10
      if (id(eight) && id(ten)) arrows.push(arrow(id(eight)!, id(ten)!, 'run', 'dashed'));
      const fb = activeRight ? rb : lb;
      if (id(ten) && id(fb)) arrows.push(arrow(id(ten)!, id(fb)!, 'pass', 'dashed'));
      if (id(cover) && id(ten)) arrows.push(arrow(id(cover)!, id(ten)!, 'press', 'solid'));
      return arrows;
    }
    // 3-5-2
    if (id(cbs[1]) && id(six)) arrows.push(arrow(id(cbs[1])!, id(six)!, 'pass', 'solid'));
    if (id(six) && id(ten)) arrows.push(arrow(id(six)!, id(ten)!, 'pass', 'dashed'));
    const wb = activeRight ? rb : lb;
    if (id(eight) && id(wb)) arrows.push(arrow(id(eight)!, id(wb)!, 'run', 'dashed')); // contra
    if (id(cover) && id(six)) arrows.push(arrow(id(cover)!, id(six)!, 'press', 'solid'));
    return arrows;
  }

  // attack / final third
  if (formation === '4-3-3') {
    if (id(six) && id(nine)) arrows.push(arrow(id(nine)!, id(six)!, 'run', 'dashed')); // false nine drop
    if (id(nine) && id(seven)) arrows.push(arrow(id(nine)!, id(seven)!, 'pass', 'solid'));
    if (id(rb) && id(nine)) arrows.push(arrow(id(rb)!, id(nine)!, 'pass', 'dashed')); // cutback
    if (id(cover) && id(six)) arrows.push(arrow(id(cover)!, id(six)!, 'press', 'solid'));
    return arrows;
  }
  if (formation === '4-4-2') {
    const st2 = att.front.find((p) => p !== nine) || att.front[1];
    if (id(nine) && id(st2)) arrows.push(arrow(id(nine)!, id(st2)!, 'pass', 'solid')); // hold-up → runner
    if (id(seven) && id(nine)) arrows.push(arrow(id(seven)!, id(nine)!, 'pass', 'dashed'));
    if (id(rb) && id(seven)) arrows.push(arrow(id(rb)!, id(seven)!, 'run', 'dashed')); // overlap
    if (id(cover) && id(nine)) arrows.push(arrow(id(cover)!, id(nine)!, 'press', 'solid'));
    return arrows;
  }
  if (formation === '4-2-3-1') {
    if (id(ten) && id(nine)) arrows.push(arrow(id(ten)!, id(nine)!, 'pass', 'solid'));
    if (id(seven) && id(ten)) arrows.push(arrow(id(seven)!, id(ten)!, 'run', 'dashed'));
    if (id(rb) && id(nine)) arrows.push(arrow(id(rb)!, id(nine)!, 'pass', 'dashed')); // FB cutback lane
    if (id(rb) && id(seven)) arrows.push(arrow(id(rb)!, id(seven)!, 'run', 'dashed'));
    if (id(cover) && id(ten)) arrows.push(arrow(id(cover)!, id(ten)!, 'press', 'solid'));
    return arrows;
  }
  // 3-5-2
  if (id(ten) && id(nine)) arrows.push(arrow(id(ten)!, id(nine)!, 'pass', 'solid'));
  if (id(rb) && id(nine)) arrows.push(arrow(id(rb)!, id(nine)!, 'pass', 'dashed')); // WB cross
  if (id(eight) && id(nine)) arrows.push(arrow(id(eight)!, id(nine)!, 'run', 'dashed'));
  if (id(cover) && id(ten)) arrows.push(arrow(id(cover)!, id(ten)!, 'press', 'solid'));
  return arrows;
}

/** Place ATT + DEF for one play-out sub-phase using existing roster ids. */
export function placePhaseSnapshot(input: {
  roster: Player[];
  subPhase: PlayOutSubPhase;
  attFormation: FormationId11;
  defFormation: FormationId11;
  channelX: number;
  defBlock?: DefBlockHeight;
  /** Motif pass/press arrows — on for AI play-out, off for Setup shape. */
  includeMotifArrows?: boolean;
}): {
  players: Player[];
  arrows: Arrow[];
  areas: WebDiagramV1['areas'];
  labels: WebDiagramV1['labels'];
  balls: WebDiagramV1['balls'];
  title: string;
} {
  const {
    roster,
    subPhase: phase,
    attFormation,
    defFormation,
    channelX,
    defBlock = 'high',
    includeMotifArrows = true,
  } = input;

  const g = geomForPhase(phase, channelX, attFormation);
  const focus = g.focus;

  const att = {
    gk: byBand(roster, 'ATT', 'GK'),
    back: byBand(roster, 'ATT', 'BACK'),
    mid: byBand(roster, 'ATT', 'MID'),
    front: byBand(roster, 'ATT', 'FRONT'),
    all: roster.filter((p) => p.team === 'ATT'),
  };
  const def = {
    gk: byBand(roster, 'DEF', 'GK'),
    back: byBand(roster, 'DEF', 'BACK'),
    mid: byBand(roster, 'DEF', 'MID'),
    front: byBand(roster, 'DEF', 'FRONT'),
  };

  const targets = new Map<string, { x: number; y: number }>();
  placeAttChassis(targets, att, focus, phase, attFormation, channelX);
  placeDefBlock(targets, def, focus, phase, defBlock, defFormation);

  // Fallback: anyone without a target gets a generic band place
  let fallbackI = 0;
  for (const p of roster) {
    if (targets.has(p.id)) continue;
    const band = roleBand(p);
    const y =
      p.team === 'ATT'
        ? band === 'GK'
          ? 94
          : band === 'BACK'
            ? focus.y + 10
            : band === 'MID'
              ? focus.y
              : focus.y - 16
        : band === 'GK'
          ? 6
          : band === 'BACK'
            ? focus.y - 20
            : band === 'MID'
              ? focus.y - 8
              : focus.y - 10; // DEF FRONT — press side of the ball, never behind ATT
    const xOff = ((fallbackI % 5) - 2) * 6;
    fallbackI += 1;
    setT(targets, p, focus.x + xOff, y);
  }

  const playersRaw = separate(applyTargets(roster, targets));
  // Restore chassis after separation — keep locked playout / midfield shapes
  let players = playersRaw.map((p) => {
    const t = targets.get(p.id);
    if (!t) return p;
    if (
      (phase === 'goal_kick' || phase === 'pocket' || phase === 'final_third') &&
      (p.team === 'DEF' || p.team === 'ATT')
    ) {
      return { ...p, x: t.x, y: t.y };
    }
    return p;
  });
  // Hard rule: never leave shirts stacked (chassis restore can reintroduce overlaps)
  players = enforceNoOverlap(players);

  const arrows = includeMotifArrows
    ? motifArrows(phase, attFormation, att, def, channelX)
    : [];

  const captions = playOutCaptions(attFormation, phase, defBlock);
  if (phase === 'goal_kick') {
    const defCues = boardCuesFor(defFormation, phaseKeyForPlayOut(phase)).slice(0, 1);
    for (const c of defCues) captions.push(`DEF ${defFormation}: ${c}`.slice(0, 200));
  }

  const stack = labelStackAwayFromEmphasis(g.area, Math.min(3, captions.length), focus.x);
  const labels = captions.slice(0, 3).map((text, i) => ({
    text: text.slice(0, 200),
    x: stack[i]?.x ?? clamp(90 - i * 13),
    y: stack[i]?.y ?? 76,
  }));

  // Build-out ball: 4-2-3-1 sits with the pivot platform; other shapes with the ball-side CB
  // Middle-third Center: ball on the center spot
  const carrierY = phase === 'goal_kick' ? clamp(Math.max(focus.y + 2, 87)) : focus.y;
  const ballAt =
    phase === 'pocket' && Math.abs(channelX - 50) <= 10
      ? { x: 50, y: 50 }
      : phase === 'final_third' &&
          (attFormation === '4-4-2' ||
            attFormation === '3-5-2' ||
            attFormation === '4-2-3-1' ||
            attFormation === '4-3-3')
        ? {
            x: 50,
            y:
              attFormation === '4-3-3'
                ? 22
                : attFormation === '4-2-3-1' || attFormation === '3-5-2'
                  ? 20
                  : 18,
          }
        : phase === 'goal_kick' && attFormation === '4-2-3-1'
          ? { x: 50, y: clamp(focus.y - 16) } // ahead of CBs, between #6+#8 platform and #10
          : phase === 'goal_kick'
            ? {
                x: clamp(focus.x + (focus.x >= 50 ? -5 : focus.x <= 50 ? 5 : 4)),
                y: clamp(carrierY - 4),
              }
            : { x: focus.x, y: focus.y };

  // 4-4-2 Def-third: double yellow squares — CB unit + CM screening unit
  // 3-5-2 Def-third: yellow square on the #6/#8/#7/#9 midfield box
  const areas: WebDiagramV1['areas'] =
    phase === 'goal_kick' && attFormation === '4-4-2'
      ? [
          {
            x: 26,
            y: 80,
            width: 48,
            height: 16,
            shape: 'rect',
            label: 'CB unit',
          },
          {
            x: 28,
            y: 62,
            width: 44,
            height: 16,
            shape: 'rect',
            label: 'CM screen',
          },
        ]
      : phase === 'goal_kick' && attFormation === '3-5-2'
        ? [
            {
              x: 28,
              y: 54,
              width: 44,
              height: 22,
              shape: 'rect',
              label: 'Midfield box',
            },
          ]
        : [g.area];

  return {
    players,
    arrows,
    areas,
    labels,
    balls: [ballAt],
    title: g.title,
  };
}

/** Place ATT + DEF for one play-out sub-phase (infers formations/channel from message). */
export function placePlayOutFrame(
  roster: Player[],
  phase: PlayOutSubPhase,
  message: string
): {
  players: Player[];
  arrows: Arrow[];
  areas: WebDiagramV1['areas'];
  labels: WebDiagramV1['labels'];
  balls: WebDiagramV1['balls'];
  title: string;
} {
  const formations = resolvePlayOutFormations(roster, message);
  return placePhaseSnapshot({
    roster,
    subPhase: phase,
    attFormation: formations.att,
    defFormation: formations.def,
    channelX: inferChannelX(message),
    defBlock: inferDefBlockHeight(message),
    includeMotifArrows: true,
  });
}

export type SetupPhaseId = 'ATTACKING' | 'DEFENDING' | 'TRANSITION';
export type SetupZoneId = 'DEFENSIVE_THIRD' | 'MIDDLE_THIRD' | 'ATTACKING_THIRD';
export type SetupChannelId = 'LEFT' | 'CENTER' | 'RIGHT';

/** Setup zone → play-out chassis frame (Attacking / Defending / Transition share zone geometry). */
export function mapSetupToSubPhase(_phase: SetupPhaseId, zone: SetupZoneId): PlayOutSubPhase {
  if (zone === 'DEFENSIVE_THIRD') return 'goal_kick';
  if (zone === 'MIDDLE_THIRD') return 'pocket';
  return 'final_third';
}

export function mapSetupChannelX(channel: SetupChannelId): number {
  if (channel === 'LEFT') return 28;
  if (channel === 'RIGHT') return 72;
  return 50;
}

function asFormationId11(value: unknown, fallback: FormationId11): FormationId11 {
  const s = String(value || '');
  if (s === '4-3-3' || s === '4-4-2' || s === '4-2-3-1' || s === '3-5-2') return s;
  return fallback;
}

/**
 * Apply Setup phase/zone/channel using the same chassis as AI play-out.
 * Clears sequence — this is a fresh starting shape.
 */
export function applySetupPhaseToDiagram(
  diagram: WebDiagramV1,
  input: {
    phase: SetupPhaseId;
    zone: SetupZoneId;
    channel: SetupChannelId;
    attFormation?: string | null;
    defFormation?: string | null;
    defBlock?: DefBlockHeight;
    /** When false, only the subject team (Blue if attacking, Red if defending) is kept. */
    showOpposition?: boolean;
  }
): WebDiagramV1 {
  const attFormation = asFormationId11(input.attFormation, '4-3-3');
  const defFormation = asFormationId11(input.defFormation, '4-4-2');
  const subPhase = mapSetupToSubPhase(input.phase, input.zone);
  const channelX = mapSetupChannelX(input.channel);
  const showOpposition = input.showOpposition !== false;
  const subjectTeam: 'ATT' | 'DEF' = input.phase === 'DEFENDING' ? 'DEF' : 'ATT';

  const existing = diagram.players || [];
  const attN = existing.filter((p) => p.team === 'ATT').length;
  const defN = existing.filter((p) => p.team === 'DEF').length;

  const roster: Player[] = [];
  if (attN >= 10 || attN === 0) {
    roster.push(...build11v11FormationPlayers(attFormation, 'ATT'));
  } else {
    roster.push(...existing.filter((p) => p.team === 'ATT'));
  }
  if (defN >= 10 || defN === 0) {
    roster.push(...build11v11FormationPlayers(defFormation, 'DEF'));
  } else {
    roster.push(...existing.filter((p) => p.team === 'DEF'));
  }
  roster.push(...existing.filter((p) => p.team !== 'ATT' && p.team !== 'DEF'));

  const subjectCount = roster.filter((p) => p.team === subjectTeam).length;
  if (subjectCount < 4) {
    return diagram;
  }

  const placed = placePhaseSnapshot({
    roster,
    subPhase,
    attFormation,
    defFormation,
    channelX,
    defBlock: input.defBlock || 'high',
    includeMotifArrows: false,
  });

  const players = showOpposition
    ? placed.players
    : placed.players.filter((p) => p.team === subjectTeam || (p.team !== 'ATT' && p.team !== 'DEF'));

  const subject = subjectTeam === 'DEF' ? 'Red' : 'Blue';
  const zoneLabel =
    input.zone === 'DEFENSIVE_THIRD'
      ? 'Def third'
      : input.zone === 'MIDDLE_THIRD'
        ? 'Middle'
        : 'Att third';
  const channelLabel =
    input.channel === 'LEFT' ? 'Left' : input.channel === 'RIGHT' ? 'Right' : 'Center';
  const headline = `${subject} ${
    input.phase === 'DEFENDING' ? 'defending' : 'attacking'
  } · ${zoneLabel} · ${channelLabel}${showOpposition ? '' : ' · solo'}`;

  const area0 = placed.areas?.[0];
  const focusX = placed.balls?.[0]?.x ?? channelX;
  const captionTexts = [
    headline,
    ...(placed.labels || []).map((l) => String(l.text || '')).filter(Boolean),
  ].slice(0, 3);
  const stack =
    area0 && typeof area0.x === 'number' && typeof area0.y === 'number'
      ? labelStackAwayFromEmphasis(
          { x: area0.x, y: area0.y, width: area0.width, height: area0.height },
          captionTexts.length,
          focusX
        )
      : captionTexts.map((_, i) => ({ x: clamp(90 - i * 13), y: 76 }));

  return {
    ...diagram,
    players,
    balls: placed.balls,
    areas: placed.areas,
    labels: captionTexts.map((text, i) => ({
      text: text.slice(0, 200),
      x: stack[i]?.x ?? clamp(90 - i * 13),
      y: stack[i]?.y ?? 76,
    })),
    arrows: [],
    sequence: undefined,
  };
}

const PHASES: PlayOutSubPhase[] = ['goal_kick', 'pocket', 'final_third'];

/** Prefer formation templates when coach named shapes so roles match chassis. */
function rosterForPlayOut(
  existing: Player[],
  message: string
): Player[] {
  const { att, def } = inferFormationsFromMessage(message);
  const attN = existing.filter((p) => p.team === 'ATT').length;
  const defN = existing.filter((p) => p.team === 'DEF').length;
  // Only reseed full 11v11 sides — keep small-sided boards intact
  if (attN < 10 && defN < 10 && !att && !def) return existing;

  const next: Player[] = [];
  if (att && (attN >= 10 || attN === 0)) {
    next.push(...build11v11FormationPlayers(att, 'ATT'));
  } else {
    next.push(...existing.filter((p) => p.team === 'ATT'));
  }
  if (def && (defN >= 10 || defN === 0)) {
    next.push(...build11v11FormationPlayers(def, 'DEF'));
  } else {
    next.push(...existing.filter((p) => p.team === 'DEF'));
  }
  // Preserve any neutrals
  next.push(...existing.filter((p) => p.team !== 'ATT' && p.team !== 'DEF'));
  return next.length >= 8 ? next : existing;
}

/**
 * Force a 3-frame play-out sequence onto the diagram using the phase model.
 * Preserves player ids/teams from the current roster when formations are unknown;
 * reseeds from 11v11 templates when the coach named ATT/DEF shapes.
 */
export function applyPlayOutSequenceToDiagram(
  diagram: WebDiagramV1,
  message: string
): WebDiagramV1 {
  if (!isPlayOutRequest(message, diagram)) return diagram;

  const baseRoster =
    diagram.players?.length
      ? diagram.players
      : diagram.sequence?.frames?.[0]?.players;

  if (!baseRoster?.length) return diagram;

  const roster = rosterForPlayOut(baseRoster, message);

  const attCount = roster.filter((p) => p.team === 'ATT');
  const defCount = roster.filter((p) => p.team === 'DEF');
  if (attCount.length < 4 || defCount.length < 4) return diagram;

  const existing = diagram.sequence?.frames || [];
  const frames: SeqFrame[] = PHASES.map((phase, i) => {
    const placed = placePlayOutFrame(roster, phase, message);
    const prev = existing[i];
    return {
      id: prev?.id || `f-${i + 1}`,
      title: placed.title,
      note: prev?.note,
      durationMs: prev?.durationMs ?? 1600,
      players: placed.players,
      arrows: placed.arrows,
      areas: placed.areas,
      labels: placed.labels,
      balls: placed.balls,
      goals: prev?.goals || diagram.goals,
      coach: prev?.coach || diagram.coach,
      cones: prev?.cones || diagram.cones,
    };
  });

  const extras = existing.slice(3, 8).map((f) => ({
    ...f,
    players: f.players?.length ? f.players : frames[2].players,
  }));

  const all = [...frames, ...extras];
  const activeFrameId = all[0].id;
  const active = all[0];

  return {
    ...diagram,
    players: active.players,
    arrows: active.arrows,
    areas: active.areas,
    labels: active.labels,
    balls: active.balls,
    sequence: { frames: all, activeFrameId },
  };
}
