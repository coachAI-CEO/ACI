/**
 * Web type re-exports for the tactical board.
 *
 * The canonical type lives in `@aci/shared` (`packages/shared/src/types/tactical-board.ts`).
 * This file re-exports under the `Diagram*` names that the web app uses so
 * existing imports (`import { DiagramV1 } from '@/types/diagram'`) keep
 * working without a 30-file refactor.
 *
 * If you need to add a field: add it to the shared type and to the API Zod
 * schema. Then both apps pick it up automatically.
 */
import type {
  WebDiagramArea,
  WebDiagramArrow,
  WebDiagramArrowStyle,
  WebDiagramArrowType,
  WebDiagramArrowWeight,
  WebDiagramBall,
  WebDiagramCoach,
  WebDiagramCone,
  WebDiagramElement,
  WebDiagramElementKind,
  WebDiagramFrameLayers,
  WebDiagramGoal,
  WebDiagramLabel,
  WebDiagramPitch,
  WebDiagramPlayer,
  WebDiagramPointRef,
  WebDiagramSequence,
  WebDiagramSequenceFrame,
  WebDiagramTeam,
  WebDiagramV1,
  WebDiagramZones,
} from '@aci/shared';

export type DiagramTeamCode = WebDiagramTeam;
export type DiagramZones = WebDiagramZones;
export type DiagramPitchZones = WebDiagramZones;
export type DiagramPitch = WebDiagramPitch;
export type DiagramGoal = WebDiagramGoal;
export type DiagramElementKind = WebDiagramElementKind;
export type DiagramElement = WebDiagramElement;
export type DiagramPlayer = WebDiagramPlayer;
export type DiagramCoach = WebDiagramCoach;
export type DiagramPointRef = WebDiagramPointRef;
export type DiagramArrowType = WebDiagramArrowType;
export type DiagramArrowStyle = WebDiagramArrowStyle;
export type DiagramArrowWeight = WebDiagramArrowWeight;
export type DiagramArrow = WebDiagramArrow & { id: string };
export type DiagramArea = WebDiagramArea & { id: string };
export type DiagramLabel = WebDiagramLabel & { id: string };
export type DiagramBall = WebDiagramBall & { id: string };
export type DiagramCone = WebDiagramCone;

// The web editor selects/deletes objects by id and Play matches them across
// frames, so here arrows, areas, labels and balls carry a REQUIRED id. In the
// shared type the id is optional (the API and mobile app may omit it); the
// shared id helpers (`ensureDiagramObjectIds`) stamp the missing ones.
type IdLayerKeys = 'arrows' | 'areas' | 'labels' | 'balls';
export type DiagramFrameLayers = Omit<WebDiagramFrameLayers, IdLayerKeys> & {
  arrows: DiagramArrow[];
  areas: DiagramArea[];
  labels: DiagramLabel[];
  balls?: DiagramBall[];
};
export type DiagramSequenceFrame = DiagramFrameLayers & {
  id: string;
  title?: string;
  note?: string;
  durationMs?: number;
};
export type DiagramSequence = {
  activeFrameId: string;
  frames: DiagramSequenceFrame[];
};
export type DiagramV1 = Omit<WebDiagramV1, IdLayerKeys | 'sequence'> & {
  arrows: DiagramArrow[];
  areas: DiagramArea[];
  labels: DiagramLabel[];
  balls?: DiagramBall[];
  sequence?: DiagramSequence;
};

// Note: types are erased at runtime — re-exports under both names are
// guaranteed to refer to the same TSC-instantiated shape because they
// all resolve to the same WebDiagram* declarations from @aci/shared.
