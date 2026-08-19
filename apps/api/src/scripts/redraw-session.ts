import "../config/load-env";
import { prisma } from "../prisma";
import { generateDrillDiagramSvg, persistDrillDiagramSvg } from "../services/drill-diagram-svg";

process.env.DIAGRAM_SVG_ENGINE = "deterministic";

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

async function main() {
  const refCode = process.argv.find((a, i, all) => all[i - 1] === "--ref") || "S-RNVN";
  const session = await prisma.session.findFirst({ where: { refCode } });
  if (!session) {
    console.error(`Session ${refCode} not found`);
    process.exit(1);
  }
  const drills = asRecord(session.json).drills;
  if (!Array.isArray(drills) || drills.length === 0) {
    console.error(`Session ${refCode} has no drills`);
    process.exit(1);
  }
  console.log(`Redrawing ${refCode} · ${session.title} · ${drills.length} drills`);
  for (const raw of drills) {
    const row = asRecord(raw);
    const key = String(row.refCode || row.id || "");
    if (!key || String(row.drillType || "").toUpperCase() === "COOLDOWN") {
      console.log(`  skip ${key || row.title || "unnamed"}`);
      continue;
    }
    const drill = await prisma.drill.findFirst({
      where: { OR: [{ refCode: key }, { id: key }] },
    });
    if (!drill) {
      console.log(`  ${key} MISSING`);
      continue;
    }
    const json = JSON.parse(JSON.stringify(drill.json || row || {}));
    json.drillType = drill.drillType || json.drillType;
    json.goalsAvailable = drill.goalsAvailable ?? json.goalsAvailable;
    json.spaceConstraint = drill.spaceConstraint || json.spaceConstraint;
    json.phase = json.phase || drill.phase;
    json.zone = json.zone || drill.zone;
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
    });
    if (drill.refCode) await persistDrillDiagramSvg(drill.refCode, result);
    console.log(`  ${drill.refCode || drill.id} ${drill.drillType} ${result.model}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
