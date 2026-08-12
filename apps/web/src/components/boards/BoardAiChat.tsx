"use client";

import * as React from "react";
import type { DiagramV1 } from "@/types/diagram";
import { boardAiChat } from "@/lib/boards";

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  applied?: boolean;
};

type Props = {
  boardId: string;
  diagram: DiagramV1;
  canEdit: boolean;
  gameModelId?: string | null;
  ageGroup?: string | null;
  coachLevel?: string | null;
  playerLevel?: string | null;
  onApplyDiagram: (diagram: DiagramV1) => void;
};

const WELCOME: ChatMsg = {
  id: "welcome",
  role: "assistant",
  content:
    "Describe a scenario and I’ll set it on the board using your club’s game model.\n\nLanguage follows your coach level from Settings; player demand is matched to that level (Beginner only for USSF D).\n\nIf it’s vague, I’ll ask for formations, where (left / central / right), and phase before drawing.\n\nExamples:\n• “7v7 ATT 2-3-1 vs DEF 3-2-1, left channel, Defensive Transition — press after loss in their defensive third”\n• “11v11 4-3-3 vs 4-4-2, central, Attacking Organization — switch from LB to RW”\n• Or say “just draw it” to use defaults",
};

function formatCoachLevel(level?: string | null) {
  const v = String(level || "").toUpperCase();
  if (v === "USSF_B_PLUS" || v === "USSF_B") return "USSF B+";
  if (v === "USSF_C") return "USSF C";
  if (v === "USSF_D") return "USSF D";
  return null;
}

function formatPlayerLevel(level?: string | null) {
  const v = String(level || "").toUpperCase();
  if (v === "BEGINNER") return "Beginner";
  if (v === "INTERMEDIATE") return "Intermediate";
  if (v === "ADVANCED") return "Advanced";
  return null;
}

/** Mirror API resolveBoardAudience for header display before first AI reply. */
function derivePlayerLevel(coachLevel?: string | null, ageGroup?: string | null): string | null {
  if (!coachLevel) return null;
  const coach = String(coachLevel).toUpperCase();
  const years = parseInt(String(ageGroup || "").replace(/\D/g, ""), 10);
  const y = Number.isFinite(years) ? years : null;
  if (coach === "USSF_D" || coach === "D") {
    return y != null && y >= 13 ? "INTERMEDIATE" : "BEGINNER";
  }
  if (coach === "USSF_B_PLUS" || coach === "USSF_B" || coach === "B+" || coach === "B") {
    return y != null && y >= 15 ? "ADVANCED" : "INTERMEDIATE";
  }
  if (coach === "USSF_C" || coach === "C") {
    return y != null && y >= 16 ? "ADVANCED" : "INTERMEDIATE";
  }
  return null;
}

export default function BoardAiChat({
  boardId,
  diagram,
  canEdit,
  gameModelId,
  ageGroup,
  coachLevel,
  playerLevel,
  onApplyDiagram,
}: Props) {
  const [messages, setMessages] = React.useState<ChatMsg[]>([WELCOME]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [audience, setAudience] = React.useState({
    coachLevel: coachLevel || null,
    playerLevel: playerLevel || derivePlayerLevel(coachLevel, ageGroup),
  });
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const diagramRef = React.useRef(diagram);
  diagramRef.current = diagram;

  React.useEffect(() => {
    setAudience({
      coachLevel: coachLevel || null,
      playerLevel: playerLevel || derivePlayerLevel(coachLevel, ageGroup),
    });
  }, [coachLevel, playerLevel, ageGroup]);

  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !canEdit) return;
    setInput("");
    setError(null);
    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    try {
      const history = [...messages, userMsg]
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await boardAiChat(boardId, {
        message: text,
        diagram: diagramRef.current,
        history,
      });
      if (!res.ok) {
        setError(res.message || res.error || "AI request failed");
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: res.message || res.error || "Something went wrong. Try again.",
          },
        ]);
        return;
      }
      if (res.coachLevel || res.playerLevel) {
        setAudience({
          coachLevel: res.coachLevel || audience.coachLevel,
          playerLevel: res.playerLevel || audience.playerLevel,
        });
      }
      if (res.applied && res.diagram) {
        onApplyDiagram(res.diagram);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: res.reply || (res.applied ? "Updated the board." : "Got it."),
          applied: Boolean(res.applied),
        },
      ]);
    } catch (e: any) {
      setError(e?.message || "AI request failed");
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: "Couldn’t reach Tactical Edge AI. Check your connection and try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const coachLabel = formatCoachLevel(audience.coachLevel);
  const playerLabel = formatPlayerLevel(audience.playerLevel);
  const modelLabel = gameModelId ? gameModelId.replace(/_/g, " ") : null;

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-white/10 bg-[#07111f]/95">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/15">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 3l1.8 5.5H20l-4.5 3.3 1.7 5.4L12 14.8 6.8 17.2l1.7-5.4L4 8.5h6.2z" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white/90">Tactical Edge AI</p>
          <p className="text-[10px] text-slate-500">
            {[
              modelLabel ? `Model ${modelLabel}` : null,
              coachLabel ? `Lang ${coachLabel}` : null,
              playerLabel ? `Players ${playerLabel}` : null,
              ageGroup ? ageGroup : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Describe a scenario → board updates"}
          </p>
        </div>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl px-3 py-2.5 text-[12px] leading-relaxed whitespace-pre-wrap ${
              m.role === "user"
                ? "ml-6 bg-sky-500/15 text-sky-50 border border-sky-500/20"
                : "mr-4 bg-white/[0.04] text-slate-200 border border-white/10"
            }`}
          >
            {m.content}
            {m.applied ? (
              <span className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">
                Applied to board
              </span>
            ) : null}
          </div>
        ))}
        {sending ? (
          <div className="mr-4 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[12px] text-slate-400">
            Setting up the board…
          </div>
        ) : null}
      </div>

      <div className="border-t border-white/10 p-3">
        {error ? <p className="mb-2 text-[11px] text-rose-300">{error}</p> : null}
        {!canEdit ? (
          <p className="text-[11px] text-slate-500">View-only — AI edits are disabled.</p>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={3}
              placeholder="e.g. Show a 4-3-3 switch of play from left back…"
              className="min-h-[4.5rem] flex-1 resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500/40"
              disabled={sending}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-100 disabled:opacity-40"
              title="Send"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
