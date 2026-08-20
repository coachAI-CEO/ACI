import type { WebDiagramV1 } from './web-diagram-v1';
import { roleBand } from './board-phase-placement';
import type { FormationId11 } from './formation-principles';

export type FormLineIssue = string;

type Shirt = WebDiagramV1['players'][number];

function shirts(players: Shirt[], team: 'ATT' | 'DEF'): Shirt[] {
  return players.filter((p) => p.team === team);
}

function byNumber(players: Shirt[], n: number): Shirt | undefined {
  return players.find((p) => p.number === n);
}

function spreadY(list: Shirt[]): number {
  if (list.length < 2) return 0;
  const ys = list.map((p) => p.y);
  return Math.max(...ys) - Math.min(...ys);
}

function meanY(list: Shirt[]): number {
  if (!list.length) return 0;
  return list.reduce((s, p) => s + p.y, 0) / list.length;
}

/** ATT own goal is high y (~94). Left fullback is low x on this board. */
export function scoreFormLines(
  players: Shirt[],
  opts?: { attFormation?: FormationId11; defFormation?: FormationId11 }
): FormLineIssue[] {
  const issues: FormLineIssue[] = [];
  const att = shirts(players, 'ATT');
  const def = shirts(players, 'DEF');
  if (att.length < 8 || def.length < 8) return issues;

  const attGk = att.find((p) => roleBand(p) === 'GK') || byNumber(att, 1);
  const defGk = def.find((p) => roleBand(p) === 'GK') || byNumber(def, 1);
  if (attGk && attGk.y < 88) issues.push('GK_HOME: ATT #1 y < 88');
  if (defGk && defGk.y > 12) issues.push('GK_HOME: DEF #1 y > 12');

  const attCbs = att.filter((p) => /^(CB|RCB|LCB)$/i.test(String(p.role || '')) || p.number === 4 || p.number === 5);
  const attFbs = att.filter((p) => /^(RB|LB)$/i.test(String(p.role || '')) || p.number === 2 || p.number === 3);
  if (attCbs.length >= 2 && spreadY(attCbs.slice(0, 2)) > 6) {
    issues.push(`ATT_CB_FLAT: CB y-spread ${spreadY(attCbs.slice(0, 2)).toFixed(1)} > 6`);
  }
  if (attFbs.length >= 2 && spreadY(attFbs.slice(0, 2)) > 6) {
    issues.push(`ATT_FB_FLAT: FB y-spread ${spreadY(attFbs.slice(0, 2)).toFixed(1)} > 6`);
  }
  if (attCbs.length >= 2 && attFbs.length >= 2 && meanY(attFbs) >= meanY(attCbs) - 2) {
    issues.push('ATT_FB_STEP: fullbacks are not stepped up from the CBs');
  }

  const defBack = def.filter((p) => roleBand(p) === 'BACK');
  const defCbs = defBack.filter((p) => /CB/i.test(String(p.role || '')) || p.number === 4 || p.number === 5);
  if (defCbs.length >= 2 && spreadY(defCbs.slice(0, 2)) > 8) {
    issues.push(`DEF_CB_FLAT: CB y-spread ${spreadY(defCbs.slice(0, 2)).toFixed(1)} > 8`);
  }

  const six = byNumber(att, 6);
  const eight = byNumber(att, 8);
  const ten = byNumber(att, 10);
  const nine = byNumber(att, 9);
  if (opts?.attFormation === '4-3-3' || (!opts?.attFormation && six && eight && ten)) {
    if (six && eight && six.y < eight.y + 3) issues.push('433_TRIANGLE: #6 is not deeper than #8');
    if (six && ten && six.y < ten.y + 3) issues.push('433_TRIANGLE: #6 is not deeper than #10');
  }
  if (nine && six && nine.y >= six.y) issues.push('ATT_BAND_ORDER: #9 is not ahead of #6');
  const lb = byNumber(att, 3);
  const rb = byNumber(att, 2);
  if (lb && rb && !(rb.x > lb.x + 20)) issues.push('ROLE_SIDE: ATT #2 is not clearly right of #3');

  const sameTeamMin = 3.2;
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      if (a.team !== b.team) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < sameTeamMin) {
        issues.push(`TOKEN_GAP: ${a.team}${a.number}/${b.team}${b.number} ${d.toFixed(1)} < ${sameTeamMin}`);
      }
    }
  }
  return issues.slice(0, 12);
}

export function yDriftIssues(
  before: Shirt[],
  after: Shirt[],
  maxBandDrift = 1.5
): FormLineIssue[] {
  const prev = new Map(before.map((p) => [p.id, p]));
  const issues: FormLineIssue[] = [];
  for (const p of after) {
    const b = prev.get(p.id);
    if (!b) continue;
    if (roleBand(p) === 'GK') continue;
    if (roleBand(p) !== 'BACK' && roleBand(p) !== 'MID') continue;
    const dy = Math.abs(p.y - b.y);
    if (dy > maxBandDrift) {
      issues.push(`Y_DRIFT: ${p.team}${p.number} Δy=${dy.toFixed(1)} > ${maxBandDrift}`);
    }
  }
  return issues.slice(0, 8);
}
