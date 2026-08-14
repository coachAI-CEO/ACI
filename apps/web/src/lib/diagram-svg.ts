/** Pick a stored Gemini/deterministic SVG off a drill or session-json drill. */
export function pickDrillDiagramSvg(source: unknown): string | null {
  if (!source || typeof source !== "object") return null;
  const record = source as Record<string, unknown>;
  const nested =
    record.json && typeof record.json === "object"
      ? (record.json as Record<string, unknown>)
      : null;
  for (const value of [record.diagramSvg, nested?.diagramSvg]) {
    if (typeof value === "string" && /<svg[\s>]/i.test(value)) return value;
  }
  return null;
}

/**
 * Vault list drills use `${sessionId}-${index}` as a UI id. That is not a
 * Drill row, so SVG lookup must prefer refCode.
 */
export function pickDrillSvgId(source: unknown): string | null {
  if (!source || typeof source !== "object") return null;
  const record = source as Record<string, unknown>;
  const nested =
    record.json && typeof record.json === "object"
      ? (record.json as Record<string, unknown>)
      : null;
  for (const value of [record.refCode, nested?.refCode, record.id]) {
    if (typeof value !== "string" || !value.trim()) continue;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-\d+$/i.test(value)) {
      continue;
    }
    return value;
  }
  return null;
}

export function sessionDrillsHaveStoredSvgs(session: unknown): boolean {
  if (!session || typeof session !== "object") return false;
  const json = (session as Record<string, unknown>).json;
  const drills =
    json && typeof json === "object" && Array.isArray((json as Record<string, unknown>).drills)
      ? ((json as Record<string, unknown>).drills as unknown[])
      : [];
  if (drills.length === 0) return true;
  return drills.every((drill) => {
    if (!drill || typeof drill !== "object") return true;
    const drillType = String((drill as Record<string, unknown>).drillType || "").toUpperCase();
    if (drillType === "COOLDOWN") return true;
    return Boolean(pickDrillDiagramSvg(drill));
  });
}

function diagramAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window === "undefined") return headers;
  const accessToken = localStorage.getItem("accessToken");
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

export async function fetchStoredDiagramSvgs(ids: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids.filter((id) => typeof id === "string" && id.trim())));
  if (unique.length === 0) return {};
  const res = await fetch("/api/diagram-svg/lookup", {
    method: "POST",
    credentials: "include",
    headers: diagramAuthHeaders(),
    body: JSON.stringify({ ids: unique }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.svgs || typeof data.svgs !== "object") return {};
  const svgs: Record<string, string> = {};
  for (const [key, value] of Object.entries(data.svgs as Record<string, unknown>)) {
    if (typeof value === "string" && /<svg[\s>]/i.test(value)) svgs[key] = value;
  }
  return svgs;
}

export function mergeSessionDrillSvgs<T extends { json?: any }>(
  session: T,
  svgs: Record<string, string>
): T {
  const drills = Array.isArray(session.json?.drills) ? session.json.drills : [];
  return {
    ...session,
    json: {
      ...session.json,
      drills: drills.map((drill: unknown) => {
        if (!drill || typeof drill !== "object") return drill;
        const id = pickDrillSvgId(drill);
        const svg = (id && svgs[id]) || pickDrillDiagramSvg(drill);
        return svg ? { ...(drill as Record<string, unknown>), diagramSvg: svg } : drill;
      }),
    },
  };
}
