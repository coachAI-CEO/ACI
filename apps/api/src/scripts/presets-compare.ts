/**
 * Side-by-side HTML: authored chassis vs BOARD_RELATIVE_PRESETS, every phase x formation.
 * Usage: npx ts-node --transpile-only --project tsconfig.json src/scripts/presets-compare.ts out.html
 */
import fs from 'fs';
import { build11v11FormationPlayers } from '../services/web-diagram-v1';
import { placePhaseSnapshot } from '../services/board-phase-placement';

const OUT = process.argv[2] || 'presets-compare.html';
const FORMATIONS = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1'] as const;
const PHASES = ['goal_kick', 'pocket', 'final_third'] as const;
type P = { id: string; number?: number; team: string; x: number; y: number };

function place(def: string, phase: (typeof PHASES)[number], relative: boolean): P[] {
  if (relative) process.env.BOARD_RELATIVE_PRESETS = '1';
  else delete process.env.BOARD_RELATIVE_PRESETS;
  try {
    const roster = [...build11v11FormationPlayers('4-3-3', 'ATT'), ...build11v11FormationPlayers(def as any, 'DEF')];
    return placePhaseSnapshot({ roster, subPhase: phase, attFormation: '4-3-3', defFormation: def as any, channelX: 50, defBlock: 'high', includeMotifArrows: false }).players as P[];
  } finally {
    delete process.env.BOARD_RELATIVE_PRESETS;
  }
}

const W = 330, H = 215, S = 3.3, PAD = 0;
// horizontal pitch: goal-to-goal (y) runs left to right, width (x) high = top of screen
const sx = (y: number) => PAD + y * S;
const sy = (x: number) => PAD + (100 - x) * (H / 100);
function pitch(title: string, ps: P[], diff?: Map<string, P>) {
  const dots = ps
    .map((p) => {
      const col = p.team === 'ATT' ? '#2b6cff' : '#e0412f';
      const ghost = diff?.get(p.id);
      const ghostLine = ghost ? `<line x1="${sx(ghost.y)}" y1="${sy(ghost.x)}" x2="${sx(p.y)}" y2="${sy(p.x)}" stroke="${col}" stroke-opacity=".35" stroke-dasharray="2 2"/><circle cx="${sx(ghost.y)}" cy="${sy(ghost.x)}" r="4" fill="none" stroke="${col}" stroke-opacity=".5"/>` : '';
      return `${ghostLine}<circle cx="${sx(p.y)}" cy="${sy(p.x)}" r="8.5" fill="${col}"/><text x="${sx(p.y)}" y="${sy(p.x) + 3.5}" font-size="9" fill="#fff" text-anchor="middle" font-weight="700">${p.number ?? ''}</text>`;
    })
    .join('');
  return `<div class="c"><div class="t">${title}</div><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#2e7d32"/><line x1="${W / 2}" y1="0" x2="${W / 2}" y2="${H}" stroke="#fff" stroke-opacity=".5"/><circle cx="${W / 2}" cy="${H / 2}" r="22" fill="none" stroke="#fff" stroke-opacity=".5"/><rect x="0" y="${H * 0.2}" width="${S * 16}" height="${H * 0.6}" fill="none" stroke="#fff" stroke-opacity=".5"/><rect x="${W - S * 16}" y="${H * 0.2}" width="${S * 16}" height="${H * 0.6}" fill="none" stroke="#fff" stroke-opacity=".5"/>${dots}</svg></div>`;
}

let body = '';
for (const phase of PHASES) {
  body += `<h2>${phase.replace('_', ' ')}</h2>`;
  for (const def of FORMATIONS) {
    const auth = place(def, phase, false);
    const rel = place(def, phase, true);
    const moved = new Map(auth.map((p) => [p.id, p]));
    let sum = 0;
    for (const p of rel) { const a = moved.get(p.id)!; sum += Math.hypot(a.x - p.x, a.y - p.y); }
    body += `<div class="row"><div class="lab">ATT 4-3-3<br>vs DEF ${def}<br><span>avg shift ${(sum / rel.length).toFixed(1)}</span></div>${pitch('authored (today)', auth)}${pitch('relative presets (dashed = authored)', rel, moved)}</div>`;
  }
}
const html = `<!doctype html><meta charset=utf-8><title>Authored vs relative presets</title><style>body{font:13px system-ui;background:#111;color:#eee;margin:16px}h2{margin:20px 0 6px;text-transform:capitalize}.row{display:flex;gap:10px;align-items:center;margin:6px 0}.lab{width:110px;font-weight:600}.lab span{font-weight:400;color:#9aa}.t{font-size:11px;color:#9aa;margin-bottom:2px}svg{border-radius:4px;display:block}</style><h1 style="font-size:18px">Blue attacks LEFT (own goal right). Red attacks RIGHT.</h1>${body}`;
fs.writeFileSync(OUT, html);
console.log('wrote', OUT);
