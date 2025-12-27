"use client";

import * as React from "react";

type DrillPitchDiagramProps = {
  diagram: any;
};

const WIDTH = 800;
const HEIGHT = 520;

const PITCH_MARGIN = 40;
const PITCH_LEFT = PITCH_MARGIN;
const PITCH_TOP = PITCH_MARGIN;
const PITCH_WIDTH = WIDTH - PITCH_MARGIN * 2;
const PITCH_HEIGHT = HEIGHT - PITCH_MARGIN * 2;


// Normalize 0–100 coordinates → svg space
function nx(x: number) {
  return (Math.max(0, Math.min(100, x)) / 100) * WIDTH;
}
function ny(y: number) {
  return (Math.max(0, Math.min(100, y)) / 100) * HEIGHT;
}

function teamColors(team: string | undefined) {
  switch (team) {
    case "ATT":
      return { fill: "#38bdf8", stroke: "#0f172a" }; // blue
    case "DEF":
      return { fill: "#fb7185", stroke: "#0f172a" }; // red
    default:
      return { fill: "#e5e7eb", stroke: "#020617" }; // neutral / GK
  }
}

function arrowColor(type: string | undefined) {
  switch (type) {
    case "pass":
      return "#e5e7eb";
    case "run":
      return "#22c55e";
    case "press":
    case "cover":
      return "#f97316";
    default:
      return "#e5e7eb";
  }
}

function arrowDash(style: string | undefined, type: string | undefined) {
  if (style === "dotted") return "2,6";
  if (style === "dashed") return "6,6";
  if (type === "run") return "4,8";
  return undefined;
}

/**
 * Normalize role names to standard position abbreviations
 */
function normalizeRoleToPosition(role: string | undefined): string {
  if (!role) return "";
  
  const roleLower = role.toLowerCase();
  
  // Goalkeeper
  if (roleLower.includes("gk") || roleLower.includes("goalkeeper")) return "GK";
  
  // Defenders
  if (roleLower.includes("cb") || roleLower.includes("center-back") || roleLower.includes("centre-back")) {
    if (roleLower.includes("lcb") || roleLower.includes("left")) return "LCB";
    if (roleLower.includes("rcb") || roleLower.includes("right")) return "RCB";
    return "CB";
  }
  if (roleLower.includes("fb") || roleLower.includes("fullback")) {
    if (roleLower.includes("lb") || roleLower.includes("left")) return "LB";
    if (roleLower.includes("rb") || roleLower.includes("right")) return "RB";
    return "FB";
  }
  if (roleLower.includes("wb") || roleLower.includes("wingback")) {
    if (roleLower.includes("lwb") || roleLower.includes("left")) return "LWB";
    if (roleLower.includes("rwb") || roleLower.includes("right")) return "RWB";
    return "WB";
  }
  
  // Midfielders
  if (roleLower.includes("dm") || roleLower.includes("cdm") || roleLower.includes("defensive midfielder") || roleLower.includes("dvan") || roleLower.includes("anchor")) {
    if (roleLower.includes("ldm") || roleLower.includes("left")) return "LDM";
    if (roleLower.includes("rdm") || roleLower.includes("right")) return "RDM";
    return "DM";
  }
  if (roleLower.includes("cm") || roleLower.includes("central midfielder") || roleLower.includes("centre midfielder")) {
    if (roleLower.includes("lcm") || roleLower.includes("left")) return "LCM";
    if (roleLower.includes("rcm") || roleLower.includes("right")) return "RCM";
    return "CM";
  }
  if (roleLower.includes("am") || roleLower.includes("cam") || roleLower.includes("attacking midfielder") || roleLower.includes("central attacking midfielder")) {
    if (roleLower.includes("lam") || roleLower.includes("left")) return "LAM";
    if (roleLower.includes("ram") || roleLower.includes("right")) return "RAM";
    return "CAM";
  }
  
  // Forwards/Wingers
  if (roleLower.includes("w") || roleLower.includes("winger")) {
    if (roleLower.includes("lw") || roleLower.includes("left")) return "LW";
    if (roleLower.includes("rw") || roleLower.includes("right")) return "RW";
    return "W";
  }
  if (roleLower.includes("st") || roleLower.includes("striker") || roleLower.includes("forward") || roleLower.includes("cf") || roleLower.includes("centre forward")) {
    return "ST";
  }
  
  // Pressing/defensive roles
  if (roleLower.includes("press") || roleLower.includes("pressing")) {
    return "CB"; // Default pressing player to CB
  }
  
  // If it's already a short abbreviation (2-4 chars, all caps or mixed), return as-is
  if (role.length <= 4 && /^[A-Z]+$/i.test(role)) {
    return role.toUpperCase();
  }
  
  // Default: return first 3-4 uppercase letters
  return role.substring(0, 3).toUpperCase();
}

/**
 * Normalize player numbers based on team and role.
 * Defensive players should use numbers 2-6 (fullbacks, center-backs, defensive midfielders).
 * Attacking players use 7-11 (wingers, attacking midfielders, strikers).
 */
function normalizePlayerNumber(
  player: { team?: string; role?: string; number?: number; x?: number }
): number {
  const team = player.team?.toUpperCase();
  const role = (player.role || "").toLowerCase();
  const currentNum = player.number ?? 0;
  const x = player.x ?? 50;

  // Goalkeeper always gets 1
  if (role.includes("gk") || role.includes("goalkeeper") || currentNum === 1) {
    return 1;
  }

  // Defensive team should use 2-6 ONLY
  // Note: For defenders, left/right is flipped because they face the opposite direction
  if (team === "DEF") {
    // Center-backs: 4 (left from defender's view = right on field) or 5 (right from defender's view = left on field)
    if (role.includes("cb") || role.includes("center-back")) {
      return x < 50 ? 5 : 4; // Flipped: x < 50 (left on field) = 5 (right from defender's view)
    }
    // Defensive midfielder: 6
    if (role.includes("dm") || role.includes("cdm") || role.includes("defensive midfielder")) {
      return 6;
    }
    // Fullbacks: 2 (left from defender's view = right on field) or 3 (right from defender's view = left on field)
    if (role.includes("fb") || role.includes("fullback") || role.includes("lb") || role.includes("rb")) {
      return x < 50 ? 3 : 2; // Flipped: x < 50 (left on field) = 3 (right from defender's view)
    }
    // Wingbacks: 2 or 3 (same as fullbacks)
    if (role.includes("wb") || role.includes("wingback") || role.includes("lwb") || role.includes("rwb")) {
      return x < 50 ? 3 : 2;
    }
    // If number is > 6 or < 2, map to defensive range (2-6)
    if (currentNum > 6 || currentNum < 2) {
      // Map to defensive range: 2-6
      const defensiveNumbers = [2, 3, 4, 5, 6];
      return defensiveNumbers[Math.abs(currentNum) % defensiveNumbers.length];
    }
    // If already in range 2-6, keep it
    if (currentNum >= 2 && currentNum <= 6) {
      return currentNum;
    }
    // Default defensive: 4 (center-back)
    return 4;
  }

  // Attacking team uses 7-11 ONLY
  if (team === "ATT") {
    // If number is in defensive range (2-6), map to attacking range
    if (currentNum >= 2 && currentNum <= 6) {
      // Map: 2->7, 3->11, 4->8, 5->9, 6->10
      const mapping: Record<number, number> = { 2: 7, 3: 11, 4: 8, 5: 9, 6: 10 };
      return mapping[currentNum] ?? 8;
    }
    // If already in attacking range (7-11), keep it
    if (currentNum >= 7 && currentNum <= 11) {
      return currentNum;
    }
    // If number is outside range, map to attacking range
    if (currentNum > 11 || currentNum < 7) {
      const attackingNumbers = [7, 8, 9, 10, 11];
      return attackingNumbers[Math.abs(currentNum) % attackingNumbers.length];
    }
    // Default attacking: 8 (central midfielder)
    return 8;
  }

  // Neutral/GK: keep original number
  return currentNum || 1;
}

function DrillPitchDiagram({ diagram }: DrillPitchDiagramProps) {
  // Handle both formats: { players: [...] } and { elements: [...] }
  let players: any[] = [];
  if (Array.isArray(diagram?.players)) {
    players = diagram.players;
  } else if (Array.isArray(diagram?.elements)) {
    // If diagram has elements array, try to extract players from it
    console.warn("[DrillPitchDiagram] Diagram uses 'elements' format instead of 'players' format. Elements:", diagram.elements);
    // Try to filter elements that look like players (have team, role, x, y, etc.)
    players = diagram.elements.filter((el: any) => 
      (el.team || el.role || el.type === 'player') && 
      typeof el.x === 'number' && 
      typeof el.y === 'number'
    );
    // If no filtered results, use elements as-is (might be player objects)
    if (players.length === 0 && diagram.elements.length > 0) {
      console.warn("[DrillPitchDiagram] No player-like elements found, using all elements:", diagram.elements);
      players = diagram.elements;
    }
  }
  
  const balls: any[] = Array.isArray(diagram?.balls) ? diagram.balls : [];
  const arrows: any[] = Array.isArray(diagram?.arrows) ? diagram.arrows : [];
  const firstPassIdx = arrows.findIndex(a => a.type === "pass");
  const goals: any[] = Array.isArray(diagram?.goals) ? diagram.goals : [];
  
  // Debug: log diagram structure
  React.useEffect(() => {
    if (players.length === 0) {
      console.warn("[DrillPitchDiagram] No players found in diagram:", {
        hasDiagram: !!diagram,
        diagramKeys: diagram ? Object.keys(diagram) : [],
        hasPlayers: !!diagram?.players,
        hasElements: !!diagram?.elements,
        playersArray: diagram?.players,
        elementsArray: diagram?.elements,
        elementsLength: diagram?.elements?.length,
        fullDiagram: diagram
      });
    } else {
      console.log(`[DrillPitchDiagram] Found ${players.length} players in diagram`);
    }
  }, [diagram, players.length]);
  
  // Determine pitch variant - default to THIRD for final third diagrams
  const pitchVariant = diagram?.pitch?.variant || "THIRD";

  const layoutPlayers = React.useMemo(() => {
    const perfStart = performance.now();
    type LayoutPlayer = (typeof players)[number] & { screenX: number; screenY: number };

    // Filter out invalid players (missing x/y coordinates)
    const validPlayers = players.filter((p) => 
      typeof p.x === 'number' && 
      typeof p.y === 'number' && 
      !isNaN(p.x) && 
      !isNaN(p.y) &&
      isFinite(p.x) &&
      isFinite(p.y)
    );
    
    if (validPlayers.length !== players.length) {
      console.warn(`[DrillPitchDiagram] Filtered out ${players.length - validPlayers.length} invalid players (missing/invalid x/y coordinates)`);
    }

    // First pass: normalize numbers and adjust positioning
    // For pressing scenarios: attackers start further back relative to defenders
    const normalized = validPlayers.map((p) => {
      const baseX = nx(p.x);
      let baseY = ny(p.y);
      
      // Adjust Y position based on team for better pressing visualization
      // In the diagram: Y=0 is at top (goal), Y increases downward
      // ATT players should start further back (increase Y = move down/away from goal)
      // DEF players stay higher (decrease Y = move up/closer to goal)
      if (p.team === "ATT") {
        // Push attacking players back by ~12% of pitch height
        baseY = Math.min(HEIGHT - PITCH_MARGIN, baseY + (PITCH_HEIGHT * 0.12));
      } else if (p.team === "DEF") {
        // Adjust defensive players based on role:
        // CBs should be furthest from GK (move down/further from goal)
        // STs should be closest to GK (move up/closer to goal)
        const role = (p.role || "").toLowerCase();
        if (role.includes("cb") || role.includes("center-back") || role.includes("centre-back")) {
          // Center-backs: move down (further from goal) - add to Y
          baseY = Math.min(HEIGHT - PITCH_MARGIN, baseY + (PITCH_HEIGHT * 0.12));
        } else if (role.includes("st") || role.includes("striker") || role.includes("forward") || role.includes("cf")) {
          // Strikers: move up (closer to goal) - subtract from Y
          baseY = Math.max(PITCH_TOP, baseY - (PITCH_HEIGHT * 0.10));
        } else {
          // Other defensive players (DM, FB, etc.): slight adjustment down
          baseY = Math.min(HEIGHT - PITCH_MARGIN, baseY + (PITCH_HEIGHT * 0.04));
        }
      }
      // Neutral/GK: no adjustment
      
      return {
        ...p,
        number: normalizePlayerNumber(p),
        screenX: baseX,
        screenY: baseY,
      };
    });

    // Second pass: ensure unique numbers within each team
    const teamGroups: Record<string, LayoutPlayer[]> = {};
    normalized.forEach((p) => {
      const team = p.team || "NEUTRAL";
      if (!teamGroups[team]) teamGroups[team] = [];
      teamGroups[team].push(p);
    });

    // Second pass: ensure unique numbers within each team and correct ranges
    Object.keys(teamGroups).forEach((team) => {
      const teamPlayers = teamGroups[team];
      const usedNumbers = new Set<number>();
      
      teamPlayers.forEach((p) => {
        const currentNum = p.number ?? 0;
        let assigned = false;
        
        // Check if number is valid for this team and not already used
        if (team === "DEF") {
          // Defensive team must use 2-6
          if (currentNum >= 2 && currentNum <= 6 && !usedNumbers.has(currentNum)) {
            // Number is valid and unique
            usedNumbers.add(currentNum);
            assigned = true;
          } else {
            // Find next available number in range 2-6
            for (let n = 2; n <= 6; n++) {
              if (!usedNumbers.has(n)) {
                p.number = n;
                usedNumbers.add(n);
                assigned = true;
                break;
              }
            }
          }
        } else if (team === "ATT") {
          // Attacking team must use 7-11
          if (currentNum >= 7 && currentNum <= 11 && !usedNumbers.has(currentNum)) {
            // Number is valid and unique
            usedNumbers.add(currentNum);
            assigned = true;
          } else {
            // Find next available number in range 7-11
            for (let n = 7; n <= 11; n++) {
              if (!usedNumbers.has(n)) {
                p.number = n;
                usedNumbers.add(n);
                assigned = true;
                break;
              }
            }
          }
        } else {
          // Neutral/GK - use 1
          if (currentNum === 1 && !usedNumbers.has(1)) {
            usedNumbers.add(1);
            assigned = true;
          } else if (!usedNumbers.has(1)) {
            p.number = 1;
            usedNumbers.add(1);
            assigned = true;
          } else {
            // 1 is already taken, keep current or default to 1
            p.number = currentNum || 1;
            assigned = true;
          }
        }
        
        // Ensure number is set (fallback)
        if (!assigned) {
          if (team === "DEF") {
            p.number = 2 + (usedNumbers.size % 5);
          } else if (team === "ATT") {
            p.number = 7 + (usedNumbers.size % 5);
          } else {
            p.number = 1;
          }
        }
      });
    });

    const base: LayoutPlayer[] = normalized;

    const COLLISION_DISTANCE = 44; // px, ~2x player radius + a small gap
    const COLLISION_DISTANCE_SQ = COLLISION_DISTANCE * COLLISION_DISTANCE; // Squared distance for comparison (avoids sqrt)

    // Optimized collision detection: use squared distance to avoid expensive sqrt until collision detected
    // Limit iterations to prevent infinite loops with very crowded players
    const MAX_ITERATIONS = 5;
    let iterations = 0;
    let hasCollisions = true;

    while (hasCollisions && iterations < MAX_ITERATIONS) {
      hasCollisions = false;
      iterations++;

      for (let i = 0; i < base.length; i++) {
        for (let j = i + 1; j < base.length; j++) {
          const dx = base[j].screenX - base[i].screenX;
          const dy = base[j].screenY - base[i].screenY;
          const distSq = dx * dx + dy * dy; // Squared distance (no sqrt needed for comparison)
          
          if (distSq >= COLLISION_DISTANCE_SQ || distSq === 0) continue;

          // Only calculate sqrt when collision is detected
          const dist = Math.sqrt(distSq);
          hasCollisions = true;

          const overlap = COLLISION_DISTANCE - dist;
          const ux = dx / dist;
          const uy = dy / dist;

          base[i].screenX -= (ux * overlap) / 2;
          base[i].screenY -= (uy * overlap) / 2;
          base[j].screenX += (ux * overlap) / 2;
          base[j].screenY += (uy * overlap) / 2;
        }
      }
    }

    const perfTime = performance.now() - perfStart;
    console.log(`[PERF] Diagram layoutPlayers calculation: ${perfTime.toFixed(2)}ms (${base.length} players, ${iterations} collision iterations)`);

    // Final validation: ensure all players have valid screen coordinates
    const validLayoutPlayers = base.filter(p => 
      typeof p.screenX === 'number' && 
      typeof p.screenY === 'number' &&
      !isNaN(p.screenX) && 
      !isNaN(p.screenY) &&
      isFinite(p.screenX) &&
      isFinite(p.screenY)
    );
    
    if (validLayoutPlayers.length !== base.length) {
      console.warn(`[DrillPitchDiagram] Filtered out ${base.length - validLayoutPlayers.length} players with invalid screen coordinates`);
    }

    return validLayoutPlayers;
  }, [players]);
  const coach = diagram?.coach || null;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-full w-full"
      role="img"
      aria-label="Tactical drill diagram"
    >
      {/* Pitch background */}
      <rect
        x={PITCH_LEFT}
        y={PITCH_TOP}
        width={PITCH_WIDTH}
        height={PITCH_HEIGHT}
        rx={24}
        ry={24}
        fill="#022c22"
      />

      {/* Shaded lanes (wide / half-spaces / central) */}
      {/* Lane proportions: wide (15%), half-space (20%), central (30%), half-space (20%), wide (15%) */}
      {(() => {
        const laneProportions = [0.15, 0.20, 0.30, 0.20, 0.15]; // Sum = 1.0
        const colors = ["#022c22", "#064e3b", "#0f766e", "#064e3b", "#022c22"];
        let currentX = PITCH_LEFT;
        
        return laneProportions.map((proportion, i) => {
          const laneWidth = PITCH_WIDTH * proportion;
          const x = currentX;
          currentX += laneWidth;
          
          return (
            <rect
              key={i}
              x={x}
              y={PITCH_TOP}
              width={laneWidth}
              height={PITCH_HEIGHT}
              fill={colors[i]}
              opacity={0.75}
            />
          );
        });
      })()}

      {/* Outer lines */}
      
      <rect
        x={PITCH_LEFT}
        y={PITCH_TOP}
        width={PITCH_WIDTH}
        height={PITCH_HEIGHT}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={2}
      />

      {/* Halfway line - only for HALF and FULL */}
      {(pitchVariant === "HALF" || pitchVariant === "FULL") && (
        <line
          x1={PITCH_LEFT}
          y1={pitchVariant === "HALF" ? PITCH_TOP + PITCH_HEIGHT : HEIGHT / 2}
          x2={PITCH_LEFT + PITCH_WIDTH}
          y2={pitchVariant === "HALF" ? PITCH_TOP + PITCH_HEIGHT : HEIGHT / 2}
          stroke="#e5e7eb"
          strokeWidth={1.5}
        />
      )}

      {/* Center circle - HALF shows half circle at bottom, FULL shows full circle in center */}
      {(pitchVariant === "HALF" || pitchVariant === "FULL") && (() => {
        const centerX = WIDTH / 2;
        const radius = PITCH_WIDTH * 0.12; // ~12% of pitch width
        
        if (pitchVariant === "HALF") {
          // Half circle at the bottom edge (where halfway line would be)
          const centerY = PITCH_TOP + PITCH_HEIGHT;
          return (
            <path
              d={`M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={1.5}
            />
          );
        } else {
          // Full circle in the center for FULL field
          const centerY = HEIGHT / 2;
          return (
            <circle
              cx={centerX}
              cy={centerY}
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={1.5}
            />
          );
        }
      })()}

      {/* Vertical dashed lane guides */}
      {(() => {
        const laneProportions = [0.15, 0.20, 0.30, 0.20, 0.15];
        let currentX = PITCH_LEFT;
        const dividerPositions: number[] = [];
        
        // Calculate divider positions between lanes
        laneProportions.forEach((proportion, i) => {
          if (i < laneProportions.length - 1) {
            currentX += PITCH_WIDTH * proportion;
            dividerPositions.push(currentX);
          }
        });
        
        return dividerPositions.map((x, i) => (
          <line
            key={i}
            x1={x}
            y1={PITCH_TOP}
            x2={x}
            y2={PITCH_TOP + PITCH_HEIGHT}
            stroke="#e5e7eb"
            strokeWidth={1}
            strokeDasharray="4,10"
            opacity={0.4}
          />
        ));
      })()}

      {/* Penalty boxes and goal areas */}
      {/* Adjust proportions based on pitch variant */}
      {(() => {
        // For THIRD view: penalty box should be larger relative to visible area
        // For HALF/FULL: use smaller proportions
        const isThird = pitchVariant === "THIRD" || pitchVariant === "QUARTER";
        const isFull = pitchVariant === "FULL";
        const isHalf = pitchVariant === "HALF";
        
        // Penalty box dimensions
        const penaltyBoxWidth = isThird ? PITCH_WIDTH * 0.40 : PITCH_WIDTH * 0.33;
        const penaltyBoxHeight = isThird ? PITCH_HEIGHT * 0.40 : PITCH_HEIGHT * 0.25;
        
        // Goal area (6-yard box) dimensions
        const goalAreaWidth = isThird ? PITCH_WIDTH * 0.22 : PITCH_WIDTH * 0.17;
        const goalAreaHeight = isThird ? PITCH_HEIGHT * 0.18 : PITCH_HEIGHT * 0.10;
        
        // Goal dimensions
        const goalWidth = isThird ? PITCH_WIDTH * 0.14 : PITCH_WIDTH * 0.11;
        const goalHeight = 10;
        
        const renderPenaltyBox = (y: number, isTop: boolean) => (
          <>
            {/* Penalty box */}
            <rect
              x={WIDTH / 2 - penaltyBoxWidth / 2}
              y={y}
              width={penaltyBoxWidth}
              height={penaltyBoxHeight}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={2}
            />
            {/* Goal area (6-yard box) */}
            <rect
              x={WIDTH / 2 - goalAreaWidth / 2}
              y={y}
              width={goalAreaWidth}
              height={goalAreaHeight}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={2}
            />
            {/* Goal */}
            <rect
              x={WIDTH / 2 - goalWidth / 2}
              y={isTop ? y - goalHeight : y + penaltyBoxHeight}
              width={goalWidth}
              height={goalHeight}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={2}
            />
          </>
        );
        
        return (
          <>
            {/* Top penalty box - always show for THIRD, HALF, or FULL */}
            {renderPenaltyBox(PITCH_TOP, true)}
            
            {/* Bottom penalty box - only for FULL field */}
            {isFull && renderPenaltyBox(PITCH_TOP + PITCH_HEIGHT - penaltyBoxHeight, false)}
          </>
        );
      })()}

      {/* Goals from diagram.goals */}
      {goals.map((g, goalIdx) => {
        const gx = nx(g.x);
        const gy = ny(g.y);
        const isBig = g.type === "BIG";
        
        // Mini goals should be much larger and more visible
        const w = isBig 
          ? ((g.width ?? 15) / 100) * WIDTH || 120  // Big goal: 15% of width or 120px
          : ((g.width ?? 25) / 100) * WIDTH || 200;  // Mini goal: 25% of width or 200px (much larger)
        const height = isBig ? 16 : 18;  // Mini goals: 18px height (was 12px)
        const color = isBig ? "#e5e7eb" : "#22c55e";
        // Use stable key: prefer id, fallback to type+position+index
        const goalKey = g.id || `goal-${g.type}-${g.x}-${g.y}-${goalIdx}`;

        return (
          <rect
            key={goalKey}
            x={gx - w / 2}
            y={gy - height / 2}
            width={w}
            height={height}
            rx={4}
            ry={4}
            fill="none"
            stroke={color}
            strokeWidth={isBig ? 3 : 3}
          />
        );
      })}

      {/* Arrows */}
      {arrows.map((a, idx) => {
        // Use layoutPlayers to get adjusted positions (with team-based Y offsets)
        const fromLayoutPlayer = layoutPlayers.find((p) => p.id === a.from?.playerId);
        const toLayoutPlayer = layoutPlayers.find((p) => p.id === a.to?.playerId);

        if (!fromLayoutPlayer || !toLayoutPlayer) return null;
        
        // Use stable key for arrows
        const arrowKey = a.from?.playerId && a.to?.playerId 
          ? `arrow-${a.from.playerId}-${a.to.playerId}-${a.type ?? 'pass'}-${idx}`
          : `arrow-${idx}`;

        // Use the adjusted screen positions from layoutPlayers
        const x1 = fromLayoutPlayer.screenX;
        const y1 = fromLayoutPlayer.screenY;
        const x2 = toLayoutPlayer.screenX;
        const y2 = toLayoutPlayer.screenY;

        const color = arrowColor(a.type);
        const dash = arrowDash(a.style, a.type);

        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const arrowHead = 6;

        const ballOffset = 28;
        const ballX = x1 + ux * ballOffset;
        const ballY = y1 + uy * ballOffset;

        const endX = x2 - ux * 24;
        const endY = y2 - uy * 24;

        const leftX = endX - uy * arrowHead - ux * arrowHead;
        const leftY = endY + ux * arrowHead - uy * arrowHead;

        const rightX = endX + uy * arrowHead - ux * arrowHead;
        const rightY = endY - ux * arrowHead - uy * arrowHead;

        return (
          <g key={arrowKey}>
            <line
              x1={x1}
              y1={y1}
              x2={endX}
              y2={endY}
              stroke={color}
              strokeWidth={3}
              strokeDasharray={dash}
              strokeLinecap="round"
            />
            {idx === firstPassIdx && (
              <>
                <circle
                  cx={ballX}
                  cy={ballY}
                  r={6}
                  fill="#facc15"
                  stroke="#fefce8"
                  strokeWidth={2}
                />
                <line
                  x1={x2}
                  y1={y2}
                  x2={x2 + ux * 24}
                  y2={y2 + uy * 24}
                  stroke="#facc15"
                  strokeWidth={2}
                  strokeDasharray="4,6"
                  strokeLinecap="round"
                />
              </>
            )}
            <polygon
              points={`${endX},${endY} ${leftX},${leftY} ${rightX},${rightY}`}
              fill={color}
            />
          </g>
        );
      })}

      {/* Run indicators for attacking players */}
      {layoutPlayers
        .filter(p => {
          // Filter out invalid coordinates
          const isValid = p.team === "ATT" && 
            typeof p.screenX === 'number' && 
            typeof p.screenY === 'number' &&
            !isNaN(p.screenX) && 
            !isNaN(p.screenY) &&
            isFinite(p.screenX) &&
            isFinite(p.screenY);
          return isValid;
        })
        .map((p, idx) => {
          const runBackX = p.screenX - 40;
          const runBackY = p.screenY + 24;
          const runFrontX = p.screenX;
          const runFrontY = p.screenY;
          // Use stable key: prefer id, fallback to team+number+idx for uniqueness
          const stableKey = p.id || `run-att-${p.number ?? idx}-${idx}`;
          return (
            <line
              key={stableKey}
              x1={runBackX}
              y1={runBackY}
              x2={runFrontX}
              y2={runFrontY}
              stroke="#ffffff"
              strokeWidth={2}
              strokeDasharray="4,8"
              strokeLinecap="round"
            />
          );
        })}

      {/* Players */}
      {layoutPlayers.map((p, idx) => {
        const { fill, stroke } = teamColors(p.team);
        const x = p.screenX;
        const y = p.screenY;
        
        // Validate coordinates - skip rendering if invalid
        if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
          console.warn(`[DrillPitchDiagram] Skipping player ${idx} with invalid coordinates: x=${x}, y=${y}`, p);
          return null;
        }
        
        // Use stable key: prefer id, fallback to team+number+role+idx for uniqueness
        const stableKey = p.id || `player-${p.team}-${p.number ?? 'n'}-${p.role ?? 'r'}-${idx}`;

        return (
          <g key={stableKey}>
            <circle
              cx={x}
              cy={y}
              r={20}
              fill="#020617"
              stroke="#020617"
              strokeWidth={6}
            />
            <circle
              cx={x}
              cy={y}
              r={18}
              fill={fill}
              stroke={stroke}
              strokeWidth={2}
            />
            <text
              x={x}
              y={y + 5}
              textAnchor="middle"
              fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
              fontSize={11}
              fontWeight={600}
              fill="#0f172a"
            >
              {normalizeRoleToPosition(p.role)}
            </text>
          </g>
        );
      })}

      {/* Coach marker */}
      {coach && (
        <g>
          <rect
            x={nx(coach.x) - 10}
            y={ny(coach.y) - 10}
            width={20}
            height={20}
            rx={4}
            ry={4}
            fill="#f97316"
            stroke="#020617"
            strokeWidth={2}
          />
          <text
            x={nx(coach.x)}
            y={ny(coach.y) + 28}
            textAnchor="middle"
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
            fontSize={10}
            fill="#e5e7eb"
          >
            Coach
          </text>
        </g>
      )}
    </svg>
  );
}

export default DrillPitchDiagram;
