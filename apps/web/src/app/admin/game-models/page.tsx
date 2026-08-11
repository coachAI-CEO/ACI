"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Compass, Pencil, RefreshCw, Search } from "lucide-react";
import GameModelDirectionModal, {
  getGameModelLabel,
} from "@/components/doc-hub/GameModelDirectionPanel";
import { adminFetch, getAdminHeaders } from "../_lib/api";

type PhilosophyForm = {
  attackingOrganization: string;
  defensiveTransition: string;
  defensiveOrganization: string;
  attackingTransition: string;
};

type CatalogModel = {
  value: string;
  label: string;
  summary: string;
  exclusive: boolean;
  clubCount: number;
  clubs: Array<{
    clubId: string;
    clubName: string;
    filledStages: number;
    active: boolean;
  }>;
  template: {
    philosophy: PhilosophyForm;
    filledStages: number;
    updatedAt: string;
    updatedBy: string | null;
  } | null;
};

type ClubGameModelRow = {
  clubId: string;
  clubName: string;
  clubCode: string;
  active: boolean;
  gameModelId: string;
  memberCount: number;
  philosophy: PhilosophyForm;
  filledStages: number;
  hasPhilosophy: boolean;
  philosophyUpdatedAt: string | null;
};

const EMPTY_PHILOSOPHY: PhilosophyForm = {
  attackingOrganization: "",
  defensiveTransition: "",
  defensiveOrganization: "",
  attackingTransition: "",
};

type EditorTarget =
  | { kind: "club"; clubId: string; clubName: string }
  | { kind: "template"; gameModelId: string; label: string };

export default function AdminGameModelsPage() {
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [clubs, setClubs] = useState<ClubGameModelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filterModel, setFilterModel] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);
  const [gameModelId, setGameModelId] = useState("");
  const [philosophy, setPhilosophy] = useState<PhilosophyForm>(EMPTY_PHILOSOPHY);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch<{
        ok: boolean;
        models: CatalogModel[];
        clubs: ClubGameModelRow[];
        error?: string;
      }>("/admin/game-models");
      if (!data?.ok) throw new Error(data?.error || "Failed to load game models");
      setModels(data.models || []);
      setClubs(data.clubs || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load game models");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredClubs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clubs.filter((club) => {
      if (filterModel && club.gameModelId !== filterModel) return false;
      if (!q) return true;
      return (
        club.clubName.toLowerCase().includes(q) ||
        club.clubCode.toLowerCase().includes(q) ||
        club.gameModelId.toLowerCase().includes(q)
      );
    });
  }, [clubs, filterModel, query]);

  function openClubEditor(club: ClubGameModelRow) {
    setEditorTarget({ kind: "club", clubId: club.clubId, clubName: club.clubName });
    setGameModelId(club.gameModelId);
    setPhilosophy({
      attackingOrganization: club.philosophy?.attackingOrganization || "",
      defensiveTransition: club.philosophy?.defensiveTransition || "",
      defensiveOrganization: club.philosophy?.defensiveOrganization || "",
      attackingTransition: club.philosophy?.attackingTransition || "",
    });
    setUpdatedAt(club.philosophyUpdatedAt);
    setMessage(null);
    setModalError(null);
    setModalOpen(true);
  }

  function openTemplateEditor(model: CatalogModel) {
    setEditorTarget({
      kind: "template",
      gameModelId: model.value,
      label: model.label,
    });
    setGameModelId(model.value);
    setPhilosophy({
      attackingOrganization: model.template?.philosophy?.attackingOrganization || "",
      defensiveTransition: model.template?.philosophy?.defensiveTransition || "",
      defensiveOrganization: model.template?.philosophy?.defensiveOrganization || "",
      attackingTransition: model.template?.philosophy?.attackingTransition || "",
    });
    setUpdatedAt(model.template?.updatedAt || null);
    setMessage(null);
    setModalError(null);
    setModalOpen(true);
  }

  async function savePhilosophy(opts?: { pushed?: boolean }) {
    if (!editorTarget) return;
    setSaving(true);
    setModalError(null);
    setMessage(null);
    try {
      if (editorTarget.kind === "template") {
        const data = await adminFetch<{
          ok: boolean;
          philosophy?: PhilosophyForm;
          updatedAt?: string;
          error?: string;
        }>(`/admin/game-models/${editorTarget.gameModelId}`, {
          method: "PATCH",
          body: JSON.stringify({
            attackingOrganization: philosophy.attackingOrganization,
            defensiveTransition: philosophy.defensiveTransition,
            defensiveOrganization: philosophy.defensiveOrganization,
            attackingTransition: philosophy.attackingTransition,
          }),
        });
        if (!data?.ok) throw new Error(data?.error || "Save failed");
        if (data.philosophy) {
          setPhilosophy({
            attackingOrganization: data.philosophy.attackingOrganization || "",
            defensiveTransition: data.philosophy.defensiveTransition || "",
            defensiveOrganization: data.philosophy.defensiveOrganization || "",
            attackingTransition: data.philosophy.attackingTransition || "",
          });
        }
        setUpdatedAt(data.updatedAt || null);
        setMessage(
          opts?.pushed
            ? "Template pushed. Clubs without custom DNA inherit this on next session."
            : "System game-model template saved."
        );
      } else {
        const data = await adminFetch<{
          ok: boolean;
          gameModelId?: string;
          philosophy?: PhilosophyForm;
          philosophyUpdatedAt?: string | null;
          error?: string;
        }>(`/admin/clubs/${editorTarget.clubId}/philosophy`, {
          method: "PATCH",
          body: JSON.stringify({
            gameModelId: gameModelId || undefined,
            attackingOrganization: philosophy.attackingOrganization,
            defensiveTransition: philosophy.defensiveTransition,
            defensiveOrganization: philosophy.defensiveOrganization,
            attackingTransition: philosophy.attackingTransition,
          }),
        });
        if (!data?.ok) throw new Error(data?.error || "Save failed");

        setGameModelId(data.gameModelId || gameModelId);
        setUpdatedAt(data.philosophyUpdatedAt || null);
        if (data.philosophy) {
          setPhilosophy({
            attackingOrganization: data.philosophy.attackingOrganization || "",
            defensiveTransition: data.philosophy.defensiveTransition || "",
            defensiveOrganization: data.philosophy.defensiveOrganization || "",
            attackingTransition: data.philosophy.attackingTransition || "",
          });
        }
        setMessage(
          opts?.pushed
            ? "Pushed. Club coaches are locked to this model and inherit DNA on their next session."
            : "Club game model and philosophy saved."
        );
      }
      await load();
    } catch (e: any) {
      setModalError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const modalTitleName =
    editorTarget?.kind === "template"
      ? `${editorTarget.label} (system template)`
      : editorTarget?.clubName || "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Game Models</h1>
          <p className="mt-1 text-sm text-slate-400">
            Every system model has a 4-phase DNA template. Clubs can override; otherwise the
            template is used in session generation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 px-3 text-sm text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {models.map((model) => (
          <div
            key={model.value}
            className={`rounded-2xl border p-4 text-left transition ${
              filterModel === model.value
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-slate-700/60 bg-slate-900/50"
            }`}
          >
            <button
              type="button"
              onClick={() => setFilterModel((prev) => (prev === model.value ? "" : model.value))}
              className="w-full text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold leading-snug text-white">{model.label}</span>
                {model.exclusive ? (
                  <span className="shrink-0 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">
                    Exclusive
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{model.summary}</p>
              <p className="mt-3 text-[11px] text-slate-500">
                DNA {model.template?.filledStages ?? 0}/4 · {model.clubCount} club
                {model.clubCount === 1 ? "" : "s"}
              </p>
            </button>
            <button
              type="button"
              onClick={() => openTemplateEditor(model)}
              className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-700 px-3 text-xs text-slate-200 hover:bg-slate-800"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit template
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-slate-200">
            <Compass className="h-4 w-4 text-emerald-400" />
            Club overrides
            <span className="text-slate-500">({filteredClubs.length})</span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clubs…"
              className="min-h-9 rounded-xl border border-slate-700 bg-slate-950 pl-8 pr-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {loading ? (
          <p className="px-4 py-8 text-sm text-slate-400">Loading game models…</p>
        ) : filteredClubs.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-400">No clubs match this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Club</th>
                  <th className="px-4 py-3 font-medium">Game model</th>
                  <th className="px-4 py-3 font-medium">Club DNA</th>
                  <th className="px-4 py-3 font-medium">Members</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filteredClubs.map((club) => (
                  <tr key={club.clubId} className="border-t border-slate-800/80">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-100">{club.clubName}</div>
                      <div className="text-[11px] text-slate-500">{club.clubCode}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200">
                        {getGameModelLabel(club.gameModelId)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {club.filledStages}/4 stages
                      {club.filledStages === 0 ? (
                        <span className="ml-2 text-[11px] text-slate-500">uses system template</span>
                      ) : null}
                      {!club.active ? (
                        <span className="ml-2 text-[11px] text-slate-500">inactive</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{club.memberCount}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {club.philosophyUpdatedAt
                        ? new Date(club.philosophyUpdatedAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openClubEditor(club)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-700 px-3 text-xs text-slate-200 hover:bg-slate-800"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit override
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <GameModelDirectionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        clubId={editorTarget?.kind === "club" ? editorTarget.clubId : ""}
        clubName={modalTitleName}
        gameModelId={gameModelId}
        philosophy={philosophy}
        canEdit
        allowChangeGameModel={editorTarget?.kind === "club"}
        saving={saving}
        updatedAt={updatedAt}
        message={message}
        error={modalError}
        authHeaders={getAdminHeaders}
        onGameModelChange={setGameModelId}
        onPhilosophyChange={setPhilosophy}
        onSave={(opts) => void savePhilosophy(opts)}
      />
    </div>
  );
}
