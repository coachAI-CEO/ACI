import assert from "node:assert";

// --- Canonicalization helpers ---

const EQUIP_MAP: Record<string, string> = {
  footballs: "Soccer balls",
  "cones/markers": "Cones",
  "cones or markers": "Cones",
  markers: "Cones",
  "bibs (two different colors": "Bibs (2 colors)",
  "bibs (two different colours": "Bibs (2 colors)",
  "bibs (two colors": "Bibs (2 colors)",
  "bibs (two different colors)": "Bibs (2 colors)",
  "bibs (two colors)": "Bibs (2 colors)",
  "team bibs": "Bibs (2 colors)",
  pinnies: "Bibs (2 colors)",
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
  "full-size goal": "1 Full-size goal",
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

function enforceGoalEquipment(
  list: string[],
  goalMode: "MINI2" | "LARGE" | null
): string[] {
  const stripped = (list || []).filter(
    (x) =>
      !/mini[\-\s]?goal/i.test(x) &&
      !/(full[\-\s]?size(d)?|large)\s?goal/i.test(x)
  );
  if (goalMode === "MINI2") stripped.push("2 Mini-goals");
  if (goalMode === "LARGE") stripped.push("1 Full-size goal");
  return Array.from(new Set(stripped));
}

/** Canonical equipment synonyms -> preferred labels */
const EQUIP_CANON: Record<string, string> = {
  "pinnies (2 different colors)": "Bibs (2 colors)",
  "pinnies (two different colors)": "Bibs (2 colors)",
  "pinnies (2 different colours)": "Bibs (2 colors)",
  "pinnies (two different colours)": "Bibs (2 colors)",
  pinnies: "Bibs (2 colors)",
  footballs: "Soccer balls",
  "cones/markers": "Cones",
  "cones or markers": "Cones",
  markers: "Cones",
  "cones (to mark playing area)": "Cones",
  "bibs (blue and red)": "Bibs (2 colors)",
  "large goal": "1 Full-size goal",
  "1 small counter-goal": "Mini-goal",
  "small counter-goal": "Mini-goal",
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
  "1 full-size goal": "1 Full-size goal",
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
  json.diagram.teams = Array.isArray(json.diagram.teams)
    ? json.diagram.teams
    : [];
  if (typeof json.diagram.miniGoals !== "number") json.diagram.miniGoals = 0;
}

/** Ensure a GK team present or absent */
function setGKPresence(json: any, present: boolean) {
  ensureDiagram(json);
  const teams = json.diagram.teams as any[];
  const idx = teams.findIndex(
    (t) => (t?.label || "").toLowerCase() === "gk"
  );
  if (present) {
    if (idx === -1) teams.push({ color: "green", count: 1, label: "GK" });
  } else {
    if (idx !== -1) teams.splice(idx, 1);
  }
}

/** Remove any equipment items that match /mini-goal/i or full-size goal as needed */
function filterEquipmentByMode(
  list: string[],
  mode: "MINI2" | "LARGE" | null
): string[] {
  const items = (list || []).map((x) => String(x));
  if (mode === "MINI2") {
    // Drop ALL goal mentions first (both large and mini/counter), we will add the exact canonical later
    return items
      .filter((x) => !/(?:full[\-\s]?size|large)\s?goal/i.test(x))
      .filter((x) => !/mini[\-\s]?goals?/i.test(x))
      .filter((x) => !/counter[\-\s]?goal/i.test(x));
  }
  if (mode === "LARGE") {
    // Keep large, drop minis; (the caller will ensure the canonical 1 Full-size goal is present)
    return items.filter((x) => !/mini[\-\s]?goals?/i.test(x));
  }
  return items;
}

/** Public API: post-process the drill JSON according to goalsAvailable and normalize equipment */
function uniqueEquip(arr: any[]): string[] {
  return Array.from(new Set(arr.filter(Boolean))).sort();
}

function __canonOrder(): string[] {
  return ["Cones", "Bibs (2 colors)", "Soccer balls", "2 Mini-goals", "1 Full-size goal"];
}

function __regexCanon(item: unknown): string {
  const s = String(item ?? "").trim();
  const lower = s.toLowerCase();

  // Balls
  if (/^footballs?/.test(lower) || /soccer\s*balls?/.test(lower))
    return "Soccer balls";

  // Bibs (2 colors)
  if (/(?:^|\W)bibs?(?:\W|$)/i.test(s) && /(two|\b2\b)/i.test(s))
    return "Bibs (2 colors)";

  // Cones (cones/discs/markers variants)
  if (/(?:^|\W)(?:cones?|disc(?:s)?|marker(?:s)?)\b/i.test(s)) return "Cones";

  // Full-size goal (large or full-sized variants)
  if (/(?:^|\W)(?:full[-\s]?size(?:d)?|large)\s*goals?\b/i.test(s))
    return "1 Full-size goal";

  // Mini-goals (mini/pugg/small variants)
  if (/(?:^|\W)(?:mini|pugg|small)[-\s]?goals?\b/i.test(s))
    return "2 Mini-goals";

  return s;
}

function __canonEquip(list: string[]): string[] {
  const mapped: string[] = (list || [])
    .map((x: string) => (EQUIP_CANON as Record<string, string>)[x] ?? x)
    .map(__regexCanon);
  const uniq: string[] = Array.from(new Set(mapped.filter(Boolean)));
  const order = __canonOrder();
  const idx = (v: string) => {
    const i = order.indexOf(v);
    return i === -1 ? 999 : i;
  };
  uniq.sort((a: string, b: string) => idx(a) - idx(b));
  return uniq;
}

export function postProcessDrill(drill: any, body?: any) {
  // guard
  assert(drill && typeof drill === "object", "postProcessDrill: drill must be object");
  drill.json = drill.json || {};
  const json = drill.json;

  // 1) pick goalsAvailable from request body first, fallback to json
  const goalsAvailable: number =
    (body && typeof body.goalsAvailable === "number"
      ? body.goalsAvailable
      : undefined) ??
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
  const essentials = ["Bibs (2 colors)", "Soccer balls", "Cones"];
  let equip: string[] = Array.isArray(json.equipment)
    ? json.equipment.slice()
    : [];
  // normalize inputs
  equip = canonicalizeEquipmentV2(equip);
  equip = filterEquipmentByMode(equip, goalMode);
  equip = __canonEquip(uniqueEquip(equip));

  // Rebuild deterministically by mode
  const base = new Set<string>(essentials);
  if (goalMode === "MINI2") {
    base.add("2 Mini-goals");
  } else if (goalMode === "LARGE") {
    base.add("1 Full-size goal");
  }

  // Carry forward only non-goal extras
  for (const it of equip) {
    if (/mini[-\s]?goals?/i.test(it)) continue;
    if (/full[-\s]?size\s*goal/i.test(it)) continue;
    base.add(it);
  }

  json.equipment = __canonEquip(Array.from(base));

  // 4) ensure gameModelId + QA are present
  if (!json.gameModelId) {
    json.gameModelId =
      (body && typeof body.gameModelId === "string" && body.gameModelId) ||
      "COACHAI";
  }

  if (!json.qa) {
    json.qa = {
      pass: true,
      scores: {},
      notes: [
        "QA stub: structural checks only; full reviewer pipeline WIP."
      ],
    };
  }

  // 5) debug log
  try {
    const teamsLbl = Array.isArray(json?.diagram?.teams)
      ? json.diagram.teams.map((t: any) => t.label).join(",")
      : "";
    if (process.env.LOG_POSTPROC === "1") {
      // eslint-disable-next-line no-console
      console.log("[POSTPROC]", {
        goalsAvailable,
        goalMode: json.goalMode ?? null,
        miniGoals: json.diagram?.miniGoals ?? null,
        teams: teamsLbl,
        equipment: json.equipment ?? [],
      });
    }
  } catch {
    /* noop */
  }
}