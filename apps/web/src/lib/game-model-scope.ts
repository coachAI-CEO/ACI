"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import { fetchAuthMe, peekEnforcedGameModelId } from "@/lib/auth-me";

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
  /** False until login payload or /auth/me finishes — avoid flashing every game model. */
  scopeReady: boolean;
};

export function useEnforcedGameModelScope() {
  const [state, setState] = useState<ScopeState>({
    enforcedGameModelId: null,
    scopeReady: false,
  });

  useLayoutEffect(() => {
    let mounted = true;

    const applyPeek = () => {
      const peeked = peekEnforcedGameModelId();
      if (!mounted || !peeked.ready) return;
      setState({
        enforcedGameModelId: peeked.value,
        scopeReady: true,
      });
    };

    const run = async () => {
      applyPeek();
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
        if (!token) {
          if (mounted) setState({ enforcedGameModelId: null, scopeReady: true });
          return;
        }

        const data = await fetchAuthMe();
        if (!mounted) return;
        if (!data?.ok) {
          applyPeek();
          if (!peekEnforcedGameModelId().ready) {
            setState({ enforcedGameModelId: null, scopeReady: true });
          }
          return;
        }
        const scoped = String(data?.user?.enforcedGameModelId || "").trim();
        setState({
          enforcedGameModelId: scoped || null,
          scopeReady: true,
        });
      } catch {
        if (mounted) {
          applyPeek();
          if (!peekEnforcedGameModelId().ready) {
            setState({ enforcedGameModelId: null, scopeReady: true });
          }
        }
      }
    };

    run();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "accessToken" || e.key === "user") {
        setState((prev) => ({ ...prev, scopeReady: false }));
        run();
      }
    };
    const onLogin = () => {
      applyPeek();
      run();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("userLogin", onLogin);
    return () => {
      mounted = false;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("userLogin", onLogin);
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
