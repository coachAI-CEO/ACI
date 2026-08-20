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
  switchingTeam: boolean;
  finishTeamSwitch: (loadedTeamId: string) => void;
};

const CoachCenterContext = createContext<CoachCenterContextValue | null>(null);

export function CoachCenterProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<AccessState>("checking");
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [selectedTeamId, setSelectedTeamIdState] = useState("");
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [canViewAllTeams, setCanViewAllTeams] = useState(false);

  const finishTeamSwitch = useCallback((loadedTeamId: string) => {
    setSwitchingTo((current) => (current === loadedTeamId ? null : current));
  }, []);

  const setSelectedTeamId = useCallback((teamId: string) => {
    setSelectedTeamIdState((current) => {
      if (teamId && teamId !== current) setSwitchingTo(teamId);
      return teamId;
    });
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
      switchingTeam: Boolean(switchingTo),
      finishTeamSwitch,
    }),
    [access, teams, clubs, selectedTeamId, setSelectedTeamId, selectedTeam, canViewAllTeams, accessError, refresh, switchingTo, finishTeamSwitch]
  );

  return <CoachCenterContext.Provider value={value}>{children}</CoachCenterContext.Provider>;
}

export function useCoachCenter() {
  const ctx = useContext(CoachCenterContext);
  if (!ctx) throw new Error("useCoachCenter must be used inside CoachCenterProvider");
  return ctx;
}

/** Call after a page finishes loading data for the current team. */
export function useFinishTeamSwitch(ready: boolean) {
  const { selectedTeamId, switchingTeam, finishTeamSwitch } = useCoachCenter();
  useEffect(() => {
    if (!switchingTeam || !ready || !selectedTeamId) return;
    finishTeamSwitch(selectedTeamId);
  }, [switchingTeam, ready, selectedTeamId, finishTeamSwitch]);
}
