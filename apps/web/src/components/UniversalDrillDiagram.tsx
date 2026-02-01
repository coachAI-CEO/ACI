"use client";

import React from "react";

/** Goal as expected by the universal diagram (optional in ACI; adapter can pass []). */
export interface UniversalDrillGoal {
  id: string;
  x: number;
  y: number;
  width?: number;
  type?: "BIG" | string;
}

/** Arrow/line showing passes, movements, or pressing */
export interface UniversalDrillArrow {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  type: "pass" | "movement" | "press" | "run";
  color?: string;
  label?: string;
}

/** Text annotation on the field */
export interface UniversalDrillAnnotation {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  fontWeight?: string;
}

/** Player shape for the universal diagram (matches ACI DiagramPlayer for id, number, team, role, x, y). */
export interface UniversalDrillPlayer {
  id: string;
  number?: number;
  team: "ATT" | "DEF" | string;
  role?: string;
  x: number;
  y: number;
}

export interface UniversalDrillDiagramInner {
  goals?: UniversalDrillGoal[];
  players?: UniversalDrillPlayer[];
  pitch?: Record<string, unknown>;
  arrows?: UniversalDrillArrow[];
  annotations?: UniversalDrillAnnotation[];
}

export interface UniversalDrillDataJson {
  description?: string;
  organization?: {
    area?: { widthYards?: number; lengthYards?: number; notes?: string };
    setupSteps?: string[];
  };
}

export interface UniversalDrillData {
  title: string;
  diagram: UniversalDrillDiagramInner;
  json?: UniversalDrillDataJson;
  spaceConstraint?: "HALF" | "FULL" | "THIRD" | string;
  numbersMin?: number;
  numbersMax?: number;
}

export type UniversalDrillDiagramProps = {
  drillData: UniversalDrillData;
  size?: "small" | "large";
};

/** Zone configuration for automatic detection */
interface ZoneConfig {
  name: string;
  keywords: string[];
  color: string;
  borderColor: string;
  label: string;
  pattern?: "diagonal";
  defaultPos?: { yStart: number; yEnd: number; xStart?: number; xEnd?: number };
  multiple?: boolean;
  positions?: Array<{ yStart?: number; yEnd?: number; xStart?: number; xEnd?: number }>;
  horizontal?: boolean;
}

interface DetectedZone extends ZoneConfig {
  yStart?: number;
  yEnd?: number;
  xStart?: number;
  xEnd?: number;
}

/**
 * Universal Drill Diagram Component - Enhanced with Zone Detection
 * Renders any drill JSON in either small preview or large detailed format.
 * Supports all formats from 1v1 to 11v11.
 * Automatically detects and renders 11+ zone types.
 */
const UniversalDrillDiagram = ({
  drillData,
  size = "large",
}: UniversalDrillDiagramProps) => {
  const isSmall = size === "small";

  const { title, diagram, json, spaceConstraint } = drillData;
  const { goals = [], players = [], pitch = {}, arrows = [], annotations = [] } = diagram || {};
  const pitchOrientation = (pitch as { orientation?: string }).orientation;
  const isHalfPitch = spaceConstraint === "HALF";

  // ============================================================================
  // MEASUREMENT-BASED RENDERING
  // ============================================================================
  
  // Get actual dimensions from JSON
  const widthYards = json?.organization?.area?.widthYards;
  const lengthYards = json?.organization?.area?.lengthYards;
  
  // Detect field location context from setup steps
  const detectFieldLocation = () => {
    if (!json?.organization?.setupSteps) return null;
    
    const setupText = json.organization.setupSteps.join(' ').toLowerCase();
    
    if (setupText.includes('attacking third') || setupText.includes('final third')) {
      return { zone: 'Attacking Third', position: 'top' };
    }
    if (setupText.includes('middle third') || setupText.includes('center of the field')) {
      return { zone: 'Middle Third', position: 'middle' };
    }
    if (setupText.includes('defensive third') || setupText.includes('back third')) {
      return { zone: 'Defensive Third', position: 'bottom' };
    }
    if (setupText.includes('halfway line') || setupText.includes('center circle')) {
      return { zone: 'Halfway Line', position: 'middle' };
    }
    
    return null;
  };
  
  const fieldLocation = detectFieldLocation();
  
  // Determine if we should show field context
  // Show context for QUARTER drills or when location is explicitly mentioned
  const showFieldContext = (pitch as any)?.variant === "QUARTER" && fieldLocation !== null;
  
  // Calculate aspect ratio from actual measurements
  let aspectRatio = 1.53; // Default ratio (520/340 ≈ 1.53)
  let displayWidth = "Unknown";
  let displayLength = "Unknown";
  
  if (widthYards && lengthYards) {
    // Actual field aspect ratio
    aspectRatio = lengthYards / widthYards;
    displayWidth = `${widthYards}`;
    displayLength = `${lengthYards}`;
  }
  
  // Calculate container dimensions based on aspect ratio
  const baseHeight = isSmall ? 210 : 340;
  const pitchHeight = baseHeight;
  const pitchWidth = Math.round(pitchHeight * aspectRatio);
  const containerWidth = isSmall ? "auto" : Math.max(600, pitchWidth + 80);

  // Note: scaleX and scaleY will be defined later after viewport calculation

  // ============================================================================
  // ZONE DETECTION SYSTEM
  // ============================================================================
  
  const detectZones = (jsonData?: UniversalDrillDataJson): DetectedZone[] => {
    const zones: DetectedZone[] = [];
    if (!jsonData) return zones;

    // Combine all text sources
    const textSources = [
      jsonData.description || "",
      ...(jsonData.organization?.setupSteps || []),
      jsonData.organization?.area?.notes || "",
    ]
      .join(" ")
      .toLowerCase();

    // Zone configurations
    const zoneConfigs: ZoneConfig[] = [
      {
        name: "SECURITY_ZONE",
        keywords: ["security zone", "safety zone", "rest defense"],
        color: "rgba(255, 193, 7, 0.08)",
        borderColor: "rgba(255, 193, 7, 0.7)",
        label: "SECURITY ZONE",
        defaultPos: { yStart: 75, yEnd: 98 },
      },
      {
        name: "CENTRAL_ZONE",
        keywords: ["central zone", "possession zone", "middle zone", "central area"],
        color: "rgba(59, 130, 246, 0.08)",
        borderColor: "rgba(59, 130, 246, 0.5)",
        label: "CENTRAL ZONE",
        defaultPos: { yStart: 40, yEnd: 60 },
      },
      {
        name: "ATTACKING_THIRD",
        keywords: ["attacking third", "final third", "offensive third"],
        color: "rgba(239, 68, 68, 0.06)",
        borderColor: "rgba(239, 68, 68, 0.5)",
        label: "ATTACKING THIRD",
        multiple: true,
        positions: [
          { yStart: 0, yEnd: 33.33 },
          { yStart: 66.67, yEnd: 100 },
        ],
      },
      {
        name: "PRESSING_ZONE",
        keywords: ["pressing zone", "press zone", "high press zone", "trigger zone"],
        color: "rgba(239, 68, 68, 0.08)",
        borderColor: "rgba(239, 68, 68, 0.6)",
        label: "PRESSING ZONE",
        defaultPos: { yStart: 0, yEnd: 33.33 },
      },
      {
        name: "BUILD_UP_ZONE",
        keywords: ["build-up zone", "buildup zone", "build up zone"],
        color: "rgba(34, 197, 94, 0.08)",
        borderColor: "rgba(34, 197, 94, 0.5)",
        label: "BUILD-UP ZONE",
        defaultPos: { yStart: 66.67, yEnd: 100 },
      },
      {
        name: "DEFENSIVE_THIRD",
        keywords: ["defensive third", "defending third", "back third"],
        color: "rgba(59, 130, 246, 0.06)",
        borderColor: "rgba(59, 130, 246, 0.4)",
        label: "DEFENSIVE THIRD",
        defaultPos: { yStart: 66.67, yEnd: 100 },
      },
      {
        name: "MIDDLE_THIRD",
        keywords: ["middle third", "midfield third", "center third"],
        color: "rgba(168, 85, 247, 0.06)",
        borderColor: "rgba(168, 85, 247, 0.4)",
        label: "MIDDLE THIRD",
        defaultPos: { yStart: 33.33, yEnd: 66.67 },
      },
      {
        name: "NO_GO_ZONE",
        keywords: ["no-go zone", "restricted zone", "forbidden zone", "off-limits"],
        color: "rgba(239, 68, 68, 0.12)",
        borderColor: "rgba(239, 68, 68, 0.8)",
        label: "NO-GO ZONE",
        pattern: "diagonal",
        defaultPos: { yStart: 40, yEnd: 60 },
      },
      {
        name: "TARGET_ZONE",
        keywords: ["target zone", "scoring zone", "finish zone", "goal zone"],
        color: "rgba(34, 197, 94, 0.1)",
        borderColor: "rgba(34, 197, 94, 0.7)",
        label: "TARGET ZONE",
        defaultPos: { yStart: 0, yEnd: 18 },
      },
      {
        name: "TRANSITION_ZONE",
        keywords: ["transition zone", "counter-attack zone", "turnover zone"],
        color: "rgba(249, 115, 22, 0.08)",
        borderColor: "rgba(249, 115, 22, 0.6)",
        label: "TRANSITION ZONE",
        defaultPos: { yStart: 33.33, yEnd: 66.67 },
      },
      {
        name: "CHANNEL_ZONE",
        keywords: ["channel", "wide zone", "wing zone", "flank"],
        color: "rgba(168, 85, 247, 0.06)",
        borderColor: "rgba(168, 85, 247, 0.5)",
        label: "CHANNEL",
        multiple: true,
        horizontal: true,
        positions: [
          { xStart: 0, xEnd: 20 },
          { xStart: 80, xEnd: 100 },
        ],
      },
    ];

    // Detect zones
    zoneConfigs.forEach((config) => {
      const found = config.keywords.some((kw) => textSources.includes(kw));
      if (found) {
        if (config.multiple && config.positions) {
          config.positions.forEach((pos) => {
            zones.push({
              ...config,
              ...pos,
            });
          });
        } else if (config.defaultPos) {
          zones.push({
            ...config,
            ...config.defaultPos,
          });
        }
      }
    });

    return zones;
  };

  const detectedZones = detectZones(json);

  // ============================================================================
  // ORIENTATION DETECTION
  // ============================================================================

  // ============================================================================
  // SMART ORIENTATION DETECTION
  // ============================================================================
  
  // 1. Check goals first (most reliable indicator)
  const goalsIndicateHorizontal = goals.length > 0 && (() => {
    const leftGoals = goals.filter(g => g.x < 20);
    const rightGoals = goals.filter(g => g.x > 80);
    const topGoals = goals.filter(g => g.y < 20);
    const bottomGoals = goals.filter(g => g.y > 80);
    
    // If goals are clearly on left/right (x-axis), it's horizontal
    if ((leftGoals.length > 0 || rightGoals.length > 0) && topGoals.length === 0 && bottomGoals.length === 0) {
      return true;
    }
    // If goals are clearly on top/bottom (y-axis), it's vertical
    if ((topGoals.length > 0 || bottomGoals.length > 0) && leftGoals.length === 0 && rightGoals.length === 0) {
      return false;
    }
    return null; // Inconclusive
  })();
  
  // 2. Infer from player spread (if goals inconclusive)
  const inferHorizontal =
    players.length >= 2 &&
    (() => {
      const xs = players.map((p) => p.x);
      const ys = players.map((p) => p.y);
      const rangeX = Math.max(...xs) - Math.min(...xs);
      const rangeY = Math.max(...ys) - Math.min(...ys);
      return rangeX > rangeY;
    })();
  
  // 3. Final determination: goals override JSON, then player spread, then JSON
  const isHorizontal = 
    goalsIndicateHorizontal !== null 
      ? goalsIndicateHorizontal  // Trust goals first
      : pitchOrientation === "HORIZONTAL" 
        ? inferHorizontal  // If JSON says horizontal, verify with player spread
        : pitchOrientation == null && inferHorizontal;  // No orientation, use inference

  // Always draw pitch vertically (goals top/bottom); #1 (GK) at bottom, others in front (up)
  const drawVertical = true;
  const dataIsHorizontalButDrawVertical = isHorizontal;

  // When vertical data: if GK (#1 or role GK) has low y, flip Y so GK goes to bottom
  const gkPlayer = players.find((p) => p.number === 1 || p.role === "GK");
  const flipVerticalY =
    !dataIsHorizontalButDrawVertical &&
    players.length > 0 &&
    (gkPlayer ? gkPlayer.y < 50 : false);

  // Horizontal data: low x = our goal (GK) → bottom; vertical data: flip Y when GK is in top half so GK → bottom
  const toScreenX = (dataX: number, dataY: number) =>
    dataIsHorizontalButDrawVertical ? scaleX(dataY) : scaleX(dataX);
  const toScreenY = (dataX: number, dataY: number) =>
    dataIsHorizontalButDrawVertical
      ? scaleY(100 - dataX)
      : flipVerticalY
        ? scaleY(100 - dataY)
        : scaleY(dataY);

  // When ACI/adapter passes no goals, infer default goals; use vertical layout when drawVertical
  const displayGoals: UniversalDrillGoal[] =
    goals.length > 0
      ? goals
      : drawVertical
        ? isHalfPitch
          ? [{ id: "goal-bottom", x: 50, y: 95, type: "BIG" }]
          : [
              { id: "goal-top", x: 50, y: 5, type: "BIG" },
              { id: "goal-bottom", x: 50, y: 95, type: "BIG" },
            ]
        : isHalfPitch
          ? [{ id: "goal-left", x: 5, y: 50, type: "BIG" }]
          : [
              { id: "goal-left", x: 5, y: 50, type: "BIG" },
              { id: "goal-right", x: 95, y: 50, type: "BIG" },
            ];

  const totalPlayers = players.length;
  const attackPlayers = players.filter((p) => p.team === "ATT");
  const defendPlayers = players.filter((p) => p.team === "DEF");

  // ============================================================================
  // DYNAMIC VIEWPORT - Calculate bounding box of active area
  // ============================================================================
  
  const calculateViewport = () => {
    if (players.length === 0) {
      return { minX: 0, maxX: 100, minY: 0, maxY: 100, useCrop: false };
    }
    
    // Determine if this is a full-team game (90%+ of full squad)
    const maxPlayersPerSide = Math.max(attackPlayers.length, defendPlayers.length);
    const isFullTeamGame = maxPlayersPerSide >= 10 || // 11v11 or close (10+)
                          (maxPlayersPerSide >= 9 && hasTopGoal && hasBottomGoal); // 9v9+ with both goals
    
    // For full-team games with goals at both ends, always show entire field
    if (isFullTeamGame && hasTopGoal && hasBottomGoal) {
      return { minX: 0, maxX: 100, minY: 0, maxY: 100, useCrop: false };
    }
    
    // Get player position ranges
    const xs = players.map(p => p.x);
    const ys = players.map(p => p.y);
    const minPlayerX = Math.min(...xs);
    const maxPlayerX = Math.max(...xs);
    const minPlayerY = Math.min(...ys);
    const maxPlayerY = Math.max(...ys);
    
    // Include goals if they exist
    let minX = minPlayerX;
    let maxX = maxPlayerX;
    let minY = minPlayerY;
    let maxY = maxPlayerY;
    
    if (goals.length > 0) {
      const goalXs = goals.map(g => g.x);
      const goalYs = goals.map(g => g.y);
      minX = Math.min(minPlayerX, ...goalXs);
      maxX = Math.max(maxPlayerX, ...goalXs);
      minY = Math.min(minPlayerY, ...goalYs);
      maxY = Math.max(maxPlayerY, ...goalYs);
    }
    
    // Calculate range
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    
    // Add padding (15% of range, minimum 10%)
    const paddingX = Math.max(rangeX * 0.15, 10);
    const paddingY = Math.max(rangeY * 0.15, 10);
    
    // Apply padding with bounds checking
    const viewMinX = Math.max(0, minX - paddingX);
    const viewMaxX = Math.min(100, maxX + paddingX);
    const viewMinY = Math.max(0, minY - paddingY);
    const viewMaxY = Math.min(100, maxY + paddingY);
    
    return { 
      minX: viewMinX, 
      maxX: viewMaxX, 
      minY: viewMinY, 
      maxY: viewMaxY,
      useCrop: true 
    };
  };
  
  const hasLeftGoal = !drawVertical && displayGoals.some((g) => g.x < 20);
  const hasRightGoal = !drawVertical && displayGoals.some((g) => g.x > 80);
  const hasTopGoal = drawVertical && displayGoals.some((g) => g.y < 10);
  const hasBottomGoal = drawVertical && displayGoals.some((g) => g.y > 90);
  
  const viewport = calculateViewport();
  
  // Create viewport-aware scale functions
  const viewportWidth = viewport.maxX - viewport.minX;
  const viewportHeight = viewport.maxY - viewport.minY;
  
  // Replace original scale functions with viewport-aware versions
  const scaleX = (percent: number) => {
    if (!viewport.useCrop) {
      return (percent / 100) * pitchWidth;
    }
    return ((percent - viewport.minX) / viewportWidth) * pitchWidth;
  };
  
  const scaleY = (percent: number) => {
    if (!viewport.useCrop) {
      return (percent / 100) * pitchHeight;
    }
    return ((percent - viewport.minY) / viewportHeight) * pitchHeight;
  };

  const getPlayerRadius = () => {
    if (isSmall) {
      if (totalPlayers <= 6) return 8;
      if (totalPlayers <= 12) return 7;
      if (totalPlayers <= 16) return 6;
      return 5;
    } else {
      if (totalPlayers <= 6) return 14;
      if (totalPlayers <= 12) return 12;
      if (totalPlayers <= 16) return 11;
      return 10;
    }
  };

  const getGKRadius = () => {
    const baseRadius = getPlayerRadius();
    return isSmall ? baseRadius : baseRadius + 2;
  };

  const getFontSize = () => {
    if (isSmall) {
      if (totalPlayers <= 12) return 7;
      return 6;
    } else {
      if (totalPlayers <= 12) return 10;
      return 9;
    }
  };

  const isFullPitch = drawVertical ? hasTopGoal && hasBottomGoal : hasLeftGoal && hasRightGoal;

  const fieldWidth = json?.organization?.area?.widthYards ?? 60;
  const fieldLength = json?.organization?.area?.lengthYards ?? 50;

  const playerRadius = getPlayerRadius();
  const gkRadius = getGKRadius();
  const fontSize = getFontSize();

  return (
    <div
      style={{
        width: isSmall ? "auto" : `${containerWidth}px`,
        padding: isSmall ? "12px" : "32px",
        background: isSmall ? "#1a2332" : "#0a1628",
        borderRadius: isSmall ? "8px" : "16px",
        display: isSmall ? "inline-block" : "block",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxShadow: isSmall ? "none" : "0 4px 20px rgba(0, 0, 0, 0.5)",
      }}
    >
      {isSmall ? (
        <div
          style={{
            marginBottom: "8px",
            color: "#e2e8f0",
            fontSize: "11px",
            fontWeight: "600",
          }}
        >
          Diagram
        </div>
      ) : (
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              fontSize: "11px",
              letterSpacing: "1.5px",
              color: "#10b981",
              fontWeight: "700",
              marginBottom: "8px",
              textTransform: "uppercase",
            }}
          >
            TACTICAL DIAGRAM
          </div>
          <h2
            style={{
              margin: "0",
              fontSize: "22px",
              fontWeight: "600",
              color: "#f8fafc",
              lineHeight: "1.3",
            }}
          >
            {title}
          </h2>
          <div
            style={{
              fontSize: "12px",
              color: "#64748b",
              marginTop: "4px",
            }}
          >
            {attackPlayers.length}v{defendPlayers.length}
            {widthYards && lengthYards && (
              <> • {displayLength}x{displayWidth} yards</>
            )}
            {fieldLocation && (
              <> • {fieldLocation.zone}</>
            )}
            {viewport.useCrop && <> • Cropped</>}
          </div>
        </div>
      )}

      <svg
        width={pitchWidth}
        height={pitchHeight}
        style={{
          borderRadius: isSmall ? "4px" : "8px",
          overflow: "hidden",
          display: "block",
          marginBottom: isSmall ? "8px" : "20px",
        }}
      >
        <defs>
          <linearGradient
            id={`pitchGrad-${size}`}
            x1={drawVertical ? "0%" : "0%"}
            y1={drawVertical ? "0%" : "0%"}
            x2={drawVertical ? "0%" : "100%"}
            y2={drawVertical ? "100%" : "0%"}
          >
            <stop offset="0%" style={{ stopColor: "#1e4d3a", stopOpacity: 1 }} />
            <stop offset="50%" style={{ stopColor: "#265c45", stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: "#1e4d3a", stopOpacity: 1 }} />
          </linearGradient>
          
          {/* Arrowhead markers for different arrow types */}
          <marker
            id="arrowhead-pass"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon
              points="0 0, 10 3, 0 6"
              fill="rgba(255, 255, 255, 0.8)"
            />
          </marker>
          
          <marker
            id="arrowhead-movement"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon
              points="0 0, 8 3, 0 6"
              fill="rgba(255, 255, 255, 0.6)"
            />
          </marker>
          
          <marker
            id="arrowhead-press"
            markerWidth="12"
            markerHeight="12"
            refX="10"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon
              points="0 0, 12 3, 0 6"
              fill="rgba(239, 68, 68, 0.9)"
            />
          </marker>
          
          <marker
            id="arrowhead-dribble"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon
              points="0 0, 10 3, 0 6"
              fill="rgba(251, 191, 36, 0.8)"
            />
          </marker>
          
          {/* Diagonal pattern for restricted zones */}
          {detectedZones
            .filter((z) => z.pattern === "diagonal")
            .map((zone, idx) => (
              <pattern
                key={`diag-${idx}`}
                id={`diag-${idx}`}
                patternUnits="userSpaceOnUse"
                width={8}
                height={8}
              >
                <path
                  d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4"
                  stroke={zone.borderColor}
                  strokeWidth={1}
                />
              </pattern>
            ))}
        </defs>

        <rect
          x={0}
          y={0}
          width={pitchWidth}
          height={pitchHeight}
          fill={`url(#pitchGrad-${size})`}
        />

        {/* Grass stripes - direction based on orientation */}
        {drawVertical
          ? [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <rect
                key={`stripe-${i}`}
                x={i * (pitchWidth / 8)}
                y={0}
                width={pitchWidth / 8}
                height={pitchHeight}
                fill={
                  i % 2 === 0
                    ? "rgba(0, 0, 0, 0.08)"
                    : "rgba(255, 255, 255, 0.03)"
                }
              />
            ))
          : [0, 1, 2, 3, 4, 5, 6].map((i) => (
              <rect
                key={`stripe-${i}`}
                x={0}
                y={i * (pitchHeight / 7)}
                width={pitchWidth}
                height={pitchHeight / 7}
                fill={
                  i % 2 === 0
                    ? "rgba(0, 0, 0, 0.08)"
                    : "rgba(255, 255, 255, 0.03)"
                }
              />
            ))}

        {/* Field Context Overlay - Show drill location on full field */}
        {showFieldContext && fieldLocation && !isSmall && (
          <g opacity="0.3">
            {/* Faded full field outline - very subtle */}
            <rect
              x={pitchWidth * 0.05}
              y={pitchHeight * 0.03}
              width={pitchWidth * 0.9}
              height={pitchHeight * 0.94}
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="1"
              strokeDasharray="6,3"
            />
            
            {/* Third lines - very faint */}
            <line
              x1={pitchWidth * 0.05}
              y1={pitchHeight * 0.35}
              x2={pitchWidth * 0.95}
              y2={pitchHeight * 0.35}
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="0.5"
              strokeDasharray="3,2"
            />
            <line
              x1={pitchWidth * 0.05}
              y1={pitchHeight * 0.67}
              x2={pitchWidth * 0.95}
              y2={pitchHeight * 0.67}
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="0.5"
              strokeDasharray="3,2"
            />
            
            {/* Small zone label in corner */}
            <text
              x={pitchWidth * 0.08}
              y={pitchHeight * 0.08}
              textAnchor="start"
              fill="rgba(59, 130, 246, 0.4)"
              fontSize="9"
              fontWeight="600"
            >
              📍 {fieldLocation.zone}
            </text>
          </g>
        )}

        {/* Channel divider lines - only for larger games on vertical fields */}
        {drawVertical &&
          totalPlayers > 10 &&
          [0.2, 0.4, 0.6, 0.8].map((pos, idx) => (
            <line
              key={`channel-${idx}`}
              x1={pitchWidth * pos}
              y1={isSmall ? 8 : 15}
              x2={pitchWidth * pos}
              y2={pitchHeight - (isSmall ? 8 : 15)}
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth={isSmall ? 0.5 : 1}
              strokeDasharray={isSmall ? "2,2" : "4,4"}
            />
          ))}

        {/* Pitch boundary - adjusted for viewport */}
        <rect 
          x={isSmall ? 8 : 15} 
          y={isSmall ? 8 : 15} 
          width={pitchWidth - (isSmall ? 16 : 30)} 
          height={pitchHeight - (isSmall ? 16 : 30)} 
          fill="none" 
          stroke="rgba(255, 255, 255, 0.7)" 
          strokeWidth={isSmall ? 2 : 2.5}
        />

        {/* Halfway line and center circle - orientation dependent */}
        {drawVertical ? (
          <>
            {isHalfPitch && !isFullPitch ? (
              <>
                <line
                  x1={isSmall ? 8 : 15}
                  y1={isSmall ? 38 : 60}
                  x2={pitchWidth - (isSmall ? 8 : 15)}
                  y2={isSmall ? 38 : 60}
                  stroke="rgba(255, 255, 255, 0.7)"
                  strokeWidth={isSmall ? 2 : 2.5}
                />
                {totalPlayers > 6 && (
                  <>
                    <circle
                      cx={scaleX(50)}
                      cy={isSmall ? 38 : 60}
                      r={isSmall ? 28 : 50}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.7)"
                      strokeWidth={isSmall ? 2 : 2.5}
                    />
                    <circle
                      cx={scaleX(50)}
                      cy={isSmall ? 38 : 60}
                      r={isSmall ? 2 : 3}
                      fill="rgba(255, 255, 255, 0.8)"
                    />
                  </>
                )}
              </>
            ) : (
              <>
                <line
                  x1={isSmall ? 8 : 15}
                  y1={scaleY(50)}
                  x2={pitchWidth - (isSmall ? 8 : 15)}
                  y2={scaleY(50)}
                  stroke="rgba(255, 255, 255, 0.7)"
                  strokeWidth={isSmall ? 2 : 2.5}
                />
                {totalPlayers > 6 && (
                  <>
                    <circle
                      cx={scaleX(50)}
                      cy={scaleY(50)}
                      r={isSmall ? 28 : 50}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.7)"
                      strokeWidth={isSmall ? 2 : 2.5}
                    />
                    <circle
                      cx={scaleX(50)}
                      cy={scaleY(50)}
                      r={isSmall ? 2 : 3}
                      fill="rgba(255, 255, 255, 0.8)"
                    />
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <line
              x1={scaleX(50)}
              y1={isSmall ? 8 : 15}
              x2={scaleX(50)}
              y2={pitchHeight - (isSmall ? 8 : 15)}
              stroke="rgba(255, 255, 255, 0.7)"
              strokeWidth={isSmall ? 2 : 2.5}
            />
            {totalPlayers > 6 && (
              <>
                <circle
                  cx={scaleX(50)}
                  cy={scaleY(50)}
                  r={isSmall ? 28 : 50}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.7)"
                  strokeWidth={isSmall ? 2 : 2.5}
                />
                <circle
                  cx={scaleX(50)}
                  cy={scaleY(50)}
                  r={isSmall ? 2 : 3}
                  fill="rgba(255, 255, 255, 0.8)"
                />
              </>
            )}
          </>
        )}

        {/* ============================================================================ */}
        {/* DETECTED ZONES - AUTOMATICALLY RENDERED */}
        {/* ============================================================================ */}
        {!isSmall &&
          detectedZones.map((zone, idx) => {
            // Horizontal zones on vertical field (most common)
            if (drawVertical && !zone.horizontal) {
              return (
                <g key={`zone-${idx}`}>
                  <rect
                    x={15}
                    y={scaleY(zone.yStart ?? 0)}
                    width={pitchWidth - 30}
                    height={scaleY((zone.yEnd ?? 100) - (zone.yStart ?? 0))}
                    fill={zone.pattern === "diagonal" ? `url(#diag-${idx})` : zone.color}
                    stroke="none"
                  />
                  <line
                    x1={15}
                    y1={scaleY(zone.yStart ?? 0)}
                    x2={pitchWidth - 15}
                    y2={scaleY(zone.yStart ?? 0)}
                    stroke={zone.borderColor}
                    strokeWidth={2}
                    strokeDasharray="8,4"
                  />
                  <line
                    x1={15}
                    y1={scaleY(zone.yEnd ?? 100)}
                    x2={pitchWidth - 15}
                    y2={scaleY(zone.yEnd ?? 100)}
                    stroke={zone.borderColor}
                    strokeWidth={2}
                    strokeDasharray="8,4"
                  />
                  {zone.label && (
                    <text
                      x={scaleX(50)}
                      y={scaleY(((zone.yStart ?? 0) + (zone.yEnd ?? 100)) / 2)}
                      textAnchor="middle"
                      fill={zone.borderColor.replace(/0\.\d+/, "0.8")}
                      fontSize={11}
                      fontWeight={700}
                      letterSpacing="1px"
                    >
                      {zone.label}
                    </text>
                  )}
                </g>
              );
            }
            // Vertical zones (channels) on vertical field
            else if (drawVertical && zone.horizontal) {
              return (
                <g key={`zone-${idx}`}>
                  <rect
                    x={scaleX(zone.xStart ?? 0)}
                    y={15}
                    width={scaleX((zone.xEnd ?? 100) - (zone.xStart ?? 0))}
                    height={pitchHeight - 30}
                    fill={zone.color}
                    stroke="none"
                  />
                  <line
                    x1={scaleX(zone.xStart ?? 0)}
                    y1={15}
                    x2={scaleX(zone.xStart ?? 0)}
                    y2={pitchHeight - 15}
                    stroke={zone.borderColor}
                    strokeWidth={2}
                    strokeDasharray="8,4"
                  />
                  <line
                    x1={scaleX(zone.xEnd ?? 100)}
                    y1={15}
                    x2={scaleX(zone.xEnd ?? 100)}
                    y2={pitchHeight - 15}
                    stroke={zone.borderColor}
                    strokeWidth={2}
                    strokeDasharray="8,4"
                  />
                </g>
              );
            }
            return null;
          })}

        {/* Penalty boxes - orientation dependent */}
        {totalPlayers > 4 && (
          <>
            {drawVertical ? (
              <>
                {(hasBottomGoal || isHalfPitch) && (
                  <>
                    <rect
                      x={scaleX(50) - (isSmall ? 50 : 95)}
                      y={pitchHeight - (isSmall ? 60 : 115)}
                      width={isSmall ? 100 : 190}
                      height={isSmall ? 52 : 100}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.6)"
                      strokeWidth={isSmall ? 1.5 : 2}
                    />
                    <rect
                      x={scaleX(50) - (isSmall ? 25 : 48)}
                      y={pitchHeight - (isSmall ? 29 : 55)}
                      width={isSmall ? 50 : 96}
                      height={isSmall ? 21 : 40}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.6)"
                      strokeWidth={isSmall ? 1.5 : 2}
                    />
                    {totalPlayers > 10 && (
                      <circle
                        cx={scaleX(50)}
                        cy={pitchHeight - (isSmall ? 42 : 80)}
                        r={isSmall ? 2 : 3}
                        fill="rgba(255, 255, 255, 0.7)"
                      />
                    )}
                  </>
                )}
                {hasTopGoal && (
                  <>
                    <rect
                      x={scaleX(50) - (isSmall ? 50 : 95)}
                      y={isSmall ? 8 : 15}
                      width={isSmall ? 100 : 190}
                      height={isSmall ? 52 : 100}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.6)"
                      strokeWidth={isSmall ? 1.5 : 2}
                    />
                    <rect
                      x={scaleX(50) - (isSmall ? 25 : 48)}
                      y={isSmall ? 8 : 15}
                      width={isSmall ? 50 : 96}
                      height={isSmall ? 21 : 40}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.6)"
                      strokeWidth={isSmall ? 1.5 : 2}
                    />
                    {totalPlayers > 10 && (
                      <circle
                        cx={scaleX(50)}
                        cy={isSmall ? 42 : 80}
                        r={isSmall ? 2 : 3}
                        fill="rgba(255, 255, 255, 0.7)"
                      />
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                {hasLeftGoal && (
                  <>
                    <rect
                      x={isSmall ? 8 : 15}
                      y={scaleY(50) - (isSmall ? 50 : 95)}
                      width={isSmall ? 52 : 100}
                      height={isSmall ? 100 : 190}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.6)"
                      strokeWidth={isSmall ? 1.5 : 2}
                    />
                    <rect
                      x={isSmall ? 8 : 15}
                      y={scaleY(50) - (isSmall ? 25 : 48)}
                      width={isSmall ? 21 : 40}
                      height={isSmall ? 50 : 96}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.6)"
                      strokeWidth={isSmall ? 1.5 : 2}
                    />
                    {totalPlayers > 10 && (
                      <circle
                        cx={isSmall ? 42 : 80}
                        cy={scaleY(50)}
                        r={isSmall ? 2 : 3}
                        fill="rgba(255, 255, 255, 0.7)"
                      />
                    )}
                  </>
                )}
                {hasRightGoal && (
                  <>
                    <rect
                      x={pitchWidth - (isSmall ? 60 : 115)}
                      y={scaleY(50) - (isSmall ? 50 : 95)}
                      width={isSmall ? 52 : 100}
                      height={isSmall ? 100 : 190}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.6)"
                      strokeWidth={isSmall ? 1.5 : 2}
                    />
                    <rect
                      x={pitchWidth - (isSmall ? 29 : 55)}
                      y={scaleY(50) - (isSmall ? 25 : 48)}
                      width={isSmall ? 21 : 40}
                      height={isSmall ? 50 : 96}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.6)"
                      strokeWidth={isSmall ? 1.5 : 2}
                    />
                    {totalPlayers > 10 && (
                      <circle
                        cx={pitchWidth - (isSmall ? 42 : 80)}
                        cy={scaleY(50)}
                        r={isSmall ? 2 : 3}
                        fill="rgba(255, 255, 255, 0.7)"
                      />
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* Goals - orientation dependent */}
        {displayGoals.map((goal, idx) => {
          const gWidth = scaleX(goal.width ?? (totalPlayers > 10 ? 8 : 4));

          if (drawVertical) {
            const gx = toScreenX(goal.x, goal.y);
            const gy = toScreenY(goal.x, goal.y);

            if (goal.type === "BIG") {
              return (
                <g key={goal.id ?? idx}>
                  <rect
                    x={gx - gWidth / 2}
                    y={gy - (isSmall ? 2 : 4)}
                    width={gWidth}
                    height={isSmall ? 10 : 20}
                    fill="rgba(200, 200, 200, 0.1)"
                    stroke="none"
                  />
                  <rect
                    x={gx - gWidth / 2}
                    y={gy - (isSmall ? 2 : 4)}
                    width={gWidth}
                    height={isSmall ? 10 : 20}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.75)"
                    strokeWidth={2}
                  />
                </g>
              );
            } else {
              return (
                <rect
                  key={goal.id ?? idx}
                  x={gx - gWidth / 2}
                  y={gy - (isSmall ? 6 : 12)}
                  width={gWidth}
                  height={isSmall ? 12 : 24}
                  fill="#ff8c42"
                  stroke="none"
                  rx={2}
                />
              );
            }
          } else {
            const gx = toScreenX(goal.x, goal.y);
            const gy = toScreenY(goal.x, goal.y);
            const gHeight = scaleY(goal.width ?? 8);

            if (goal.type === "BIG") {
              return (
                <g key={goal.id ?? idx}>
                  <rect
                    x={gx - (isSmall ? 5 : 10)}
                    y={gy - gHeight / 2}
                    width={isSmall ? 10 : 20}
                    height={gHeight}
                    fill="rgba(200, 200, 200, 0.1)"
                    stroke="none"
                  />
                  <rect
                    x={gx - (isSmall ? 5 : 10)}
                    y={gy - gHeight / 2}
                    width={isSmall ? 10 : 20}
                    height={gHeight}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.75)"
                    strokeWidth={isSmall ? 2 : 2.5}
                  />
                </g>
              );
            } else {
              return (
                <rect
                  key={goal.id ?? idx}
                  x={gx - (isSmall ? 6 : 12)}
                  y={gy - gHeight / 2}
                  width={isSmall ? 12 : 24}
                  height={gHeight}
                  fill="#ff8c42"
                  stroke="none"
                  rx={2}
                />
              );
            }
          }
        })}

        {!isSmall &&
          totalPlayers > 6 &&
          (() => {
            const passLines = players
              .filter((p) =>
                p.team === "ATT" && (isHorizontal ? p.x > 70 : p.y > 70)
              )
              .slice(0, 2)
              .map((player, idx) => {
                const nextPlayer = players.find(
                  (p) =>
                    p.team === "ATT" &&
                    (isHorizontal
                      ? p.x < player.x && p.x > 50
                      : p.y < player.y && p.y > 50)
                );
                if (nextPlayer) {
                  return (
                    <line
                      key={`pass-${idx}`}
                      x1={toScreenX(player.x, player.y)}
                      y1={toScreenY(player.x, player.y)}
                      x2={toScreenX(nextPlayer.x, nextPlayer.y)}
                      y2={toScreenY(nextPlayer.x, nextPlayer.y)}
                      stroke="rgba(255, 255, 255, 0.35)"
                      strokeWidth={1.5}
                    />
                  );
                }
                return null;
              });
            const pressLines = players
              .filter(
                (p) =>
                  p.team === "DEF" &&
                  (p.role?.includes("ST") || p.role?.includes("FW"))
              )
              .slice(0, 2)
              .map((player, idx) => {
                const target = players.find(
                  (p) =>
                    p.team === "ATT" &&
                    Math.abs(isHorizontal ? p.y - player.y : p.x - player.x) <
                      20 &&
                    (isHorizontal ? p.x > player.x : p.y > player.y)
                );
                if (target) {
                  return (
                    <line
                      key={`press-${idx}`}
                      x1={toScreenX(player.x, player.y)}
                      y1={toScreenY(player.x, player.y)}
                      x2={toScreenX(target.x, target.y)}
                      y2={toScreenY(target.x, target.y)}
                      stroke="rgba(255, 255, 255, 0.45)"
                      strokeWidth={2}
                    />
                  );
                }
                return null;
              });
            return (
              <>
                {passLines}
                {pressLines}
              </>
            );
          })()}

        {/* Custom Arrows - Passes, Movement, Pressing */}
        {arrows.map((arrow, idx) => {
          const x1 = toScreenX(arrow.from.x, arrow.from.y);
          const y1 = toScreenY(arrow.from.x, arrow.from.y);
          const x2 = toScreenX(arrow.to.x, arrow.to.y);
          const y2 = toScreenY(arrow.to.x, arrow.to.y);
          
          // Different styles based on arrow type
          const getArrowStyle = (type: string) => {
            switch (type) {
              case "pass":
                return {
                  stroke: arrow.color || "rgba(255, 255, 255, 0.8)",
                  strokeWidth: isSmall ? 1.2 : 1.8,
                  strokeDasharray: "none",
                  opacity: 0.85,
                  arrowSize: 8
                };
              case "movement":
              case "run":
                return {
                  stroke: arrow.color || "rgba(255, 255, 255, 0.5)",
                  strokeWidth: isSmall ? 1 : 1.5,
                  strokeDasharray: isSmall ? "3,2" : "4,3",
                  opacity: 0.6,
                  arrowSize: 7
                };
              case "press":
                return {
                  stroke: arrow.color || "rgba(239, 68, 68, 0.8)",
                  strokeWidth: isSmall ? 2 : 2.5,
                  strokeDasharray: "none",
                  opacity: 0.9,
                  arrowSize: 10
                };
              default:
                return {
                  stroke: arrow.color || "rgba(255, 255, 255, 0.6)",
                  strokeWidth: isSmall ? 1.2 : 1.8,
                  strokeDasharray: "none",
                  opacity: 0.7,
                  arrowSize: 8
                };
            }
          };
          
          const style = getArrowStyle(arrow.type || "pass");
          
          // Calculate arrowhead
          const dx = x2 - x1;
          const dy = y2 - y1;
          const angle = Math.atan2(dy, dx);
          const arrowSize = style.arrowSize;
          
          // Shorten the line so arrowhead sits at the end
          const lineLength = Math.sqrt(dx * dx + dy * dy);
          const shortenBy = arrowSize;
          const ratio = (lineLength - shortenBy) / lineLength;
          const x2Short = x1 + dx * ratio;
          const y2Short = y1 + dy * ratio;
          
          // Arrowhead points
          const arrowPoint1X = x2 - arrowSize * Math.cos(angle - Math.PI / 6);
          const arrowPoint1Y = y2 - arrowSize * Math.sin(angle - Math.PI / 6);
          const arrowPoint2X = x2 - arrowSize * Math.cos(angle + Math.PI / 6);
          const arrowPoint2Y = y2 - arrowSize * Math.sin(angle + Math.PI / 6);
          
          return (
            <g key={`arrow-${arrow.id || idx}`}>
              {/* Arrow line */}
              <line
                x1={x1}
                y1={y1}
                x2={x2Short}
                y2={y2Short}
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                strokeDasharray={style.strokeDasharray}
                opacity={style.opacity}
              />
              
              {/* Arrowhead triangle */}
              <polygon
                points={`${x2},${y2} ${arrowPoint1X},${arrowPoint1Y} ${arrowPoint2X},${arrowPoint2Y}`}
                fill={style.stroke}
                opacity={style.opacity}
              />
              
              {/* Arrow label (optional) - numbered circles for pass sequences */}
              {arrow.label && !isSmall && (
                <>
                  <circle
                    cx={(x1 + x2) / 2}
                    cy={(y1 + y2) / 2}
                    r={9}
                    fill="rgba(255, 255, 255, 0.95)"
                    stroke="#000"
                    strokeWidth="1.5"
                  />
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 + 3.5}
                    textAnchor="middle"
                    fill="#000"
                    fontSize="9"
                    fontWeight="bold"
                  >
                    {arrow.label}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Text Annotations on Field */}
        {annotations.map((annotation, idx) => {
          const ax = toScreenX(annotation.x, annotation.y);
          const ay = toScreenY(annotation.x, annotation.y);
          
          return (
            <g key={`annotation-${annotation.id || idx}`}>
              {/* Background box for readability (optional) */}
              {annotation.backgroundColor && (
                <rect
                  x={ax - 40}
                  y={ay - 10}
                  width={80}
                  height={20}
                  fill={annotation.backgroundColor}
                  opacity={0.8}
                  rx={3}
                />
              )}
              
              {/* Annotation text */}
              <text
                x={ax}
                y={ay + 4}
                textAnchor="middle"
                fill={annotation.color || "rgba(255, 255, 255, 0.9)"}
                fontSize={annotation.fontSize || (isSmall ? 8 : 11)}
                fontWeight={annotation.fontWeight || "700"}
                letterSpacing="0.5px"
              >
                {annotation.text}
              </text>
            </g>
          );
        })}

        {players.map((player, idx) => {
          const px = toScreenX(player.x, player.y);
          const py = toScreenY(player.x, player.y);
          const isGK = player.number === 1 || player.role === "GK";
          const radius = isGK ? gkRadius : playerRadius;
          
          // Get team color - supports ATT, DEF, NEUTRAL, and custom teams
          const getTeamColor = (team: string) => {
            const colorMap: Record<string, string> = {
              'ATT': '#3b82f6',      // Blue
              'DEF': '#dc2626',      // Red
              'NEUTRAL': '#fbbf24',  // Yellow/Amber
              'NEUT': '#fbbf24',     // Yellow/Amber (alternate)
            };
            return colorMap[team] || '#94a3b8'; // Default gray for unknown teams
          };
          
          const teamColor = getTeamColor(player.team);
          
          // Mirror roles for team attacking downward (DEF team)
          // This ensures RW/LW, RB/LB are shown correctly from their attacking perspective
          const getMirroredRole = (role: string | undefined, team: string) => {
            if (!role) return "";
            
            // Determine which team attacks downward
            // In vertical orientation, check if team's GK is at top (y < 50)
            const teamGK = players.find(p => p.team === team && (p.number === 1 || p.role === "GK"));
            const attacksDownward = teamGK ? teamGK.y < 50 : team === "DEF";
            
            if (attacksDownward) {
              // Mirror left/right positions for team attacking downward
              if (role === "RW") return "LW";
              if (role === "LW") return "RW";
              if (role === "RB") return "LB";
              if (role === "LB") return "RB";
            }
            
            return role;
          };
          
          // Get abbreviated role for display with mirroring
          const roleAbbr = getMirroredRole(player.role, player.team) || 
                          (player.number ? `${player.number}` : "");

          return (
            <g key={player.id ?? idx}>
              <circle
                cx={px}
                cy={py}
                r={radius}
                fill={teamColor}
                stroke="#000000"
                strokeWidth={isSmall ? 1.5 : 2}
              />
              {isGK && !isSmall && totalPlayers > 6 && (
                <circle
                  cx={px}
                  cy={py}
                  r={radius - 3}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.35)"
                  strokeWidth={1.5}
                />
              )}
              <text
                x={px}
                y={py + fontSize * 0.35}
                textAnchor="middle"
                fill="white"
                fontSize={fontSize}
                fontWeight="bold"
              >
                {roleAbbr}
              </text>
            </g>
          );
        })}
      </svg>

      <div
        style={{
          marginTop: isSmall ? "8px" : "0",
          display: "flex",
          gap: isSmall ? "10px" : "20px",
          alignItems: "center",
          paddingBottom: isSmall ? "0" : "16px",
          borderBottom: isSmall ? "none" : "1px solid rgba(255, 255, 255, 0.1)",
          marginBottom: isSmall ? "0" : "16px",
          flexWrap: "wrap",
          fontSize: isSmall ? "9px" : "13px",
          color: isSmall ? "#94a3b8" : "#cbd5e1",
        }}
      >
        {/* Dynamic team legend - shows all teams present */}
        {(() => {
          const teams = [...new Set(players.map(p => p.team))];
          const teamColorMap: Record<string, { color: string; label: string }> = {
            'ATT': { color: '#3b82f6', label: 'Attack' },
            'DEF': { color: '#dc2626', label: 'Defend' },
            'NEUTRAL': { color: '#fbbf24', label: 'Neutral' },
            'NEUT': { color: '#fbbf24', label: 'Neutral' },
          };
          
          return teams.map(team => {
            const teamPlayers = players.filter(p => p.team === team);
            const config = teamColorMap[team] || { color: '#94a3b8', label: team };
            
            return (
              <div
                key={team}
                style={{ display: "flex", alignItems: "center", gap: isSmall ? "4px" : "8px" }}
              >
                <div
                  style={{
                    width: isSmall ? 10 : 20,
                    height: isSmall ? 10 : 20,
                    borderRadius: "50%",
                    backgroundColor: config.color,
                    border: `${isSmall ? 1 : 2}px solid #000000`,
                  }}
                />
                <span>
                  {config.label}{teamPlayers.length > 0 ? ` (${teamPlayers.length})` : ""}
                </span>
              </div>
            );
          });
        })()}

        {!isSmall && totalPlayers > 6 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: 20,
                  height: 2,
                  backgroundColor: "rgba(255, 255, 255, 0.6)",
                }}
              />
              <span>Pass</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width={20} height={8}>
                <line
                  x1={0}
                  y1={4}
                  x2={20}
                  y2={4}
                  stroke="rgba(255, 255, 255, 0.6)"
                  strokeWidth={2}
                  strokeDasharray="3,2"
                />
              </svg>
              <span>Run</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: 20,
                  height: 2,
                  backgroundColor: "rgba(255, 255, 255, 0.9)",
                }}
              />
              <span>Press</span>
            </div>
            {/* Show detected zones in legend */}
            {detectedZones.length > 0 &&
              detectedZones
                .filter(
                  (zone, idx, arr) =>
                    arr.findIndex((z) => z.label === zone.label) === idx
                )
                .map((zone, idx) => (
                  <div
                    key={`legend-zone-${idx}`}
                    style={{ display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <svg width={20} height={8}>
                      <line
                        x1={0}
                        y1={4}
                        x2={20}
                        y2={4}
                        stroke={zone.borderColor}
                        strokeWidth={2}
                        strokeDasharray="4,2"
                      />
                    </svg>
                    <span>{zone.label}</span>
                  </div>
                ))}
          </>
        )}
      </div>

      {!isSmall && json?.description && (
        <p
          style={{
            margin: "0",
            color: "#94a3b8",
            fontSize: "12px",
            lineHeight: "1.6",
          }}
        >
          {json.description.length > 200
            ? `${json.description.substring(0, 200)}...`
            : json.description}
        </p>
      )}
    </div>
  );
};

export default UniversalDrillDiagram;
