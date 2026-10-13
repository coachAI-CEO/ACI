import type { DrillPacket, SessionPacket } from "./types";
import type { PanelFixture } from "./types";

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

function countArray(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function drillPacket(raw: any): DrillPacket {
  const org = raw?.organization && typeof raw.organization === "object" ? raw.organization : {};
  const diagram = raw?.diagram && typeof raw.diagram === "object" ? raw.diagram : {};
  return {
    drillType: asString(raw?.drillType || raw?.type),
    title: asString(raw?.title),
    duration: typeof raw?.duration === "number" ? raw.duration : Number(raw?.duration) || null,
    rpe: raw?.rpe ?? raw?.RPE ?? null,
    description: asString(raw?.description),
    organization: {
      setupSteps: asStringArray(org.setupSteps),
      area: org.area ?? null,
      rotation: asString(org.rotation),
      restarts: asString(org.restarts),
      scoring: asString(org.scoring),
    },
    coachingPoints: asStringArray(raw?.coachingPoints),
    progressions: asStringArray(raw?.progressions || raw?.progression),
    constraints: asStringArray(raw?.constraints),
    coachingNotes: asString(raw?.coachingNotes),
    debrief: raw?.debrief ?? null,
    diagramCounts: {
      players: countArray(diagram.players),
      goals: countArray(diagram.goals),
      arrows: countArray(diagram.arrows),
      annotations: countArray(diagram.annotations),
    },
  };
}

/**
 * Coach-readable session only. Diagram geometry is dropped — judges rate
 * the hour a coach reads, not arrow coordinates.
 */
export function stripSessionToPacket(session: any, fixture: PanelFixture): SessionPacket {
  const drills = Array.isArray(session?.drills) ? session.drills.map(drillPacket) : [];
  const nested = session?.session && typeof session.session === "object" ? session.session : {};
  return {
    title: asString(session?.title || nested.title),
    summary: asString(session?.summary || nested.summary),
    ageGroup: asString(session?.ageGroup || nested.ageGroup || fixture.input.ageGroup),
    coachLevel: asString(session?.coachLevel || nested.coachLevel || fixture.input.coachLevel),
    playerLevel: asString(session?.playerLevel || nested.playerLevel || fixture.input.playerLevel),
    gameModelId: asString(session?.gameModelId || nested.gameModelId || fixture.input.gameModelId),
    phase: asString(session?.phase || nested.phase || fixture.input.phase || ""),
    zone: asString(session?.zone || nested.zone || fixture.input.zone || ""),
    topic: asString(session?.topic || nested.topic || fixture.input.topic || ""),
    durationMin: Number(session?.durationMin || nested.durationMin || fixture.input.durationMin) || 0,
    numbersMin: Number(session?.numbersMin || nested.numbersMin || fixture.input.numbersMin) || 0,
    numbersMax: Number(session?.numbersMax || nested.numbersMax || fixture.input.numbersMax) || 0,
    spaceConstraint: asString(session?.spaceConstraint || nested.spaceConstraint || fixture.input.spaceConstraint),
    coachingNotes: asString(session?.coachingNotes || nested.coachingNotes),
    principleIds: asStringArray(session?.principleIds || nested.principleIds),
    drills,
  };
}

export function packetText(packet: SessionPacket): string {
  return JSON.stringify(packet);
}

const DESC_CHARS = 220;
const STEP_CHARS = 110;
const LINE_CHARS = 90;
const LIST_N = 4;
const STEP_N = 5;
const SUMMARY_CHARS = 280;

function clip(s: string, n: number): string {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= n) return t;
  return t.slice(0, n - 1) + "…";
}

function clipList(items: string[], n: number, chars: number): string[] {
  return items.slice(0, n).map((item) => clip(item, chars)).filter(Boolean);
}

function areaLabel(area: unknown): string {
  if (!area) return "";
  if (typeof area === "string") return clip(area, 40);
  if (typeof area === "object") {
    const a = area as { lengthYards?: number; widthYards?: number };
    if (a.lengthYards && a.widthYards) return `${a.lengthYards}x${a.widthYards}yd`;
  }
  return "";
}

function takeaways(debrief: unknown): string[] {
  if (!debrief || typeof debrief !== "object") return [];
  const raw = (debrief as { keyTakeaways?: unknown }).keyTakeaways;
  return clipList(asStringArray(raw), 3, LINE_CHARS);
}

/**
 * Compact coach card for judges. Full packet stays for frozen gates and the
 * HTML report. Clipping is the token win: Flash Lite is prompted to write
 * 80–120 word descriptions and 6–10 setup steps; judges do not need all of it.
 */
export function formatPacketForJudge(packet: SessionPacket): string {
  const lines: string[] = [
    `# ${clip(packet.title, 80) || "(untitled)"}`,
    `${packet.ageGroup} ${packet.coachLevel} ${packet.playerLevel} | ${packet.gameModelId} ${packet.phase}/${packet.zone} | ${packet.durationMin}min ${packet.spaceConstraint} squad ${packet.numbersMin}-${packet.numbersMax}`,
    `TOPIC: ${packet.topic}`,
  ];
  const summary = clip(packet.summary, SUMMARY_CHARS);
  if (summary) lines.push(summary);
  lines.push("");

  for (const d of packet.drills) {
    const pic = d.diagramCounts.players ? ` pic:${d.diagramCounts.players}p` : "";
    const rpe = d.rpe != null && d.rpe !== "" ? ` RPE${d.rpe}` : "";
    lines.push(`## ${d.drillType} ${d.duration ?? "?"}min${rpe}${pic} — ${clip(d.title, 70)}`);
    const desc = clip(d.description, DESC_CHARS);
    if (desc) lines.push(desc);
    const area = areaLabel(d.organization.area);
    const setup = clipList(d.organization.setupSteps, STEP_N, STEP_CHARS);
    if (area || setup.length) {
      lines.push(`Setup: ${[area, ...setup].filter(Boolean).join("; ")}`);
    }
    if (d.organization.scoring) lines.push(`Score: ${clip(d.organization.scoring, 120)}`);
    if (d.organization.restarts) lines.push(`Restart: ${clip(d.organization.restarts, 100)}`);
    if (d.organization.rotation) lines.push(`Rotate: ${clip(d.organization.rotation, 90)}`);
    const cp = clipList(d.coachingPoints, LIST_N, LINE_CHARS);
    const cx = clipList(d.constraints, LIST_N, LINE_CHARS);
    const pg = clipList(d.progressions, LIST_N, LINE_CHARS);
    if (cp.length) lines.push(`CP: ${cp.join(" | ")}`);
    if (cx.length) lines.push(`CX: ${cx.join(" | ")}`);
    if (pg.length) lines.push(`PG: ${pg.join(" | ")}`);
    const db = takeaways(d.debrief);
    if (db.length) lines.push(`Debrief: ${db.join(" | ")}`);
    lines.push("");
  }

  return lines.join("\n").trim();
}

export function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function tacticalAndGameBlob(packet: SessionPacket): string {
  return packet.drills
    .filter((d) => /TACTICAL|CONDITIONED/i.test(d.drillType))
    .map((d) =>
      [
        d.title,
        d.description,
        d.coachingNotes,
        d.organization.scoring,
        d.organization.restarts,
        ...d.coachingPoints,
        ...d.constraints,
        ...d.progressions,
      ].join("\n")
    )
    .join("\n");
}

export function parseJsonSafe(text: string): any | null {
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) return null;
    return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}
