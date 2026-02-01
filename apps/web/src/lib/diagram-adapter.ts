import type { DiagramV1 } from "@/types/diagram";
import type {
  UniversalDrillData,
  UniversalDrillDiagramInner,
  UniversalDrillDataJson,
  UniversalDrillPlayer,
  UniversalDrillGoal,
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
