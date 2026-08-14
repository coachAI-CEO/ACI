export const deriveGoalsSupported = (json: any) => {
  const m = (json?.goalMode || "").toUpperCase();
  if (m === "LARGE") return [1];
  if (m === "MINI2") return [2];
  return [];
};

import { applyYouthGuards } from "./youth-guards";
import { postProcessDrill } from "./postprocess";
import { fixDrillDecision } from "./fixer";
import { generateText, setMetricsContext, clearMetricsContext } from "../gemini";
import { prisma } from "../prisma";
import { buildDrillPrompt, buildQAReviewerPrompt } from "../prompts/drill-optimized-v2";
import { generateRefCode } from "../utils/ref-code";
import { needsDiagramEnrichment, reenrichDiagramFromDrillJson } from "./diagram-enrichment";
import { demoteDiagramGoalkeepers, enforceDiagramGoalAvailability, isFullSizeGoal } from "./diagram-goals";

/**
 * Sanitize LLM output to enforce clarity rules:
 * - Remove forbidden duplicate keys (diagramV1, progression)
 * - Merge alternate keys into canonical ones
 * - Remove nested json wrappers
 */
export function sanitizeDrillOutput(drill: any): { drill: any; warnings: string[] } {
  const warnings: string[] = [];
  console.log("[SANITIZER] Starting sanitization...");
  console.log("[SANITIZER] drill.organization type:", typeof drill.organization);
  console.log("[SANITIZER] drill.json?.organization type:", typeof drill.json?.organization);
  console.log("[SANITIZER] has diagramV1?", !!drill.diagramV1);
  console.log("[SANITIZER] has drill.json.diagramV1?", !!drill.json?.diagramV1);
  console.log("[SANITIZER] has progression?", !!drill.progression);
  console.log("[SANITIZER] has drill.json.progression?", !!drill.json?.progression);
  
  // Helper to fix a single object level
  const fixDiagramAndProgression = (obj: any, prefix: string = "") => {
    // Remove diagramV1 if diagram also exists
    if (obj.diagramV1 && obj.diagram) {
      delete obj.diagramV1;
      warnings.push(`${prefix}Removed duplicate 'diagramV1' (kept 'diagram')`);
    }
    
    // If only diagramV1 exists, rename to diagram
    if (obj.diagramV1 && !obj.diagram) {
      obj.diagram = obj.diagramV1;
      delete obj.diagramV1;
      warnings.push(`${prefix}Renamed 'diagramV1' to 'diagram'`);
    }
    
    // Merge progression into progressions
    if (obj.progression) {
      const existing = Array.isArray(obj.progressions) ? obj.progressions : [];
      const singular = Array.isArray(obj.progression) ? obj.progression : [obj.progression];
      obj.progressions = [...existing, ...singular].filter((x, i, arr) => 
        arr.indexOf(x) === i // dedupe
      );
      delete obj.progression;
      warnings.push(`${prefix}Merged 'progression' into 'progressions'`);
    }
  };
  
  // 1-3. Fix at top level
  fixDiagramAndProgression(drill, "");
  
  // Fix at drill.json level
  if (drill.json && typeof drill.json === "object") {
    console.log("🔍 [SANITIZER] Before fix - drill.json has diagramV1?", !!drill.json.diagramV1);
    console.log("🔍 [SANITIZER] Before fix - drill.json has progression?", !!drill.json.progression);
    fixDiagramAndProgression(drill.json, "[json] ");
    console.log("🔍 [SANITIZER] After fix - drill.json has diagramV1?", !!drill.json.diagramV1);
    console.log("🔍 [SANITIZER] After fix - drill.json has progression?", !!drill.json.progression);
  }
  
  // 4. Remove nested json.json wrappers (if LLM wrapped output incorrectly)
  if (drill.json && typeof drill.json === "object" && Object.keys(drill.json).length > 0) {
    // Check if drill.json contains drill-like keys
    const hasContent = drill.json.title || drill.json.description || drill.json.diagram;
    if (hasContent) {
      warnings.push("Removed nested 'json' wrapper");
      const nested = drill.json;
      delete drill.json;
      // Merge nested content into drill (without overwriting existing)
      Object.keys(nested).forEach(key => {
        if (!(key in drill)) {
          drill[key] = nested[key];
        }
      });
    }
  }
  
  // 5. Ensure progressions is array (not string)
  if (drill.progressions && !Array.isArray(drill.progressions)) {
    drill.progressions = [drill.progressions];
    warnings.push("Converted 'progressions' to array");
  }

  // 5b. Ensure diagram includes arrows + annotations (fallbacks if missing)
  const ensureDiagramVisuals = (diagram: any, players: any[] | undefined, prefix: string = "") => {
    if (!diagram || typeof diagram !== "object") return;

    const safePlayers = Array.isArray(players) ? players : [];
    const isGoalkeeper = (player: any) => {
      const role = String(player?.role || "").toUpperCase();
      return player?.number === 1 || role === "GK" || role.includes("GOALKEEPER");
    };
    const normalizeGoalkeeperPositions = () => {
      const goals = Array.isArray(diagram.goals) ? diagram.goals : [];
      const fullGoals = goals.filter(isFullSizeGoal);
      const gks = safePlayers.filter(isGoalkeeper);
      if (gks.length === 0) return;
      if (fullGoals.length === 0) {
        demoteDiagramGoalkeepers(diagram);
        return;
      }
      const orientation = diagram.pitch?.orientation === "VERTICAL" ? "VERTICAL" : "HORIZONTAL";

      for (const gk of gks) {
        const team = String(gk.team || "");
        const ownGoalCandidates = fullGoals.filter((goal: any) => {
          const attacks = String(goal?.teamAttacks || "");
          return attacks && attacks !== team && (attacks === "ATT" || attacks === "DEF");
        });
        const candidates = ownGoalCandidates.length > 0 ? ownGoalCandidates : fullGoals;
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
    };

    if (diagram.pitch && typeof diagram.pitch === "object") {
      diagram.pitch.showZones = false;
    }

    // The diagram is ALWAYS horizontal -- this is a fixed, absolute
    // convention (drill-optimized-v2.ts DIAGRAM DIRECTION LOCK), not
    // something to infer per-drill. This used to run a goals/player-spread
    // heuristic to guess HORIZONTAL vs VERTICAL, which (a) had no reason to
    // exist anymore once orientation stopped being a per-drill choice, and
    // (b) had its own bug: it compared raw percent-space ranges directly
    // without accounting for the field's actual landscape pixel aspect
    // ratio, so it would sometimes conclude "VERTICAL" for a layout that
    // renders perfectly horizontal once mapped onto the wide field rect.
    // Sandbox data confirmed the model itself gets this field wrong often
    // on goal-less drills (no goal position to anchor against) -- forcing
    // it here removes the ambiguity instead of trying to infer around it.
    if (diagram.pitch && typeof diagram.pitch === "object" && diagram.pitch.orientation !== "HORIZONTAL") {
      diagram.pitch.orientation = "HORIZONTAL";
      warnings.push(`${prefix}Forced pitch.orientation to HORIZONTAL (fixed convention, never inferred)`);
    }

    // Force goal.teamAttacks to match the fixed, absolute direction
    // convention (drill-optimized-v2.ts DIAGRAM DIRECTION LOCK): DEF always
    // defends the LEFT edge, ATT always attacks the RIGHT edge. This used
    // to infer teamAttacks from the ATT player centroid instead, but sandbox
    // data showed the model systematically swaps the teamAttacks label on
    // ~65% of two-goal drills (ATT's goal ends up at x~0-6, DEF's at
    // x~94-100 -- the exact mirror of the rule) while still calling itself
    // HORIZONTAL. Since the correct side is now a fixed absolute fact, not
    // something to infer from player positions, don't trust the model's
    // label at all -- assign it deterministically from which edge each
    // goal actually sits closer to.
    if (diagram.pitch && typeof diagram.pitch === "object") {
      const goals = Array.isArray(diagram.goals) ? diagram.goals : [];
      if (goals.length >= 2) {
        if (diagram.pitch.orientation === "HORIZONTAL") {
          const leftGoal = goals.reduce((min: any, g: any) => (g.x < min.x ? g : min), goals[0]);
          const rightGoal = goals.reduce((max: any, g: any) => (g.x > max.x ? g : max), goals[0]);
          if (leftGoal.teamAttacks !== "DEF" || rightGoal.teamAttacks !== "ATT") {
            leftGoal.teamAttacks = "DEF";
            rightGoal.teamAttacks = "ATT";
            warnings.push(`${prefix}Forced goal.teamAttacks to the fixed convention: DEF's own goal on the right, ATT's own goal on the left`);
          }
        } else {
          // VERTICAL is deprecated under the always-horizontal rule; keep a
          // legacy centroid-based fallback since there's no fixed top/bottom
          // convention to force here.
          const attPlayers = safePlayers.filter((p: any) => p.team === "ATT");
          if (attPlayers.length > 0) {
            const attCentroidY =
              attPlayers.reduce((sum: number, p: any) => sum + (p.y || 0), 0) / attPlayers.length;
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
            warnings.push(`${prefix}Adjusted goal.teamAttacks based on ATT centroid (legacy VERTICAL fallback)`);
          }
        }
      }
    }
    normalizeGoalkeeperPositions();

    // Force each L/R-prefixed role (LB/LM/LW/LCB/LCM/LWB vs their R-
    // prefixed counterparts) onto the correct half of the pitch width,
    // per drill-optimized-v2.ts's POSITION SIDE LOCK: ATT faces right, so
    // ATT's Left-prefixed roles belong at low y (top half) and Right-
    // prefixed at high y (bottom half); DEF faces the opposite way
    // (toward the incoming ATT), so DEF is mirrored -- DEF's Left-prefixed
    // roles belong at high y (bottom half), Right-prefixed at low y (top
    // half). This is exactly the kind of side-relative spatial reasoning
    // the model gets right most of the time but not reliably (the sandbox's
    // roleSide scorer exists because of that) -- like orientation and goal
    // direction above, don't leave it purely to the prompt: mirror any
    // player that landed on the wrong half instead of trusting the model's
    // y value as-is.
    for (const p of safePlayers) {
      const team = String((p as any)?.team || "").toUpperCase();
      if (team !== "ATT" && team !== "DEF") continue;
      const role = String((p as any)?.role || "").toUpperCase();
      const match = role.match(/^([LR])[A-Z]/);
      if (!match) continue;
      const y = Number((p as any).y);
      if (!Number.isFinite(y) || (y >= 40 && y <= 60)) continue; // too central to judge reliably

      const isLeftRole = match[1] === "L";
      // ATT: left->top (y<50), right->bottom (y>50). DEF: mirrored.
      const wantsTopHalf = team === "ATT" ? isLeftRole : !isLeftRole;
      const isTopHalf = y < 50;
      if (isTopHalf !== wantsTopHalf) {
        (p as any).y = 100 - y;
        warnings.push(
          `${prefix}Mirrored ${team} role="${(p as any).role}" from y=${y} to y=${100 - y} (POSITION SIDE LOCK: wrong half for that team/side)`
        );
      }
    }

    // Do not auto-insert generic arrows/annotations/safeZones.
    // These must be provided in the drill JSON itself.
    if (!Array.isArray(diagram.arrows)) diagram.arrows = [];
    if (!Array.isArray(diagram.annotations)) diagram.annotations = [];
    if (!Array.isArray(diagram.safeZones)) diagram.safeZones = [];
  };

  // COOLDOWN drills don't need a tactical diagram -- there's no formation,
  // no ball work, nothing spatial to draw. The prompt already asks the
  // model to omit it, but that's a request, not a guarantee (and older
  // stored drills may still carry one from before this rule existed), so
  // strip it deterministically instead of rendering whatever the model
  // returned. The UI shows the session summary in its place.
  if (String(drill.drillType || "").toUpperCase() === "COOLDOWN") {
    if (drill.diagram) {
      delete drill.diagram;
      warnings.push("Removed diagram from COOLDOWN drill (not needed -- session summary shown instead)");
    }
    if (drill.json?.diagram) delete drill.json.diagram;
  } else {
    if (drill.diagram) {
      ensureDiagramVisuals(drill.diagram, drill.diagram.players, "");
    }
    if (drill.json?.diagram) {
      ensureDiagramVisuals(drill.json.diagram, drill.json.diagram.players, "[json] ");
    }
  }
  
  // 6. Convert organization from string to structured object
  const convertOrganization = (orgString: string) => {
    const areaMatch = orgString.match(/(\d+)\s*x\s*(\d+)\s*(?:yd|yard)/i);
    const lengthYards = areaMatch ? parseInt(areaMatch[1]) : 40;
    const widthYards = areaMatch ? parseInt(areaMatch[2]) : 30;
    
    return {
      setupSteps: [
        `Mark out a ${lengthYards}x${widthYards} yard area using cones.`,
        `Split players into two teams and assign colored bibs.`,
        `Position players according to the starting formation.`,
        `Place the coach at the designated restart position.`,
        `Prepare multiple balls at the coach's position.`,
        `Explain the objective and scoring rules to all players.`
      ],
      area: { lengthYards, widthYards },
      rotation: "Rotate players every 2-3 minutes or after scoring events.",
      restarts: "Coach restarts play after goals, out of bounds, or stoppages.",
      scoring: orgString.includes("double") || orgString.includes("bonus") || orgString.includes("2 point")
        ? "Goals = 1 point. Bonus points for one-touch finishes or specific actions."
        : "Standard scoring: 1 point per goal."
    };
  };
  
  // Fix at top level
  if (typeof drill.organization === "string") {
    warnings.push("Converting drill.organization from STRING to OBJECT");
    drill.organization = convertOrganization(drill.organization);
  }
  
  // Fix at drill.json level (CRITICAL - this is where the LLM puts it!)
  if (drill.json && typeof drill.json.organization === "string") {
    console.log("🔧 [SANITIZER] FOUND STRING organization in drill.json, converting to object...");
    warnings.push("Converting drill.json.organization from STRING to OBJECT");
    drill.json.organization = convertOrganization(drill.json.organization);
    console.log("✅ [SANITIZER] Converted! Type is now:", typeof drill.json.organization);
    console.log("✅ [SANITIZER] setupSteps count:", drill.json.organization.setupSteps?.length);
  } else {
    console.log("⚠️ [SANITIZER] drill.json.organization type:", typeof drill.json?.organization);
  }
  
  // 6b. Ensure area fields are numbers (not strings) - CRITICAL for clarity score
  const ensureAreaIsNumeric = (org: any, prefix: string = "") => {
    if (org && org.area) {
      if (typeof org.area.lengthYards === "string") {
        org.area.lengthYards = parseInt(org.area.lengthYards, 10) || 40;
        warnings.push(`${prefix}Converted area.lengthYards from string to number`);
      }
      if (typeof org.area.widthYards === "string") {
        org.area.widthYards = parseInt(org.area.widthYards, 10) || 30;
        warnings.push(`${prefix}Converted area.widthYards from string to number`);
      }
      // Ensure they're numbers (handle null/undefined)
      if (typeof org.area.lengthYards !== "number") {
        org.area.lengthYards = Number(org.area.lengthYards) || 40;
        warnings.push(`${prefix}Fixed area.lengthYards to number`);
      }
      if (typeof org.area.widthYards !== "number") {
        org.area.widthYards = Number(org.area.widthYards) || 30;
        warnings.push(`${prefix}Fixed area.widthYards to number`);
      }
    }
  };
  
  // Fix at top level
  if (drill.organization && typeof drill.organization === "object") {
    ensureAreaIsNumeric(drill.organization, "");
  }
  
  // Fix at drill.json level
  if (drill.json && drill.json.organization && typeof drill.json.organization === "object") {
    ensureAreaIsNumeric(drill.json.organization, "[json] ");
  }
  
  // 7. Auto-fix age mismatches
  const correctAge = drill.ageGroup || drill.json?.ageGroup;
  if (correctAge) {
    const agePattern = /U\d+/g;
    const fixAgeInField = (obj: any, field: string, prefix: string = "") => {
      if (!obj || !obj[field]) return;
      
      if (typeof obj[field] === "string") {
        const fixed = obj[field].replace(agePattern, correctAge);
        if (fixed !== obj[field]) {
          obj[field] = fixed;
          warnings.push(`${prefix}Fixed age in ${field} to ${correctAge}`);
        }
      } else if (typeof obj[field] === "object") {
        const str = JSON.stringify(obj[field]);
        const fixed = str.replace(agePattern, correctAge);
        if (str !== fixed) {
          obj[field] = JSON.parse(fixed);
          warnings.push(`${prefix}Fixed age in ${field} to ${correctAge}`);
        }
      }
    };
    
    // Fix at top level
    fixAgeInField(drill, "organization", "");
    fixAgeInField(drill, "loadNotes", "");
    fixAgeInField(drill, "description", "");
    fixAgeInField(drill, "setup", "");
    
    // Fix at drill.json level
    if (drill.json) {
      fixAgeInField(drill.json, "organization", "[json] ");
      fixAgeInField(drill.json, "loadNotes", "[json] ");
      fixAgeInField(drill.json, "description", "[json] ");
      fixAgeInField(drill.json, "setup", "[json] ");
    }
  }
  
  return { drill, warnings };
}


function parseJsonSafe(text: string) {
  try {
    const cleaned = String(text || "")
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    return JSON.parse(cleaned);
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

function modelConstraintDefaults(gameModelId: string, phase?: string, zone?: string): string[] {
  const p = phase || "ATTACKING";
  const z = zone || "ATTACKING_THIRD";
  if (gameModelId === "POSSESSION") {
    return [
      `POSSESSION cue (${p}/${z}): create a support triangle before the next forward action.`,
      `POSSESSION cue (${p}/${z}): bonus for line-breaking pass into next lane/half-space.`,
    ];
  }
  if (gameModelId === "PRESSING") {
    return [
      `PRESSING cue (${p}/${z}): trigger press on bad touch, back pass, or closed body shape.`,
      `PRESSING cue (${p}/${z}): bonus for regain in target zone within 6 seconds.`,
    ];
  }
  if (gameModelId === "TRANSITION") {
    return [
      `TRANSITION cue (${p}/${z}): first action in 3 seconds after regain must be forward or to support.`,
      `TRANSITION cue (${p}/${z}): on loss, nearest 3 players counterpress for 3-5 seconds before recovery.`,
    ];
  }
  if (gameModelId === "ROCKLIN_FC") {
    return [
      "After regain, play forward early when on (pass or dribble); if not, secure and re-expand with width/depth.",
      "After loss, counterpress for 3-5 seconds; if not regained, recover compact and protect central lanes.",
    ];
  }
  return [
    `COACHAI cue (${p}/${z}): switch between controlled circulation and direct attack based on pressure.`,
    `COACHAI cue (${p}/${z}): on loss, immediate pressure first, then recover compact shape if press is broken.`,
  ];
}

function phaseConstraintDefaults(phase?: string, zone?: string): string[] {
  const p = phase || "ATTACKING";
  const z = zone || "ATTACKING_THIRD";
  if (p === "ATTACKING") {
    return [
      `PHASE cue (${p}/${z}): create and use width/depth to progress into final action zones.`,
      `PHASE cue (${p}/${z}): final action must come from a timed support/penetration sequence.`,
    ];
  }
  if (p === "DEFENDING") {
    return [
      `PHASE cue (${p}/${z}): protect central lanes; force play away from goal-facing channels.`,
      `PHASE cue (${p}/${z}): pressure-cover-balance distances must stay compact before challenge.`,
    ];
  }
  if (p === "TRANSITION_TO_ATTACK") {
    return [
      `PHASE cue (${p}/${z}): first action within 3-6 seconds after regain must exploit forward space or secure support.`,
      `PHASE cue (${p}/${z}): support runs must provide at least two immediate options after regain.`,
    ];
  }
  if (p === "TRANSITION_TO_DEFEND") {
    return [
      `PHASE cue (${p}/${z}): immediate reaction after loss: nearest players counterpress for 3-5 seconds.`,
      `PHASE cue (${p}/${z}): if press fails, recover compact shape with clear line responsibilities.`,
    ];
  }
  return [
    `PHASE cue (${p}/${z}): include both regain-to-attack and loss-to-defend transitions in repeated cycles.`,
    `PHASE cue (${p}/${z}): decision timing must switch roles immediately on possession change.`,
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

function enforceModelConstraints(
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
 * Main generator + QA (+ decision) pipeline.
 *
 * 1) Generate drill JSON from Gemini.
 * 2) Apply youth guards & hard post-processing.
 * 3) Run QA reviewer.
 * 4) Compute fixer decision from QA scores (OK / PATCHABLE / NEEDS_REGEN).
 * 5) Persist final drill + QA into DB.
 */
export async function generateAndReviewDrill(
  input: Parameters<typeof buildDrillPrompt>[0],
  userId?: string
) {
  // Set metrics context for tracking
  setMetricsContext({
    operationType: "drill",
    ageGroup: input.ageGroup,
    gameModelId: input.gameModelId,
    phase: input.phase,
  });
  
  try {
    // 1) Generate (45s timeout for reliability - Gemini can be slow for complex prompts)
    const prompt = buildDrillPrompt(input);
    console.log(`[DRILL] Starting generation with ${prompt.length} char prompt...`);
    const generationModel = process.env.GEMINI_DRILL_MODEL || process.env.GEMINI_GENERATION_MODEL;
    const genText = await generateText(prompt, {
      timeout: Number(process.env.DRILL_GENERATION_TIMEOUT_MS || 45000),
      retries: Number(process.env.GEMINI_MAX_RETRIES ?? 1),
      model: generationModel,
    });
  let drill: any = parseJsonSafe(genText);
  if (!drill) throw new Error("LLM returned non-JSON drill");

  // 1.5) Sanitize output to remove forbidden keys
  const { drill: sanitizedDrill, warnings } = sanitizeDrillOutput(drill);
  drill = sanitizedDrill;
  
  if (warnings.length > 0) {
    console.log("[DRILL_SANITIZER] Applied fixes:", warnings);
  }

  // Youth guards / structural guards.
  applyYouthGuards(drill, input);
  enforceModelConstraints(drill, {
    gameModelId: input.gameModelId,
    phase: input.phase,
    zone: input.zone,
  });

  // Ensure coaching points array exists + GK coaching point if goalsAvailable >= 1
  if (!Array.isArray(drill.coachingPoints)) drill.coachingPoints = [];
  if (
    input.goalsAvailable >= 1 &&
    !drill.coachingPoints.some((p: string) =>
      /^GK\b|^Goalkeeper\b/i.test(p)
    )
  ) {
    drill.coachingPoints.push(
      "GK: starting position and communication on cutbacks (angle/near-post, claim vs. set)."
    );
  }

  // Normalize numbers from input if missing
  drill.numbers = drill.numbers || {};
  if (typeof drill.numbers.min !== "number") {
    drill.numbers.min = input.numbersMin;
  }
  if (typeof drill.numbers.max !== "number") {
    drill.numbers.max = input.numbersMax;
  }

  // Let the shared post-processor handle goalMode, diagram, equipment, etc.
  let processedFields: any = {};
  try {
    processedFields = postProcessDrill({ json: drill }, input);
  } catch (err) {
    console.error("postProcessDrill error:", err);
    // never hard-crash on post-processing, but log the error
  }

  // Re-enrich diagram with LLM if tactical elements are generic/missing.
  // Skip entirely for COOLDOWN -- it has no diagram to enrich, and calling
  // needsDiagramEnrichment(undefined) would return true and trigger a
  // wasted Gemini call to generate one.
  try {
    if (String(input.drillType || "").toUpperCase() !== "COOLDOWN" && needsDiagramEnrichment(drill?.diagram, input.coachLevel)) {
      const reenriched = await reenrichDiagramFromDrillJson(drill);
      if (reenriched) {
        drill.diagram = reenriched;
        if (processedFields?.json) {
          processedFields.json.diagram = reenriched;
        }
      }
    }
  } catch (err: any) {
    console.error("[DRILL] Diagram re-enrichment failed:", err?.message || String(err));
  }
  enforceDiagramGoalAvailability(drill, input);
  if (processedFields?.json) enforceDiagramGoalAvailability(processedFields.json, input);

  // 2) First QA (40s timeout - QA can be slow with large drill objects)
  // Update metrics context for QA
  setMetricsContext({
    operationType: "qa_review",
    ageGroup: input.ageGroup,
    gameModelId: input.gameModelId,
    phase: input.phase,
  });
  
  const qaPrompt = buildQAReviewerPrompt(drill);
  console.log(`[DRILL] Starting QA with ${qaPrompt.length} char prompt...`);
  const qaModel = process.env.GEMINI_QA_MODEL || process.env.GEMINI_FAST_MODEL;
  const qaText = await generateText(qaPrompt, {
    timeout: Number(process.env.DRILL_QA_TIMEOUT_MS || 25000),
    retries: Number(process.env.GEMINI_MAX_RETRIES ?? 1),
    model: qaModel,
  });
  const qaJson: any = parseJsonSafe(qaText);
  if (!qaJson) throw new Error("LLM returned non-JSON QA");

  // 3) Compute fixer decision from QA scores
  const scores = qaJson?.scores || {};

  // For now, we do NOT auto-patch drills here.
  const finalDrill = drill;
  const finalQa = qaJson;
  humanizeGameModelText(finalDrill);

  // Average QA score
  const avgScore =
    finalQa?.scores
      ? Object.values(finalQa.scores).reduce(
          (a: number, b: any) => a + Number(b || 0),
          0
        ) / Math.max(1, Object.keys(finalQa.scores).length)
      : null;

  // Derive fixer decision from final QA scores (if present)
  try {
    const scores = (finalQa && (finalQa as any).scores) || {};
    if (scores && Object.keys(scores).length > 0) {
    }
  } catch (err) {
    console.error("fixDrillDecision error", err);
  }

  // JSON we persist to the DB
  // Use processedFields.json (cleaned) instead of finalDrill (may have forbidden keys)
  const jsonForDb = {
    ...(processedFields.json || finalDrill), // Use cleaned version if available
    goalsSupported: processedFields.goalsSupported || [],
    drillType: input.drillType, // Store drillType in JSON
    qa: finalQa,
  };
  enforceDiagramGoalAvailability(jsonForDb, input);

  // Final cleanup: ensure forbidden keys are removed from jsonForDb
  if (jsonForDb.diagramV1) {
    delete jsonForDb.diagramV1;
    console.log("🗑️ [DRILL] Removed diagramV1 from jsonForDb (final cleanup)");
  }
  if (jsonForDb.progression) {
    delete jsonForDb.progression;
    console.log("🗑️ [DRILL] Removed progression from jsonForDb (final cleanup)");
  }
  
  console.log("💾 [DB SAVE] jsonForDb.organization type:", typeof jsonForDb.organization);
  console.log("💾 [DB SAVE] jsonForDb.json?.organization type:", typeof jsonForDb.json?.organization);

  // Generate unique reference code for the drill
  const drillRefCode = await generateRefCode("drill");

  // Persist drill with all normalized fields from postProcessDrill
  const created = await prisma.drill.create({
    data: {
      refCode: drillRefCode,
      title: processedFields.title || jsonForDb.title || "Untitled",
      gameModelId: input.gameModelId as any,
      phase: input.phase as any,
      zone: input.zone as any,
      ageGroup: input.ageGroup,
      durationMin: processedFields.durationMin ?? input.durationMin ?? 25,
      qaScore: avgScore,
      approved: !!finalQa.pass,
      
      // --- NORMALIZED FIELDS FROM POSTPROCESS ---
      numbersMin: processedFields.numbersMin ?? input.numbersMin,
      numbersMax: processedFields.numbersMax ?? input.numbersMax,
      
      principleIds: Array.isArray(processedFields.principleIds) 
        ? processedFields.principleIds 
        : [],
      psychThemeIds: Array.isArray(processedFields.psychThemeIds) 
        ? processedFields.psychThemeIds 
        : [],
      
      energySystem: processedFields.energySystem ?? "Aerobic",
      rpeMin: processedFields.rpeMin ?? 3,
      rpeMax: processedFields.rpeMax ?? 6,
      
      goalsAvailable: processedFields.goalsAvailable ?? 0,
      goalMode: processedFields.goalMode,
      
      // --- NEW: Formation & Level fields (from input, validated) ---
      // Store attacking formation in formationUsed for backward compatibility
      // Both formations are also stored in json.formationAttacking and json.formationDefending
      formationUsed: input.formationAttacking, // Use attacking formation as primary
      playerLevel: input.playerLevel as any,
      coachLevel: input.coachLevel as any,
      
      // --- NEW: Drill Type field (only include if provided) ---
      ...(input.drillType ? { drillType: input.drillType as any } : {}),
      
      needGKFocus: processedFields.needGKFocus ?? false,
      gkFocus: processedFields.gkFocus,
      
      spaceConstraint: input.spaceConstraint as any,
      
      // Auto-save to vault
      savedToVault: true,
      
      // Track who generated this drill
      generatedBy: userId || null,
      
      json: jsonForDb,
    },
  });
  
  console.log("✅ [DB CREATED] created.json.organization type:", typeof (created.json as any)?.organization);

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
      artifactType: "DRILL",
      drillId: created.id,
      pass: !!finalQa.pass,
      scores: finalQa.scores ?? {},
      summary: finalQa.summary ?? "",
    },
  });

  // --- DB CHECK: Verify critical fields were persisted correctly ---
  const dbCheck = await prisma.drill.findUnique({
    where: { id: created.id },
    select: {
      formationUsed: true,
      playerLevel: true,
      coachLevel: true,
    },
  });

  if (!dbCheck?.formationUsed || !dbCheck?.playerLevel || !dbCheck?.coachLevel) {
    throw new Error(
      `DB_CHECK_FAILED: Critical fields missing after save. ` +
      `formationUsed=${dbCheck?.formationUsed}, playerLevel=${dbCheck?.playerLevel}, coachLevel=${dbCheck?.coachLevel}`
    );
  }

  if (
    dbCheck.formationUsed !== input.formationAttacking ||
    dbCheck.playerLevel !== input.playerLevel ||
    dbCheck.coachLevel !== input.coachLevel
  ) {
    throw new Error(
      `DB_CHECK_FAILED: Field mismatch after save. ` +
      `Expected: formationUsed=${input.formationAttacking}, playerLevel=${input.playerLevel}, coachLevel=${input.coachLevel}. ` +
      `Got: formationUsed=${dbCheck.formationUsed}, playerLevel=${dbCheck.playerLevel}, coachLevel=${dbCheck.coachLevel}`
    );
  }

    return {
      drill: {
        ...created,
        // Ensure organization is accessible at top level
        organization: (created.json as any)?.organization || "",
        // Include creator information
        creator,
      },
      qa: finalQa,
      raw: { genText, qaText },
    };
  } finally {
    clearMetricsContext();
  }
}
