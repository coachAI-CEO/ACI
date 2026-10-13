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

export const btnSecondary =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-slate-600 bg-transparent px-3 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-40";
export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-sky-600 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40";
export const btnQuiet =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-slate-700 bg-transparent px-3 text-sm text-slate-300";
export const btnPrimarySm =
  "inline-flex h-8 items-center justify-center rounded-lg bg-sky-600 px-2.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40";
export const btnSecondarySm =
  "inline-flex h-8 items-center justify-center rounded-lg border border-slate-600 bg-transparent px-2.5 text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-40";

export function authHeaders(): HeadersInit {
  const token = typeof window === "undefined" ? null : localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const TEAM_STORAGE_KEY = "coachCenter.selectedTeamId";

export function readStoredTeamId(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(TEAM_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function writeStoredTeamId(teamId: string) {
  if (typeof window === "undefined") return;
  try {
    if (teamId) localStorage.setItem(TEAM_STORAGE_KEY, teamId);
    else localStorage.removeItem(TEAM_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export const MOMENT_LABELS: Record<string, string> = {
  attackingOrganization: "Attacking organization",
  attackingTransition: "Attacking transition",
  defensiveOrganization: "Defensive organization",
  defensiveTransition: "Defensive transition",
};

export const PHASE_LABELS: Record<string, string> = {
  ATTACKING: "Attacking",
  DEFENDING: "Defending",
  TRANSITION: "Transition",
};

export const ZONE_LABELS: Record<string, string> = {
  DEFENSIVE_THIRD: "Defensive third",
  MIDDLE_THIRD: "Middle third",
  ATTACKING_THIRD: "Attacking third",
};

export const COACH_LEVEL_LABELS: Record<string, string> = {
  USSF_D: "USSF D",
  USSF_C: "USSF C",
  USSF_B_PLUS: "USSF B+",
};

export const PLAYER_LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

export const TEAM_BAND_LABELS: Record<string, string> = {
  NPL: "NPL / ECRL",
  NAVY: "Navy / Pre-NPL",
  DEVELOPMENT: "White / Grey",
};

export const CURRICULUM_SECTIONS = [
  { id: "attackingOrganization", label: "Attacking organization" },
  { id: "attackingTransition", label: "Attacking transition" },
  { id: "defensiveOrganization", label: "Defensive organization" },
  { id: "defensiveTransition", label: "Defensive transition" },
] as const;

export const TEAM_GROUP_ORDER = [
  "Girls 11v11",
  "Girls 9v9",
  "Girls 7v7",
  "Boys 11v11",
  "Boys 9v9",
  "Boys 7v7",
];

export function teamPickerGroup(team: { name: string; notes?: string | null; clubName?: string | null }): string {
  const notes = (team.notes || "").trim();
  if (/girls|boys/i.test(notes) && /7v7|9v9|11v11/i.test(notes)) return notes;
  const gender = /girls/i.test(team.name) ? "Girls" : /boys/i.test(team.name) ? "Boys" : "";
  const format = notes.match(/7v7|9v9|11v11/i)?.[0] || "";
  return [gender, format].filter(Boolean).join(" ") || team.clubName || "Teams";
}
