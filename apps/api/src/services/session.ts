import { generateText, setMetricsContext, clearMetricsContext } from "../gemini";
import { prisma } from "../prisma";
import {
  buildSessionPrompt,
  buildSessionQAReviewerPrompt,
  getGameFormatForAgeGroup,
  getPlayersPerTeamForFormat,
  type GameFormat,
} from "../prompts/session";
import { fixSessionDecision } from "./fixer";
import { generateRefCode } from "../utils/ref-code";
import { needsDiagramEnrichment, reenrichDiagramFromDrillJson } from "./diagram-enrichment";
import { enforceDiagramGoalAvailability } from "./diagram-goals";

// Re-export for convenience
export { fixSessionDecision };

/**
 * Parse JSON safely from LLM text output
 */
function parseJsonSafe(text: string) {
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

function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = String(raw || "").trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function humanizeGameModelText(value: any, parentKey?: string): any {
  if (typeof value === "string") {
    return value.replace(/\bROCKLIN_FC\b/g, "Rocklin FC");
  }
  if (Array.isArray(value)) {
    return value.map((item) => humanizeGameModelText(item));
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "gameModelId" || parentKey === "gameModelId") continue;
      (value as any)[key] = humanizeGameModelText(child, key);
    }
  }
  return value;
}

function isGrassrootsCoachLevel(coachLevel?: string): boolean {
  return String(coachLevel || "").toUpperCase() === "GRASSROOTS";
}

function getCoachDiagramMinimums(coachLevel?: string) {
  const level = String(coachLevel || "").toUpperCase();
  if (level === "USSF_B_PLUS") return { arrows: 7, annotations: 4, safeZones: 2 };
  if (level === "USSF_C") return { arrows: 5, annotations: 3, safeZones: 1 };
  return null;
}

function pickPlayerPairs(players: any[]) {
  const attackers = players.filter((p: any) => p?.team === "ATT");
  const defenders = players.filter((p: any) => p?.team === "DEF");
  const sortedAttackers = [...attackers].sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
  const sortedDefenders = [...defenders].sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
  return { attackers: sortedAttackers, defenders: sortedDefenders };
}

function ensureRichCoachDiagramProfile(drill: any, coachLevel?: string) {
  const minimums = getCoachDiagramMinimums(coachLevel);
  if (!minimums || !drill || drill.drillType === "COOLDOWN" || !drill.diagram) return;

  const diagram = drill.diagram;
  diagram.pitch = diagram.pitch || {};
  diagram.pitch.showZones = false;
  const players = Array.isArray(diagram.players) ? diagram.players : [];
  const { attackers, defenders } = pickPlayerPairs(players);
  const lastAttacker = attackers.length > 0 ? attackers[attackers.length - 1] : null;

  diagram.arrows = Array.isArray(diagram.arrows) ? diagram.arrows : [];
  const fallbackArrows = [
    attackers[0] && attackers[1]
      ? { id: "coach-pass-1", from: { playerId: attackers[0].id }, to: { playerId: attackers[1].id }, type: "pass", label: "1" }
      : null,
    attackers[1] && attackers[2]
      ? { id: "coach-pass-2", from: { playerId: attackers[1].id }, to: { playerId: attackers[2].id }, type: "pass", label: "2" }
      : null,
    attackers[2]
      ? { id: "coach-run-1", from: { playerId: attackers[2].id }, to: { x: Math.max(8, (attackers[2].x ?? 50) - 12), y: attackers[2].y ?? 50 }, type: "run", label: "run" }
      : null,
    defenders[0] && attackers[0]
      ? { id: "coach-press-1", from: { playerId: defenders[0].id }, to: { playerId: attackers[0].id }, type: "press", label: "press" }
      : null,
    attackers[0]
      ? { id: "coach-move-1", from: { playerId: attackers[0].id }, to: { x: Math.max(8, (attackers[0].x ?? 50) - 15), y: Math.max(10, (attackers[0].y ?? 50) - 10) }, type: "movement", label: "support" }
      : null,
    lastAttacker
      ? { id: "coach-run-2", from: { playerId: lastAttacker.id }, to: { x: Math.max(8, (lastAttacker.x ?? 50) - 18), y: Math.min(90, (lastAttacker.y ?? 50) + 8) }, type: "run", label: "depth" }
      : null,
    defenders[1] && attackers[1]
      ? { id: "coach-press-2", from: { playerId: defenders[1].id }, to: { playerId: attackers[1].id }, type: "press", label: "cover" }
      : null,
  ].filter(Boolean);
  for (const arrow of fallbackArrows) {
    if (diagram.arrows.length >= minimums.arrows) break;
    if (!diagram.arrows.some((a: any) => a?.id === (arrow as any).id)) diagram.arrows.push(arrow);
  }

  diagram.annotations = Array.isArray(diagram.annotations) ? diagram.annotations : [];
  const annotationBase = [
    { id: "coach-ann-1", text: "FREE PLAYER", x: 50, y: 32, color: "rgba(34, 211, 238, 0.95)" },
    { id: "coach-ann-2", text: "PRESS TRIGGER", x: 58, y: 54, color: "rgba(248, 113, 113, 0.95)" },
    { id: "coach-ann-3", text: "LINE BREAK", x: 42, y: 44, color: "rgba(253, 224, 71, 0.95)" },
    { id: "coach-ann-4", text: "COVER SHAPE", x: 30, y: 66, color: "rgba(196, 181, 253, 0.95)" },
  ];
  for (const ann of annotationBase) {
    if (diagram.annotations.length >= minimums.annotations) break;
    if (!diagram.annotations.some((a: any) => a?.id === ann.id)) {
      diagram.annotations.push({
        ...ann,
        fontSize: 10,
        fontWeight: "800",
        backgroundColor: "rgba(2, 6, 23, 0.82)",
      });
    }
  }

  diagram.safeZones = Array.isArray(diagram.safeZones) ? diagram.safeZones : [];
  const safeZoneBase = [
    { id: "coach-zone-1", x: 38, y: 0, width: 24, height: 100, team: "ATT", label: "CENTRAL LANE" },
    { id: "coach-zone-2", x: 0, y: 0, width: 18, height: 100, team: "DEF", label: "PRESS SIDE" },
  ];
  for (const zone of safeZoneBase) {
    if (diagram.safeZones.length >= minimums.safeZones) break;
    if (!diagram.safeZones.some((z: any) => z?.id === zone.id)) diagram.safeZones.push(zone);
  }
}

function applyCoachLevelDiagramProfile(drill: any, coachLevel?: string) {
  if (!drill || drill.drillType === "COOLDOWN" || !drill.diagram) return;
  if (!isGrassrootsCoachLevel(coachLevel)) {
    ensureRichCoachDiagramProfile(drill, coachLevel);
    return;
  }

  const diagram = drill.diagram;
  diagram.pitch = diagram.pitch || {};
  diagram.pitch.showZones = false;
  if (diagram.pitch && typeof diagram.pitch === "object" && "zones" in diagram.pitch) {
    delete diagram.pitch.zones;
  }

  if (Array.isArray(diagram.safeZones)) {
    diagram.safeZones = [];
  }
  if (Array.isArray(diagram.arrows)) {
    diagram.arrows = diagram.arrows.slice(0, 3);
  }
  if (Array.isArray(diagram.annotations)) {
    diagram.annotations = diagram.annotations.slice(0, 1);
  }
}

function getFullGameRoles(format: GameFormat): string[] {
  if (format === "7v7") return ["GK", "RB", "LB", "CM", "LM", "RM", "ST"];
  if (format === "9v9") return ["GK", "RB", "CB", "LB", "CM", "CM", "LW", "RW", "ST"];
  return ["GK", "RB", "RCB", "LCB", "LB", "DM", "CM", "AM", "RW", "ST", "LW"];
}

function buildCanonicalFullGamePlayers(format: GameFormat) {
  const roles = getFullGameRoles(format);
  const rows = roles.map((role, idx) => ({
    role,
    lane: idx === 0 ? 50 : 20 + ((idx - 1) % 4) * 20,
    line: idx === 0 ? 0 : Math.floor((idx - 1) / 4),
  }));

  return [
    ...rows.map((row, idx) => ({
      id: `A${idx + 1}`,
      number: idx === 0 ? 1 : idx + 1,
      team: "ATT",
      role: row.role,
      x: idx === 0 ? 92 : 76 - row.line * 13,
      y: row.lane,
      facingAngle: 270,
    })),
    ...rows.map((row, idx) => ({
      id: `D${idx + 1}`,
      number: idx === 0 ? 1 : idx + 1,
      team: "DEF",
      role: row.role,
      x: idx === 0 ? 8 : 24 + row.line * 13,
      y: row.lane,
      facingAngle: 90,
    })),
  ];
}

function buildReducedGamePlayers(format: GameFormat, maxPlayers: number) {
  const fullPlayers = buildCanonicalFullGamePlayers(format);
  const perTeam = Math.max(1, Math.floor(maxPlayers / 2));
  const fullPerTeam = getPlayersPerTeamForFormat(format);
  return [
    ...fullPlayers.slice(0, perTeam),
    ...fullPlayers.slice(fullPerTeam, fullPerTeam + perTeam),
  ].slice(0, Math.max(0, maxPlayers));
}

function isGoalkeeper(player: any): boolean {
  const role = String(player?.role || "").toUpperCase();
  return player?.number === 1 || role === "GK" || role.includes("GOALKEEPER");
}

function normalizeGoalkeeperPositions(diagram: any) {
  if (!diagram || typeof diagram !== "object") return;
  const players = Array.isArray(diagram.players) ? diagram.players : [];
  const goals = Array.isArray(diagram.goals) ? diagram.goals : [];
  const gks = players.filter(isGoalkeeper);
  if (gks.length === 0) return;

  const orientation = diagram.pitch?.orientation === "VERTICAL" ? "VERTICAL" : "HORIZONTAL";

  for (const gk of gks) {
    const team = String(gk.team || "");
    const ownGoalCandidates = goals.filter((goal: any) => {
      const attacks = String(goal?.teamAttacks || "");
      return attacks && attacks !== team && (attacks === "ATT" || attacks === "DEF");
    });
    const candidates = ownGoalCandidates.length > 0 ? ownGoalCandidates : goals;
    const closestGoal =
      candidates.length > 0
        ? candidates.reduce((best: any, goal: any) => {
            const bestDist =
              Math.abs(Number(gk.x ?? 50) - Number(best.x ?? 50)) +
              Math.abs(Number(gk.y ?? 50) - Number(best.y ?? 50));
            const goalDist =
              Math.abs(Number(gk.x ?? 50) - Number(goal.x ?? 50)) +
              Math.abs(Number(gk.y ?? 50) - Number(goal.y ?? 50));
            return goalDist < bestDist ? goal : best;
          }, candidates[0])
        : null;

    if (orientation === "VERTICAL") {
      const goalY = Number.isFinite(closestGoal?.y) ? Number(closestGoal.y) : Number(gk.y ?? 50);
      gk.x = Number.isFinite(closestGoal?.x) ? Number(closestGoal.x) : 50;
      gk.y = goalY < 50 ? Math.max(6, goalY + 3) : Math.min(94, goalY - 3);
      gk.facingAngle = goalY < 50 ? 90 : 270;
    } else {
      const goalX = Number.isFinite(closestGoal?.x) ? Number(closestGoal.x) : Number(gk.x ?? 50);
      gk.x = goalX < 50 ? Math.max(6, goalX + 3) : Math.min(94, goalX - 3);
      gk.y = Number.isFinite(closestGoal?.y) ? Number(closestGoal.y) : 50;
      gk.facingAngle = goalX < 50 ? 0 : 180;
    }
  }
}

function replaceFormatMentions(value: any, replacement: string): any {
  if (typeof value === "string") {
    return value.replace(/\b(?:7v7|9v9|11v11)\b/g, replacement);
  }
  if (Array.isArray(value)) return value.map((item) => replaceFormatMentions(item, replacement));
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      value[key] = replaceFormatMentions(value[key], replacement);
    }
  }
  return value;
}

function enforceConditionedGameFormatDiagram(
  drill: any,
  input: { ageGroup: string; numbersMax?: number }
) {
  if (!drill || (drill.drillType !== "CONDITIONED_GAME" && drill.drillType !== "FULL_GAME")) return;

  const expectedFormat = getGameFormatForAgeGroup(input.ageGroup);
  const expectedPerTeam = getPlayersPerTeamForFormat(expectedFormat);
  const fullFormatTotal = expectedPerTeam * 2;
  const maxPlayers = Number(input.numbersMax || 0);
  const canRunFullFormat = maxPlayers >= fullFormatTotal;
  const activePerTeam = canRunFullFormat ? expectedPerTeam : Math.max(1, Math.floor(maxPlayers / 2));
  const activeTotal = canRunFullFormat ? fullFormatTotal : Math.max(0, activePerTeam * 2);
  const activeFormatLabel = canRunFullFormat ? expectedFormat : `${activePerTeam}v${activePerTeam}`;
  const diagram = (drill.diagram = drill.diagram || {});
  const players = Array.isArray(diagram.players) ? diagram.players : [];
  const attCount = players.filter((p: any) => p?.team === "ATT").length;
  const defCount = players.filter((p: any) => p?.team === "DEF").length;

  replaceFormatMentions(drill, activeFormatLabel);

  if (attCount === activePerTeam && defCount === activePerTeam && players.length <= maxPlayers) return;

  console.warn(
    `[SESSION] Rebuilding CONDITIONED_GAME diagram for ${input.ageGroup}/${activeFormatLabel}: ` +
      `got ATT=${attCount}, DEF=${defCount}, total=${players.length}; expected ${activePerTeam} per team, max=${maxPlayers}`
  );

  diagram.players = canRunFullFormat
    ? buildCanonicalFullGamePlayers(expectedFormat)
    : buildReducedGamePlayers(expectedFormat, activeTotal);
  diagram.pitch = {
    variant: expectedFormat === "11v11" ? "FULL" : "HALF",
    orientation: "HORIZONTAL",
    showZones: false,
    ...(diagram.pitch && typeof diagram.pitch === "object" ? diagram.pitch : {}),
  };
  diagram.pitch.variant = expectedFormat === "11v11" ? "FULL" : "HALF";
  diagram.pitch.orientation = "HORIZONTAL";
  diagram.pitch.showZones = false;
  diagram.goals = [
    { id: "G1", type: "BIG", width: 8, x: 6, y: 50, facingAngle: 90, teamAttacks: "ATT" },
    { id: "G2", type: "BIG", width: 8, x: 94, y: 50, facingAngle: 270, teamAttacks: "DEF" },
  ];
  normalizeGoalkeeperPositions(diagram);

  drill.organization = drill.organization && typeof drill.organization === "object" ? drill.organization : {};
  const setupSteps = Array.isArray(drill.organization.setupSteps) ? drill.organization.setupSteps : [];
  drill.organization.setupSteps = [
    canRunFullFormat
      ? `${expectedFormat} game: ${expectedPerTeam} players per team, including one GK per team.`
      : `${activeFormatLabel} reduced game using ${expectedFormat} roles; ${activePerTeam} players per team and ${activeTotal} total active players.`,
    ...setupSteps.filter((step: any) => !/\b(?:7v7|9v9|11v11)\b/i.test(String(step))),
  ];
}

function enforceDiagramPlayerLimit(drill: any, maxPlayers?: number) {
  const max = Number(maxPlayers || 0);
  if (!max || !drill || drill.drillType === "COOLDOWN" || !drill.diagram) return;
  const players = Array.isArray(drill.diagram.players) ? drill.diagram.players : [];
  if (players.length <= max) return;

  const gks = players.filter(isGoalkeeper);
  const attackers = players.filter((p: any) => p?.team === "ATT" && !isGoalkeeper(p));
  const defenders = players.filter((p: any) => p?.team === "DEF" && !isGoalkeeper(p));
  const others = players.filter((p: any) => p?.team !== "ATT" && p?.team !== "DEF" && !isGoalkeeper(p));
  const next: any[] = [];

  for (const gk of gks) {
    if (next.length < max && !next.some((p) => p.id === gk.id)) next.push(gk);
  }

  let ai = 0;
  let di = 0;
  while (next.length < max && (ai < attackers.length || di < defenders.length)) {
    if (ai < attackers.length && next.length < max) next.push(attackers[ai++]);
    if (di < defenders.length && next.length < max) next.push(defenders[di++]);
  }
  for (const other of others) {
    if (next.length >= max) break;
    next.push(other);
  }

  console.warn(`[SESSION] Trimmed ${drill.drillType || "drill"} diagram players from ${players.length} to max=${max}`);
  drill.diagram.players = next;
  normalizeGoalkeeperPositions(drill.diagram);
}

const GRASSROOTS_LANGUAGE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bmeticulously\b/gi, "carefully"],
  [/\bcomprehensive\b/gi, "complete"],
  [/\btactical intelligence\b/gi, "decision-making"],
  [/\btactical nuances?\b/gi, "key ideas"],
  [/\bnumerical superiority\b/gi, "an extra player"],
  [/\brest defense\b/gi, "cover behind the ball"],
  [/\bline-breaking\b/gi, "forward"],
  [/\bprogression lanes\b/gi, "passing lanes"],
  [/\bverticality\b/gi, "playing forward"],
  [/\bcounterpress(?:ing)?\b/gi, "win the ball back quickly"],
  [/\bphase(?:s)?\b/gi, "moment"],
  [/\bman-oriented\b/gi, "player-to-player"],
  [/\bzonal\b/gi, "area-based"],
  [/\bpositional superiority\b/gi, "better positioning"],
  [/\bfunctional game application\b/gi, "real game use"],
  [/\bcognitive scanning\b/gi, "scanning"],
  [/\bunder high-pressure scenarios?\b/gi, "under pressure"],
  [/\bhigh-pressure situations?\b/gi, "pressure situations"],
  [/\bexploit(?:ing)? gaps?\b/gi, "find spaces"],
  [/\bnuances?\b/gi, "details"],
  [/\bincentivized\b/gi, "rewarded"],
  [/\btertiary\b/gi, "third"],
  [/\bstructured\b/gi, "organized"],
  [/\bcohesive\b/gi, "clear"],
  [/\bculminating\b/gi, "final"],
  [/\bmanipulate\b/gi, "move"],
  [/\bspatial awareness\b/gi, "awareness of space"],
];

function simplifyGrassrootsText(text: string): string {
  let out = String(text || "");
  for (const [pattern, replacement] of GRASSROOTS_LANGUAGE_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  out = out
    .replace(/[“”]/g, '"')
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
  // Prefer shorter plain sentences while preserving core detail.
  out = out
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => {
      const words = sentence.split(/\s+/).filter(Boolean);
      if (words.length <= 22) return sentence;
      return `${words.slice(0, 22).join(" ")}.`;
    })
    .join(" ");
  return out.trim();
}

function toGrassrootsCoachVoice(text: string): string {
  let out = String(text || "").trim();
  if (!out) return out;

  out = out
    .replace(/^this (training session|session) (is|was) (specifically )?designed to/gi, "Run this session to")
    .replace(/^this (technical|tactical|conditioned)?\s*drill (focuses on|is designed to|is built to)/gi, "Run this drill to")
    .replace(/\bthe primary focus is\b/gi, "Focus on")
    .replace(/\bthe core focus is\b/gi, "Focus on")
    .replace(/\bthe focus is on\b/gi, "Focus on")
    .replace(/\bplayers should\b/gi, "Players")
    .replace(/\bcoaches should\b/gi, "Coach")
    .replace(/\bthis drill\b/gi, "The drill")
    .replace(/\bthis session\b/gi, "The session");

  // Keep wording practical and action-oriented.
  out = out.replace(/\bwill be able to\b/gi, "can");

  return out.replace(/\s{2,}/g, " ").trim();
}

function simplifyGrassrootsStringArray(values: any): any {
  if (!Array.isArray(values)) return values;
  return values.map((value) =>
    typeof value === "string" ? toGrassrootsCoachVoice(simplifyGrassrootsText(value)) : value
  );
}

function applyCoachLevelLanguageProfile(session: any, coachLevel?: string) {
  if (!isGrassrootsCoachLevel(coachLevel) || !session || typeof session !== "object") return;

  if (typeof session.summary === "string") {
    session.summary = toGrassrootsCoachVoice(simplifyGrassrootsText(session.summary));
  }

  if (!Array.isArray(session.drills)) return;
  session.drills.forEach((drill: any) => {
    if (!drill || typeof drill !== "object") return;

    if (typeof drill.description === "string") {
      drill.description = toGrassrootsCoachVoice(simplifyGrassrootsText(drill.description));
    }
    drill.coachingPoints = simplifyGrassrootsStringArray(drill.coachingPoints);
    drill.progressions = simplifyGrassrootsStringArray(drill.progressions);
    drill.constraints = simplifyGrassrootsStringArray(drill.constraints);

    if (drill.loadNotes && typeof drill.loadNotes === "object") {
      if (typeof drill.loadNotes.rationale === "string") {
        drill.loadNotes.rationale = simplifyGrassrootsText(drill.loadNotes.rationale);
      }
      if (typeof drill.loadNotes.structure === "string") {
        drill.loadNotes.structure = simplifyGrassrootsText(drill.loadNotes.structure);
      }
    }

    if (drill.organization && typeof drill.organization === "object") {
      if (Array.isArray(drill.organization.setupSteps)) {
        drill.organization.setupSteps = simplifyGrassrootsStringArray(drill.organization.setupSteps);
      }
      if (typeof drill.organization.rotation === "string") {
        drill.organization.rotation = simplifyGrassrootsText(drill.organization.rotation);
      }
      if (typeof drill.organization.restarts === "string") {
        drill.organization.restarts = simplifyGrassrootsText(drill.organization.restarts);
      }
      if (typeof drill.organization.scoring === "string") {
        drill.organization.scoring = simplifyGrassrootsText(drill.organization.scoring);
      }
    }

    // Keep cues short and practical at grassroots level.
    if (Array.isArray(drill.coachingPoints)) {
      drill.coachingPoints = drill.coachingPoints.map((point: any) => {
        const text = simplifyGrassrootsText(String(point || ""));
        const coachVoice = toGrassrootsCoachVoice(text);
        const words = coachVoice.split(/\s+/).filter(Boolean);
        return words.length > 18 ? `${words.slice(0, 18).join(" ")}.` : coachVoice;
      });
    }
  });
}

function modelConstraintDefaults(gameModelId: string, phase?: string, zone?: string): string[] {
  const p = phase || "ATTACKING";
  const z = zone || "ATTACKING_THIRD";
  if (gameModelId === "POSSESSION") {
    return [
      `POSSESSION cue (${p}/${z}): team in possession must create a support triangle before playing the next forward pass.`,
      `POSSESSION cue (${p}/${z}): 1 bonus point for a line-breaking pass into the next lane or half-space.`,
    ];
  }
  if (gameModelId === "PRESSING") {
    return [
      `PRESSING cue (${p}/${z}): immediate press trigger on bad first touch, back pass, or closed body shape.`,
      `PRESSING cue (${p}/${z}): regain in the target pressing zone within 6 seconds = bonus point.`,
    ];
  }
  if (gameModelId === "TRANSITION") {
    return [
      `TRANSITION cue (${p}/${z}): first action within 3 seconds after regain must be forward or to a clear support option.`,
      `TRANSITION cue (${p}/${z}): on loss, nearest 3 players counterpress for 3-5 seconds before recovering shape.`,
    ];
  }
  if (gameModelId === "ROCKLIN_FC") {
    return [
      "After regain, play forward early when on (pass or dribble); if not, secure and re-expand with width/depth.",
      "After loss, counterpress for 3-5 seconds; if not regained, recover compact and protect central lanes.",
    ];
  }
  return [
    `COACHAI cue (${p}/${z}): choose between keep-ball circulation or vertical attack based on pressure and space.`,
    `COACHAI cue (${p}/${z}): on loss, immediate pressure by nearest players, then recover compact shape if press is broken.`,
  ];
}

function phaseConstraintDefaults(phase?: string, zone?: string): string[] {
  const p = phase || "ATTACKING";
  const z = zone || "ATTACKING_THIRD";
  if (p === "ATTACKING") {
    return [
      `PHASE cue (${p}/${z}): create progression lanes with width/depth before final action.`,
      `PHASE cue (${p}/${z}): finishing action should follow timed support and penetration decisions.`,
    ];
  }
  if (p === "DEFENDING") {
    return [
      `PHASE cue (${p}/${z}): protect central areas and force play wide or backward.`,
      `PHASE cue (${p}/${z}): maintain pressure-cover-balance distances before stepping to challenge.`,
    ];
  }
  if (p === "TRANSITION_TO_ATTACK") {
    return [
      `PHASE cue (${p}/${z}): first action within 3-6 seconds after regain should exploit forward space or secure support.`,
      `PHASE cue (${p}/${z}): immediate support-run structure must provide at least two options after regain.`,
    ];
  }
  if (p === "TRANSITION_TO_DEFEND") {
    return [
      `PHASE cue (${p}/${z}): immediate reaction after loss: nearest players counterpress for 3-5 seconds.`,
      `PHASE cue (${p}/${z}): if press fails, recover compact shape with clear role recovery lanes.`,
    ];
  }
  return [
    `PHASE cue (${p}/${z}): include repeated regain-to-attack and loss-to-defend cycles.`,
    `PHASE cue (${p}/${z}): enforce fast role switching on every possession change.`,
  ];
}

function hasModelSpecificConstraint(constraints: string[], gameModelId: string): boolean {
  const text = constraints.join(" ").toLowerCase();
  if (gameModelId === "POSSESSION") {
    return /(possession|circulation|line[- ]?break|overload|support triangle|free man)/i.test(text);
  }
  if (gameModelId === "PRESSING") {
    return /(press|pressing|trigger|counterpress|regain|trap|compact)/i.test(text);
  }
  if (gameModelId === "TRANSITION") {
    return /(transition|regain|on loss|counterpress|first action|3 seconds|5 seconds|fast attack|counter)/i.test(text);
  }
  if (gameModelId === "ROCKLIN_FC") {
    return /(rocklin|vertical|line[- ]?break|overload|switch|counterpress|compact|final[- ]?third|runs behind|width|depth)/i.test(text);
  }
  return /(possession|press|transition|counterpress|regain|circulation|switch)/i.test(text);
}

function hasPhaseSpecificConstraint(constraints: string[], phase?: string): boolean {
  const text = constraints.join(" ").toLowerCase();
  const p = phase || "ATTACKING";
  if (p === "ATTACKING") {
    return /(attacking|penetrat|finish|final action|create chance|width|depth)/i.test(text);
  }
  if (p === "DEFENDING") {
    return /(defend|compact|deny|channel|pressure|cover|balance|protect)/i.test(text);
  }
  if (p === "TRANSITION_TO_ATTACK") {
    return /(regain|first action|3-6|counter|forward|support run|exploit)/i.test(text);
  }
  if (p === "TRANSITION_TO_DEFEND") {
    return /(loss|counterpress|recover shape|nearest|immediate reaction|3-5)/i.test(text);
  }
  return /(transition|regain|loss|switch role|counterpress|recover)/i.test(text);
}

function enforceModelConstraintsOnDrill(
  drill: any,
  input: { gameModelId: string; phase?: string; zone?: string }
) {
  const current = Array.isArray(drill?.constraints) ? drill.constraints : [];
  const cleaned = uniqueNonEmpty(current.map((c: any) => String(c)));
  const modelDefaults = modelConstraintDefaults(input.gameModelId, input.phase, input.zone);
  const phaseDefaults = phaseConstraintDefaults(input.phase, input.zone);

  let next = cleaned;
  if (next.length < 2) {
    next = uniqueNonEmpty([...next, ...modelDefaults, ...phaseDefaults]);
  }
  if (!hasModelSpecificConstraint(next, input.gameModelId)) {
    next = uniqueNonEmpty([...next, modelDefaults[0]]);
  }
  if (!hasPhaseSpecificConstraint(next, input.phase)) {
    next = uniqueNonEmpty([...next, phaseDefaults[0]]);
  }
  drill.constraints = next.slice(0, 5);
}

/**
 * Main generator + QA pipeline for sessions.
 *
 * 1) Generate session JSON from Gemini.
 * 2) Run QA reviewer.
 * 3) Compute fixer decision from QA scores (OK / PATCHABLE / NEEDS_REGEN).
 * 4) Persist final session + QA into DB.
 */
export async function generateAndReviewSession(
  input: Parameters<typeof buildSessionPrompt>[0],
  userId?: string,
  options?: {
    isCancelled?: () => boolean;
  }
) {
  const isCancelled = () => Boolean(options?.isCancelled?.());
  const SESSION_GENERATION_TIMEOUT_MS = Number(process.env.SESSION_GENERATION_TIMEOUT_MS || 150000);
  const SESSION_QA_TIMEOUT_MS = Number(process.env.SESSION_QA_TIMEOUT_MS || 90000);

  // Set metrics context for tracking
  setMetricsContext({
    operationType: "session",
    ageGroup: input.ageGroup,
    gameModelId: input.gameModelId,
    phase: input.phase,
  });
  
  try {
    // 1) Generate (longer timeout for sessions - more complex than drills)
    const prompt = buildSessionPrompt(input);
    console.log(`[SESSION] Starting generation with ${prompt.length} char prompt...`);
    const generationModel = process.env.GEMINI_SESSION_MODEL || process.env.GEMINI_GENERATION_MODEL;
    const genText = await generateText(prompt, {
      timeout: SESSION_GENERATION_TIMEOUT_MS,
      retries: 0,
      model: generationModel,
    });
    if (isCancelled()) throw new Error("REQUEST_CANCELLED");
  
  // Log raw response for debugging (first 5000 chars to see diagram structure)
  const rawPreview = genText.substring(0, 5000);
  console.log(`[SESSION] Raw LLM response (first 5000 chars):`, rawPreview);
  // Also log the last 2000 chars in case diagrams are at the end
  if (genText.length > 5000) {
    console.log(`[SESSION] Raw LLM response (last 2000 chars):`, genText.substring(genText.length - 2000));
  }
  
  let session: any = parseJsonSafe(genText);
  if (!session) throw new Error("LLM returned non-JSON session");
  if (isCancelled()) throw new Error("REQUEST_CANCELLED");
  
  // Log parsed session structure
  console.log(`[SESSION] Parsed session structure:`, {
    hasDrills: !!session.drills,
    drillsCount: session.drills?.length,
    drills: session.drills?.map((d: any) => ({
      drillType: d.drillType,
      title: d.title,
      hasDiagram: !!d.diagram,
      diagramKeys: d.diagram ? Object.keys(d.diagram) : [],
      playersCount: d.diagram?.players?.length ?? 0
    }))
  });

  // Log raw session structure for debugging
  console.log(`[SESSION] Generated session with ${session.drills?.length || 0} drills`);
  if (session.drills && Array.isArray(session.drills)) {
    session.drills.forEach((drill: any, index: number) => {
      console.log(`[SESSION] Drill ${index}: ${drill.drillType} - "${drill.title}"`);
      console.log(`[SESSION]   Has diagram: ${!!drill.diagram}`);
      if (drill.diagram) {
        console.log(`[SESSION]   Diagram keys:`, Object.keys(drill.diagram));
        console.log(`[SESSION]   Players array type:`, typeof drill.diagram.players);
        console.log(`[SESSION]   Players is array:`, Array.isArray(drill.diagram.players));
        console.log(`[SESSION]   Players length:`, drill.diagram.players?.length ?? 'undefined');
        if (drill.diagram.players && drill.diagram.players.length > 0) {
          console.log(`[SESSION]   First player:`, JSON.stringify(drill.diagram.players[0]));
        } else {
          console.error(`[SESSION]   ⚠️ EMPTY PLAYERS ARRAY for drill "${drill.title}"`);
          console.error(`[SESSION]   Full drill.diagram:`, JSON.stringify(drill.diagram, null, 2));
          // Also check if elements array has data
          if (drill.diagram.elements && Array.isArray(drill.diagram.elements)) {
            console.error(`[SESSION]   Elements array length:`, drill.diagram.elements.length);
            if (drill.diagram.elements.length > 0) {
              console.error(`[SESSION]   First element:`, JSON.stringify(drill.diagram.elements[0], null, 2));
            }
          }
        }
      }
    });
  }

  // Normalize diagram format: convert elements to players if needed
  if (session.drills && Array.isArray(session.drills)) {
    session.drills.forEach((drill: any, index: number) => {
      enforceModelConstraintsOnDrill(drill, {
        gameModelId: input.gameModelId,
        phase: input.phase,
        zone: input.zone,
      });

      if (drill.drillType !== "COOLDOWN" && drill.diagram) {
        const inferOrientation = (diagram: any) => {
          const goals = Array.isArray(diagram.goals) ? diagram.goals : [];
          if (goals.length > 0) {
            const left = goals.some((g: any) => typeof g.x === "number" && g.x < 20);
            const right = goals.some((g: any) => typeof g.x === "number" && g.x > 80);
            const top = goals.some((g: any) => typeof g.y === "number" && g.y < 20);
            const bottom = goals.some((g: any) => typeof g.y === "number" && g.y > 80);
            if ((left || right) && !(top || bottom)) return "HORIZONTAL";
            if ((top || bottom) && !(left || right)) return "VERTICAL";
          }
          const players = Array.isArray(diagram.players) ? diagram.players : [];
          if (players.length >= 2) {
            const xs = players.map((p: any) => p.x).filter((n: any) => Number.isFinite(n));
            const ys = players.map((p: any) => p.y).filter((n: any) => Number.isFinite(n));
            const rangeX = xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
            const rangeY = ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
            return rangeY >= rangeX ? "VERTICAL" : "HORIZONTAL";
          }
          return "HORIZONTAL";
        };

        // If diagram has 'elements' instead of 'players', try to convert it
        if (Array.isArray(drill.diagram.elements) && (!Array.isArray(drill.diagram.players) || drill.diagram.players.length === 0)) {
          console.warn(`[SESSION] Drill ${index} uses 'elements' format, attempting to convert to 'players' format`);
          // Try to extract player objects from elements
          const playerElements = drill.diagram.elements.filter((el: any) => 
            (el.team || el.role || el.type === 'player' || el.type === 'Player') &&
            typeof el.x === 'number' && 
            typeof el.y === 'number'
          );
          
          if (playerElements.length > 0) {
            drill.diagram.players = playerElements;
            delete drill.diagram.elements;
            console.log(`[SESSION] ✅ Converted ${playerElements.length} elements to players for drill ${index}`);
          } else {
            console.error(`[SESSION] ⚠️ Could not find player-like elements in elements array`);
            drill.diagram.players = [];
          }
        }
        
        // Ensure diagram has required structure
        if (!drill.diagram.pitch) {
          drill.diagram.pitch = { variant: "HALF", orientation: "HORIZONTAL", showZones: false };
        }
        if (drill.diagram.pitch) {
          const inferred = inferOrientation(drill.diagram);
          if (drill.diagram.pitch.orientation !== inferred) {
            drill.diagram.pitch.orientation = inferred;
            console.log(`[SESSION] Adjusted diagram orientation to ${inferred} for drill ${index}`);
          }
        }

        // Align goal teamAttacks with player positioning
        const goals = Array.isArray(drill.diagram.goals) ? drill.diagram.goals : [];
        const players = Array.isArray(drill.diagram.players) ? drill.diagram.players : [];
        if (goals.length >= 2 && players.length > 0) {
          const attPlayers = players.filter((p: any) => p.team === "ATT");
          if (attPlayers.length > 0) {
            const attCentroidX =
              attPlayers.reduce((sum: number, p: any) => sum + (p.x || 0), 0) /
              attPlayers.length;
            const attCentroidY =
              attPlayers.reduce((sum: number, p: any) => sum + (p.y || 0), 0) /
              attPlayers.length;
            if (drill.diagram.pitch.orientation === "HORIZONTAL") {
              const leftGoal = goals.reduce((min: any, g: any) => (g.x < min.x ? g : min), goals[0]);
              const rightGoal = goals.reduce((max: any, g: any) => (g.x > max.x ? g : max), goals[0]);
              const distLeft = Math.abs(attCentroidX - leftGoal.x);
              const distRight = Math.abs(attCentroidX - rightGoal.x);
              if (distRight < distLeft) {
                leftGoal.teamAttacks = "DEF";
                rightGoal.teamAttacks = "ATT";
              } else {
                leftGoal.teamAttacks = "ATT";
                rightGoal.teamAttacks = "DEF";
              }
            } else {
              const topGoal = goals.reduce((min: any, g: any) => (g.y < min.y ? g : min), goals[0]);
              const bottomGoal = goals.reduce((max: any, g: any) => (g.y > max.y ? g : max), goals[0]);
              const distTop = Math.abs(attCentroidY - topGoal.y);
              const distBottom = Math.abs(attCentroidY - bottomGoal.y);
              if (distBottom < distTop) {
                topGoal.teamAttacks = "DEF";
                bottomGoal.teamAttacks = "ATT";
              } else {
                topGoal.teamAttacks = "ATT";
                bottomGoal.teamAttacks = "DEF";
              }
            }
          }
        }
        if (!Array.isArray(drill.diagram.players)) {
          drill.diagram.players = [];
        }
        if (!Array.isArray(drill.diagram.goals)) {
          drill.diagram.goals = [];
        }
        enforceConditionedGameFormatDiagram(drill, input);
        enforceDiagramPlayerLimit(drill, input.numbersMax);
        enforceDiagramGoalAvailability(drill, input);
        normalizeGoalkeeperPositions(drill.diagram);
        applyCoachLevelDiagramProfile(drill, input.coachLevel);
        
        // Validate players array is populated
        if (drill.diagram.players.length === 0) {
          console.error(`[SESSION] ⚠️ CRITICAL: Drill ${index} (${drill.drillType || 'unknown'}) has empty players array!`);
          console.error(`[SESSION] Drill organization:`, drill.organization?.setupSteps);
          
          // Try to extract player count from organization.setupSteps
          const setupText = JSON.stringify(drill.organization?.setupSteps || []);
          const playerMatches = setupText.match(/(\d+)\s*(?:attackers?|defenders?|players?|GK|goalkeeper)/gi);
          
          if (playerMatches && playerMatches.length > 0) {
            console.warn(`[SESSION] Attempting to infer player count from setupSteps:`, playerMatches);
          }
        } else {
          console.log(`[SESSION] ✅ Drill ${index} (${drill.drillType}) has ${drill.diagram.players.length} players in diagram`);
        }
      } else if (drill.drillType !== "COOLDOWN" && !drill.diagram) {
        // Ensure diagram exists
        console.warn(`[SESSION] Drill ${index} (${drill.drillType || 'unknown'}) missing diagram, creating minimal diagram`);
        drill.diagram = {
          pitch: { variant: "HALF", orientation: "HORIZONTAL", showZones: false },
          players: [],
          goals: []
        };
        applyCoachLevelDiagramProfile(drill, input.coachLevel);
      }
    });
  }
  applyCoachLevelLanguageProfile(session, input.coachLevel);

  // 2) QA Review - update metrics context
  setMetricsContext({
    operationType: "qa_review",
    ageGroup: input.ageGroup,
    gameModelId: input.gameModelId,
    phase: input.phase,
  });
  
  const qaPrompt = buildSessionQAReviewerPrompt(session);
  console.log(`[SESSION] Starting QA with ${qaPrompt.length} char prompt...`);
  const qaModel = process.env.GEMINI_QA_MODEL || process.env.GEMINI_FAST_MODEL;
  const qaText = await generateText(qaPrompt, {
    timeout: SESSION_QA_TIMEOUT_MS,
    retries: 0,
    model: qaModel,
    fallbackModel: null,
  });
  if (isCancelled()) throw new Error("REQUEST_CANCELLED");
  const qaJson: any = parseJsonSafe(qaText);
  if (!qaJson) throw new Error("LLM returned non-JSON QA");

  // 3) Compute fixer decision from QA scores
  const scores = qaJson?.scores || {};

  // For now, we do NOT auto-patch sessions here (similar to drills)
  const finalSession = session;
  const finalQa = qaJson;

  // Average QA score
  const avgScore =
    finalQa?.scores
      ? Object.values(finalQa.scores).reduce(
          (a: number, b: any) => a + Number(b || 0),
          0
        ) / Math.max(1, Object.keys(finalQa.scores).length)
      : null;

  // Generate unique reference code for the session
  const sessionRefCode = await generateRefCode("session");
  if (isCancelled()) throw new Error("REQUEST_CANCELLED");
  
  // Add ref codes to embedded drills in the session JSON and persist as standalone records
  const drillsWithRefCodes = finalSession.drills ? await Promise.all(
    finalSession.drills.map(async (drill: any) => {
      if (isCancelled()) throw new Error("REQUEST_CANCELLED");
      try {
        if (needsDiagramEnrichment(drill?.diagram)) {
          const reenriched = await reenrichDiagramFromDrillJson(drill);
          if (reenriched) {
            drill.diagram = reenriched;
            enforceConditionedGameFormatDiagram(drill, input);
            enforceDiagramPlayerLimit(drill, input.numbersMax);
            enforceDiagramGoalAvailability(drill, input);
            normalizeGoalkeeperPositions(drill.diagram);
            applyCoachLevelDiagramProfile(drill, input.coachLevel);
            if (drill.json && typeof drill.json === "object") {
              drill.json.diagram = reenriched;
            }
          }
        }
      } catch (err: any) {
        console.error("[SESSION] Diagram re-enrichment failed:", err?.message || String(err));
      }
      if (drill?.diagram) {
        enforceConditionedGameFormatDiagram(drill, input);
        enforceDiagramPlayerLimit(drill, input.numbersMax);
        enforceDiagramGoalAvailability(drill, input);
        normalizeGoalkeeperPositions(drill.diagram);
        applyCoachLevelDiagramProfile(drill, input.coachLevel);
      }
      const drillRefCode = drill.refCode || await generateRefCode("drill");
      
      // Persist drill as standalone record (upsert by refCode)
      try {
        const drillData: any = {
          refCode: drillRefCode,
          title: drill.title || "Untitled Drill",
          gameModelId: input.gameModelId as any,
          phase: input.phase as any,
          zone: input.zone as any,
          ageGroup: input.ageGroup,
          durationMin: drill.durationMin ?? input.durationMin ?? 25,
          drillType: drill.drillType || "TECHNICAL",
          
          // Map from input or drill JSON
          numbersMin: drill.numbersMin ?? input.numbersMin,
          numbersMax: drill.numbersMax ?? input.numbersMax,
          goalsAvailable: input.goalsAvailable ?? drill.goalsAvailable ?? 0,
          goalMode: input.goalsAvailable === 1 ? "LARGE" : drill.goalMode,
          spaceConstraint: drill.spaceConstraint ?? input.spaceConstraint,
          formationUsed: drill.formationUsed ?? input.formationAttacking,
          playerLevel: input.playerLevel as any,
          coachLevel: input.coachLevel as any,
          principleIds: drill.principleIds || finalSession.principleIds || [],
          psychThemeIds: drill.psychThemeIds || finalSession.psychThemeIds || [],
          
          // Store full drill JSON
          json: drill,
          savedToVault: true,
        };

        await prisma.drill.upsert({
          where: { refCode: drillRefCode },
          update: { ...drillData, updatedAt: new Date() },
          create: drillData,
        });
      } catch (err: any) {
        console.error(`[SESSION] Failed to save drill ${drillRefCode}:`, err?.message);
        // Continue - don't fail session save if drill save fails
      }
      
      return {
        ...drill,
        refCode: drillRefCode,
      };
    })
  ) : [];

  // Final grassroots enforcement after any re-enrichment mutations.
  if (Array.isArray(drillsWithRefCodes)) {
    drillsWithRefCodes.forEach((drill: any) =>
      applyCoachLevelDiagramProfile(drill, input.coachLevel)
    );
  }
  finalSession.drills = drillsWithRefCodes;
  applyCoachLevelLanguageProfile(finalSession, input.coachLevel);
  humanizeGameModelText(finalSession);

  // Persist final post-processed drill JSON so later drill lookups match what session view shows.
  if (Array.isArray(finalSession.drills)) {
    await Promise.all(
      finalSession.drills.map(async (drill: any) => {
        if (!drill?.refCode) return;
        try {
          await prisma.drill.update({
            where: { refCode: drill.refCode },
            data: {
              json: drill,
              coachLevel: input.coachLevel as any,
              goalsAvailable: input.goalsAvailable ?? drill.goalsAvailable ?? 0,
              goalMode: input.goalsAvailable === 1 ? "LARGE" : drill.goalMode,
            },
          });
        } catch (err: any) {
          console.error(`[SESSION] Failed to persist final post-processed drill ${drill.refCode}:`, err?.message);
        }
      })
    );
  }

  // JSON we persist to the DB
  const jsonForDb = {
    ...finalSession,
    drills: drillsWithRefCodes,
    qa: finalQa,
  };

  // Persist session with all fields
  const created = await prisma.session.create({
    data: {
      refCode: sessionRefCode,
      title: jsonForDb.title || "Untitled Session",
      gameModelId: input.gameModelId as any,
      phase: input.phase as any,
      zone: input.zone as any,
      ageGroup: input.ageGroup,
      durationMin: input.durationMin ?? jsonForDb.durationMin ?? 90,
      qaScore: avgScore,
      approved: !!finalQa.pass,
      
      // Session constraints
      numbersMin: input.numbersMin,
      numbersMax: input.numbersMax,
      
      principleIds: Array.isArray(jsonForDb.principleIds) 
        ? jsonForDb.principleIds 
        : [],
      psychThemeIds: Array.isArray(jsonForDb.psychThemeIds) 
        ? jsonForDb.psychThemeIds 
        : [],
      
      // Formation & level metadata
      formationUsed: input.formationAttacking,
      playerLevel: input.playerLevel as any,
      coachLevel: input.coachLevel as any,
      
      spaceConstraint: input.spaceConstraint as any,
      goalsAvailable: input.goalsAvailable ?? 0,
      
      // Auto-save to vault
      savedToVault: true,
      
      // Track who generated this session
      generatedBy: userId || null,
      
      json: jsonForDb,
    },
  });
  
  console.log("✅ [SESSION CREATED] ID:", created.id);

  // Fetch creator info if userId was provided
  let creator = null;
  if (userId) {
    const creatorUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    if (creatorUser) {
      creator = {
        id: creatorUser.id,
        name: creatorUser.name,
        email: creatorUser.email,
      };
    }
  }

  // Persist QA snapshot
  await prisma.qAReport.create({
    data: {
      artifactId: created.id,
      artifactType: "SESSION",
      sessionId: created.id,
      pass: !!finalQa.pass,
      scores: finalQa.scores || {},
      summary: finalQa.summary || null,
    },
  });

  // Compute fixer decision
  let fixDecision: any = null;
  try {
    const scoresObj = (finalQa && (finalQa as any).scores) || {};
    if (scoresObj && Object.keys(scoresObj).length > 0) {
      fixDecision = fixSessionDecision(scoresObj);
    }
  } catch (err) {
    console.error("fixSessionDecision error", err);
  }

    return {
      session: {
        ...finalSession,
        id: created.id,
        refCode: sessionRefCode,
        drills: drillsWithRefCodes,
        qaScore: avgScore,
        approved: !!finalQa.pass,
        // Include creator information
        creator,
      },
      qa: finalQa,
      fixDecision,
      raw: {
        created: { id: created.id },
      },
    };
  } finally {
    clearMetricsContext();
  }
}
