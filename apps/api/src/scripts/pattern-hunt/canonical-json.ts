import { formatOutfieldPerSide, practiceSpaceYards, type FieldFormat } from "../../data/field-dimensions";
import type { PatternHuntCell } from "./matrix";

function asFormat(value: string | undefined): FieldFormat {
  const key = String(value || "9V9").toUpperCase();
  if (key === "7V7" || key === "11V11") return key;
  return "9V9";
}

function roster(cell: PatternHuntCell): { att: number; def: number; neu: number; gk: number } {
  const format = asFormat(cell.input.fieldFormat);
  const goals = cell.expectedFullGoals;
  const gk = goals === 0 ? 0 : 2;
  if (cell.fault === "phantom-gk") {
    return { att: 5, def: 2, neu: 0, gk: 1 };
  }
  if (/neutral/i.test(cell.input.formationAttacking)) {
    return { att: 4, def: 4, neu: 2, gk: 0 };
  }
  if (cell.allowUnopposed && goals === 0) {
    return { att: 5, def: 2, neu: 0, gk: 0 };
  }
  if (goals === 0) {
    const side = Math.max(3, Math.floor(cell.input.numbersMin / 2));
    return { att: side, def: side, neu: 0, gk: 0 };
  }
  const out = formatOutfieldPerSide(format);
  const gkBudget = Math.max(0, cell.input.numbersMax - gk);
  const cap = Math.floor(gkBudget / 2);
  const side = Math.min(out, Math.max(3, cap));
  return { att: side, def: side, neu: 0, gk };
}

function player(id: string, team: string, role: string, x: number, y: number, number: number) {
  return { id, team, role, x, y, number };
}

function scatterSide(team: "ATT" | "DEF", count: number, fault: PatternHuntCell["fault"]): ReturnType<typeof player>[] {
  const defending = team === "DEF";
  const baseX = defending ? 72 : 28;
  const rolesDump = ["LB", "CB", "CB", "RB", "CM", "CM", "ST", "ST", "CM", "ST"];
  const allCb = fault === "all-cb" && defending;
  const dump = fault === "dump-422" && defending;
  const swapAtt = fault === "att-lr-swap" && !defending;
  const swapDef = fault === "def-lr-swap" && defending;
  const out: ReturnType<typeof player>[] = [];
  for (let i = 0; i < count; i++) {
    const col = Math.floor(i / 4);
    const row = i % 4;
    let x = baseX + (defending ? -col : col) * 14;
    let y = 18 + row * 18;
    let role = dump ? rolesDump[i] || "CM" : allCb ? "CB" : "CM";
    if (swapAtt && i === 0) {
      role = "LB";
      y = 82;
    }
    if (swapAtt && i === 1) {
      role = "RB";
      y = 18;
    }
    if (swapDef && i === 0) {
      role = "LB";
      y = 18;
    }
    if (swapDef && i === 1) {
      role = "RB";
      y = 82;
    }
    if (dump) {
      x = i < 4 ? 75 : i < 6 ? 55 : 35;
      y = i < 4 ? 8 + (i % 4) * 14 : 20 + ((i - 4) % 2) * 15;
    }
    out.push(player(`${team}-${i + 1}`, team, role, x, y, i + 2));
  }
  return out;
}

export function canonicalJson(cell: PatternHuntCell): Record<string, any> {
  const format = asFormat(cell.input.fieldFormat);
  const cap = practiceSpaceYards(format, cell.input.spaceConstraint);
  const counts = roster(cell);
  const yard = cell.fault === "yard-axis";
  const scaleX = yard ? cap.lengthYards / 100 : 1;
  const scaleY = yard ? cap.widthYards / 100 : 1;
  const remap = (x: number, y: number) => ({ x: x * scaleX, y: y * scaleY });

  const players = [
    ...scatterSide("ATT", counts.att, cell.fault),
    ...scatterSide("DEF", counts.def, cell.fault),
  ];
  for (let i = 0; i < counts.neu; i++) {
    players.push(player(`NEU-${i + 1}`, "NEUTRAL", "N", 50, i === 0 ? 10 : 90, 30 + i));
  }
  if (counts.gk >= 1) {
    players.push(player("GK-L", "ATT", "GK", 6, 50, 1));
  }
  if (counts.gk >= 2) {
    players.push(player("GK-R", "DEF", "GK", 94, 50, 1));
  }
  if (cell.fault === "phantom-gk" && counts.gk === 1) {
    players.push(player("GK-PHANTOM", "DEF", "GK", 50, 50, 1));
  }

  const goals: Array<Record<string, unknown>> = [];
  if (cell.expectedFullGoals >= 1) {
    goals.push({ id: "G-R", type: "full", x: 100, y: 50, width: 8 });
  }
  if (cell.expectedFullGoals >= 2) {
    goals.push({ id: "G-L", type: "full", x: 0, y: 50, width: 8 });
  }
  if (cell.expectedFullGoals === 1) {
    goals.push({ id: "MG-T", type: "mini", x: 6, y: 38, width: 4 });
    goals.push({ id: "MG-B", type: "mini", x: 6, y: 62, width: 4 });
  }

  const omitFormations = cell.fault === "empty-formation" || cell.fault === "setup-text-only";
  const json: Record<string, any> = {
    title: cell.label,
    drillType: cell.input.drillType,
    fieldFormat: format,
    spaceConstraint: cell.input.spaceConstraint,
    goalsAvailable: cell.input.goalsAvailable,
    phase: cell.input.phase,
    zone: cell.input.zone,
    formationAttacking: omitFormations ? "" : cell.input.formationAttacking,
    formationDefending: omitFormations ? "" : cell.input.formationDefending,
    coachLevel: cell.input.coachLevel,
    playerLevel: cell.input.playerLevel,
    organization: {
      area: { lengthYards: cap.lengthYards, widthYards: cap.widthYards, format },
      setupSteps:
        cell.fault === "setup-text-only"
          ? ["Teams set up in their respective formations: 3-2-3 attacking vs 3-3-2 defending."]
          : [`Play ${format} ${cell.input.spaceConstraint.toLowerCase()}.`],
    },
    diagram: {
      pitch: { variant: cell.input.spaceConstraint, orientation: "HORIZONTAL" },
      players: players.map((p) => ({ ...p, ...remap(p.x, p.y) })),
      goals: goals.map((g) => ({ ...g, ...remap(Number(g.x), Number(g.y)) })),
      arrows: [],
      annotations: [],
      areas: [],
      safeZones:
        cell.fault === "match-area"
          ? [{ id: "sz1", label: "Match Area", x: 0, y: 0, width: 80, height: 55 }]
          : [],
    },
  };
  if (yard) {
    json.diagram.goals = json.diagram.goals.map((g: any) => ({
      ...g,
      x: g.x >= cap.lengthYards / 2 ? cap.lengthYards : 0,
      y: cap.widthYards / 2,
    }));
  }
  return json;
}
