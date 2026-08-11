"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import ThemedConfirmModal from "@/components/ThemedConfirmModal";
import { useEnforcedGameModelScope } from "@/lib/game-model-scope";

function normalizeCoachLevel(value: unknown): "USSF_D" | "USSF_C" | "USSF_B_PLUS" {
  const raw = String(value || "").trim().toUpperCase();
  const v = raw
    .replace(/\+/g, " PLUS ")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (v === "USSF_B_PLUS" || v === "USSF_B" || v === "USSF_A" || v === "USSF_A_PLUS") return "USSF_B_PLUS";
  if (v === "USSF_C") return "USSF_C";
  return "USSF_D"; // also covers legacy "GRASSROOTS" and D-license phrasing
}

export default function SessionFormWithLoading({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { enforcedGameModelId, scopeReady } = useEnforcedGameModelScope();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!scopeReady) {
      return;
    }

    const form = e.currentTarget;
    const formData = new FormData(form);
    const params = new URLSearchParams();

    const sessionModeInputs = form.querySelectorAll('input[name="sessionMode"]') as NodeListOf<HTMLInputElement>;
    const selectedMode = Array.from(sessionModeInputs).find(input => input.checked)?.value || "single";

    formData.forEach((value, key) => {
      if (value && value !== "false" && key !== "sessionMode") {
        params.append(key, value.toString());
      }
    });

    if (enforcedGameModelId) {
      params.set("gameModelId", enforcedGameModelId);
    }

    const normalizedCoachLevel = normalizeCoachLevel(formData.get("coachLevel"));
    params.set("coachLevel", normalizedCoachLevel);

    if (selectedMode === "series") {
      params.append("series", "true");
      const numberOfSessions = formData.get("numberOfSessions") || "3";
      params.append("numberOfSessions", numberOfSessions.toString());
    } else {
      params.append("series", "false");
    }

    const numberOfSessions = Number(formData.get("numberOfSessions") || "3");
    const confirmMessage =
      selectedMode === "series"
        ? `Generate a new ${numberOfSessions}-session series with these settings?`
        : "Generate a new session with these settings?";
    // Ensure generation runs even when form values are unchanged.
    params.set("_run", String(Date.now()));
    const nextUrl = `/demo/session?${params.toString()}`;
    setPendingUrl(nextUrl);
    setConfirmMessage(confirmMessage);
    setConfirmOpen(true);
  };

  return (
    <>
      <form onSubmit={handleSubmit} method="GET">
        {children}
      </form>
      <ThemedConfirmModal
        open={confirmOpen}
        title="Start Generation"
        message={confirmMessage}
        confirmLabel="Generate"
        cancelLabel="Cancel"
        onCancel={() => {
          setConfirmOpen(false);
          setPendingUrl(null);
        }}
        onConfirm={() => {
          if (pendingUrl) {
            router.push(pendingUrl);
          }
          setConfirmOpen(false);
          setPendingUrl(null);
        }}
      />
    </>
  );
}
