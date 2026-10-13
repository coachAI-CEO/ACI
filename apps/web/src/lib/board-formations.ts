/**
 * Web re-export of @aci/shared board formations.
 * Canonical source: `packages/shared/src/board/formations.ts`.
 */
export {
  FORMATIONS_BY_FORMAT,
  DEFAULT_FORMATIONS,
  FORMATION_OPTIONS,
  formationSize,
  playerCountOptions,
  buildFormationPlayers,
  type FormationId,
  type FormationBuildOpts,
} from '@aci/shared';

// Re-typed for the web: its DiagramV1 requires ids on arrows/areas/labels/balls.
// buildDefaultMatchDiagram seeds the ball with an id and applyFormationToTeam only
// moves players, so the stricter return type is accurate.
import * as shared from '@aci/shared';
import type { DiagramV1 } from '@/types/diagram';

export const buildDefaultMatchDiagram = shared.buildDefaultMatchDiagram as unknown as (
  ...args: Parameters<typeof shared.buildDefaultMatchDiagram>
) => DiagramV1;
export const applyFormationToTeam = shared.applyFormationToTeam as unknown as (
  ...args: Parameters<typeof shared.applyFormationToTeam>
) => DiagramV1;
