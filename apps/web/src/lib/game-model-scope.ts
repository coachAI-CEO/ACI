"use client";

import { useEffect, useMemo, useState } from "react";

export type GameModelId =
  | "POSSESSION"
  | "PRESSING"
  | "TRANSITION"
  | "COACHAI"
  | "ROCKLIN_FC";

export const GAME_MODEL_OPTIONS: Array<{ value: GameModelId; label: string }> = [
  { value: "POSSESSION", label: "Possession" },
  { value: "PRESSING", label: "Pressing" },
  { value: "TRANSITION", label: "Transition" },
  { value: "COACHAI", label: "Balanced (CoachAI)" },
  { value: "ROCKLIN_FC", label: "Rocklin FC" },
];

export function getScopedGameModelOptions(enforcedGameModelId: string | null) {
  if (!enforcedGameModelId) return GAME_MODEL_OPTIONS;
  return GAME_MODEL_OPTIONS.filter((option) => option.value === enforcedGameModelId);
}

type ScopeState = {
  enforcedGameModelId: string | null;
  /** False until /auth/me finishes — avoid flashing every game model. */
  scopeReady: boolean;
};

export function useEnforcedGameModelScope() {
  const [state, setState] = useState<ScopeState>({
    enforcedGameModelId: null,
    scopeReady: false,
  });

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
        if (!token) {
          if (mounted) setState({ enforcedGameModelId: null, scopeReady: true });
          return;
        }

        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (mounted) setState({ enforcedGameModelId: null, scopeReady: true });
          return;
        }
        const data = await res.json().catch(() => ({}));
        const scoped = String(data?.user?.enforcedGameModelId || "").trim();
        if (mounted) {
          setState({
            enforcedGameModelId: scoped || null,
            scopeReady: true,
          });
        }
      } catch {
        if (mounted) setState({ enforcedGameModelId: null, scopeReady: true });
      }
    };

    run();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "accessToken") {
        setState((prev) => ({ ...prev, scopeReady: false }));
        run();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      mounted = false;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const scopedGameModelOptions = useMemo(
    () => getScopedGameModelOptions(state.enforcedGameModelId),
    [state.enforcedGameModelId]
  );

  return {
    enforcedGameModelId: state.enforcedGameModelId,
    scopeReady: state.scopeReady,
    scopedGameModelOptions,
  };
}
