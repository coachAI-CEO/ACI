import { prisma } from "../prisma";
import { fitDiagramSvgViewBox } from "./fit-diagram-viewbox";

function isStoredSvg(value: unknown): value is string {
  return typeof value === "string" && value.includes("<svg");
}

export function mergeStoredSvgsOntoDrills(
  drills: unknown[],
  rows: Array<{ id: string; refCode: string | null; diagramSvg: string | null }>
): unknown[] {
  const byKey = new Map<string, string>();
  for (const row of rows) {
    if (!isStoredSvg(row.diagramSvg)) continue;
    const svg = fitDiagramSvgViewBox(row.diagramSvg);
    byKey.set(row.id, svg);
    if (row.refCode) byKey.set(row.refCode, svg);
  }

  return drills.map((drill) => {
    if (!drill || typeof drill !== "object") return drill;
    const record = drill as Record<string, unknown>;
    if (isStoredSvg(record.diagramSvg)) {
      return { ...record, diagramSvg: fitDiagramSvgViewBox(record.diagramSvg) };
    }
    const nested =
      record.json && typeof record.json === "object"
        ? (record.json as Record<string, unknown>)
        : null;
    if (isStoredSvg(nested?.diagramSvg)) {
      return { ...record, diagramSvg: fitDiagramSvgViewBox(nested.diagramSvg) };
    }
    const svg =
      (typeof record.refCode === "string" ? byKey.get(record.refCode) : undefined) ||
      (typeof record.id === "string" ? byKey.get(record.id) : undefined);
    return svg ? { ...record, diagramSvg: svg } : record;
  });
}

/**
 * Vault preview reads session.json.drills. The drawn SVG lives on
 * Drill.diagramSvg after first generation, and is often missing from the
 * session blob. Copy it onto each drill so the preview can render immediately.
 */
export async function attachStoredDiagramSvgsToSession<T extends { json?: unknown }>(
  session: T
): Promise<T> {
  const json =
    session.json && typeof session.json === "object"
      ? (session.json as Record<string, unknown>)
      : null;
  if (!json || !Array.isArray(json.drills)) return session;

  const drills = json.drills.filter(
    (drill): drill is Record<string, unknown> => Boolean(drill) && typeof drill === "object"
  );
  const keys = Array.from(
    new Set(
      drills.flatMap((drill) =>
        [drill.refCode, drill.id].filter(
          (key): key is string => typeof key === "string" && key.trim().length > 0
        )
      )
    )
  );
  if (keys.length === 0) return session;

  const rows = await prisma.drill.findMany({
    where: { OR: [{ refCode: { in: keys } }, { id: { in: keys } }] },
    select: { id: true, refCode: true, diagramSvg: true },
  });

  return { ...session, json: { ...json, drills: mergeStoredSvgsOntoDrills(drills, rows) } };
}
