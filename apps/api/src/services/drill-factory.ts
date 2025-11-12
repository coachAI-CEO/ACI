import type { Prisma } from "@prisma/client";

export function buildDrillCreateData(json: any, meta: any): Prisma.DrillCreateInput | any {
  // derive title
  const title = json?.title
    ?? json?.summary?.title
    ?? `Auto: ${meta?.gameModelId || "UNKNOWN"} ${meta?.phase || ""} ${meta?.zone || ""}`.trim();

  // required meta (schema-required fields in your project)
  const gameModelId = meta?.gameModelId || "COACHAI";
  const phase       = meta?.phase       || "ATTACKING";
  const zone        = meta?.zone        || "ATTACKING_THIRD";
  const ageGroup    = meta?.ageGroup    || "U12";

  // optional/common fields if your schema has them; otherwise they’ll be ignored by Prisma if not present
  const coachLevel  = meta?.coachLevel  || "advanced";
  const playerLevel = meta?.playerLevel || "developing";

  // goalsSupported should already be computed by the route, but fall back to derive from goalMode if present
  const goalsSupported = Array.isArray(json?.goalsSupported)
    ? json.goalsSupported
    : (json?.goalMode === "LARGE" ? [1] : json?.goalMode === "MINI2" ? [2] : []);

  // Minimal, safe payload —
  // NOTE: we cast to 'any' so we don't fight the exact schema during compile; Prisma will still validate at runtime.
  const data: any = {
    title,
    gameModelId,
    phase,
    zone,
    ageGroup,
    coachLevel,
    playerLevel,
    goalsSupported,          // integer[]
  };

  // If you have a JSON column for full drill JSON, uncomment next line and match your schema key:
  // data.json = json;

  return data;
}
