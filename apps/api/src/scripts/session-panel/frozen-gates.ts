import { FIELD_SPECS } from "../../data/field-dimensions";
import { getGameFormatForAgeGroup } from "../../prompts/session";
import { tacticalAndGameBlob } from "./packet";
import type { FrozenGates, GateIssue, PanelFixture, SessionPacket } from "./types";
import {
  VARIETY_CLONE_THRESHOLD,
  maxSimilarityToPriors,
  snapshotFromPacket,
  type SessionFormSnapshot,
} from "./variety";

const D_BANNED: Array<{ pattern: RegExp; term: string }> = [
  { pattern: /\boverload/i, term: "overload" },
  { pattern: /numerical superiority/i, term: "numerical superiority" },
  { pattern: /half[- ]space/i, term: "half-space" },
  { pattern: /half[- ]turn/i, term: "half-turn" },
  { pattern: /third[- ]man/i, term: "third-man" },
  { pattern: /line[- ]breaking/i, term: "line-breaking" },
  { pattern: /defensive block/i, term: "defensive block" },
  { pattern: /\bmid[- ]block/i, term: "mid-block" },
  { pattern: /\blow[- ]block/i, term: "low-block" },
  { pattern: /rest[- ]defen[cs]e/i, term: "rest defense" },
  { pattern: /unmarking/i, term: "unmarking" },
  { pattern: /positional shape/i, term: "positional shape" },
  { pattern: /positional play/i, term: "positional play" },
  { pattern: /pressing trigger/i, term: "pressing trigger" },
  { pattern: /switch the point of attack/i, term: "switch the point of attack" },
  { pattern: /\bcompact\b/i, term: "compact" },
  { pattern: /\bstaggered\b/i, term: "staggered" },
];

const C_BANNED_SYSTEMIC: Array<{ pattern: RegExp; term: string }> = [
  { pattern: /rest[- ]defen[cs]e/i, term: "rest defense" },
  { pattern: /cover shadow/i, term: "cover shadow" },
  { pattern: /blindside run/i, term: "blindside run" },
];

const BEGINNER_TOUCH: RegExp[] = [
  /\b1[- ]touch\b/i,
  /\bone[- ]touch\b/i,
  /\b2[- ]touch\b/i,
  /\btwo[- ]touch\b/i,
  /\bmaximum \d+ touches?\b/i,
  /\bstrictly \d+ touches?\b/i,
  /\bno more than [12] touches?\b/i,
];

function areaYards(drill: SessionPacket["drills"][number]): { length: number; width: number } | null {
  const area = drill.organization?.area;
  if (area && typeof area === "object") {
    const a = area as { lengthYards?: number; widthYards?: number };
    if (a.lengthYards && a.widthYards) return { length: a.lengthYards, width: a.widthYards };
  }
  return null;
}

function isFullPitch(drill: SessionPacket["drills"][number], format: ReturnType<typeof getGameFormatForAgeGroup>): boolean {
  const spec = FIELD_SPECS[format.toUpperCase() as keyof typeof FIELD_SPECS];
  const a = areaYards(drill);
  if (!spec || !a) return false;
  return Math.abs(a.length - spec.lengthYards) <= 5 && Math.abs(a.width - spec.widthYards) <= 5;
}

function namesSecondGroup(drill: SessionPacket["drills"][number]): boolean {
  const text = [
    ...(drill.organization?.setupSteps || []),
    drill.organization?.rotation || "",
  ].join(" ");
  return /two groups|second group|another group|waiting (players|group)|rotate (the )?groups|split the squad|in pairs|stations|waves of|switch .{0,60} roles|rotate .{0,40}(roles|groups|players)/i.test(text);
}

function add(issues: GateIssue[], code: string, detail: string) {
  issues.push({ code, detail });
}

function blob(packet: SessionPacket): string {
  return [
    packet.title,
    packet.summary,
    packet.coachingNotes,
    ...packet.drills.map((d) =>
      [
        d.title,
        d.description,
        d.coachingNotes,
        ...d.coachingPoints,
        ...d.constraints,
        ...d.progressions,
        ...d.organization.setupSteps,
        d.organization.scoring,
        d.organization.restarts,
      ].join("\n")
    ),
  ].join("\n");
}

export function runFrozenGates(
  packet: SessionPacket,
  fixture: PanelFixture,
  opts?: { priors?: SessionFormSnapshot[] }
): FrozenGates {
  const issues: GateIssue[] = [];
  const text = blob(packet);
  const expectedAge = fixture.input.ageGroup;
  const expectedFormat = getGameFormatForAgeGroup(expectedAge);
  const coach = String(fixture.input.coachLevel || "").toUpperCase();
  const player = String(fixture.input.playerLevel || "").toUpperCase();
  const topic = String(fixture.input.topic || "").trim();

  if (packet.drills.length < 4) {
    add(issues, "structure", `Expected 4–5 drills, got ${packet.drills.length}`);
  }

  const durationSum = packet.drills.reduce((sum, d) => sum + (d.duration || 0), 0);
  const target = fixture.input.durationMin;
  if (target && durationSum > 0 && Math.abs(durationSum - target) > 10) {
    add(issues, "duration", `Drill durations sum to ${durationSum} min, session is ${target} min`);
  }

  if (packet.ageGroup && packet.ageGroup.replace(/^U/i, "") !== expectedAge.replace(/^U/i, "")) {
    add(issues, "age", `Session ageGroup ${packet.ageGroup} does not match fixture ${expectedAge}`);
  }

  const youngerThan13 = Number(expectedAge.replace(/^U/i, "")) < 13;
  const youngerThan11 = Number(expectedAge.replace(/^U/i, "")) <= 10;
  if (youngerThan11 && /\b11\s*v\s*11\b/i.test(text)) {
    add(issues, "format", `${expectedAge} session mentions 11v11; expected ${expectedFormat}`);
  }
  if (youngerThan13 && expectedFormat !== "11v11" && /\b11\s*v\s*11\b/i.test(packet.title + " " + packet.summary)) {
    add(issues, "format", `Title/summary uses 11v11 for a ${expectedFormat} age group`);
  }

  if (coach === "USSF_D") {
    for (const banned of D_BANNED) {
      if (banned.pattern.test(text)) {
        add(issues, "d-jargon", `USSF_D session contains banned term "${banned.term}"`);
      }
    }
  }

  if (coach === "USSF_C") {
    for (const banned of C_BANNED_SYSTEMIC) {
      if (banned.pattern.test(text)) {
        add(issues, "c-jargon", `USSF_C session uses B+ systemic term "${banned.term}"`);
      }
    }
  }

  if (player === "BEGINNER") {
    for (const pattern of BEGINNER_TOUCH) {
      if (pattern.test(text)) {
        add(issues, "beginner-touch", `BEGINNER session uses a tight touch limit (${pattern})`);
        break;
      }
    }
  }

  for (const drill of packet.drills) {
    if (/COOLDOWN/i.test(drill.drillType)) continue;
    if (drill.constraints.length === 0) {
      add(issues, "constraints", `${drill.drillType} "${drill.title}" has no constraints`);
    }
    if (drill.coachingPoints.length < 3) {
      add(issues, "points", `${drill.drillType} "${drill.title}" has ${drill.coachingPoints.length} coaching points`);
    }
    if (/WARMUP/i.test(drill.drillType) && drill.diagramCounts.players > 10) {
      add(issues, "warmup-crowd", `Warmup diagram has ${drill.diagramCounts.players} shirts; working group should be ~8`);
    }
    if (/TECHNICAL/i.test(drill.drillType) && drill.diagramCounts.players > 12) {
      add(issues, "tech-crowd", `Technical diagram has ${drill.diagramCounts.players} shirts; working group should be ~8–10`);
    }
  }

  const squad = fixture.input.numbersMax || 0;
  const tech = packet.drills.find((d) => /TECHNICAL/i.test(d.drillType));
  if (tech && squad >= 18 && tech.diagramCounts.players > 0 && tech.diagramCounts.players <= 10 && !namesSecondGroup(tech)) {
    add(
      issues,
      "idle-squad",
      `TECHNICAL shows ${tech.diagramCounts.players} working vs squad ${squad}; setupSteps must name a second group, not idle spectators`
    );
  }

  const tactical = packet.drills.find((d) => /TACTICAL/i.test(d.drillType));
  if (tactical && isFullPitch(tactical, expectedFormat)) {
    const spec = FIELD_SPECS[expectedFormat.toUpperCase() as keyof typeof FIELD_SPECS];
    add(
      issues,
      "tactical-is-match",
      `TACTICAL is a full ${spec.lengthYards}x${spec.widthYards} pitch; isolate today's problem on a reduced grid. Full format belongs on CONDITIONED_GAME.`
    );
  }

  if (topic) {
    const topicBlob = `${packet.title}\n${packet.summary}\n${tacticalAndGameBlob(packet)}`;
    const hit = fixture.topicSignals.some((re) => re.test(topicBlob));
    if (!hit) {
      add(
        issues,
        "topic-signal",
        `Tactical/conditioned text never teaches topic "${topic}" (title-sticker / generic session)`
      );
    }

    const tactical = packet.drills.find((d) => /TACTICAL/i.test(d.drillType));
    const game = packet.drills.find((d) => /CONDITIONED/i.test(d.drillType));
    const tacticalHit = tactical && fixture.topicSignals.some((re) => re.test(`${tactical.title}\n${tactical.description}`));
    if (tactical && !tacticalHit) {
      add(issues, "topic-tactical", `Tactical drill does not center topic "${topic}"`);
    }
    if (game) {
      const gameBlob = [game.title, game.description, game.organization.scoring, ...game.constraints].join("\n");
      const gameHit = fixture.topicSignals.some((re) => re.test(gameBlob));
      if (!gameHit) {
        add(issues, "topic-game", `Conditioned game does not force topic "${topic}" via scoring or constraints`);
      }
    }
  }

  const pointMap = new Map<string, number>();
  for (const drill of packet.drills) {
    const seen = new Set<string>();
    for (const point of drill.coachingPoints) {
      const key = point.toLowerCase().replace(/\s+/g, " ").trim();
      if (key.length < 12 || seen.has(key)) continue;
      seen.add(key);
      pointMap.set(key, (pointMap.get(key) || 0) + 1);
    }
  }
  for (const [point, n] of pointMap) {
    if (n >= 3) {
      add(issues, "copy-paste-points", `Same coaching point appears on ${n} drills: "${point.slice(0, 80)}"`);
    }
  }

  if (opts?.priors?.length) {
    const sim = maxSimilarityToPriors(snapshotFromPacket(packet), opts.priors, topic);
    if (sim >= VARIETY_CLONE_THRESHOLD) {
      add(
        issues,
        "variety-clone",
        `Practice form is ${(sim * 100).toFixed(0)}% the same as a prior session on this topic (grid/numbers/scoring/constraints). Change the form.`
      );
    }
  }

  return { ok: issues.length === 0, issues };
}
