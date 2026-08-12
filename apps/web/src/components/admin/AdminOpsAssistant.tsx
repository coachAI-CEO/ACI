"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, MessageSquare, Send, Shield, X } from "lucide-react";
import { adminFetch } from "@/app/admin/_lib/api";

type ProposedAction = {
  confirmId: string;
  type: string;
  summary: string;
  userId: string;
  userEmail?: string;
  payload: Record<string, unknown>;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposedAction?: ProposedAction | null;
  model?: string;
  isLoading?: boolean;
};

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Admin Ops Assistant — account lookup, analytics, clubs, and gated permission changes.\n\n" +
    "Try:\n" +
    "• lookup coach@example.com\n" +
    "• user summary\n" +
    "• platform stats\n" +
    "• list clubs\n" +
    "• set adminRole SUPPORT for coach@example.com\n" +
    "• block user@example.com for abuse\n\n" +
    "Writes always need your Confirm. Model: gemini-3.5-flash-lite",
};

export default function AdminOpsAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };
    const loadingId = `l-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: loadingId, role: "assistant", content: "", isLoading: true },
    ]);
    setInput("");
    setIsLoading(true);

    try {
      const history = [...messages, userMsg]
        .filter((m) => m.id !== "welcome" && !m.isLoading)
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));

      const data = await adminFetch<{
        ok: boolean;
        message?: string;
        error?: string;
        proposedAction?: ProposedAction | null;
        model?: string;
      }>("/admin/ops-assistant", {
        method: "POST",
        body: JSON.stringify({ message: text, history }),
      });

      setMessages((prev) => {
        const withoutLoading = prev.filter((m) => m.id !== loadingId);
        return [
          ...withoutLoading,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: data.message || data.error || "No response",
            proposedAction: data.proposedAction || null,
            model: data.model,
          },
        ];
      });
    } catch (err: any) {
      setMessages((prev) => {
        const withoutLoading = prev.filter((m) => m.id !== loadingId);
        return [
          ...withoutLoading,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            content: err?.message || "Request failed",
          },
        ];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const confirmAction = async (action: ProposedAction) => {
    if (confirmingId) return;
    setConfirmingId(action.confirmId);
    try {
      const data = await adminFetch<{
        ok: boolean;
        message?: string;
        error?: string;
        result?: unknown;
      }>("/admin/ops-assistant/confirm", {
        method: "POST",
        body: JSON.stringify({ confirmId: action.confirmId }),
      });

      const resultExtra =
        data.result && typeof data.result === "object"
          ? `\n\n\`\`\`json\n${JSON.stringify(data.result, null, 2)}\n\`\`\``
          : "";

      setMessages((prev) => {
        const cleared = prev.map((m) =>
          m.proposedAction?.confirmId === action.confirmId
            ? { ...m, proposedAction: null }
            : m
        );
        return [
          ...cleared,
          {
            id: `c-${Date.now()}`,
            role: "assistant",
            content: `${data.ok ? "✅" : "❌"} ${data.message || data.error || "Done."}${resultExtra}`,
          },
        ];
      });
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ce-${Date.now()}`,
          role: "assistant",
          content: `❌ ${err?.message || "Confirm failed"}`,
        },
      ]);
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full border shadow-lg transition-all ${
          open
            ? "border-slate-600 bg-slate-800 text-slate-200"
            : "border-emerald-500/40 bg-emerald-600 text-white hover:bg-emerald-500"
        }`}
        aria-label="Toggle Admin Ops Assistant"
        title="Admin Ops Assistant"
      >
        {open ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
      </button>

      {open ? (
        <div className="fixed bottom-20 right-5 z-50 flex h-[min(640px,calc(100vh-7rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/15">
              <Shield className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-100">Admin Ops Assistant</p>
              <p className="text-[11px] text-slate-500">Accounts · analytics · gated writes</p>
            </div>
            <Bot className="h-4 w-4 text-slate-600" />
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-emerald-600 text-white"
                      : "border border-slate-800 bg-slate-900 text-slate-200"
                  }`}
                >
                  {msg.isLoading ? (
                    <span className="text-slate-400">Working…</span>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      {msg.model ? (
                        <p className="mt-1 text-[10px] text-slate-500">model: {msg.model}</p>
                      ) : null}
                      {msg.proposedAction ? (
                        <div className="mt-3 space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
                          <p className="text-xs text-amber-200">{msg.proposedAction.summary}</p>
                          <button
                            type="button"
                            disabled={confirmingId === msg.proposedAction.confirmId}
                            onClick={() => confirmAction(msg.proposedAction!)}
                            className="w-full rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
                          >
                            {confirmingId === msg.proposedAction.confirmId
                              ? "Applying…"
                              : "Confirm change"}
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <form onSubmit={send} className="border-t border-slate-800 p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about users, stats, clubs…"
                disabled={isLoading}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
