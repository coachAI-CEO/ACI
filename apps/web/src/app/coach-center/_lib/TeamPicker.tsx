"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Search } from "lucide-react";
import type { TeamSummary } from "./types";
import { TEAM_GROUP_ORDER, teamPickerGroup } from "./utils";

export function TeamPicker({
  teams,
  selectedTeamId,
  onChange,
  compact = false,
  label = "Team",
}: {
  teams: TeamSummary[];
  selectedTeamId: string;
  onChange: (teamId: string) => void;
  compact?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = teams.find((t) => t.id === selectedTeamId) || null;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? teams.filter((t) =>
          `${t.name} ${t.ageGroup} ${t.clubName || ""} ${t.notes || ""}`.toLowerCase().includes(q)
        )
      : teams;
    const byGroup = new Map<string, TeamSummary[]>();
    for (const team of filtered) {
      const key = teamPickerGroup(team);
      const list = byGroup.get(key) || [];
      list.push(team);
      byGroup.set(key, list);
    }
    return [...byGroup.entries()].sort(([a], [b]) => {
      const ai = TEAM_GROUP_ORDER.indexOf(a);
      const bi = TEAM_GROUP_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [teams, query]);

  if (teams.length === 0) return null;

  return (
    <div ref={rootRef} className={`relative ${compact ? "w-full" : "w-[280px]"}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-2 text-left text-xs text-slate-200 hover:border-slate-600"
      >
        <span className="min-w-0 flex-1 truncate">
          {selected ? `${selected.name} · ${selected.ageGroup}` : "Select a team"}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
      </button>
      {open ? (
        <div
          className={`absolute z-50 overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-xl ${
            compact ? "bottom-full left-0 right-0 mb-1" : "left-0 right-0 top-full mt-1"
          }`}
        >
          <div className="flex items-center gap-2 border-b border-slate-800 px-2.5 py-2">
            <Search className="h-3.5 w-3.5 text-slate-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="w-full bg-transparent text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {groups.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-500">No matching teams</p>
            ) : (
              groups.map(([group, items]) => (
                <div key={group}>
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {group}
                  </p>
                  {items.map((team) => (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => {
                        onChange(team.id);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs ${
                        team.id === selectedTeamId
                          ? "bg-sky-500/15 text-sky-200"
                          : "text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <span className="truncate">{team.name}</span>
                      <span className="ml-2 shrink-0 text-[10px] text-slate-500">{team.ageGroup}</span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
