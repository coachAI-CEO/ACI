import "dotenv/config";
import { prisma } from "../prisma";

const REQUIRED_DRILL_TYPES = new Set(["WARMUP", "TECHNICAL", "TACTICAL", "CONDITIONED_GAME", "FULL_GAME"]);

type MissingReason =
  | "missing_diagram"
  | "missing_players"
  | "empty_players"
  | "missing_arrows"
  | "missing_annotations"
  | "missing_safeZones"
  | "missing_pitch"
  | "missing_pitch_showZones";

function checkDiagram(diagram: any): MissingReason[] {
  const missing: MissingReason[] = [];
  if (!diagram || typeof diagram !== "object") {
    return ["missing_diagram"];
  }
  if (!diagram.pitch || typeof diagram.pitch !== "object") {
    missing.push("missing_pitch");
  } else if (typeof diagram.pitch.showZones !== "boolean") {
    missing.push("missing_pitch_showZones");
  }
  if (!Array.isArray(diagram.players)) {
    missing.push("missing_players");
  } else if (diagram.players.length === 0) {
    missing.push("empty_players");
  }
  if (!Array.isArray(diagram.arrows)) missing.push("missing_arrows");
  if (!Array.isArray(diagram.annotations)) missing.push("missing_annotations");
  if (!Array.isArray(diagram.safeZones)) missing.push("missing_safeZones");
  return missing;
}

function keysOf(obj: any): string[] {
  if (!obj || typeof obj !== "object") return [];
  return Object.keys(obj).sort();
}

function diffKeys(newer: any, older: any) {
  const a = new Set(keysOf(newer));
  const b = new Set(keysOf(older));
  const onlyNew: string[] = [];
  const onlyOld: string[] = [];
  for (const k of a) if (!b.has(k)) onlyNew.push(k);
  for (const k of b) if (!a.has(k)) onlyOld.push(k);
  return { onlyNew, onlyOld };
}

async function main() {
  const drillSelect = { id: true, refCode: true, drillType: true, json: true, createdAt: true } as const;
  const sessionSelect = { id: true, refCode: true, json: true, createdAt: true } as const;

  const [drillCount, sessionCount] = await Promise.all([
    prisma.drill.count(),
    prisma.session.count(),
  ]);

  const drills = await prisma.drill.findMany({ select: drillSelect });
  const sessions = await prisma.session.findMany({ select: sessionSelect });

  const drillMissing: Record<MissingReason, number> = {
    missing_diagram: 0,
    missing_players: 0,
    empty_players: 0,
    missing_arrows: 0,
    missing_annotations: 0,
    missing_safeZones: 0,
    missing_pitch: 0,
    missing_pitch_showZones: 0,
  };

  const drillNeedingFix: { id: string; refCode: string | null; drillType: string | null; reasons: MissingReason[] }[] = [];

  for (const d of drills) {
    const drillType = d.drillType || null;
    if (drillType && !REQUIRED_DRILL_TYPES.has(drillType)) continue; // skip COOLDOWN
    const json: any = d.json || {};
    const diagram = json.diagram || json.diagramV1 || null;
    const reasons = checkDiagram(diagram);
    if (reasons.length > 0) {
      for (const r of reasons) drillMissing[r]++;
      drillNeedingFix.push({ id: d.id, refCode: d.refCode ?? null, drillType, reasons });
    }
  }

  const sessionMissing: Record<MissingReason, number> = {
    missing_diagram: 0,
    missing_players: 0,
    empty_players: 0,
    missing_arrows: 0,
    missing_annotations: 0,
    missing_safeZones: 0,
    missing_pitch: 0,
    missing_pitch_showZones: 0,
  };

  const sessionNeedingFix: { id: string; refCode: string | null; reasons: MissingReason[] }[] = [];

  for (const s of sessions) {
    const json: any = s.json || {};
    const drillsArr: any[] = Array.isArray(json.drills) ? json.drills : [];
    let reasonsForSession: MissingReason[] = [];
    for (const drill of drillsArr) {
      const drillType = String(drill?.drillType || "");
      if (drillType && !REQUIRED_DRILL_TYPES.has(drillType)) continue; // skip COOLDOWN
      const diagram = drill?.diagram || drill?.diagramV1 || null;
      const reasons = checkDiagram(diagram);
      if (reasons.length > 0) {
        reasonsForSession = reasonsForSession.concat(reasons);
        for (const r of reasons) sessionMissing[r]++;
      }
    }
    if (reasonsForSession.length > 0) {
      sessionNeedingFix.push({ id: s.id, refCode: s.refCode ?? null, reasons: Array.from(new Set(reasonsForSession)) });
    }
  }

  // Compare newest vs oldest drill/session diagram keys
  const newestDrill = drills.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  const oldestDrill = drills.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
  const newestSession = sessions.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  const oldestSession = sessions.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

  const newestDrillDiagram = newestDrill ? ((newestDrill.json as any)?.diagram || (newestDrill.json as any)?.diagramV1) : null;
  const oldestDrillDiagram = oldestDrill ? ((oldestDrill.json as any)?.diagram || (oldestDrill.json as any)?.diagramV1) : null;
  const newestSessionDiagram = (() => {
    if (!newestSession) return null;
    const drillsArr: any[] = Array.isArray((newestSession.json as any)?.drills) ? (newestSession.json as any).drills : [];
    const first = drillsArr.find((d) => d?.diagram || d?.diagramV1);
    return first?.diagram || first?.diagramV1 || null;
  })();
  const oldestSessionDiagram = (() => {
    if (!oldestSession) return null;
    const drillsArr: any[] = Array.isArray((oldestSession.json as any)?.drills) ? (oldestSession.json as any).drills : [];
    const first = drillsArr.find((d) => d?.diagram || d?.diagramV1);
    return first?.diagram || first?.diagramV1 || null;
  })();

  const drillDiff = diffKeys(newestDrillDiagram, oldestDrillDiagram);
  const sessionDiff = diffKeys(newestSessionDiagram, oldestSessionDiagram);

  console.log("=== Diagram Additions Audit ===");
  console.log(`Drills total: ${drillCount}`);
  console.log(`Sessions total: ${sessionCount}`);
  console.log("");
  console.log("Drills needing additions (by missing field counts):");
  console.log(drillMissing);
  console.log(`Unique drills needing fixes: ${drillNeedingFix.length}`);
  console.log("");
  console.log("Sessions needing additions (by missing field counts across drills):");
  console.log(sessionMissing);
  console.log(`Unique sessions needing fixes: ${sessionNeedingFix.length}`);
  console.log("");

  console.log("Drill diagram key diff (newest vs oldest):");
  console.log({
    newestRefCode: newestDrill?.refCode ?? null,
    oldestRefCode: oldestDrill?.refCode ?? null,
    onlyInNewest: drillDiff.onlyNew,
    onlyInOldest: drillDiff.onlyOld,
  });

  console.log("");
  console.log("Session drill diagram key diff (newest vs oldest):");
  console.log({
    newestRefCode: newestSession?.refCode ?? null,
    oldestRefCode: oldestSession?.refCode ?? null,
    onlyInNewest: sessionDiff.onlyNew,
    onlyInOldest: sessionDiff.onlyOld,
  });

  console.log("");
  console.log("Sample drill IDs needing fixes (up to 20):");
  console.log(drillNeedingFix.slice(0, 20));
  console.log("");
  console.log("Sample session IDs needing fixes (up to 20):");
  console.log(sessionNeedingFix.slice(0, 20));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
