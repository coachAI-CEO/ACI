"use client";

import React, { useEffect } from "react";

/** Goal as expected by the universal diagram (optional in TacticalEdge; adapter can pass []). */
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

/** Safe zone - restricted area with special rules */
export interface UniversalDrillSafeZone {
  id?: string;
  x: number;  // Left edge (percentage)
  y: number;  // Top edge (percentage)
  width: number;  // Width (percentage)
  height: number;  // Height (percentage)
  team?: "ATT" | "DEF" | string;  // Which team can enter
  label?: string;  // Optional label
  color?: string;  // Custom color
}

/** Player shape for the universal diagram (matches TacticalEdge DiagramPlayer for id, number, team, role, x, y). */
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
  safeZones?: UniversalDrillSafeZone[];
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
  autoSpacing?: boolean;
  spacingMode?: "simple" | "advanced";
  showSpacingWarning?: boolean;
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

// ==========================================================================
// AUTO-SPACING HELPERS (prevents cramped player spacing)
// ==========================================================================

const MINIMUM_SPREADS: Record<string, number> = {
  FULL: 80,
  HALF: 65,
  THIRD: 60,
  QUARTER: 50,
};

const TARGET_RANGES: Record<string, { min: number; max: number }> = {
  FULL: { min: 5, max: 95 },
  HALF: { min: 2, max: 75 },
  THIRD: { min: 2, max: 80 },
  QUARTER: { min: 20, max: 80 },
};

const TEAM_RANGES: Record<
  string,
  { ATT: { min: number; max: number }; DEF: { min: number; max: number } }
> = {
  FULL: {
    ATT: { min: 50, max: 95 },
    DEF: { min: 5, max: 50 },
  },
  HALF: {
    ATT: { min: 20, max: 75 },
    DEF: { min: 2, max: 45 },
  },
  THIRD: {
    ATT: { min: 25, max: 80 },
    DEF: { min: 2, max: 55 },
  },
  QUARTER: {
    ATT: { min: 40, max: 80 },
    DEF: { min: 20, max: 60 },
  },
};

const needsSpacingAdjustment = (
  players: UniversalDrillPlayer[],
  variant: string
) => {
  if (!players || players.length === 0) return false;
  const minY = Math.min(...players.map((p) => p.y));
  const maxY = Math.max(...players.map((p) => p.y));
  const currentSpread = maxY - minY;
  const requiredSpread = MINIMUM_SPREADS[variant] || 65;
  return currentSpread < requiredSpread;
};

const autoAdjustPlayerSpacing = (
  players: UniversalDrillPlayer[],
  variant: string
) => {
  if (!players || players.length === 0) return players;
  const minY = Math.min(...players.map((p) => p.y));
  const maxY = Math.max(...players.map((p) => p.y));
  const currentSpread = maxY - minY;
  const requiredSpread = MINIMUM_SPREADS[variant] || 65;
  if (currentSpread >= requiredSpread || currentSpread === 0) return players;
  const targetRange = TARGET_RANGES[variant] || { min: 2, max: 75 };
  return players.map((player) => {
    const normalized = (player.y - minY) / currentSpread;
    const newY = targetRange.min + normalized * (targetRange.max - targetRange.min);
    return { ...player, y: Math.round(newY * 100) / 100 };
  });
};

const autoAdjustPlayerSpacingAdvanced = (
  players: UniversalDrillPlayer[],
  variant: string
) => {
  if (!players || players.length === 0) return players;
  const attackers = players.filter((p) => p.team === "ATT");
  const defenders = players.filter((p) => p.team === "DEF");
  const neutral = players.filter((p) => p.team !== "ATT" && p.team !== "DEF");
  const ranges = TEAM_RANGES[variant] || TEAM_RANGES.HALF;

  const scaleGroup = (
    group: UniversalDrillPlayer[],
    targetRange: { min: number; max: number }
  ) => {
    if (group.length === 0) return [];
    const minY = Math.min(...group.map((p) => p.y));
    const maxY = Math.max(...group.map((p) => p.y));
    const currentSpread = maxY - minY;
    if (currentSpread === 0) {
      const mid = (targetRange.min + targetRange.max) / 2;
      return group.map((p) => ({ ...p, y: mid }));
    }
    return group.map((player) => {
      const normalized = (player.y - minY) / currentSpread;
      const newY = targetRange.min + normalized * (targetRange.max - targetRange.min);
      return { ...player, y: Math.round(newY * 100) / 100 };
    });
  };

  const scaledAttackers = scaleGroup(attackers, ranges.ATT);
  const scaledDefenders = scaleGroup(defenders, ranges.DEF);
  const scaledNeutral = neutral;
  const combined = [...scaledAttackers, ...scaledDefenders, ...scaledNeutral];
  return players.map((p) => combined.find((sp) => sp.id === p.id) || p);
};

const fitPlayersToBounds = (
  players: UniversalDrillPlayer[],
  padding = 5
) => {
  if (!players || players.length === 0) return players;
  const xs = players.map((p) => p.x);
  const ys = players.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const maxSpan = 100 - padding * 2;
  const scaleX = spanX > maxSpan ? maxSpan / spanX : 1;
  const scaleY = spanY > maxSpan ? maxSpan / spanY : 1;

  const scaled = players.map((p) => ({
    ...p,
    x: minX + (p.x - minX) * scaleX,
    y: minY + (p.y - minY) * scaleY,
  }));

  const sxs = scaled.map((p) => p.x);
  const sys = scaled.map((p) => p.y);
  const sMinX = Math.min(...sxs);
  const sMaxX = Math.max(...sxs);
  const sMinY = Math.min(...sys);
  const sMaxY = Math.max(...sys);

  const shiftX =
    sMinX < padding ? padding - sMinX : sMaxX > 100 - padding ? 100 - padding - sMaxX : 0;
  const shiftY =
    sMinY < padding ? padding - sMinY : sMaxY > 100 - padding ? 100 - padding - sMaxY : 0;

  return scaled.map((p) => ({
    ...p,
    x: Math.round((p.x + shiftX) * 100) / 100,
    y: Math.round((p.y + shiftY) * 100) / 100,
  }));
};

/**
 * Universal Drill Diagram Component - Enhanced with Zone Detection
 * Renders any drill JSON in either small preview or large detailed format.
 * Supports all formats from 1v1 to 11v11.
 * Automatically detects and renders 11+ zone types.
 */
const UniversalDrillDiagram = ({
  drillData,
  size = "large",
  autoSpacing,
  spacingMode,
  showSpacingWarning,
}: UniversalDrillDiagramProps) => {
  const isAutoSpacing = true;
  const resolvedSpacingMode = spacingMode ?? "advanced";
  const shouldWarnOnSpacing = showSpacingWarning ?? false;
  const isSmall = size === "small";
  const uid = React.useId();

  const { title, diagram, json, spaceConstraint } = drillData;
  const debugOrientation =
    (diagram as any)?.pitch?.orientation ??
    (json as any)?.diagram?.pitch?.orientation ??
    "UNKNOWN";
  
  // DEBUG: Log what we received
  console.log("📥 Component received drillData:", {
    title,
    diagramExists: !!diagram,
    diagramKeys: diagram ? Object.keys(diagram) : [],
    diagramArrows: diagram?.arrows?.length ?? 0,
  });
  
  const {
    goals = [],
    players: rawPlayers = [],
    pitch = {},
    arrows = [],
    annotations = [],
    safeZones = [],
  } = diagram || {};

  const pitchVariant =
    (pitch as { variant?: "FULL" | "HALF" | "THIRD" | "QUARTER" }).variant ||
    "HALF";

  let players = rawPlayers;
  if (isAutoSpacing && needsSpacingAdjustment(players, pitchVariant)) {
    if (shouldWarnOnSpacing) {
      console.warn("Auto-adjusting cramped spacing for", pitchVariant, "pitch");
    }
    players =
      resolvedSpacingMode === "simple"
        ? autoAdjustPlayerSpacing(players, pitchVariant)
        : autoAdjustPlayerSpacingAdvanced(players, pitchVariant);
  }
  const fittedPlayers = fitPlayersToBounds(players, 6);

  const transformPoint = (pt: { x: number; y: number }) => {
    const xs = players.map((p) => p.x);
    const ys = players.map((p) => p.y);
    if (xs.length === 0 || ys.length === 0) {
      return { x: pt.x, y: pt.y };
    }
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const maxSpan = 100 - 12;
    const scaleX = spanX > maxSpan ? maxSpan / spanX : 1;
    const scaleY = spanY > maxSpan ? maxSpan / spanY : 1;
    const sx = minX + (pt.x - minX) * scaleX;
    const sy = minY + (pt.y - minY) * scaleY;
    const sxs = fittedPlayers.map((p) => p.x);
    const sys = fittedPlayers.map((p) => p.y);
    const sMinX = Math.min(...sxs);
    const sMaxX = Math.max(...sxs);
    const sMinY = Math.min(...sys);
    const sMaxY = Math.max(...sys);
    const shiftX =
      sMinX < 6 ? 6 - sMinX : sMaxX > 94 ? 94 - sMaxX : 0;
    const shiftY =
      sMinY < 6 ? 6 - sMinY : sMaxY > 94 ? 94 - sMaxY : 0;
    return {
      x: Math.round((sx + shiftX) * 100) / 100,
      y: Math.round((sy + shiftY) * 100) / 100,
    };
  };

  const adjustedArrows = arrows.map((a) => ({
    ...a,
    from: transformPoint(a.from),
    to: transformPoint(a.to),
  }));

  const adjustedAnnotations = annotations
    .map((a) => {
      const pt = transformPoint({ x: a.x, y: a.y });
      return { ...a, x: pt.x, y: pt.y };
    })
    .filter(
      (a) =>
        Number.isFinite(a.x) &&
        Number.isFinite(a.y)
    );

  players = fittedPlayers;
  
  // DEBUG: Log arrow data
  useEffect(() => {
    if (arrows.length > 0 || annotations.length > 0 || safeZones.length > 0) {
      console.log("📊 Diagram content:", {
        players: players.length,
        arrows: arrows.length,
        annotations: annotations.length,
        safeZones: safeZones.length,
        arrowData: arrows.slice(0, 2),
      });
    }
  }, [arrows, annotations, safeZones, players]);
  
  const isHalfPitch = spaceConstraint === "HALF";

  // ==========================================================================
  // MEASUREMENT-BASED RENDERING
  // ==========================================================================
  
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

  // Note: scaleX and scaleY will be defined later (fixed viewport)

  // ==========================================================================
  // ZONE DETECTION SYSTEM
  // ==========================================================================
  
  const detectZones = (jsonData?: UniversalDrillDataJson): DetectedZone[] => {
    const zones: DetectedZone[] = [];
    if (!jsonData) return zones;
    // Respect pitch flag -- if the adapter or author disabled auto zones, skip detection
    const showZonesFlag = (pitch as any)?.showZones;
    if (showZonesFlag === false) return zones;
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

  // ==========================================================================
  // ORIENTATION (Prefer JSON, but correct obvious mismatches from goals)
  // ==========================================================================
  const explicitOrientation = (pitch as any)?.orientation as string | undefined;
  const goalsForOrientation = goals;
  const hasLeft = goalsForOrientation.some((g) => g.x < 20);
  const hasRight = goalsForOrientation.some((g) => g.x > 80);
  const hasTop = goalsForOrientation.some((g) => g.y < 20);
  const hasBottom = goalsForOrientation.some((g) => g.y > 80);
  const inferredOrientation =
    (hasTop || hasBottom) && !(hasLeft || hasRight)
      ? "VERTICAL"
      : (hasLeft || hasRight) && !(hasTop || hasBottom)
        ? "HORIZONTAL"
        : explicitOrientation;
  const effectiveOrientation = inferredOrientation || explicitOrientation || "HORIZONTAL";
  const drawVertical = effectiveOrientation === "VERTICAL";

  // Map data coords -> screen coords (simple percentage mapping)
  const toScreenX = (dataX: number) => scaleX(dataX);
  const toScreenY = (dataY: number) => scaleY(dataY);

  // ==========================================================================
  // FIXED PITCH DIMENSIONS (No viewport/cropping)
  // ==========================================================================
  const pitchWidth = isSmall ? 420 : 820;
  const pitchHeight = isSmall ? 300 : 580;
  const containerWidth = isSmall ? "auto" : "100%";
  const containerMaxWidth = "100%";

  let displayWidth = "Unknown";
  let displayLength = "Unknown";

  if (widthYards && lengthYards) {
    displayWidth = `${widthYards}`;
    displayLength = `${lengthYards}`;
  }

  // When adapter passes no goals, infer default goals; use vertical layout when drawVertical
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

  const hasLeftGoal = !drawVertical && displayGoals.some((g) => g.x < 20);
  const hasRightGoal = !drawVertical && displayGoals.some((g) => g.x > 80);
  const hasTopGoal = drawVertical && displayGoals.some((g) => g.y < 10);
  const hasBottomGoal = drawVertical && displayGoals.some((g) => g.y > 90);
  const isFullPitch = drawVertical ? hasTopGoal && hasBottomGoal : hasLeftGoal && hasRightGoal;

  // Simple percentage scaling
  const scaleX = (percent: number) => (percent / 100) * pitchWidth;
  const scaleY = (percent: number) => (percent / 100) * pitchHeight;

  const getPlayerRadius = () => {
    const scale = isSmall ? 1.25 : 1.7;
    if (isSmall) {
      if (totalPlayers <= 6) return Math.round(8 * scale);
      if (totalPlayers <= 12) return Math.round(7 * scale);
      if (totalPlayers <= 16) return Math.round(6 * scale);
      return Math.round(5 * scale);
    }
    if (totalPlayers <= 6) return Math.round(14 * scale);
    if (totalPlayers <= 12) return Math.round(12 * scale);
    if (totalPlayers <= 16) return Math.round(11 * scale);
    return Math.round(10 * scale);
  };

  const getGKRadius = () => {
    const baseRadius = getPlayerRadius();
    return isSmall ? baseRadius : baseRadius + 2;
  };

  const getFontSize = () => {
    const scale = isSmall ? 1.1 : 1.55;
    if (isSmall) {
      if (totalPlayers <= 12) return Math.round(7 * scale);
      return Math.round(6 * scale);
    }
    if (totalPlayers <= 12) return Math.round(10 * scale);
    return Math.round(9 * scale);
  };

  const fieldWidth = json?.organization?.area?.widthYards ?? 60;
  const fieldLength = json?.organization?.area?.lengthYards ?? 50;

  const playerRadius = getPlayerRadius();
  const gkRadius = getGKRadius();
  const fontSize = getFontSize();

  return (
    <div
      style={{
        width: containerWidth,
        maxWidth: containerMaxWidth,
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
          </div>
        </div>
      )}

      <svg
        width="100%"
        height="auto"
        viewBox={`0 0 ${pitchWidth} ${pitchHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          borderRadius: isSmall ? "4px" : "8px",
          overflow: "hidden",
          display: "block",
          marginBottom: isSmall ? "8px" : "20px",
          maxWidth: "100%",
          height: "auto",
        }}
      >
        <defs>
          <linearGradient
            id={`pitchGrad-${size}-${uid}`}
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
            id={`arrowhead-pass-${uid}`}
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
            id={`arrowhead-movement-${uid}`}
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
            id={`arrowhead-press-${uid}`}
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
            id={`arrowhead-dribble-${uid}`}
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
          
          {/* Safe zone patterns for ATT and DEF teams */}
          <pattern
            id={`safeZoneATT-${uid}`}
            patternUnits="userSpaceOnUse"
            width={8}
            height={8}
          >
            <path
              d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4"
              stroke="rgba(59, 130, 246, 0.3)"
              strokeWidth="1.5"
            />
          </pattern>
          <pattern
            id={`safeZoneDEF-${uid}`}
            patternUnits="userSpaceOnUse"
            width={8}
            height={8}
          >
            <path
              d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4"
              stroke="rgba(239, 68, 68, 0.3)"
              strokeWidth="1.5"
            />
          </pattern>
          <pattern
            id={`safeZoneNEUTRAL-${uid}`}
            patternUnits="userSpaceOnUse"
            width={8}
            height={8}
          >
            <path
              d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4"
              stroke="rgba(251, 191, 36, 0.3)"
              strokeWidth="1.5"
            />
          </pattern>
          
          {/* Diagonal pattern for restricted zones */}
          {detectedZones
            .filter((z) => z.pattern === "diagonal")
            .map((zone, idx) => (
              <pattern
                key={`diag-${idx}`}
                id={`diag-${uid}-${idx}`}
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
          fill={`url(#pitchGrad-${size}-${uid})`}
        />

        {/* Debug overlay: orientation */}
        <text
          x={pitchWidth - 10}
          y={14}
          textAnchor="end"
          fill="rgba(255, 255, 255, 0.55)"
          fontSize="10"
          fontWeight="600"
          letterSpacing="0.5px"
        >
          ORIENT: {effectiveOrientation}
        </text>

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

        {/* Pitch boundary */}
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
                    fill={zone.pattern === "diagonal" ? `url(#diag-${uid}-${idx})` : zone.color}
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
            const gx = toScreenX(goal.x);
            const gy = toScreenY(goal.y);

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
            const gx = toScreenX(goal.x);
            const gy = toScreenY(goal.y);
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
                p.team === "ATT" && (!drawVertical ? p.x > 70 : p.y > 70)
              )
              .slice(0, 2)
              .map((player, idx) => {
                const nextPlayer = players.find(
                  (p) =>
                    p.team === "ATT" &&
                    (!drawVertical
                      ? p.x < player.x && p.x > 50
                      : p.y < player.y && p.y > 50)
                );
                if (nextPlayer) {
                  return (
                    <line
                      key={`pass-${idx}`}
                      x1={toScreenX(player.x)}
                      y1={toScreenY(player.y)}
                      x2={toScreenX(nextPlayer.x)}
                      y2={toScreenY(nextPlayer.y)}
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
                    Math.abs(!drawVertical ? p.y - player.y : p.x - player.x) <
                      20 &&
                    (!drawVertical ? p.x > player.x : p.y > player.y)
                );
                if (target) {
                  return (
                    <line
                      key={`press-${idx}`}
                      x1={toScreenX(player.x)}
                      y1={toScreenY(player.y)}
                      x2={toScreenX(target.x)}
                      y2={toScreenY(target.y)}
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

        {/* Safe Zones - Restricted areas with special rules */}
        {safeZones.map((zone, idx) => {
          const zx = scaleX(zone.x);
          const zy = scaleY(zone.y);
          const zw = (zone.width / 100) * pitchWidth;
          const zh = (zone.height / 100) * pitchHeight;
          
          // Get color and pattern based on team
          const getZoneColor = (team?: string) => {
            if (team === "ATT") return { pattern: `url(#safeZoneATT-${uid})`, stroke: "rgba(59, 130, 246, 0.7)" };
            if (team === "DEF") return { pattern: `url(#safeZoneDEF-${uid})`, stroke: "rgba(239, 68, 68, 0.7)" };
            return { pattern: `url(#safeZoneNEUTRAL-${uid})`, stroke: "rgba(251, 191, 36, 0.7)" };
          };
          
          const zoneStyle = getZoneColor(zone.team);
          
          return (
            <g key={`safezone-${zone.id || idx}`}>
              {/* Safe zone rectangle with pattern */}
              <rect
                x={zx}
                y={zy}
                width={zw}
                height={zh}
                fill={zone.color || zoneStyle.pattern}
                stroke={zoneStyle.stroke}
                strokeWidth="2.5"
                strokeDasharray="6,3"
              />
              
              {/* Optional label */}
              {zone.label && !isSmall && (
                <text
                  x={zx + zw / 2}
                  y={zy + 12}
                  textAnchor="middle"
                  fill={zoneStyle.stroke}
                  fontSize="9"
                  fontWeight="700"
                  letterSpacing="0.5px"
                >
                  {zone.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Custom Arrows - Passes, Movement, Pressing */}
        {/* STEP 1: Draw arrow LINES first (behind everything) */}
        {adjustedArrows.map((arrow, idx) => {
          const x1 = toScreenX(arrow.from.x);
          const y1 = toScreenY(arrow.from.y);
          const x2 = toScreenX(arrow.to.x);
          const y2 = toScreenY(arrow.to.y);
          if (
            !Number.isFinite(x1) ||
            !Number.isFinite(y1) ||
            !Number.isFinite(x2) ||
            !Number.isFinite(y2)
          ) {
            return null;
          }
          if (
            !Number.isFinite(x1) ||
            !Number.isFinite(y1) ||
            !Number.isFinite(x2) ||
            !Number.isFinite(y2)
          ) {
            return null;
          }
          if (
            !Number.isFinite(x1) ||
            !Number.isFinite(y1) ||
            !Number.isFinite(x2) ||
            !Number.isFinite(y2)
          ) {
            return null;
          }
          
          const getArrowStyle = (type: string) => {
            switch (type) {
              case "pass":
                return {
                  stroke: arrow.color || "rgba(255, 255, 255, 0.85)",
                  strokeWidth: isSmall ? 1.4 : 2.4,
                  strokeDasharray: "none",
                  opacity: 1,
                  arrowSize: 12,
                  arrowFill: "rgba(255, 255, 255, 0.98)"
                };
              case "movement":
              case "run":
                return {
                  stroke: arrow.color || "rgba(255, 255, 255, 0.6)",
                  strokeWidth: isSmall ? 1.1 : 1.8,
                  strokeDasharray: isSmall ? "3,2" : "4,2",
                  opacity: 1,
                  arrowSize: 8,
                  arrowFill: "rgba(255, 255, 255, 0.6)"
                };
              case "press":
                return {
                  stroke: arrow.color || "rgba(239, 68, 68, 0.85)",
                  strokeWidth: isSmall ? 2.2 : 3,
                  strokeDasharray: "none",
                  opacity: 1,
                  arrowSize: 12,
                  arrowFill: "rgba(239, 68, 68, 0.95)"
                };
              default:
                return {
                  stroke: arrow.color || "rgba(255, 255, 255, 0.85)",
                  strokeWidth: isSmall ? 1.4 : 2.4,
                  strokeDasharray: "none",
                  opacity: 1,
                  arrowSize: 12,
                  arrowFill: "rgba(255, 255, 255, 0.98)"
                };
            }
          };
          
          const style = getArrowStyle(arrow.type || "pass");
          const dx = x2 - x1;
          const dy = y2 - y1;
          const arrowSize = style.arrowSize;
          const lineLength = Math.sqrt(dx * dx + dy * dy);
          const shortenBy = arrowSize;
          const ratio = lineLength > 0 ? (lineLength - shortenBy) / lineLength : 0;
          const x2Short = x1 + dx * ratio;
          const y2Short = y1 + dy * ratio;
          
          return (
            <line
              key={`arrow-line-${arrow.id || idx}`}
              x1={x1}
              y1={y1}
              x2={x2Short}
              y2={y2Short}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              strokeDasharray={style.strokeDasharray}
              opacity={style.opacity}
            />
          );
        })}
        
        {/* STEP 2: Draw numbered circles (middle layer) */}
        {adjustedArrows.map((arrow, idx) => {
          if (!arrow.label || isSmall) return null;
          
          const x1 = toScreenX(arrow.from.x);
          const y1 = toScreenY(arrow.from.y);
          const x2 = toScreenX(arrow.to.x);
          const y2 = toScreenY(arrow.to.y);
          
          return (
            <g key={`arrow-label-${arrow.id || idx}`}>
              <circle
                cx={(x1 + x2) / 2}
                cy={(y1 + y2) / 2}
                r={9}
                fill="rgba(255, 255, 255, 0.85)"
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
            </g>
          );
        })}
        
        {/* STEP 3: Draw arrowheads LAST (on top of everything) */}
        {adjustedArrows.map((arrow, idx) => {
          const x1 = toScreenX(arrow.from.x);
          const y1 = toScreenY(arrow.from.y);
          const x2 = toScreenX(arrow.to.x);
          const y2 = toScreenY(arrow.to.y);
          
          const getArrowStyle = (type: string) => {
            switch (type) {
              case "pass":
                return { arrowSize: 12, arrowFill: "rgba(255, 255, 255, 0.98)" };
              case "movement":
              case "run":
                return { arrowSize: 8, arrowFill: "rgba(255, 255, 255, 0.6)" };
              case "press":
                return { arrowSize: 12, arrowFill: "rgba(239, 68, 68, 0.95)" };
              default:
                return { arrowSize: 12, arrowFill: "rgba(255, 255, 255, 0.98)" };
            }
          };
          
          const style = getArrowStyle(arrow.type || "pass");
          const dx = x2 - x1;
          const dy = y2 - y1;
          const angle = Math.atan2(dy, dx);
          const arrowSize = style.arrowSize;
          
          const arrowPoint1X = x2 - arrowSize * Math.cos(angle - Math.PI / 6);
          const arrowPoint1Y = y2 - arrowSize * Math.sin(angle - Math.PI / 6);
          const arrowPoint2X = x2 - arrowSize * Math.cos(angle + Math.PI / 6);
          const arrowPoint2Y = y2 - arrowSize * Math.sin(angle + Math.PI / 6);
          
          return (
            <polygon
              key={`arrow-head-${arrow.id || idx}`}
              points={`${x2},${y2} ${arrowPoint1X},${arrowPoint1Y} ${arrowPoint2X},${arrowPoint2Y}`}
              fill={style.arrowFill}
              stroke={arrow.type === "pass" ? "rgba(0, 0, 0, 0.3)" : "none"}
              strokeWidth={arrow.type === "pass" ? "0.5" : "0"}
              strokeLinejoin="miter"
            />
          );
        })}

        {/* Text Annotations on Field */}
        {adjustedAnnotations.map((annotation, idx) => {
          const ax = toScreenX(annotation.x);
          const ay = toScreenY(annotation.y);
          
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
                fontSize={
                  (annotation.fontSize || (isSmall ? 8 : 11)) *
                  (isSmall ? 1.1 : 1.25)
                }
                fontWeight={annotation.fontWeight || "700"}
                letterSpacing="0.5px"
              >
                {annotation.text}
              </text>
            </g>
          );
        })}

        {players.map((player, idx) => {
          const px = toScreenX(player.x);
          const py = toScreenY(player.y);
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

    </div>
  );
};

export default UniversalDrillDiagram;
