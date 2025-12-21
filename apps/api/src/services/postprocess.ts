import assert from "node:assert";
import type { EnergySystem } from "../types/drill";
import { normalizeGoalFields } from "./goal-normalizer";

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

export function postProcessDrill({ json }: { json: any }, input: any) {
  const body = json || {};

  // guard
  assert(json && typeof json === "object", "postProcessDrill: drill must be object");
  json.json = json.json || {};
  const raw = json.json;
  
  console.log("📦 [POSTPROCESS] raw.organization type:", typeof raw.organization);
  console.log("📦 [POSTPROCESS] body.organization type:", typeof body.organization);

  // Compute QA score and approval in the same scope
  const qa = body.qa || {};
  const qaScore =
    qa?.scores
      ? Object.values(qa.scores).reduce(
          (a: number, b: any) => a + Number(b || 0),
          0
        ) / Math.max(1, Object.keys(qa.scores || {}).length)
      : null;
  const approved = !!qa.pass;

  // --- NORMALIZE GOAL FIELDS USING SINGLE HELPER ---
  const goalNormalization = normalizeGoalFields({
    goalsAvailable: typeof body.goalsAvailable === "number" 
      ? body.goalsAvailable 
      : input.goalsAvailable ?? 0,
    rawGoalMode: body.goalMode,
    json: body,
  });

  const { goalMode, goalsAvailable, goalsSupported } = goalNormalization;

  // Update diagram based on normalized goalMode
  ensureDiagram(json);
  if (goalMode === "MINI2") {
    json.diagram.miniGoals = 2;
    setGKPresence(json, false);
  } else if (goalMode === "LARGE") {
    json.diagram.miniGoals = 0;
    setGKPresence(json, true);
  } else {
    json.diagram.miniGoals = 0;
    setGKPresence(json, false);
  }
  json.goalMode = goalMode;

  // --- NEW LOCAL HELPERS (defined once, used in return) ---
  const principleIds: string[] = Array.isArray(body.principleIds)
    ? body.principleIds
    : [];

  const psychThemeIds: string[] = Array.isArray(body.psychThemeIds)
    ? body.psychThemeIds
    : [];

  const energySystem: EnergySystem =
    (body.energySystem as EnergySystem) ?? "Aerobic";

  const rpeMin: number =
    typeof body.rpeMin === "number"
      ? body.rpeMin
      : 3;

  const rpeMax: number =
    typeof body.rpeMax === "number"
      ? body.rpeMax
      : 6;

  const numbersMin: number =
    typeof body.numbers?.min === "number"
      ? body.numbers.min
      : input.numbersMin;

  const numbersMax: number =
    typeof body.numbers?.max === "number"
      ? body.numbers.max
      : input.numbersMax;

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

  // Ensure body.json.organization is set to the processed value (if it's an object)
  const processedOrg = raw.organization ?? body.organization ?? "";
  console.log("🔧 [POSTPROCESS] processedOrg type:", typeof processedOrg);
  console.log("🔧 [POSTPROCESS] body.json exists?", !!body.json);
  if (typeof processedOrg === "object" && body.json) {
    body.json.organization = processedOrg;
    console.log("✅ [POSTPROCESS] Set body.json.organization to object");
  } else {
    console.log("⚠️ [POSTPROCESS] NOT setting body.json.organization (processedOrg type:", typeof processedOrg, ", body.json:", !!body.json, ")");
  }
  
  // Remove forbidden keys from body.json (sanitizer should have done this, but ensure it)
  // Remove unconditionally - these keys are forbidden regardless
  if (body.json) {
    if (body.json.diagramV1) {
      delete body.json.diagramV1;
      console.log("🗑️ [POSTPROCESS] Removed diagramV1 from body.json (forbidden key)");
    }
    if (body.json.progression) {
      delete body.json.progression;
      console.log("🗑️ [POSTPROCESS] Removed progression from body.json (forbidden key)");
    }
  }
  
  // Also remove from body itself (top level) if they exist
  if (body.diagramV1) {
    delete body.diagramV1;
    console.log("🗑️ [POSTPROCESS] Removed diagramV1 from body (forbidden key)");
  }
  if (body.progression) {
    delete body.progression;
    console.log("🗑️ [POSTPROCESS] Removed progression from body (forbidden key)");
  }
  
  return {
    title: body.title ?? "",
    gameModelId: input.gameModelId,
    phase: input.phase,
    zone: input.zone,
    ageGroup: input.ageGroup,
    durationMin: input.durationMin ?? body.durationMin ?? 20,
    qaScore,
    approved,
    json: body,

    // --- NORMALIZED METADATA FIELDS ---
    principleIds,
    psychThemeIds,

    energySystem,

    rpeMin,
    rpeMax,

    numbersMin,
    numbersMax,

    spaceConstraint: input.spaceConstraint,

    // Goal fields from normalized result
    goalsAvailable,
    goalMode,
    goalsSupported,

    // --- NEW: Formation & Level fields (source of truth: input) ---
    formationUsed: input.formationAttacking, // Use attacking formation as primary for backward compatibility
    playerLevel: input.playerLevel,
    coachLevel: input.coachLevel,

    needGKFocus: !!body.needGKFocus,
    gkFocus:
      typeof body.gkFocus === "string"
        ? body.gkFocus
        : null,

    // Check nested raw.X first (sanitizer fixes these), then body.X
    organization: processedOrg,
    description: raw.description ?? body.description ?? "",
    coachingPoints: raw.coachingPoints ?? body.coachingPoints ?? [],
    progressions:
      raw.progressions ??
      body.progressions ??
      body.progression ??
      [],
    scoringHints: raw.scoringHints ?? body.scoringHints ?? [],
    constraints: raw.constraints ?? body.constraints ?? [],
    equipment: raw.equipment ?? body.equipment ?? [],

    diagramV1: raw.diagramV1 ?? body.diagramV1 ?? raw.diagram ?? body.diagram ?? {},
    diagram: raw.diagram ?? body.diagram ?? undefined,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    // ...existing fields...
  };
}