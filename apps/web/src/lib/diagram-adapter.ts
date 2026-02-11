import type { DiagramV1 } from "@/types/diagram";
import type {
  UniversalDrillData,
  UniversalDrillDiagramInner,
  UniversalDrillDataJson,
  UniversalDrillPlayer,
  UniversalDrillGoal,
  UniversalDrillArrow,
  UniversalDrillAnnotation,
  UniversalDrillSafeZone,
} from "@/components/UniversalDrillDiagram";

export interface TacticalEdgeToUniversalOptions {
  title?: string;
  description?: string;
  organization?: {
    area?: { widthYards?: number; lengthYards?: number; notes?: string };
    setupSteps?: string[];
  };
}

/**
 * Converts TacticalEdge DiagramV1 (and optional drill metadata) into the shape
 * expected by UniversalDrillDiagram (drillData).
 */
export function tacticalEdgeToUniversalDrillData(
  diagram: DiagramV1 | null | undefined,
  options?: TacticalEdgeToUniversalOptions
): UniversalDrillData {
  const title = options?.title ?? "Diagram";
  const description = options?.description;
  const organization = options?.organization;

  const inner: UniversalDrillDiagramInner = {
    goals: [],
    players: [],
    pitch: {},
  };

  if (diagram) {
    // Preserve ALL pitch data including orientation and showZones
    inner.pitch = diagram.pitch ? { ...diagram.pitch } : {};
    
    // Map players
    inner.players = (diagram.players ?? []).map((p) => {
      const player: UniversalDrillPlayer = {
        id: p.id,
        number: p.number,
        team: p.team,
        role: p.role,
        x: Math.max(0, Math.min(100, p.x)),
        y: Math.max(0, Math.min(100, p.y)),
      };
      return player;
    });
    
    // Map goals (IMPORTANT: added for zone detection and proper rendering)
    inner.goals = (diagram.goals ?? []).map((g) => {
      const goal: UniversalDrillGoal = {
        id: g.id,
        x: Math.max(0, Math.min(100, g.x)),
        y: Math.max(0, Math.min(100, g.y)),
        width: g.width,
        type: g.type,
      };
      return goal;
    });

    // Map arrows (supports both DiagramArrow and UniversalDrillArrow-like payloads)
    inner.arrows = (diagram.arrows ?? []).map((a: any, idx: number) => {
      // Resolve DiagramPointRef to actual coordinates
      const resolvePoint = (ref: any) => {
        if (ref?.playerId) {
          const player = diagram.players?.find((p) => p.id === ref.playerId);
          if (player) {
            return { x: player.x, y: player.y };
          }
        }
        return {
          x: Math.max(0, Math.min(100, ref?.x ?? 0)),
          y: Math.max(0, Math.min(100, ref?.y ?? 0)),
        };
      };

      // Map type: DiagramArrowType → UniversalDrillArrowType
      const rawType = a?.type;
      let arrowType: "pass" | "movement" | "press" | "run" = "movement";
      if (rawType === "pass") arrowType = "pass";
      else if (rawType === "press") arrowType = "press";
      else if (rawType === "run") arrowType = "run";
      else if (rawType === "movement") arrowType = "movement";
      else if (rawType === "cover" || rawType === "transition") arrowType = "movement";

      const arrow: UniversalDrillArrow = {
        id: a?.id ?? `arrow-${idx}`,
        from: resolvePoint(a?.from),
        to: resolvePoint(a?.to),
        type: arrowType,
        label: a?.label,
        color: a?.color,
      };
      return arrow;
    });
    
    if (inner.arrows.length > 0) {
      console.log("🔄 Adapter: Mapped", inner.arrows.length, "arrows");
    }

    // Map labels/annotations (supports diagram.annotations from JSON guide)
    const labelAnnotations = (diagram.labels ?? []).map((l: any, idx: number) => {
      const annotation: UniversalDrillAnnotation = {
        id: `annotation-${idx}`,
        text: l.text,
        x: Math.max(0, Math.min(100, l.x)),
        y: Math.max(0, Math.min(100, l.y)),
      };
      return annotation;
    });
    const guideAnnotations = (diagram as any).annotations
      ? ((diagram as any).annotations as any[]).map((a, idx) => {
          const annotation: UniversalDrillAnnotation = {
            id: a.id ?? `annotation-guide-${idx}`,
            text: a.text,
            x: Math.max(0, Math.min(100, a.x)),
            y: Math.max(0, Math.min(100, a.y)),
            fontSize: a.fontSize,
            color: a.color,
            backgroundColor: a.backgroundColor,
            fontWeight: a.fontWeight,
          };
          return annotation;
        })
      : [];
    inner.annotations = [...labelAnnotations, ...guideAnnotations];

    // Map areas/safeZones
    const areaZones = (diagram.areas ?? []).map((a, idx) => {
      const zone: UniversalDrillSafeZone = {
        id: `zone-${idx}`,
        x: Math.max(0, Math.min(100, a.x ?? 0)),
        y: Math.max(0, Math.min(100, a.y ?? 0)),
        width: Math.max(0, a.width ?? 0),
        height: Math.max(0, a.height ?? 0),
        label: a.label,
      };
      return zone;
    });
    const guideZones = (diagram as any).safeZones
      ? ((diagram as any).safeZones as any[]).map((z, idx) => {
          const zone: UniversalDrillSafeZone = {
            id: z.id ?? `zone-guide-${idx}`,
            x: Math.max(0, Math.min(100, z.x ?? 0)),
            y: Math.max(0, Math.min(100, z.y ?? 0)),
            width: Math.max(0, z.width ?? 0),
            height: Math.max(0, z.height ?? 0),
            label: z.label,
            team: z.team,
            color: z.color,
          };
          return zone;
        })
      : [];
    inner.safeZones = [...areaZones, ...guideZones];
  }

  const json: UniversalDrillDataJson | undefined =
    description !== undefined || organization !== undefined
      ? { description, organization }
      : undefined;

  const spaceConstraint =
    diagram?.pitch?.variant === "HALF"
      ? "HALF"
      : diagram?.pitch?.variant === "FULL"
        ? "FULL"
        : diagram?.pitch?.variant === "THIRD"
          ? "THIRD"
          : undefined;

  return {
    title,
    diagram: inner,
    json,
    spaceConstraint,
  };
}

// Backward-compat alias for older imports.
export const aciToUniversalDrillData = tacticalEdgeToUniversalDrillData;
