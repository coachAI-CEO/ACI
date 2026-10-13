import fs from "fs";
import { build11v11FormationPlayers } from "../services/web-diagram-v1";
import { placePhaseSnapshot, roleBand, type DefBlockHeight } from "../services/board-phase-placement";

const OUT = process.argv[2];
const DEF_FORMATIONS = ["4-4-2", "4-3-3", "3-5-2", "5-3-2", "4-2-3-1", "4-1-4-1"] as const;
const BLOCKS: DefBlockHeight[] = ["high", "mid", "low"];

type P = { id: string; number?: number; role?: string; team: string; x: number; y: number };
const mean = (a: number[]) => (a.length ? a.reduce((s, n) => s + n, 0) / a.length : NaN);

function metrics(base: P[], moved: P[], ball: { x: number; y: number }) {
  const baseById = new Map(base.map((p) => [p.id, p]));
  const out = moved.filter((p) => roleBand(p) !== "GK");
  // Side flips: outfield player was clearly on one side at base and ended up on the other.
  let flips = 0;
  for (const p of out) {
    const b = baseById.get(p.id)!;
    if (Math.abs(b.x - 50) > 6 && Math.abs(p.x - 50) > 6 && Math.sign(b.x - 50) !== Math.sign(p.x - 50)) flips++;
  }
  const by = (band: string) => out.filter((p) => roleBand(p) === band).map((p) => p.y);
  const back = mean(by("BACK")), mid = mean(by("MID")), front = mean(by("FRONT"));
  let minGap = Infinity;
  for (let i = 0; i < moved.length; i++)
    for (let j = i + 1; j < moved.length; j++)
      minGap = Math.min(minGap, Math.hypot(moved[i].x - moved[j].x, moved[i].y - moved[j].y));
  const forward = mean(out.map((p) => p.y)) - mean(out.map((p) => baseById.get(p.id)!.y));
  return {
    flips,
    back: back.toFixed(0), mid: mid.toFixed(0), front: front.toFixed(0),
    ordered: back < mid && mid < front,
    frontToBall: (ball.y - front).toFixed(0),
    minGap: minGap.toFixed(1),
    forward: forward.toFixed(0),
  };
}

const att = build11v11FormationPlayers("4-3-3", "ATT");
const rows: any[] = [];
const cases: { label: string; att: P[]; base: P[]; cur: P[]; rel: P[]; ball: any }[] = [];

const run = (roster: any[], defF: string, block: DefBlockHeight, relative: boolean) => {
  if (relative) process.env.BOARD_PRESS_RELATIVE = "1"; else delete process.env.BOARD_PRESS_RELATIVE;
  try {
    return placePhaseSnapshot({ roster, subPhase: "goal_kick", attFormation: "4-3-3", defFormation: defF as any, channelX: 50, defBlock: block, includeMotifArrows: false });
  } finally { delete process.env.BOARD_PRESS_RELATIVE; }
};
let idempotentFails = 0, attChanged = 0;
for (const defF of DEF_FORMATIONS) {
  const defBase = build11v11FormationPlayers(defF, "DEF") as P[];
  if (!defBase.length) { console.log("skip (no base slots in API):", defF); continue; }
  for (const block of BLOCKS) {
    const roster = [...att, ...defBase] as any[];
    const cur = run(roster, defF, block, false);
    const rel = run(roster, defF, block, true);
    const ball = cur.balls?.[0] || { x: 45, y: 84 };
    const curDef = cur.players.filter((p: P) => p.team === "DEF") as P[];
    const relDef = rel.players.filter((p: P) => p.team === "DEF") as P[];
    const attCur = cur.players.filter((p: P) => p.team === "ATT") as P[];
    const attRel = rel.players.filter((p: P) => p.team === "ATT") as P[];
    // Re-run safety: feed the relative result back in as the roster; must not drift.
    const again = run(rel.players as any[], defF, block, true).players.filter((p: P) => p.team === "DEF") as P[];
    if (again.some((p, i) => Math.abs(p.x - relDef[i].x) > 0.01 || Math.abs(p.y - relDef[i].y) > 0.01)) idempotentFails++;
    if (attRel.some((p, i) => Math.abs(p.x - attCur[i].x) > 0.01 || Math.abs(p.y - attCur[i].y) > 0.01)) attChanged++;
    const mc = metrics(defBase, curDef, ball), mr = metrics(defBase, relDef, ball);
    rows.push({ def: defF, block,
      "cur flips": mc.flips, "rel flips": mr.flips,
      "cur B/M/F": `${mc.back}/${mc.mid}/${mc.front}`, "rel B/M/F": `${mr.back}/${mr.mid}/${mr.front}`,
      "cur ord": mc.ordered, "rel ord": mr.ordered,
      "cur minGap": mc.minGap, "rel minGap": mr.minGap,
      "cur f→ball": mc.frontToBall, "rel f→ball": mr.frontToBall });
    cases.push({ label: `DEF ${defF} · ${block} press`, att: attCur, base: defBase, cur: curDef, rel: relDef, ball });
  }
}
console.log(`re-run drift cases: ${idempotentFails}   ATT changed by flag: ${attChanged}`);
console.table(rows);

// ---- HTML: side-by-side pitches --------------------------------------------
function pitch(title: string, def: P[], attP: P[], ball: any, color: string) {
  const W = 420, H = 270;
  // screen X = y% (goal-to-goal), screen Y = (100 - x)% (high x = top)
  const sx = (y: number) => (y / 100) * W, sy = (x: number) => ((100 - x) / 100) * H;
  const dot = (p: P, c: string) => `<circle cx="${sx(p.y).toFixed(1)}" cy="${sy(p.x).toFixed(1)}" r="9" fill="${c}" stroke="#fff" stroke-width="1"/><text x="${sx(p.y).toFixed(1)}" y="${(sy(p.x) + 3.5).toFixed(1)}" font-size="9" fill="#fff" text-anchor="middle" font-family="sans-serif">${p.number ?? ""}</text>`;
  return `<div><div class="t">${title}</div><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#2e7d3a"/><rect x="2" y="2" width="${W - 4}" height="${H - 4}" fill="none" stroke="#fff" stroke-opacity=".7"/>
    <line x1="${W / 2}" y1="2" x2="${W / 2}" y2="${H - 2}" stroke="#fff" stroke-opacity=".7"/><circle cx="${W / 2}" cy="${H / 2}" r="30" fill="none" stroke="#fff" stroke-opacity=".7"/>
    ${attP.map((p) => dot(p, "#3b82f6")).join("")}${def.map((p) => dot(p, color)).join("")}
    <circle cx="${sx(ball.y)}" cy="${sy(ball.x)}" r="5" fill="#fff" stroke="#000"/></svg></div>`;
}
const pick = ["DEF 4-4-2 · high press", "DEF 3-5-2 · high press", "DEF 5-3-2 · mid press", "DEF 4-2-3-1 · low press"];
const html = `<!doctype html><meta charset=utf-8><style>body{font-family:sans-serif;background:#0b1220;color:#e2e8f0;margin:16px}
.row{display:flex;gap:14px;margin-bottom:18px;align-items:flex-start}.t{font-size:12px;margin:0 0 4px;color:#94a3b8}h3{margin:14px 0 6px;font-size:14px}
.legend{font-size:12px;color:#94a3b8;margin-bottom:10px}</style>
<div class=legend>Blue = ATT (us, attacks LEFT). Red = DEF (them) pressing our goal kick, ball shown in white. Left: base shape. Middle: CURRENT absolute placement. Right: RELATIVE prototype.</div>
${cases.filter((c) => pick.includes(c.label)).map((c) => `<h3>${c.label}</h3><div class=row>${pitch("Base shape", c.base, c.att, c.ball, "#ef4444")}${pitch("Current (absolute)", c.cur, c.att, c.ball, "#ef4444")}${pitch("Relative (prototype)", c.rel, c.att, c.ball, "#f59e0b")}</div>`).join("")}`;
fs.writeFileSync(OUT, html);
console.log("wrote", OUT);
