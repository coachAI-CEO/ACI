import "../config/load-env";
import { prisma } from "../prisma";
import { enforcePracticeArea } from "../services/diagram-goals";
import { generateDrillDiagramSvg, persistDrillDiagramSvg } from "../services/drill-diagram-svg";
import { defaultFormationsForFormat, type FieldFormat } from "../data/field-dimensions";
import type { Drill } from "@prisma/client";

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

function asFormat(value: string): FieldFormat {
  const key = String(value || "9V9").toUpperCase();
  if (key === "7V7" || key === "11V11") return key;
  return "9V9";
}

function drillKeysFromSessionJson(json: unknown): string[] {
  const drills = asRecord(json).drills;
  if (!Array.isArray(drills)) return [];
  return drills.flatMap((drill) => {
    const row = asRecord(drill);
    return [row.refCode, row.id].filter((key): key is string => typeof key === "string" && key.trim().length > 0);
  });
}

async function loadVaultDrills(): Promise<Drill[]> {
  const sessions = await prisma.session.findMany({
    where: { savedToVault: true },
    select: { json: true },
  });
  const keys = new Set<string>();
  for (const session of sessions) {
    for (const key of drillKeysFromSessionJson(session.json)) keys.add(key);
  }
  const fromSessions =
    keys.size === 0
      ? []
      : await prisma.drill.findMany({
          where: { OR: [{ refCode: { in: [...keys] } }, { id: { in: [...keys] } }] },
        });
  const flagged = await prisma.drill.findMany({ where: { savedToVault: true } });
  const byId = new Map<string, Drill>();
  for (const drill of [...fromSessions, ...flagged]) byId.set(drill.id, drill);
  return [...byId.values()].filter((drill) => String(drill.drillType || "").toUpperCase() !== "COOLDOWN");
}

function prepareJson(drill: Drill): Record<string, any> {
  const json = JSON.parse(JSON.stringify(drill.json || {}));
  const fieldFormat = asFormat(String(json.fieldFormat || json.organization?.area?.format || "9V9"));
  const spaceConstraint = String(drill.spaceConstraint || json.spaceConstraint || "FULL").toUpperCase();
  const goalsAvailable = Number.isFinite(Number(drill.goalsAvailable))
    ? Number(drill.goalsAvailable)
    : Number(json.goalsAvailable ?? 0);
  const defaults = defaultFormationsForFormat(fieldFormat);
  json.goalsAvailable = goalsAvailable;
  json.spaceConstraint = spaceConstraint;
  json.fieldFormat = fieldFormat;
  json.drillType = drill.drillType || json.drillType;
  json.formationAttacking = String(
    json.formationAttacking || json.organization?.formationAttacking || drill.formationUsed || defaults.attacking
  );
  json.formationDefending = String(json.formationDefending || json.organization?.formationDefending || defaults.defending);
  json.phase = json.phase || drill.phase;
  json.zone = json.zone || drill.zone;
  enforcePracticeArea(json, {
    goalsAvailable,
    spaceConstraint,
    fieldFormat,
    drillType: drill.drillType,
  });
  return json;
}

async function redrawOne(drill: Drill, placement: "scene" | "compiler"): Promise<{ ok: boolean; model?: string; error?: string }> {
  try {
    const json = prepareJson(drill);
    const result = await generateDrillDiagramSvg({
      title: drill.title,
      json,
      drillType: drill.drillType,
      durationMin: drill.durationMin,
      rpeMin: drill.rpeMin,
      rpeMax: drill.rpeMax,
      numbersMin: drill.numbersMin,
      numbersMax: drill.numbersMax,
      spaceConstraint: drill.spaceConstraint,
      formationUsed: drill.formationUsed,
      phase: drill.phase,
      zone: drill.zone,
      coachLevel: drill.coachLevel,
    }, { placement });
    if (drill.refCode) {
      await persistDrillDiagramSvg(drill.refCode, result);
    } else {
      await prisma.drill.update({
        where: { id: drill.id },
        data: {
          diagramSvg: result.svg,
          diagramSvgGeneratedAt: new Date(),
          diagramSvgModel: result.model,
          diagramSvgPromptVersion: result.promptVersion,
        },
      });
    }
    return { ok: true, model: result.model };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) {
        const item = queue.shift();
        if (!item) return;
        await fn(item);
      }
    })
  );
}

async function main() {
  const placement = hasFlag("--scene") ? "scene" : "compiler";
  const drills = await loadVaultDrills();
  console.log(`Redrawing ${drills.length} vault drills with ${placement} SVG${placement === "compiler" ? " (pass --scene to opt in)" : ""}`);
  let ok = 0;
  let fail = 0;
  await pool(drills, 3, async (drill) => {
    const label = drill.refCode || drill.id;
    const result = await redrawOne(drill, placement);
    if (result.ok) {
      ok += 1;
      console.log(`  ${label} ${result.model}`);
    } else {
      fail += 1;
      console.log(`  ${label} FAIL ${result.error}`);
    }
  });
  console.log(`Done ${ok} ok / ${fail} fail / ${drills.length} total`);
  if (fail) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
