/**
 * 11v11 Chassis & Spacing playbook (v2) — used by board AI prompts
 * and deterministic play-out placement.
 *
 * Source of truth: apps/api/src/data/formation-principles-v2.json
 * Docs mirror: docs/tactical-board/formation-principles-v2.*
 */

import playbook from '../data/formation-principles-v2.json';

export type FormationId11 = '4-3-3' | '4-4-2' | '4-2-3-1' | '3-5-2';

export type PlaybookPhaseKey =
  | 'buildOut'
  | 'progression'
  | 'attack'
  | 'defensiveTransition';

type PhaseBlock = {
  spacing?: string[];
  patterns?: string[];
  boardCues?: string[];
};

type FormationSpec = {
  label: string;
  pivotStyle: string;
  widthSource: string;
  keyMotifs: string[];
  buildOut: PhaseBlock;
  progression: PhaseBlock;
  attack: PhaseBlock;
  defensiveTransition: PhaseBlock;
};

const FORMATIONS = playbook.formations as Record<FormationId11, FormationSpec>;

const KNOWN: FormationId11[] = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2'];

/** Normalize compact spellings: 433 → 4-3-3, 4231 → 4-2-3-1. */
export function normalizeFormationSpellings(text: string): string {
  return String(text || '')
    .replace(/\b([1-5])\s*([0-5])\s*([0-5])\s*([0-5])\s*([0-5])\b/g, '$1-$2-$3-$4-$5')
    .replace(/\b([1-5])\s*([0-5])\s*([0-5])\s*([0-5])\b/g, '$1-$2-$3-$4')
    .replace(/\b([1-5])\s*([0-5])\s*([0-5])\b/g, '$1-$2-$3');
}

export function toFormationId11(raw: string | null | undefined): FormationId11 | null {
  if (!raw) return null;
  const n = normalizeFormationSpellings(raw).replace(/\s+/g, '');
  if ((KNOWN as string[]).includes(n)) return n as FormationId11;
  // common aliases
  if (n === '4-3-2-1' || n === '4231') return '4-2-3-1';
  if (n === '352' || n === '3-5-2') return '3-5-2';
  return null;
}

/**
 * Infer ATT / DEF formations from coach text.
 * Patterns: "433 vs 442", "ATT 4-3-3 vs DEF 4-4-2", "using a 433 against a 442".
 */
export function inferFormationsFromMessage(message: string): {
  att: FormationId11 | null;
  def: FormationId11 | null;
} {
  const text = normalizeFormationSpellings(message);
  const ids: FormationId11[] = [];
  const re = /\b(4-3-3|4-4-2|4-2-3-1|3-5-2)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const id = toFormationId11(m[1]);
    if (id && !ids.includes(id)) ids.push(id);
    // allow same formation twice if explicitly both sides — keep order
    else if (id) ids.push(id);
  }

  const attNamed =
    text.match(/\b(?:att|attacking|home|us|our)\s+(?:in\s+a\s+)?(4-3-3|4-4-2|4-2-3-1|3-5-2)\b/i)?.[1] ||
    text.match(/\b(4-3-3|4-4-2|4-2-3-1|3-5-2)\s+(?:att|attacking|home)\b/i)?.[1];
  const defNamed =
    text.match(
      /\b(?:def|defending|away|them|their|vs|versus|against|v\.?)\s+(?:a\s+|in\s+a\s+)?(4-3-3|4-4-2|4-2-3-1|3-5-2)\b/i
    )?.[1] ||
    text.match(/\b(4-3-3|4-4-2|4-2-3-1|3-5-2)\s+(?:def|defending|away)\b/i)?.[1];

  let att = toFormationId11(attNamed);
  let def = toFormationId11(defNamed);

  // "X vs Y" / "X against Y" — first = ATT, second = DEF when not tagged
  const vs = text.match(
    /\b(4-3-3|4-4-2|4-2-3-1|3-5-2)\b[\s\S]{0,24}\b(?:vs\.?|versus|v\.?|against)\b[\s\S]{0,16}\b(4-3-3|4-4-2|4-2-3-1|3-5-2)\b/i
  );
  if (vs) {
    if (!att) att = toFormationId11(vs[1]);
    if (!def) def = toFormationId11(vs[2]);
  }

  // A formation named only after vs/against is DEF. Do not also assign it to ATT
  // ("progress vs a 4231" must keep the board's ATT shape).
  if (!att && ids[0] && ids[0] !== def) att = ids[0];
  if (!def && ids[1] && ids[1] !== att) def = ids[1];
  // Single untagged formation → ATT shape; DEF defaults to classic press shape
  if (!def && att) def = '4-4-2';

  return { att, def };
}

export function getFormationSpec(id: FormationId11): FormationSpec {
  return FORMATIONS[id];
}

export function phaseKeyForPlayOut(
  phase: 'goal_kick' | 'pocket' | 'final_third' | 'defensive_transition'
): PlaybookPhaseKey {
  if (phase === 'goal_kick') return 'buildOut';
  if (phase === 'pocket') return 'progression';
  if (phase === 'final_third') return 'attack';
  return 'defensiveTransition';
}

export function boardCuesFor(
  formation: FormationId11,
  phase: PlaybookPhaseKey
): string[] {
  const block = FORMATIONS[formation][phase];
  return block?.boardCues || [];
}

export function spacingFor(formation: FormationId11, phase: PlaybookPhaseKey): string[] {
  return FORMATIONS[formation][phase]?.spacing || [];
}

export function patternsFor(formation: FormationId11, phase: PlaybookPhaseKey): string[] {
  return FORMATIONS[formation][phase]?.patterns || [];
}

/** Compact prompt block for board AI — injects chassis knowledge. */
export function buildFormationPlaybookGuidance(
  message: string,
  boardFormations?: { att?: FormationId11 | null; def?: FormationId11 | null } | null
): string {
  const fromMsg = inferFormationsFromMessage(message);
  const att = fromMsg.att || boardFormations?.att || null;
  const def = fromMsg.def || boardFormations?.def || null;
  const lines: string[] = [
    '11v11 CHASSIS & SPACING PLAYBOOK (v2 — MANDATORY when drawing these shapes):',
    ...playbook.corePrinciples.map((p) => `- ${p}`),
    '- Phase map: Build-out = Frame 1 (RIGHT / goal-kick) · Progression = Frame 2 (MIDDLE pocket) · Attack = Frame 3 (LEFT final third) · Defensive Transition = rest-defence after loss.',
    '- Expand in possession; compress out of possession. Coalitions > individuals.',
  ];
  if (boardFormations?.att || boardFormations?.def) {
    lines.push(
      `- Board-inferred shapes (use unless coach overrides): ATT ${boardFormations.att || '?'} · DEF ${boardFormations.def || '?'}.`
    );
  }

  const emitFormation = (side: 'ATT' | 'DEF', id: FormationId11) => {
    const f = FORMATIONS[id];
    lines.push('');
    lines.push(`${side} ${id} — ${f.label}:`);
    lines.push(`  Pivot: ${f.pivotStyle}. Width: ${f.widthSource}.`);
    lines.push(`  Motifs: ${f.keyMotifs.join('; ')}.`);
    for (const [label, key] of [
      ['Build-out (F1)', 'buildOut'],
      ['Progression (F2)', 'progression'],
      ['Attack (F3)', 'attack'],
      ['Def transition', 'defensiveTransition'],
    ] as const) {
      const block = f[key];
      const cues = (block.boardCues || []).slice(0, 4);
      const spacing = (block.spacing || []).slice(0, 3);
      lines.push(`  ${label}:`);
      for (const c of cues) lines.push(`    · Board: ${c}`);
      for (const s of spacing) lines.push(`    · Spacing: ${s}`);
    }
  };

  if (att) emitFormation('ATT', att);
  if (def && def !== att) emitFormation('DEF', def);
  else if (def && def === att) {
    lines.push('');
    lines.push(`DEF also in ${def} — mirror OOP cues (compress, rest-defence) from that system.`);
  }

  if (!att && !def) {
    lines.push('');
    lines.push('No formation resolved yet — when the coach names one, apply that system’s chassis.');
    lines.push('Quick motifs: 4-3-3 false-nine + flank triangles; 4-4-2 short-team ≤25m + tuck/overlap; 4-2-3-1 doble pivot + #10 pocket; 3-5-2 WB overloads + libero.');
  } else {
    lines.push('');
    lines.push(
      `RESOLVED: ATT=${att || '?'} vs DEF=${def || '?'}. Draw shirts, arrows, and captions that match these chassis cues — do not invent a generic blob.`
    );
  }

  return lines.join('\n');
}

/** Caption snippets for deterministic placement. */
export function playOutCaptions(
  formation: FormationId11,
  phase: 'goal_kick' | 'pocket' | 'final_third',
  blockHeight: 'high' | 'mid' | 'low'
): string[] {
  const key = phaseKeyForPlayOut(phase);
  const cues = boardCuesFor(formation, key).slice(0, 2);
  const spacing = spacingFor(formation, key).slice(0, 1);
  const captions = [...cues, ...spacing].filter(Boolean).map((s) => s.slice(0, 200));
  if (phase === 'goal_kick') {
    captions.push(
      blockHeight === 'high'
        ? 'DEF presses on the box edge (high) unless coach asked mid/low block.'
        : blockHeight === 'mid'
          ? 'DEF mid-block as requested.'
          : 'DEF low-block as requested.'
    );
  }
  return captions.slice(0, 3);
}
