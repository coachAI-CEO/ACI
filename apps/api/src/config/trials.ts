export const TRIALS_CLOSED_MESSAGE =
  "Free trials are temporarily unavailable. They'll be back soon.";

/** Closed on production unless TRIALS_ENABLED=true. Dev open unless TRIALS_ENABLED=false. */
export function trialsEnabled(): boolean {
  if (process.env.TRIALS_ENABLED === "true") return true;
  if (process.env.TRIALS_ENABLED === "false") return false;
  return process.env.NODE_ENV !== "production";
}
