import { isWarmupPicture, resolveFieldFormat, type FieldFormat } from "../data/field-dimensions";
import type { SceneCard, ScenePicture } from "./scene-document";

export type SceneDrillLike = {
  title?: string | null;
  json?: unknown;
  drillType?: string | null;
  durationMin?: number | null;
  rpeMin?: number | null;
  rpeMax?: number | null;
  numbersMin?: number | null;
  numbersMax?: number | null;
  spaceConstraint?: string | null;
  formationUsed?: string | null;
  phase?: string | null;
  zone?: string | null;
  coachLevel?: string | null;
};

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

function asFormat(value: unknown, playerCount: number): FieldFormat {
  const key = String(value || "").toUpperCase();
  if (key === "7V7" || key === "9V9" || key === "11V11") return key;
  return resolveFieldFormat(playerCount || 14);
}

function listText(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item : String(item?.text || item || ""))).filter(Boolean);
}

/** Conservative picture tag. Only when the card is explicit — press-as-a-unit is not a switch. */
export function inferScenePicture(card: string, drillType: string): ScenePicture | undefined {
  const text = `${drillType} ${card}`.toLowerCase();
  if (/\brondo\b/.test(text) || (isWarmupPicture(drillType) && /\b(4v1|5v2|4v2)\b/.test(text))) return "rondo";
  if (/\b1v1\b/.test(text) || /\b2v1\b/.test(text) || (/\b3v2\b/.test(text) && /channel|mini/.test(text))) return "center";
  if (/switch (the )?point of attack|weak-?side/.test(text)) return "matchup";
  return undefined;
}

/** Practice card for the scene model. Never include json.diagram coordinates. */
export function buildSceneCard(drill: SceneDrillLike): SceneCard {
  const json = asRecord(drill.json);
  const organization = asRecord(json.organization);
  const area = asRecord(organization.area);
  const drillType = String(drill.drillType || json.drillType || "TECHNICAL");
  const nMin = Number(drill.numbersMin ?? json.numbersMin ?? asRecord(json.numbers).min ?? 8);
  const nMax = Number(drill.numbersMax ?? json.numbersMax ?? asRecord(json.numbers).max ?? nMin);
  const goalsAvailable = Number(json.goalsAvailable ?? 0);
  const spaceConstraint = String(drill.spaceConstraint || json.spaceConstraint || area.spaceConstraint || "FULL");
  const fieldFormat = asFormat(json.fieldFormat || area.format, nMax);
  const coachLevel = String(drill.coachLevel || json.coachLevel || "USSF_D");
  const ageGroup = String(json.ageGroup || "");
  const description = String(json.description || json.primaryCoachingPicture || "").trim();
  const points = listText(json.coachingPoints);
  const setup = listText(json.setupSteps);
  const title = String(drill.title || json.title || "Drill");

  const card = [
    `${coachLevel} DIAGRAM. ${drillType}${ageGroup ? ` ${ageGroup}` : ""}. ${title}.`,
    description,
    points.length ? `Coaching points: ${points.slice(0, 6).join("; ")}.` : "",
    setup.length ? `Setup: ${setup.slice(0, 6).join("; ")}.` : "",
    `Pitch ${fieldFormat}, space ${spaceConstraint}. About ${nMin}-${nMax} players. Full goals available: ${Number.isFinite(goalsAvailable) ? goalsAvailable : 0}.`,
    `Formations: ATT ${String(json.formationAttacking || organization.formationAttacking || drill.formationUsed || "")} / DEF ${String(json.formationDefending || organization.formationDefending || "")}.`,
    "Draw THIS practice. Named actions and named shirts are law. Do not dump a generic 11v11.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    title,
    card,
    drillType,
    fieldFormat,
    spaceConstraint,
    formationAttacking: String(json.formationAttacking || organization.formationAttacking || drill.formationUsed || "4-3-3"),
    formationDefending: String(json.formationDefending || organization.formationDefending || "4-3-3"),
    coachLevel,
    picture: inferScenePicture(card, drillType),
    phase: String(drill.phase || json.phase || "ATTACKING"),
    zone: String(drill.zone || json.zone || "MIDDLE_THIRD"),
    gameModelId: String(json.gameModelId || "POSSESSION"),
    durationMin: Number(drill.durationMin ?? json.durationMin ?? 12) || 12,
    rpeMin: Number(drill.rpeMin ?? 4) || 4,
    rpeMax: Number(drill.rpeMax ?? 6) || 6,
  };
}
