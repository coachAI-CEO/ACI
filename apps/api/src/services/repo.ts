import type { Prisma } from "@prisma/client";
import { prisma } from "../db";

/**
 * Persist a generated drill JSON blob into the DB (Drill table).
 * Returns { saved: boolean, id?: string }.
 *
 * NOTE: Callers should pass a fully post-processed json:
 * - json.goalMode set
 * - json.goalsSupported set (array of ints)
 * - canonicalized equipment already set
 */
export async function saveGeneratedDrill(json: any) {
  // Coerce enums as strings, then cast to the field types Prisma expects
  const gm = String(json?.gameModelId ?? "COACHAI");
  const ph = String(json?.phase ?? "ATTACKING");
  const zn = String(json?.zone ?? "ATTACKING_THIRD");
  const sc = String(json?.spaceConstraint ?? "HALF");

  const data: Prisma.DrillCreateInput = {
    title: String(json?.title ?? "Untitled"),

    // Cast via DrillCreateInput field types instead of importing enum names
    gameModelId: gm as Prisma.DrillCreateInput["gameModelId"],
    phase: ph as Prisma.DrillCreateInput["phase"],
    zone: zn as Prisma.DrillCreateInput["zone"],

    ageGroup: String(json?.ageGroup ?? "U12"),
    durationMin: Math.trunc(Number(json?.durationMin ?? 20)),
    numbersMin: Math.trunc(Number(json?.numbersMin ?? 10)),
    numbersMax: Math.trunc(Number(json?.numbersMax ?? 12)),
    gkOptional: Boolean(json?.gkOptional ?? false),

    spaceConstraint: sc as Prisma.DrillCreateInput["spaceConstraint"],

    goalsSupported: Array.isArray(json?.goalsSupported)
      ? (json.goalsSupported as number[])
      : typeof json?.goalsAvailable === "number"
        ? [Number(json.goalsAvailable)]
        : [],

    json: json ?? {},
  };

  const rec = await prisma.drill.create({ data });

  // Optional QA persistence (only if the generator attached qa)
  const qa = json?.qa ?? null;
  if (qa) {
    await prisma.qAReport.create({
      data: {
        pass: Boolean(qa?.pass ?? true),
        // DB column is JSON; accept any shaped scores object
        scores: (qa?.scores ?? {}) as Prisma.InputJsonValue,
        artifact: { connect: { id: rec.id } },
      },
    });
  }

  return { saved: true, id: rec.id };
}