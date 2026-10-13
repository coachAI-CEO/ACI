"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { readStoredUser } from "@/lib/doc-hub-access";
import type { ClubOption, TeamSummary } from "./types";
import { fetchAuthMe } from "@/lib/auth-me";
import { authHeaders, readStoredTeamId, writeStoredTeamId } from "./utils";

type AccessState = "checking" | "allowed" | "denied";

type CoachCenterContextValue = {
  access: AccessState;
  teams: TeamSummary[];
  clubs: ClubOption[];
  selectedTeamId: string;
  setSelectedTeamId: (teamId: string) => void;
  selectedTeam: TeamSummary | null;
  canViewAllTeams: boolean;
  accessError: string | null;
  refresh: () => Promise<void>;
};

const CoachCenterContext = createContext<CoachCenterContextValue | null>(null);

export function CoachCenterProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<AccessState>("checking");
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [selectedTeamId, setSelectedTeamIdState] = useState("");
  const [accessError, setAccessError] = useState<string | null>(null);
  const [canViewAllTeams, setCanViewAllTeams] = useState(false);

  const setSelectedTeamId = useCallback((teamId: string) => {
    setSelectedTeamIdState(teamId);
    writeStoredTeamId(teamId);
  }, []);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setAccess("denied");
      return;
    }
    const res = await fetch("/api/coach-center/access", { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setAccessError(data?.error || "Could not load Coach Center");
      setAccess(localStorage.getItem("accessToken") ? "allowed" : "denied");
      return;
    }
    setAccess("allowed");
    setAccessError(null);
    setCanViewAllTeams(!!data.canViewAllTeams);
    const nextTeams: TeamSummary[] = data.teams || [];
    setTeams(nextTeams);
    setClubs(data.clubs || []);
    setSelectedTeamIdState((current) => {
      const stored = current || readStoredTeamId();
      const next = nextTeams.some((t) => t.id === stored) ? stored : nextTeams[0]?.id || "";
      writeStoredTeamId(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setAccess("denied");
      return;
    }
    setAccess(readStoredUser() ? "allowed" : "checking");
    void refresh();
    void fetchAuthMe().then((data) => {
      if (!data?.ok) setAccess("denied");
    });
  }, [refresh]);

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId) || null,
    [teams, selectedTeamId]
  );

  const value = useMemo(
    () => ({
      access,
      teams,
      clubs,
      selectedTeamId,
      setSelectedTeamId,
      selectedTeam,
      canViewAllTeams,
      accessError,
      refresh,
    }),
    [access, teams, clubs, selectedTeamId, setSelectedTeamId, selectedTeam, canViewAllTeams, accessError, refresh]
  );

  return <CoachCenterContext.Provider value={value}>{children}</CoachCenterContext.Provider>;
}

export function useCoachCenter() {
  const ctx = useContext(CoachCenterContext);
  if (!ctx) throw new Error("useCoachCenter must be used inside CoachCenterProvider");
  return ctx;
}
