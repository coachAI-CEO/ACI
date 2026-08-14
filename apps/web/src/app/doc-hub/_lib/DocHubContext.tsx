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
import { canAccessDocHub, readStoredUser } from "@/lib/doc-hub-access";
import type { ClubOption } from "./types";
import { fetchAuthMe } from "@/lib/auth-me";
import { authHeaders, readStoredClubId, writeStoredClubId } from "./utils";

type AccessState = "checking" | "allowed" | "denied";

type DocHubContextValue = {
  access: AccessState;
  clubOptions: ClubOption[];
  selectedClubId: string;
  setSelectedClubId: (clubId: string) => void;
  canEditPhilosophy: boolean;
  accessError: string | null;
  selectedClub: ClubOption | null;
};

const DocHubContext = createContext<DocHubContextValue | null>(null);

export function DocHubProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<AccessState>("checking");
  const [clubOptions, setClubOptions] = useState<ClubOption[]>([]);
  const [selectedClubId, setSelectedClubIdState] = useState("");
  const [canEditPhilosophy, setCanEditPhilosophy] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  const setSelectedClubId = useCallback((clubId: string) => {
    setSelectedClubIdState(clubId);
    writeStoredClubId(clubId);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const applyUser = (user: unknown) => {
      if (cancelled) return;
      setAccess(canAccessDocHub(user as any) ? "allowed" : "denied");
    };

    applyUser(readStoredUser());

    const token = localStorage.getItem("accessToken");
    if (!token) {
      setAccess("denied");
      return;
    }

    fetchAuthMe()
      .then((data) => {
        if (data?.ok && data.user) {
          applyUser(data.user);
        }
      })
      .catch(() => {
        /* keep localStorage decision */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (access !== "allowed") return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/doc-hub/access", { headers: authHeaders() });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data?.ok) {
          setAccessError(data?.message || data?.error || "Could not load DOC Hub club access.");
          return;
        }

        setCanEditPhilosophy(Boolean(data.canEditPhilosophy));
        setAccessError(null);

        const fromMemberships: ClubOption[] = (data.memberships || []).map(
          (m: { clubId: string; clubName: string; role: string }) => ({
            clubId: m.clubId,
            clubName: m.clubName,
            role: m.role,
          })
        );
        const fromPreview: ClubOption[] = (data.previewClubs || []).map(
          (c: { id: string; name: string }) => ({
            clubId: c.id,
            clubName: c.name,
            role: "SUPER_ADMIN",
          })
        );
        const options = fromMemberships.length > 0 ? fromMemberships : fromPreview;
        setClubOptions(options);

        const stored = readStoredClubId();
        const preferred =
          (stored && options.some((o) => o.clubId === stored) && stored) ||
          options[0]?.clubId ||
          "";
        if (preferred) setSelectedClubId(preferred);
        if (options.length === 0) {
          setAccessError("No club membership found for this DOC account.");
        }
      } catch {
        if (!cancelled) setAccessError("Could not load DOC Hub club access.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [access, setSelectedClubId]);

  const selectedClub = useMemo(
    () => clubOptions.find((c) => c.clubId === selectedClubId) || null,
    [clubOptions, selectedClubId]
  );

  const value = useMemo(
    () => ({
      access,
      clubOptions,
      selectedClubId,
      setSelectedClubId,
      canEditPhilosophy,
      accessError,
      selectedClub,
    }),
    [
      access,
      clubOptions,
      selectedClubId,
      setSelectedClubId,
      canEditPhilosophy,
      accessError,
      selectedClub,
    ]
  );

  return <DocHubContext.Provider value={value}>{children}</DocHubContext.Provider>;
}

export function useDocHub() {
  const ctx = useContext(DocHubContext);
  if (!ctx) throw new Error("useDocHub must be used within DocHubProvider");
  return ctx;
}
