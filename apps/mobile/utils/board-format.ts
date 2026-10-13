import type { WebDiagramV1 } from '@aci/shared';
import {
  type PitchFormatId,
  type PitchZoom,
  formatFromAgeGroup,
} from '@aci/shared';

/**
 * Resolve the pitch format for a board. Prefer the explicit
 * `diagram.pitch.format` when set (the editor writes it). Fall back to the
 * age-group heuristic for legacy boards.
 *
 * `WebDiagramV1` doesn't make `pitch.format` required because older payloads
 * didn't carry it — `apps/api/src/services/web-diagram-v1.ts` has a similar
 * fallback. This is the mobile equivalent.
 */
export function formatFromBoard(
  board: { ageGroup?: string | null; diagram?: WebDiagramV1 | null } | null | undefined
): PitchFormatId {
  const explicit = board?.diagram?.pitch?.format;
  if (explicit === '7V7' || explicit === '9V9' || explicit === '11V11') {
    return explicit;
  }
  return formatFromAgeGroup(board?.ageGroup);
}

/** Default zoom when a board is opened. The editor writes FULL by default. */
export function defaultZoomForBoard(): PitchZoom {
  return 'FULL';
}
