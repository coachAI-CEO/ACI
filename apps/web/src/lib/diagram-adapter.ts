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

export interface AciToUniversalOptions {
  title?: string;
  description?: string;
  organization?: {
    area?: { widthYards?: number; lengthYards?: number; notes?: string };
    setupSteps?: string[];
  };
}

/**
 * Converts ACI DiagramV1 (and optional drill metadata) into the shape
 * expected by UniversalDrillDiagram (drillData).
 */
export function aciToUniversalDrillData(
  diagram: DiagramV1 | null | undefined,
  options?: AciToUniversalOptions
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

    // Map arrows
    inner.arrows = (diagram.arrows ?? []).map((a, idx) => {
      // Resolve DiagramPointRef to actual coordinates
      const resolvePoint = (ref: any) => {
        if (ref.playerId) {
          const player = diagram.players?.find((p) => p.id === ref.playerId);
          if (player) {
            return { x: player.x, y: player.y };
          }
        }
        // Fall back to explicit coordinates
        return { 
          x: Math.max(0, Math.min(100, ref.x ?? 0)),
          y: Math.max(0, Math.min(100, ref.y ?? 0))
        };
      };

      // Map type: DiagramArrowType → UniversalDrillArrowType
      // DiagramArrowType = "pass" | "run" | "press" | "cover" | "transition"
      // UniversalDrillArrowType = "pass" | "movement" | "press" | "run"
      let arrowType: "pass" | "movement" | "press" | "run" = "movement";
      if (a.type === "pass") arrowType = "pass";
      else if (a.type === "press") arrowType = "press";
      else if (a.type === "run") arrowType = "run";
      else if (a.type === "cover" || a.type === "transition") arrowType = "movement";

      const arrow: UniversalDrillArrow = {
        id: `arrow-${idx}`,
        from: resolvePoint(a.from),
        to: resolvePoint(a.to),
        type: arrowType,
      };
      return arrow;
    });
    
    if (inner.arrows.length > 0) {
      console.log("🔄 Adapter: Mapped", inner.arrows.length, "arrows");
    }

    // Map labels/annotations
    inner.annotations = (diagram.labels ?? []).map((l, idx) => {
      const annotation: UniversalDrillAnnotation = {
        id: `annotation-${idx}`,
        text: l.text,
        x: Math.max(0, Math.min(100, l.x)),
        y: Math.max(0, Math.min(100, l.y)),
      };
      return annotation;
    });

    // Map areas to safeZones
    inner.safeZones = (diagram.areas ?? []).map((a, idx) => {
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
