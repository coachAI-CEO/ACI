export function mondayWeekStartIso(d = new Date()): string {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = utc.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  utc.setUTCDate(utc.getUTCDate() + offset);
  return utc.toISOString().slice(0, 10);
}

export function shiftWeek(weekStart: string, deltaWeeks: number): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaWeeks * 7);
  return dt.toISOString().slice(0, 10);
}

export function statusPill(status: string) {
  if (status === "heavy") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (status === "active") return "bg-cyan-500/15 text-cyan-300 border-cyan-400/30";
  if (status === "low") return "bg-amber-500/15 text-amber-300 border-amber-400/30";
  return "bg-rose-500/15 text-rose-300 border-rose-400/30";
}

export function severityPill(severity: string) {
  if (severity === "high") return "bg-rose-500/15 text-rose-300 border-rose-400/30";
  if (severity === "medium") return "bg-amber-500/15 text-amber-300 border-amber-400/30";
  return "bg-cyan-500/15 text-cyan-300 border-cyan-400/30";
}

export const btnSecondary =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-slate-600 bg-transparent px-3 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-40";
export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-600 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40";
export const btnQuiet =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-slate-700 bg-transparent px-3 text-sm text-slate-300";
export const btnPrimarySm =
  "inline-flex h-8 items-center justify-center rounded-lg bg-emerald-600 px-2.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40";
export const btnSecondarySm =
  "inline-flex h-8 items-center justify-center rounded-lg border border-slate-600 bg-transparent px-2.5 text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-40";

export function authHeaders(): HeadersInit {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const CLUB_STORAGE_KEY = "docHub.selectedClubId";

export function readStoredClubId(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(CLUB_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function writeStoredClubId(clubId: string) {
  if (typeof window === "undefined") return;
  try {
    if (clubId) localStorage.setItem(CLUB_STORAGE_KEY, clubId);
    else localStorage.removeItem(CLUB_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
