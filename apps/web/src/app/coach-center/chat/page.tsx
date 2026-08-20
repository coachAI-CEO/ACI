"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCoachCenter } from "../_lib/CoachCenterContext";
import type { ChatMessage } from "../_lib/types";
import { authHeaders } from "../_lib/utils";

export default function CoachCenterChatPage() {
  const { selectedTeam, selectedTeamId, access } = useCoachCenter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (teamId: string) => {
    const res = await fetch(`/api/coach-center/teams/${teamId}/chat`, { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) setMessages(data.messages || []);
  }, []);

  useEffect(() => {
    if (access === "allowed" && selectedTeamId) void load(selectedTeamId);
  }, [access, selectedTeamId, load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeamId || !input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: text, createdAt: new Date().toISOString() },
    ]);
    try {
      const res = await fetch(`/api/coach-center/teams/${selectedTeamId}/chat`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok && data.message) {
        setMessages((prev) => [...prev, data.message]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: data?.message || data?.error || "Could not reply just now.",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setSending(false);
    }
  }

  if (!selectedTeam) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-700/60 bg-slate-900 p-8 text-center">
        <h1 className="text-lg font-semibold text-white">Chat follows your team and season</h1>
        <Link href="/coach-center/team" className="mt-6 inline-flex min-h-11 items-center rounded-md bg-sky-600 px-4 text-sm font-medium text-white">
          Create your team
        </Link>
      </div>
    );
  }

  const week = selectedTeam.season?.currentWeek;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Season chat</h1>
        <p className="mt-1 text-sm text-slate-400">
          Talk about {selectedTeam.name}, this week&apos;s training, and the next match.
          {week ? ` Current theme: ${week.theme}.` : ""}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4 text-sm text-slate-300">
            Ask how the team should train this week, what to do after last session, or how to prepare
            Saturday&apos;s match. I already know your age group, game model, and curriculum week.
          </div>
        ) : null}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-2xl whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${
              m.role === "user"
                ? "ml-auto bg-sky-600 text-white"
                : "bg-slate-800 text-slate-200"
            }`}
          >
            {m.content}
          </div>
        ))}
        {sending ? <p className="text-xs text-slate-500">Thinking with this week&apos;s plan…</p> : null}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="mt-3 flex gap-2">
        <textarea
          className="min-h-11 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask about ${selectedTeam.name}…`}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="self-end rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
