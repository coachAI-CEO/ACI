/**
 * Post-process goalMode / goalsSupported on the drill JSON
 * based on the request input.goalsAvailable.
 *
 * Mapping:
 *  - goalsAvailable <= 0 → goalMode = 0
 *  - goalsAvailable == 1 → goalMode = 1
 *  - goalsAvailable >= 2 → goalMode = 2
 *
 * Writes both goalMode and goalsSupported onto the inner JSON
 * (drill.json) when present, or directly on the drill object.
 */
export function postProcessGoalMode(drill: any, input: any) {
  if (!drill || !input) return drill;

  const goalsAvailable = (input as any).goalsAvailable;
  if (goalsAvailable === undefined || goalsAvailable === null) {
    return drill;
  }

  let goalMode: 0 | 1 | 2;
  if (goalsAvailable <= 0) {
    goalMode = 0;
  } else if (goalsAvailable === 1) {
    goalMode = 1;
  } else {
    goalMode = 2;
  }

  const target = (drill as any).json ?? drill;
  if (target && typeof target === "object") {
    (target as any).goalMode = goalMode;
    (target as any).goalsSupported = goalMode;
  }

  return drill;
}
