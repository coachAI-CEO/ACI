import { z } from 'zod';

/** Closed tokens for the v1 tester. No x/y on this contract. */
export const BOARD_GRID_INTENTS = [
  'full_pitch',
  'half_att',
  'half_def',
  'third_left',
  'third_middle',
  'third_right',
  'box_att',
  'box_def',
  'rondo',
  'ssg_grid',
] as const;

export const BOARD_PLACEMENTS = [
  'own_gk',
  'own_6',
  'own_8',
  'own_9',
  'own_winger_right',
  'own_winger_left',
  'opp_gk',
  'opp_6',
  'opp_9',
  'grid_nw',
  'grid_n',
  'grid_ne',
  'grid_w',
  'grid_c',
  'grid_e',
  'grid_sw',
  'grid_s',
  'grid_se',
  'perimeter',
  'inside',
  'own_line',
] as const;

export const BOARD_SEEDS = ['current', 'formation', 'blank'] as const;

export const BOARD_ACTION_TYPES = ['pass', 'run', 'press', 'cover', 'transition'] as const;
export const BOARD_ACTIVITIES = ['rondo', 'match_scenario', 'technical_exercise', 'scrimmage'] as const;
export const BOARD_FORMATIONS = [
  '4-3-3',
  '4-2-3-1',
  '4-4-2',
  '3-5-2',
  '2-3-1',
  '3-2-1',
  '3-2-3',
  '2-3-2-1',
  '3-3-2',
] as const;

export const BoardSymbolicDslSchema = z
  .object({
    activity: z.enum(BOARD_ACTIVITIES),
    /** current = keep live shirts; formation = chassis; blank = entities only. */
    seed: z.enum(BOARD_SEEDS).optional(),
    grid: z
      .object({
        intent: z.enum(BOARD_GRID_INTENTS),
        format: z.enum(['7V7', '9V9', '11V11']).optional(),
        attFormation: z.enum(BOARD_FORMATIONS).optional(),
        defFormation: z.enum(BOARD_FORMATIONS).optional(),
      })
      .strict(),
    entities: z
      .array(
        z
          .object({
            id: z.string().min(1).max(64),
            team: z.enum(['ATT', 'DEF', 'NEUTRAL']),
            number: z.number().int().min(0).max(99).optional(),
            role: z.string().max(64).optional(),
            relative_position: z.enum(BOARD_PLACEMENTS),
          })
          .strict()
      )
      .max(30)
      .default([]),
    equipment: z
      .array(
        z
          .object({
            kind: z.enum(['mini-goal', 'cone', 'mannequin', 'pole']),
            placement: z.enum(BOARD_PLACEMENTS),
            quantity: z.number().int().min(1).max(12),
          })
          .strict()
      )
      .max(20)
      .default([]),
    actions: z
      .array(
        z
          .object({
            type: z.enum(BOARD_ACTION_TYPES),
            from_id: z.string().min(1).max(64),
            to_id: z.string().min(1).max(64),
          })
          .strict()
      )
      .max(40)
      .default([]),
    /** Symbolic nudges on a current-board seed. `to` is a placement, `keep`, `toward_ball`, or `press:att-6`. */
    moves: z
      .array(
        z
          .object({
            id: z.string().min(1).max(64),
            to: z.string().min(1).max(64),
          })
          .strict()
      )
      .max(30)
      .default([]),
  })
  .strict();

export type BoardSymbolicDsl = z.infer<typeof BoardSymbolicDslSchema>;

const FORMATION_SET = new Set<string>(BOARD_FORMATIONS);
const PLACEMENT_SET = new Set<string>(BOARD_PLACEMENTS);
const INTENT_SET = new Set<string>(BOARD_GRID_INTENTS);
const ACTIVITY_SET = new Set<string>(BOARD_ACTIVITIES);
const SEVEN_A_SIDE = new Set(['2-3-1', '3-2-1']);
const NINE_A_SIDE = new Set(['3-2-3', '2-3-2-1', '3-3-2']);
const ELEVEN_A_SIDE = new Set(['4-3-3', '4-2-3-1', '4-4-2', '3-5-2']);

export function boardSymbolicDslEnabled() {
  return process.env.BOARD_AI_SYMBOLIC_DSL === '1';
}

export function dslContainsCoordinates(input: unknown): boolean {
  if (!input || typeof input !== 'object') return false;
  const seen = new Set<unknown>();
  const walk = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false;
    if (seen.has(node)) return false;
    seen.add(node);
    if (Array.isArray(node)) return node.some(walk);
    const rec = node as Record<string, unknown>;
    if (typeof rec.x === 'number' && typeof rec.y === 'number') return true;
    if (typeof rec.x === 'number' || typeof rec.y === 'number') {
      if ('playerId' in rec || 'id' in rec || 'team' in rec) return true;
    }
    return Object.values(rec).some(walk);
  };
  return walk(input);
}

function digitsFormation(raw: string) {
  return raw.replace(/[^0-9]/g, '');
}

export function admitFormation(raw: unknown): (typeof BOARD_FORMATIONS)[number] | undefined {
  if (raw == null || raw === '') return undefined;
  const s = String(raw).trim();
  if (FORMATION_SET.has(s)) return s as (typeof BOARD_FORMATIONS)[number];
  const compact = s.replace(/\s+/g, '');
  if (FORMATION_SET.has(compact)) return compact as (typeof BOARD_FORMATIONS)[number];
  const byDigits: Record<string, (typeof BOARD_FORMATIONS)[number]> = {
    '433': '4-3-3',
    '4231': '4-2-3-1',
    '442': '4-4-2',
    '352': '3-5-2',
    '231': '2-3-1',
    '321': '3-2-1',
    '323': '3-2-3',
    '2321': '2-3-2-1',
    '332': '3-3-2',
  };
  return byDigits[digitsFormation(s)];
}

export function formatFromFormation(
  formation?: string
): '7V7' | '9V9' | '11V11' | undefined {
  if (!formation) return undefined;
  if (SEVEN_A_SIDE.has(formation)) return '7V7';
  if (NINE_A_SIDE.has(formation)) return '9V9';
  if (ELEVEN_A_SIDE.has(formation)) return '11V11';
  return undefined;
}

function admitActivity(raw: unknown): (typeof BOARD_ACTIVITIES)[number] {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (ACTIVITY_SET.has(s)) return s as (typeof BOARD_ACTIVITIES)[number];
  if (/rondo|4v1|5v2|keep[-_]?away/.test(s)) return 'rondo';
  if (/ssg|small[_]?sided|scrimmage|game[_]?like/.test(s)) return 'scrimmage';
  if (/technical|function|diamond|passing|pattern|unopposed|exercise/.test(s)) {
    return 'technical_exercise';
  }
  return 'match_scenario';
}

function admitIntent(raw: unknown): (typeof BOARD_GRID_INTENTS)[number] {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (INTENT_SET.has(s)) return s as (typeof BOARD_GRID_INTENTS)[number];
  const aliases: Record<string, (typeof BOARD_GRID_INTENTS)[number]> = {
    rondo_square: 'rondo',
    rondo_circle: 'rondo',
    half_pitch_attack: 'half_att',
    half_pitch_defence: 'half_def',
    half_pitch_defense: 'half_def',
    attacking_half: 'half_att',
    defending_half: 'half_def',
    final_third: 'third_left',
    their_third: 'third_left',
    attacking_third: 'third_left',
    our_third: 'third_right',
    defensive_third: 'third_right',
    middle_third: 'third_middle',
    midfield: 'third_middle',
    penalty_box: 'box_att',
    box: 'box_att',
    penalty_box_def: 'box_def',
    ssg: 'ssg_grid',
    small_sided: 'ssg_grid',
    full: 'full_pitch',
    pitch: 'full_pitch',
  };
  return aliases[s] || 'full_pitch';
}

function admitPlacement(raw: unknown): (typeof BOARD_PLACEMENTS)[number] {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (PLACEMENT_SET.has(s)) return s as (typeof BOARD_PLACEMENTS)[number];
  const aliases: Record<string, (typeof BOARD_PLACEMENTS)[number]> = {
    gk: 'own_gk',
    goalkeeper: 'own_gk',
    center_defending: 'inside',
    centre: 'grid_c',
    center: 'grid_c',
    middle: 'grid_c',
    nw: 'grid_nw',
    ne: 'grid_ne',
    sw: 'grid_sw',
    se: 'grid_se',
    north: 'grid_n',
    south: 'grid_s',
    west: 'grid_w',
    east: 'grid_e',
    grid_corner_north_west: 'grid_nw',
    grid_corner_north_east: 'grid_ne',
    grid_corner_south_west: 'grid_sw',
    grid_corner_south_east: 'grid_se',
    back_line: 'own_line',
    defensive_line: 'own_line',
    holding: 'own_6',
    striker: 'own_9',
    winger: 'own_winger_right',
  };
  return aliases[s] || 'inside';
}

function idRef(raw: unknown): string {
  if (typeof raw === 'string' && raw.trim()) return raw.trim().slice(0, 64);
  if (raw && typeof raw === 'object') {
    const rec = raw as Record<string, unknown>;
    const v = rec.playerId ?? rec.id ?? rec.from_id ?? rec.to_id;
    if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 64);
  }
  return '';
}

function admitTeam(raw: unknown): 'ATT' | 'DEF' | 'NEUTRAL' {
  const s = String(raw || '').toUpperCase();
  if (s === 'ATT' || s === 'ATTACK' || s === 'HOME' || s === 'US') return 'ATT';
  if (s === 'DEF' || s === 'DEFEND' || s === 'AWAY' || s === 'THEM') return 'DEF';
  if (s === 'NEUTRAL' || s === 'N') return 'NEUTRAL';
  return 'ATT';
}

function admitActionType(raw: unknown): (typeof BOARD_ACTION_TYPES)[number] {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if ((BOARD_ACTION_TYPES as readonly string[]).includes(s)) {
    return s as (typeof BOARD_ACTION_TYPES)[number];
  }
  if (/dribble|carry/.test(s)) return 'run';
  if (/shoot|shot/.test(s)) return 'pass';
  return 'pass';
}

function coerceFormat(
  raw: unknown,
  att?: string,
  def?: string
): '7V7' | '9V9' | '11V11' | undefined {
  const s = String(raw || '')
    .toUpperCase()
    .replace(/\s+/g, '');
  if (s === '7V7' || s === '7') return '7V7';
  if (s === '9V9' || s === '9') return '9V9';
  if (s === '11V11' || s === '11') return '11V11';
  return formatFromFormation(att) || formatFromFormation(def);
}

export function fitFormationToFormat(
  formation: (typeof BOARD_FORMATIONS)[number] | undefined,
  format?: '7V7' | '9V9' | '11V11',
  side: 'att' | 'def' = 'att'
): (typeof BOARD_FORMATIONS)[number] | undefined {
  if (!formation) return undefined;
  const got = formatFromFormation(formation);
  if (!format || !got || got === format) return formation;
  const defaults: Record<'7V7' | '9V9' | '11V11', { att: (typeof BOARD_FORMATIONS)[number]; def: (typeof BOARD_FORMATIONS)[number] }> = {
    '7V7': { att: '2-3-1', def: '3-2-1' },
    '9V9': { att: '3-2-3', def: '2-3-2-1' },
    '11V11': { att: '4-3-3', def: '4-2-3-1' },
  };
  return side === 'def' ? defaults[format].def : defaults[format].att;
}

/** Strip unknown keys, coerce aliases. Extra x/y on the raw plan are dropped. */
export function admitBoardSymbolicDsl(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const raw = input as Record<string, unknown>;
  const gridIn = raw.grid && typeof raw.grid === 'object' ? (raw.grid as Record<string, unknown>) : {};
  const att = admitFormation(gridIn.attFormation ?? gridIn.att_formation ?? gridIn.homeFormation);
  const def = admitFormation(gridIn.defFormation ?? gridIn.def_formation ?? gridIn.awayFormation);
  const format = coerceFormat(gridIn.format, att, def);
  const entities = Array.isArray(raw.entities)
    ? raw.entities
        .filter((e) => e && typeof e === 'object')
        .slice(0, 30)
        .map((e) => {
          const rec = e as Record<string, unknown>;
          return {
            id: String(rec.id || rec.playerId || '').slice(0, 64),
            team: admitTeam(rec.team),
            number:
              typeof rec.number === 'number' && Number.isFinite(rec.number)
                ? Math.max(0, Math.min(99, Math.round(rec.number)))
                : undefined,
            role: rec.role != null ? String(rec.role).slice(0, 64) : undefined,
            relative_position: admitPlacement(rec.relative_position ?? rec.position ?? rec.placement),
          };
        })
        .filter((e) => e.id)
    : [];
  const equipment = Array.isArray(raw.equipment)
    ? raw.equipment
        .filter((e) => e && typeof e === 'object')
        .slice(0, 20)
        .map((e) => {
          const rec = e as Record<string, unknown>;
          const kindRaw = String(rec.kind || rec.type || '')
            .toLowerCase()
            .replace(/[_ ]+/g, '-');
          const kind =
            kindRaw === 'mini-goal' || kindRaw === 'minigoal' || kindRaw === 'small-goal'
              ? 'mini-goal'
              : kindRaw === 'cone' || kindRaw === 'marker'
                ? 'cone'
                : kindRaw === 'mannequin' || kindRaw === 'dummy'
                  ? 'mannequin'
                  : kindRaw === 'pole' || kindRaw === 'stick'
                    ? 'pole'
                    : null;
          if (!kind) return null;
          const qty = typeof rec.quantity === 'number' ? rec.quantity : 1;
          return {
            kind,
            placement: admitPlacement(rec.placement ?? rec.relative_position),
            quantity: Math.max(1, Math.min(12, Math.round(qty) || 1)),
          };
        })
        .filter(Boolean)
    : [];
  const actions = Array.isArray(raw.actions)
    ? raw.actions
        .filter((a) => a && typeof a === 'object')
        .slice(0, 40)
        .map((a) => {
          const rec = a as Record<string, unknown>;
          const from_id = idRef(rec.from_id ?? rec.from ?? rec.fromId);
          const to_id = idRef(rec.to_id ?? rec.to ?? rec.toId);
          if (!from_id || !to_id) return null;
          return { type: admitActionType(rec.type), from_id, to_id };
        })
        .filter(Boolean)
    : [];
  const moves = Array.isArray(raw.moves)
    ? raw.moves
        .filter((m) => m && typeof m === 'object')
        .slice(0, 30)
        .map((m) => {
          const rec = m as Record<string, unknown>;
          const id = idRef(rec.id ?? rec.playerId);
          const to =
            typeof rec.to === 'string'
              ? rec.to.slice(0, 64)
              : idRef(rec.to) || String(rec.placement || '').slice(0, 64);
          if (!id || !to) return null;
          return { id, to };
        })
        .filter(Boolean)
    : [];
  const seedRaw = String(raw.seed || '')
    .trim()
    .toLowerCase();
  const seed = (BOARD_SEEDS as readonly string[]).includes(seedRaw)
    ? seedRaw
    : undefined;
  const activity = admitActivity(raw.activity);
  const intent = admitIntent(gridIn.intent ?? raw.intent);
  return {
    activity,
    ...(seed ? { seed } : {}),
    grid: {
      intent,
      ...(format ? { format } : {}),
      ...(fitFormationToFormat(att, format, 'att')
        ? { attFormation: fitFormationToFormat(att, format, 'att') }
        : {}),
      ...(fitFormationToFormat(def, format, 'def')
        ? { defFormation: fitFormationToFormat(def, format, 'def') }
        : {}),
    },
    entities,
    equipment,
    actions,
    moves,
  };
}

export function inferFormatFromMessage(
  message: string
): '7V7' | '9V9' | '11V11' | undefined {
  const m = String(message || '').toLowerCase();
  if (/\b7\s*v\s*7\b|\b7v7\b/.test(m)) return '7V7';
  if (/\b9\s*v\s*9\b|\b9v9\b/.test(m)) return '9V9';
  if (/\b11\s*v\s*11\b|\b11v11\b/.test(m)) return '11V11';
  return undefined;
}

/** Live pitch wins unless the coach named a format this turn. */
export function lockDslFormat(
  dsl: BoardSymbolicDsl,
  opts: { message?: string; currentFormat?: '7V7' | '9V9' | '11V11' }
): BoardSymbolicDsl {
  const named = opts.message ? inferFormatFromMessage(opts.message) : undefined;
  const format = named || opts.currentFormat || dsl.grid.format;
  return {
    ...dsl,
    grid: {
      ...dsl.grid,
      format,
      ...(fitFormationToFormat(dsl.grid.attFormation, format, 'att')
        ? { attFormation: fitFormationToFormat(dsl.grid.attFormation, format, 'att') }
        : {}),
      ...(fitFormationToFormat(dsl.grid.defFormation, format, 'def')
        ? { defFormation: fitFormationToFormat(dsl.grid.defFormation, format, 'def') }
        : {}),
    },
  };
}

function blobAsksMiniGoals(blob?: string): boolean {
  const cleaned = String(blob || '').replace(/as written\s*\([^)]*\)/gi, '');
  return /\bmini[- ]?goals?\b/i.test(cleaned);
}

function miniGoalCount(equipment: BoardSymbolicDsl['equipment']): number {
  return (equipment || [])
    .filter((e) => e.kind === 'mini-goal')
    .reduce((n, e) => n + Math.max(1, e.quantity || 1), 0);
}

function twoEndMiniGoals(): BoardSymbolicDsl['equipment'] {
  return [
    { kind: 'mini-goal', placement: 'grid_w', quantity: 1 },
    { kind: 'mini-goal', placement: 'grid_e', quantity: 1 },
  ];
}

function fourSideMiniGoals(): BoardSymbolicDsl['equipment'] {
  return [
    { kind: 'mini-goal', placement: 'grid_n', quantity: 1 },
    { kind: 'mini-goal', placement: 'grid_e', quantity: 1 },
    { kind: 'mini-goal', placement: 'grid_s', quantity: 1 },
    { kind: 'mini-goal', placement: 'grid_w', quantity: 1 },
  ];
}

function fourCentralMiniGoals(): BoardSymbolicDsl['equipment'] {
  return [
    { kind: 'mini-goal', placement: 'grid_c', quantity: 1 },
    { kind: 'mini-goal', placement: 'grid_c', quantity: 1 },
    { kind: 'mini-goal', placement: 'grid_c', quantity: 1 },
    { kind: 'mini-goal', placement: 'grid_c', quantity: 1 },
  ];
}

function isMatchScaleBoard(dsl: BoardSymbolicDsl): boolean {
  const intent = dsl.grid.intent;
  return (
    dsl.activity === 'match_scenario' &&
    intent !== 'rondo' &&
    intent !== 'ssg_grid'
  );
}

/** Match-scale boards must not keep SSG mini-goals from the import review. */
function stripMatchScaleMiniGoals(dsl: BoardSymbolicDsl): BoardSymbolicDsl {
  if (!isMatchScaleBoard(dsl)) return dsl;
  if (!miniGoalCount(dsl.equipment)) return dsl;
  return {
    ...dsl,
    equipment: (dsl.equipment || []).filter((e) => e.kind !== 'mini-goal'),
  };
}

function wantsTwoMiniGoals(blob?: string): boolean {
  if (!blob) return false;
  if (/\b(four|4)\s+(?:central\s+|centre\s+)?mini[- ]?goals?\b/i.test(blob)) return false;
  return (
    /\b(two|2)\s+mini[- ]?goals?\b/i.test(blob) ||
    /\b(50\s*[x×]\s*50|compact(?:ness)?)\b/i.test(blob)
  );
}

function wantsFourMiniGoals(blob?: string): boolean {
  if (!blob) return false;
  return (
    /\b(four|4)\s+(?:central\s+|centre\s+)?mini[- ]?goals?\b/i.test(blob) ||
    /\bone on each (?:side|end)\b/i.test(blob)
  );
}

function wantsCentralMiniGoals(blob?: string): boolean {
  if (!blob || !wantsFourMiniGoals(blob)) return false;
  // "central 10×10 zone" is the inner pressure grid, not clustered mini-goals.
  if (/\b(?:4|four)\s+(?:central|centre|back[- ]to[- ]back)\s+mini[- ]?goals?\b/i.test(blob)) {
    return true;
  }
  if (
    /\bmini[- ]?goals?\s+(?:that are\s+)?(?:central|back[- ]to[- ]back|in the (?:dead )?cent(?:er|re))\b/i.test(
      blob
    )
  ) {
    return true;
  }
  return /\bback[- ]to[- ]back\b/i.test(blob);
}

function stackedMiniGoals(equipment: BoardSymbolicDsl['equipment']): boolean {
  const minis = (equipment || []).filter((e) => e.kind === 'mini-goal');
  return minis.length === 1 && (minis[0].quantity || 1) >= 2;
}

/** If the coach named kit (mini-goals) and the DSL omitted it, add ends of the grid. */
export function ensureDslEquipmentFromMessage(
  dsl: BoardSymbolicDsl,
  message?: string
): BoardSymbolicDsl {
  if (isMatchScaleBoard(dsl)) {
    return stripMatchScaleMiniGoals(dsl);
  }
  const rest = (dsl.equipment || []).filter((e) => e.kind !== 'mini-goal');
  if (wantsFourMiniGoals(message) && (miniGoalCount(dsl.equipment) !== 4 || stackedMiniGoals(dsl.equipment))) {
    const kit = wantsCentralMiniGoals(message) ? fourCentralMiniGoals() : fourSideMiniGoals();
    return { ...dsl, equipment: [...rest, ...kit] };
  }
  if (wantsTwoMiniGoals(message) && miniGoalCount(dsl.equipment) !== 2) {
    return { ...dsl, equipment: [...rest, ...twoEndMiniGoals()] };
  }
  if (!blobAsksMiniGoals(message)) return dsl;
  if (miniGoalCount(dsl.equipment) >= 2) {
    if (stackedMiniGoals(dsl.equipment)) {
      return { ...dsl, equipment: [...rest, ...twoEndMiniGoals()] };
    }
    return dsl;
  }
  return { ...dsl, equipment: [...rest, ...twoEndMiniGoals()] };
}

/** Q3 always mentions mini-goals. Don’t invent them on a rondo that never had any. */
export function stripUnmentionedRondoMiniGoals(
  dsl: BoardSymbolicDsl,
  blob?: string
): BoardSymbolicDsl {
  if (dsl.activity !== 'rondo' && dsl.grid.intent !== 'rondo') return dsl;
  if (!(dsl.equipment || []).some((e) => e.kind === 'mini-goal')) return dsl;
  if (blobAsksMiniGoals(blob)) return dsl;
  return {
    ...dsl,
    equipment: (dsl.equipment || []).filter((e) => e.kind !== 'mini-goal'),
  };
}

function trimTeam(
  entities: BoardSymbolicDsl['entities'],
  team: 'ATT' | 'DEF' | 'NEUTRAL',
  count: number
): BoardSymbolicDsl['entities'] {
  const have = entities.filter((e) => e.team === team);
  if (have.length <= count) return entities;
  let kept = 0;
  return entities.filter((e) => {
    if (e.team !== team) return true;
    kept += 1;
    return kept <= count;
  });
}

function isGkEntity(e: BoardSymbolicDsl['entities'][number]): boolean {
  return e.number === 1 || String(e.role || '').toUpperCase() === 'GK';
}

/** Remap spare shirts so named attackers (7/9/11) actually exist. */
function ensureNumbersOnTeam(
  entities: BoardSymbolicDsl['entities'],
  team: 'ATT' | 'DEF',
  required: number[]
): BoardSymbolicDsl['entities'] {
  const next = entities.map((e) => ({ ...e }));
  for (const need of required) {
    if (next.some((e) => e.team === team && e.number === need)) continue;
    const victim = next.find(
      (e) => e.team === team && !isGkEntity(e) && e.number != null && !required.includes(Number(e.number))
    );
    if (victim) victim.number = need;
  }
  return next;
}

function padTeam(
  entities: BoardSymbolicDsl['entities'],
  team: 'ATT' | 'DEF' | 'NEUTRAL',
  count: number,
  position: 'perimeter' | 'inside'
): BoardSymbolicDsl['entities'] {
  const have = entities.filter((e) => e.team === team);
  if (have.length >= count) return trimTeam(entities, team, count);
  const next = entities.slice();
  const used = new Set(
    next.filter((e) => e.team === team && e.number != null).map((e) => Number(e.number))
  );
  const prefer = team === 'DEF' ? [7, 9, 11, 10, 4, 8, 6] : [2, 3, 4, 5, 6, 8, 10, 7, 11];
  const takeNumber = () => {
    for (const n of prefer) if (!used.has(n)) return n;
    for (let n = 2; n <= 11; n++) if (!used.has(n)) return n;
    return 12;
  };
  for (let i = have.length; i < count; i++) {
    const number = team === 'NEUTRAL' ? 10 + i : takeNumber();
    used.add(number);
    next.push({
      id: `${team.toLowerCase()}-auto-${i + 1}`,
      team,
      number,
      relative_position: position,
    });
  }
  return next;
}

function uniquifyTeamNumbers(
  entities: BoardSymbolicDsl['entities']
): BoardSymbolicDsl['entities'] {
  const used: Record<'ATT' | 'DEF' | 'NEUTRAL', Set<number>> = {
    ATT: new Set(),
    DEF: new Set(),
    NEUTRAL: new Set(),
  };
  return entities.map((e) => {
    if (isGkEntity(e) || e.number == null) return e;
    const pool = used[e.team];
    if (!pool.has(e.number)) {
      pool.add(e.number);
      return e;
    }
    let n = 2;
    while (pool.has(n) || n === 1) n += 1;
    pool.add(n);
    return { ...e, number: n };
  });
}

/** 4v4+2 / 5v2 in the ask should actually produce that many shirts. */
export function ensureRondoRosterFromMessage(
  dsl: BoardSymbolicDsl,
  message?: string
): BoardSymbolicDsl {
  if (!message) return dsl;
  const rondo = dsl.activity === 'rondo' || dsl.grid.intent === 'rondo' || /\brondo\b/i.test(message);
  if (!rondo) return dsl;
  const plus = String(message).match(/\b(\d+)\s*v\s*(\d+)\s*\+\s*(\d+)\b/i);
  const vs = plus ? null : String(message).match(/\b(\d+)\s*v\s*(\d+)\b/i);
  const attN = plus ? Number(plus[1]) : vs ? Number(vs[1]) : 0;
  const defN = plus ? Number(plus[2]) : vs ? Number(vs[2]) : 0;
  const neuN = plus ? Number(plus[3]) : 0;
  if (!attN || !defN) return dsl;
  if ((attN === 7 && defN === 7) || (attN === 9 && defN === 9) || (attN === 11 && defN === 11)) {
    return dsl;
  }
  if (attN + defN + neuN > 16) return dsl;
  let entities = (dsl.entities || []).filter((e) => {
    if (e.team === 'NEUTRAL') return true;
    const role = String(e.role || '').toUpperCase();
    return e.number !== 1 && role !== 'GK';
  });
  entities = padTeam(entities, 'ATT', attN, 'perimeter');
  entities = padTeam(entities, 'DEF', defN, 'inside');
  if (neuN) entities = padTeam(entities, 'NEUTRAL', neuN, 'perimeter');
  entities = uniquifyTeamNumbers(entities);
  if (attN >= 7) entities = ensureNumbersOnTeam(entities, 'ATT', [2, 3, 4, 5, 6, 8, 10]);
  return { ...dsl, activity: 'rondo', entities, grid: { ...dsl.grid, intent: 'rondo' } };
}

const PRESSURE_CORNERS = ['grid_nw', 'grid_ne', 'grid_se', 'grid_sw'] as const;

function looksLikeIncreasingPressure(blob: string): boolean {
  return /\b(increasing pressure|extra defender|20\s*[x×]\s*20|inner\s*10\s*[x×]\s*10|four\s+mini[- ]?goals?)\b/i.test(
    blob
  );
}

/** 5v1 + 4 outside floaters is a 5v5, not a rondo with neutrals. */
function parseWaitingDefenders(blob: string): { attN: number; defN: number } | null {
  const m = blob.match(
    /\b(\d+)\s*v\s*(\d+)\s*\+\s*(\d+)\s*(?:outside|waiting|extra)(?:\s+(?:floaters?|defenders?))?/i
  );
  if (m) {
    const attN = Number(m[1]);
    const inside = Number(m[2]);
    const extra = Number(m[3]);
    if (attN >= 3 && attN <= 8 && inside >= 1 && extra >= 2 && attN + inside + extra <= 16) {
      return { attN, defN: inside + extra };
    }
  }
  if (looksLikeIncreasingPressure(blob) && /\b5\s*v\s*5\b/i.test(blob)) {
    return { attN: 5, defN: 5 };
  }
  return null;
}

function placePressureGridEntities(
  entities: BoardSymbolicDsl['entities']
): BoardSymbolicDsl['entities'] {
  const def = entities.filter((e) => e.team === 'DEF' && !isGkEntity(e));
  const hunter =
    def.find((e) => e.number === 7) ||
    def.find((e) => e.relative_position === 'inside') ||
    def[0];
  let corner = 0;
  return entities.map((e) => {
    if (isGkEntity(e)) return e;
    if (e.team === 'ATT') {
      return { ...e, relative_position: e.number === 7 ? 'grid_c' : 'inside' };
    }
    if (e.team === 'DEF') {
      if (hunter && e.id === hunter.id) return { ...e, relative_position: 'inside' };
      return { ...e, relative_position: PRESSURE_CORNERS[corner++ % PRESSURE_CORNERS.length] };
    }
    return e;
  });
}

/** 7v6 / 4v4 from an import review should pad to that many shirts (keep GKs). */
export function ensureImportOverloadRoster(
  dsl: BoardSymbolicDsl,
  message?: string
): BoardSymbolicDsl {
  if (!message) return dsl;
  if (dsl.seed === 'formation') return dsl;
  if (dsl.activity === 'rondo' || dsl.grid.intent === 'rondo') return dsl;
  const blob = String(message);
  const waiting = parseWaitingDefenders(blob);
  const matches = [...blob.matchAll(/\b(\d+)\s*v\s*(\d+)\b/gi)];
  let attN = waiting?.attN || 0;
  let defN = waiting?.defN || 0;
  for (const vs of matches) {
    const a = Number(vs[1]);
    const d = Number(vs[2]);
    if (!a || !d) continue;
    if ((a === 7 && d === 7) || (a === 9 && d === 9) || (a === 11 && d === 11)) continue;
    if (a + d > 16) continue;
    const after = blob.slice((vs.index || 0) + vs[0].length, (vs.index || 0) + vs[0].length + 14);
    if (/^\s*\+\s*\d+/.test(after)) continue;
    if (/^\s*(attack|into)\b/i.test(after)) continue;
    if (a + d > attN + defN) {
      attN = a;
      defN = d;
    }
  }
  const compactSsG =
    (dsl.grid.intent === 'ssg_grid' || dsl.activity === 'technical_exercise') &&
    /\b(50\s*[x×]\s*50|compact(?:ness)?|wide deliver|7\s*v\s*6)\b/i.test(blob);
  if (compactSsG && !waiting && !looksLikeIncreasingPressure(blob) && attN + defN < 13) {
    attN = 7;
    defN = 6;
  }
  if (!attN || !defN) return dsl;
  if ((attN === 7 && defN === 7) || (attN === 9 && defN === 9) || (attN === 11 && defN === 11)) {
    return dsl;
  }
  if (attN + defN > 16) return dsl;
  let entities = dsl.entities || [];
  entities = padTeam(entities, 'ATT', attN, 'inside');
  entities = padTeam(entities, 'DEF', defN, waiting ? 'perimeter' : 'inside');
  entities = uniquifyTeamNumbers(entities);
  if (attN >= 7 && defN >= 6) {
    entities = ensureNumbersOnTeam(entities, 'DEF', [7, 9, 11]);
    entities = ensureNumbersOnTeam(entities, 'ATT', [2, 3, 4, 5, 6, 8]);
  }
  if (waiting || (looksLikeIncreasingPressure(blob) && attN === 5 && defN === 5)) {
    entities = ensureNumbersOnTeam(entities, 'DEF', [7]);
    entities = placePressureGridEntities(entities);
  }
  return { ...dsl, entities };
}

export function promoteRondoNeutralsFromMessage(
  dsl: BoardSymbolicDsl,
  message?: string
): BoardSymbolicDsl {
  if (!message || !/\bneutral/i.test(message)) return dsl;
  if (dsl.activity !== 'rondo' && dsl.grid.intent !== 'rondo') return dsl;
  const entities = [...(dsl.entities || [])];
  const neu = entities.filter((e) => e.team === 'NEUTRAL');
  if (neu.length >= 2) return dsl;
  const attIdx = entities
    .map((e, i) => (e.team === 'ATT' ? i : -1))
    .filter((i) => i >= 0);
  if (attIdx.length < 4) return dsl;
  const next = entities.map((e, i) =>
    i === attIdx[attIdx.length - 1] || i === attIdx[attIdx.length - 2]
      ? { ...e, team: 'NEUTRAL' as const, relative_position: 'perimeter' as const }
      : e
  );
  return { ...dsl, entities: next };
}

export function inferGridIntentFromMessage(
  message: string
): (typeof BOARD_GRID_INTENTS)[number] | undefined {
  const m = String(message || '').toLowerCase();
  if (/\brondo\b/.test(m) && !/\bforget(?:ting)? (?:the |this )?rondo\b/.test(m)) return 'rondo';
  if (/\b(ssg|small[- ]sided)\b/.test(m)) return 'ssg_grid';
  // Play-out / our half wins over “against a high press” (opponent shape, not our press).
  if (/\b(play(?:ing)? out|goal[-\s]?kick|build(?:ing)? out)\b/.test(m)) return 'half_att';
  if (/\b(our half|own half)\b/.test(m) && !/\b(their half|their third)\b/.test(m)) {
    return 'half_att';
  }
  if (/\bmid[- ]?block\b/.test(m)) {
    if (/\b(our half|own half|defensive half)\b/.test(m)) return 'half_att';
    return 'third_middle';
  }
  if (
    /\b(high press|how we could press|ways to press|press(?:ing)? in|press them|after we lose it)\b/.test(
      m
    ) &&
    !/\bnot a high press\b/.test(m)
  ) {
    return 'third_left';
  }
  if (/\b(their (?:defensive |final )?third|attacking third|final third|counterpress)\b/.test(m)) {
    return 'third_left';
  }
  if (/\b(our defensive third|defending (?:in )?our)\b/.test(m)) return 'third_right';
  if (/\b(middle third|midfield third)\b/.test(m)) return 'third_middle';
  if (/\b(play(?:ing)? out|goal[-\s]?kick|build(?:ing)? out)\b/.test(m)) return 'half_att';
  if (/\bscale.{0,60}11\s*v\s*11\b|\bsame idea.{0,40}11\s*v\s*11\b|\b11\s*v\s*11.{0,40}scale\b/i.test(m)) {
    return 'full_pitch';
  }
  return undefined;
}

export function lockDslSeed(
  dsl: BoardSymbolicDsl,
  opts: {
    freeze?: boolean;
    fromCurrentBoard?: boolean;
    keepPriorFrame?: boolean;
    reshape?: boolean;
    hasImage?: boolean;
    importDrawEleven?: boolean;
  }
): BoardSymbolicDsl {
  if (opts.freeze && !opts.keepPriorFrame) {
    // Keep the live grid and pass/run actions. Clearing intent to full_pitch
    // restacks a function onto the match pitch; clearing moves is enough to
    // stop shirts walking while arrows still draw.
    return { ...dsl, seed: 'current', moves: [] };
  }
  const functionLike =
    dsl.activity === 'rondo' ||
    dsl.activity === 'technical_exercise' ||
    dsl.grid.intent === 'rondo' ||
    dsl.grid.intent === 'ssg_grid';
  if (opts.keepPriorFrame && functionLike) {
    return { ...dsl, seed: 'blank' };
  }
  if (opts.reshape) {
    return { ...dsl, seed: 'formation' };
  }
  if (opts.fromCurrentBoard) {
    return { ...dsl, seed: 'current' };
  }
  if (opts.importDrawEleven) {
    return {
      ...dsl,
      seed: 'formation',
      activity: dsl.activity === 'rondo' || dsl.activity === 'technical_exercise' ? 'match_scenario' : dsl.activity,
    };
  }
  if (opts.hasImage) {
    return { ...dsl, seed: 'blank' };
  }
  if (functionLike) {
    return { ...dsl, seed: 'blank' };
  }
  if ((dsl.entities?.length || 0) > 0 && dsl.entities.length <= 12 && dsl.seed !== 'current') {
    return { ...dsl, seed: 'blank' };
  }
  return dsl;
}

export function parseBoardSymbolicDsl(
  input: unknown
): { ok: true; dsl: BoardSymbolicDsl } | { ok: false; error: string } {
  // Strip x/y instead of aborting. Gemini often tucks coordinates onto a valid
  // symbolic plan; the solver still owns geometry.
  const admitted = admitBoardSymbolicDsl(input);
  const parsed = BoardSymbolicDslSchema.safeParse(admitted);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  return { ok: true, dsl: parsed.data };
}
