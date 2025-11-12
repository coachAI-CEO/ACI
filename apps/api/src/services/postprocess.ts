import assert from "node:assert";


// --- Canonicalization helpers ---

const EQUIP_MAP: Record<string,string> = {
  "bibs (two different colors": "Bibs (2 colors)",
  "bibs (two different colours": "Bibs (2 colors)",
  "bibs (two colors": "Bibs (2 colors)",
  "bibs (two different colors)": "Bibs (2 colors)",
  "bibs (two colors)": "Bibs (2 colors)",
  "team bibs": "Bibs (2 colors)",
  "pinnies": "Bibs (2 colors)",
  "pinnies (2 colors)": "Bibs (2 colors)",
  "pinnies/bibs (2 colors)": "Bibs (2 colors)",
  "pinnies (2 distinct colors)": "Bibs (2 colors)",
  "pinnies (2 distinct colours)": "Bibs (2 colors)",
  "cones or disc markers": "Cones",
  "cones or discs": "Cones",
  "cones/discs": "Cones",
  "cones/disc": "Cones",
  "1 small/mini goal": "Mini-goal",
  "mini goal": "Mini-goal",
  "mini-goal": "Mini-goal",
  "small goal": "Mini-goal",
  "pugg goals": "Mini-goal",
  "pugg goal": "Mini-goal",
  "2 mini-goals": "2 Mini-goals",
  "1 large goal": "1 Full-size goal",
  "1 full-sized goal": "1 Full-size goal",
  "1 full size goal": "1 Full-size goal",
  "full-size goal": "1 Full-size goal"
};

function canonicalizeEquipment(items: any): string[] {
  if (!Array.isArray(items)) return [];
  const out: string[] = [];
  for (const raw of items) {
    if (!raw) continue;
    const k = String(raw).trim();
    const mapKey = k.toLowerCase();
    out.push(EQUIP_MAP[mapKey] ?? k);
  }
  return Array.from(new Set(out));
}

function enforceGoalEquipment(list: string[], goalMode: "MINI2"|"LARGE"|null): string[] {
  const stripped = (list || []).filter(x =>
    !/mini[\-\s]?goal/i.test(x) &&
    !/(full[\-\s]?size(d)?|large)\s?goal/i.test(x)
  );
  if (goalMode === "MINI2") stripped.push("2 Mini-goals");
  if (goalMode === "LARGE") stripped.push("1 Full-size goal");
  return Array.from(new Set(stripped));
}

/** Canonical equipment synonyms -> preferred labels */
const EQUIP_CANON: Record<string, string> = {
  "team bibs": "Bibs (2 colors)",
  "pinnies (2 colors)": "Bibs (2 colors)",
  "pinnies/bibs (2 colors)": "Bibs (2 colors)",
  "cones or disc markers": "Cones",
  "cones or discs": "Cones",
  "cones/discs": "Cones",
  "cones/disc": "Cones",
  "2 mini-goals": "2 Mini-goals",
  "two mini-goals": "2 Mini-goals",
  "2 regular goals": "2 Full-size goals",
  "2 full-size goals": "2 Full-size goals",
  "full-size goal": "1 Full-size goal",
  "1 full-size goal": "1 Full-size goal"
};

/** Strict canonicalizer: lowercases, maps synonyms, dedupes (preserves order). */
function canonicalizeEquipmentV2(list: string[]): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const raw of list) {
    if (!raw) continue;
    const k = String(raw).toLowerCase().trim();
    out.push(EQUIP_CANON[k] || raw);
  }
  // dedupe
  return Array.from(new Set(out));
}

/** Ensure diagram object exists with basics */
function ensureDiagram(json: any) {
  json.diagram = json.diagram || {};
  json.diagram.teams = Array.isArray(json.diagram.teams) ? json.diagram.teams : [];
  if (typeof json.diagram.miniGoals !== "number") json.diagram.miniGoals = 0;
}

/** Ensure a GK team present or absent */
function setGKPresence(json: any, present: boolean) {
  ensureDiagram(json);
  const teams = json.diagram.teams as any[];
  const idx = teams.findIndex(t => (t?.label || "").toLowerCase() === "gk");
  if (present) {
    if (idx === -1) teams.push({ color: "green", count: 1, label: "GK" });
  } else {
    if (idx !== -1) teams.splice(idx, 1);
  }
}

/** Remove any equipment items that match /mini-goal/i or full-size goal as needed */
function filterEquipmentByMode(list: string[], mode: "MINI2" | "LARGE" | null): string[] {
  const lower = list.map(x => String(x));
  if (mode === "MINI2") {
    // keep minis, drop large-goal mentions
    return lower.filter(x => !/full[-\s]?size goal/i.test(x));
  }
  if (mode === "LARGE") {
    // keep large goal, drop minis
    return lower.filter(x => !/mini-?goals?/i.test(x));
  }
  return lower;
}

/** Public API: post-process the drill JSON according to goalsAvailable and normalize equipment */
export function postProcessDrill(drill: any, body?: any) {
  // guard
  assert(drill && typeof drill === "object", "postProcessDrill: drill must be object");
  drill.json = drill.json || {};
  const json = drill.json;

  // 1) pick goalsAvailable from request body first, fallback to json
  const goalsAvailable: number =
    (body && typeof body.goalsAvailable === "number" ? body.goalsAvailable : undefined) ??
    (typeof json.goalsAvailable === "number" ? json.goalsAvailable : 0);

  // 2) decide mode + diagram + GK presence
  let goalMode: "MINI2" | "LARGE" | null = null;
  ensureDiagram(json);

  if (goalsAvailable >= 2) {
    goalMode = "MINI2";
    json.diagram.miniGoals = 2;
    setGKPresence(json, false);
  } else if (goalsAvailable === 1) {
    goalMode = "LARGE";
    json.diagram.miniGoals = 0;
    setGKPresence(json, true);
  } else {
    goalMode = null;
    json.diagram.miniGoals = 0;
    setGKPresence(json, false);
  }
  json.goalMode = goalMode;

  // 3) equipment canonicalization + enforcement by mode
  let equip: string[] = Array.isArray(json.equipment) ? json.equipment.slice() : [];
  equip = canonicalizeEquipmentV2(equip);
  equip = filterEquipmentByMode(equip, goalMode);

  if (goalMode === "MINI2") {
    // ensure minis present; ensure bibs, balls, cones are not lost
    if (!equip.some(x => /mini-?goals?/i.test(x))) equip.push("2 Mini-goals");
  }
  if (goalMode === "LARGE") {
    // ensure one full-size goal; ensure bibs, balls, cones are not lost
    if (!equip.some(x => /full[-\s]?size goal/i.test(x))) equip.push("1 Full-size goal");
  }

  // Make sure common essentials appear at least once
  const ensureItem = (label: string, regex: RegExp) => {
    if (!equip.some(x => regex.test(x))) equip.push(label);
  };
  ensureItem("Bibs (2 colors)", /bibs?\s*\(2 colors\)/i);
  ensureItem("Soccer balls", /soccer\s*balls?/i);
  ensureItem("Cones", /^Cones$/i);

  json.equipment = canonicalizeEquipmentV2(equip);

  // 4) debug log
  try {
    const teamsLbl = Array.isArray(json?.diagram?.teams)
      ? json.diagram.teams.map((t: any) => t.label).join(",")
      : "";
    // eslint-disable-next-line no-console
    if (process.env.LOG_POSTPROC === '1') {
      console.log("[POSTPROC]", {
        goalsAvailable,
        goalMode: json.goalMode ?? null,
        miniGoals: json.diagram?.miniGoals ?? null,
        teams: teamsLbl,
        equipment: json.equipment ?? []
      });
    }
  } catch {
    /* noop */
  }
}
