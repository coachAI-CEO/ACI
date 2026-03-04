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

export function useEnforcedGameModelScope() {
  const [enforcedGameModelId, setEnforcedGameModelId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
        if (!token) {
          if (mounted) setEnforcedGameModelId(null);
          return;
        }

        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (mounted) setEnforcedGameModelId(null);
          return;
        }
        const data = await res.json().catch(() => ({}));
        const scoped = String(data?.user?.enforcedGameModelId || "").trim();
        if (mounted) setEnforcedGameModelId(scoped || null);
      } catch {
        if (mounted) setEnforcedGameModelId(null);
      }
    };

    run();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "accessToken") run();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      mounted = false;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const scopedGameModelOptions = useMemo(
    () => getScopedGameModelOptions(enforcedGameModelId),
    [enforcedGameModelId]
  );

  return { enforcedGameModelId, scopedGameModelOptions };
}

