export const TRIALS_CLOSED_MESSAGE =
  "Free trials are temporarily unavailable. They'll be back soon.";

/** Closed on production unless NEXT_PUBLIC_TRIALS_ENABLED=true. Dev open unless explicitly false. */
export function trialsEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_TRIALS_ENABLED === "true") return true;
  if (process.env.NEXT_PUBLIC_TRIALS_ENABLED === "false") return false;
  return process.env.NODE_ENV !== "production";
}
