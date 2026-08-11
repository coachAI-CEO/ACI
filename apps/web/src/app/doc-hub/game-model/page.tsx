"use client";

import { useCallback, useEffect, useState } from "react";
import GameModelDirectionModal, {
  countFilledPhilosophyStages,
  getGameModelLabel,
} from "@/components/doc-hub/GameModelDirectionPanel";
import { useDocHub } from "../_lib/DocHubContext";
import { EMPTY_PHILOSOPHY, type PhilosophyForm } from "../_lib/types";
import { authHeaders, btnPrimary } from "../_lib/utils";

export default function DocHubGameModelPage() {
  const { access, selectedClubId, canEditPhilosophy, selectedClub } = useDocHub();
  const [philosophy, setPhilosophy] = useState<PhilosophyForm>(EMPTY_PHILOSOPHY);
  const [gameModelId, setGameModelId] = useState("");
  const [clubName, setClubName] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async (clubId: string) => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/philosophy`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load club philosophy");
      setClubName(data.clubName || "");
      setGameModelId(data.gameModelId || "");
      setUpdatedAt(data.philosophyUpdatedAt || null);
      setPhilosophy({
        attackingOrganization: data.philosophy?.attackingOrganization || "",
        defensiveTransition: data.philosophy?.defensiveTransition || "",
        defensiveOrganization: data.philosophy?.defensiveOrganization || "",
        attackingTransition: data.philosophy?.attackingTransition || "",
      });
    } catch (e: any) {
      setError(e?.message || "Failed to load club philosophy");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (access === "allowed" && selectedClubId) void load(selectedClubId);
  }, [access, selectedClubId, load]);

  async function savePhilosophy(opts?: { pushed?: boolean }) {
    if (!selectedClubId || !canEditPhilosophy) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/doc-hub/clubs/${selectedClubId}/philosophy`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          attackingOrganization: philosophy.attackingOrganization,
          defensiveTransition: philosophy.defensiveTransition,
          defensiveOrganization: philosophy.defensiveOrganization,
          attackingTransition: philosophy.attackingTransition,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || data?.message || "Save failed");
      }
      setGameModelId(data.gameModelId || gameModelId);
      setUpdatedAt(data.philosophyUpdatedAt || null);
      setPhilosophy({
        attackingOrganization: data.philosophy?.attackingOrganization || "",
        defensiveTransition: data.philosophy?.defensiveTransition || "",
        defensiveOrganization: data.philosophy?.defensiveOrganization || "",
        attackingTransition: data.philosophy?.attackingTransition || "",
      });
      setMessage(
        opts?.pushed
          ? "Saved. Club coaches are locked to this game model and inherit the philosophy on their next session."
          : "Club game model and philosophy saved."
      );
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Game Model</h1>
        <p className="mt-1 text-sm text-slate-400">
          Club session engine — locked model + 4-moment DNA
          {selectedClub?.clubName ? ` · ${selectedClub.clubName}` : ""}
        </p>
      </div>

      {!selectedClubId ? (
        <p className="text-sm text-slate-400">No club available for philosophy editing yet.</p>
      ) : loading ? (
        <p className="text-sm text-slate-400">Loading club philosophy…</p>
      ) : (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <p className="text-sm text-slate-300">
                Injected into coach sessions as mandatory club DNA. Open the editor workspace to
                refine language with AI assist.
              </p>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-200">
                  {getGameModelLabel(gameModelId)}
                </span>
                <span className="rounded border border-slate-600 px-2 py-1 text-slate-300">
                  Stages {countFilledPhilosophyStages(philosophy)}/4
                </span>
                {updatedAt ? (
                  <span className="rounded border border-slate-600 px-2 py-1 text-slate-400">
                    Saved {new Date(updatedAt).toLocaleString()}
                  </span>
                ) : (
                  <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-200">
                    Not saved yet
                  </span>
                )}
                {!canEditPhilosophy ? (
                  <span className="rounded border border-slate-600 px-2 py-1 text-slate-400">
                    Read-only
                  </span>
                ) : null}
              </div>
              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
              {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
            </div>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                setMessage(null);
                setError(null);
                setModalOpen(true);
              }}
            >
              {canEditPhilosophy ? "Edit Game Model" : "View Game Model"}
            </button>
          </div>
        </div>
      )}

      <GameModelDirectionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        clubId={selectedClubId}
        clubName={clubName || selectedClub?.clubName || ""}
        gameModelId={gameModelId}
        philosophy={philosophy}
        canEdit={canEditPhilosophy}
        saving={saving}
        updatedAt={updatedAt}
        message={message}
        error={error}
        authHeaders={authHeaders}
        onPhilosophyChange={setPhilosophy}
        onSave={(opts) => void savePhilosophy(opts)}
      />
    </div>
  );
}
