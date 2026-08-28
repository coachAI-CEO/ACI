import { useWindowDimensions } from 'react-native';

export type PitchOrientation = 'HORIZONTAL' | 'VERTICAL';

/**
 * Map device posture → board pitch orientation.
 * Portrait phone → VERTICAL (length runs top→bottom, ATT at bottom).
 * Landscape → HORIZONTAL (length runs left→right via SVG transform).
 */
export function useDevicePitchOrientation(): PitchOrientation {
  const { width, height } = useWindowDimensions();
  return width > height ? 'HORIZONTAL' : 'VERTICAL';
}
