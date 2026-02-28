"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: "search" | "generate" | "clarify" | "chat";
  recommendations?: any[];
  referencedItems?: Array<{
    refCode: string;
    type: string;
    title: string;
    id: string;
  }>;
  extractedParams?: any;
  readyToGenerate?: boolean;
  isLoading?: boolean;
};

type CoachChatProps = {
  onSessionSelect?: (session: any) => void;
  onGenerateRequest?: (params: any) => void;
};

const CHAT_STORAGE_KEY = "coachAssistant.chat.v1";
const CHAT_HISTORY_LIMIT = 30;
const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi Coach! What are you working on with your team?\n\n" +
    "Tell me:\n" +
    "• What age group you're coaching\n" +
    "• What challenge or topic you want to address\n\n" +
    "For example:\n" +
    '"My U14s struggle to keep the ball under pressure"\n' +
    '"I need a session on breaking low blocks for U16"\n' +
    '"3-session series on pressing for my U12 team"\n\n' +
    "💡 You can also reference existing items:\n" +
    '"Improve S-7K2M" or "Explain drill D-9M3P"',
};

const hasMinimumGenerationParams = (params: any): boolean => {
  if (!params || typeof params !== "object") return false;
  const hasAgeGroup = Boolean(params.ageGroup);
  const hasGameModel = Boolean(params.gameModelId);
  const hasPhaseOrTopic = Boolean(params.phase || params.topic);
  return hasAgeGroup && hasGameModel && hasPhaseOrTopic;
};

const clampMessages = (messages: Message[]): Message[] => {
  const nonWelcome = messages
    .filter((m) => m.id !== "welcome")
    .filter((m) => !m.isLoading)
    .slice(-CHAT_HISTORY_LIMIT);
  return [WELCOME_MESSAGE, ...nonWelcome];
};

const normalizeStoredMessage = (value: any): Message | null => {
  if (!value || typeof value !== "object") return null;
  const role = value.role === "user" || value.role === "assistant" ? value.role : null;
  if (!role) return null;
  const content = typeof value.content === "string" ? value.content : "";
  if (!content && !value.isLoading) return null;
  return {
    id: typeof value.id === "string" ? value.id : `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    intent:
      value.intent === "search" ||
      value.intent === "generate" ||
      value.intent === "clarify" ||
      value.intent === "chat"
        ? value.intent
        : undefined,
    recommendations: Array.isArray(value.recommendations) ? value.recommendations : undefined,
    referencedItems: Array.isArray(value.referencedItems) ? value.referencedItems : undefined,
    extractedParams: value.extractedParams,
    readyToGenerate: Boolean(value.readyToGenerate),
    isLoading: Boolean(value.isLoading),
  };
};

export const CoachChat: React.FC<CoachChatProps> = ({
  onSessionSelect,
  onGenerateRequest,
}) => {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map((item: any) => normalizeStoredMessage(item))
            .filter(Boolean) as Message[];
          setMessages(clampMessages(normalized));
        }
      }
    } catch {
      // ignore malformed storage
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(clampMessages(messages)));
    } catch {
      // Best-effort local persistence only.
    }
  }, [messages, hydrated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => clampMessages([...prev, userMessage]));
    setInput("");
    setIsLoading(true);

    // Add loading message
    const loadingId = `loading-${Date.now()}`;
    setMessages((prev) =>
      clampMessages([
        ...prev,
        { id: loadingId, role: "assistant", content: "", isLoading: true },
      ])
    );

    try {
      const accessToken =
        typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const res = await fetch("/api/coach-chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: userMessage.content,
          history: messages.filter((m) => m.id !== "welcome").slice(-10),
        }),
      });

      const data = await res.json();

      // Remove loading message and add response
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== loadingId);
        return clampMessages([
          ...filtered,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: data.message || data.error || "Something went wrong",
            intent: data.intent,
            recommendations: data.recommendations,
            referencedItems: data.referencedItems,
            extractedParams: data.extractedParams,
            readyToGenerate: data.readyToGenerate,
          },
        ]);
      });
    } catch (err: any) {
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== loadingId);
        return clampMessages([
          ...filtered,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: "Sorry, I had trouble processing that. Please try again.",
          },
        ]);
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSelectSession = (session: any) => {
    if (onSessionSelect) {
      onSessionSelect(session);
    }
  };

  const handleGenerateNew = (params: any) => {
    const normalizeCoachLevelForGeneration = (value?: string) => {
      const v = String(value || "").toUpperCase();
      if (v === "GRASSROOTS") return "GRASSROOTS";
      if (v === "USSF_C") return "USSF_C";
      if (v === "USSF_B_PLUS" || v === "USSF_B" || v === "USSF_A") return "USSF_B_PLUS";
      if (v === "USSF_D") return "GRASSROOTS";
      return undefined;
    };

    const buildSessionQuery = (input: any) => {
      const queryParams = new URLSearchParams();
      if (input?.ageGroup) queryParams.set("ageGroup", input.ageGroup);
      if (input?.gameModelId) queryParams.set("gameModelId", input.gameModelId);
      if (input?.phase) queryParams.set("phase", input.phase);
      if (input?.zone) queryParams.set("zone", input.zone);
      if (input?.topic) queryParams.set("topic", input.topic);
      if (input?.durationMin) queryParams.set("durationMin", String(input.durationMin));
      if (input?.numbersMin) queryParams.set("numbersMin", String(input.numbersMin));
      if (input?.numbersMax) queryParams.set("numbersMax", String(input.numbersMax));
      if (input?.formationAttacking) queryParams.set("formationAttacking", input.formationAttacking);
      if (input?.formationDefending) queryParams.set("formationDefending", input.formationDefending);
      if (input?.playerLevel) queryParams.set("playerLevel", input.playerLevel);
      const normalizedCoachLevel = normalizeCoachLevelForGeneration(input?.coachLevel);
      if (normalizedCoachLevel) queryParams.set("coachLevel", normalizedCoachLevel);
      if (input?.goalsAvailable !== null && input?.goalsAvailable !== undefined) {
        queryParams.set("goalsAvailable", String(input.goalsAvailable));
      }
      if (input?.numberOfSessions && input.numberOfSessions > 1) {
        queryParams.set("series", "true");
        queryParams.set("numberOfSessions", String(input.numberOfSessions));
      }
      queryParams.set("autoGenerate", "true");
      // Force a fresh navigation even if other params are unchanged.
      queryParams.set("requestId", String(Date.now()));
      return queryParams.toString();
    };

    const query = buildSessionQuery(params || {});
    const targetUrl = `/demo/session?${query}`;

    // Let parent run any local UI side-effects (e.g. closing chat panel), but do not
    // depend on client router transitions for this action.
    if (onGenerateRequest) {
      try {
        onGenerateRequest(params);
      } catch (err) {
        console.warn("[COACH_CHAT] onGenerateRequest side-effects failed", err);
      }
    }

    // Deterministic navigation path: hard redirect so generate never no-ops.
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(
          "coachAssistant.pendingGenerate",
          JSON.stringify({ params, targetUrl, ts: Date.now() })
        );
      } catch {
        // best effort only
      }
      window.location.assign(targetUrl);
      return;
    }

    // SSR-safe fallback.
    router.push(targetUrl);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-800 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="text-emerald-400">⚽</span>
          Coach Assistant
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Describe your training needs in plain language
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-2.5 ${
                msg.role === "user"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-800 text-slate-100"
              }`}
            >
              {msg.isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-pulse flex gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                  </div>
                  <span className="text-sm text-slate-400">Thinking...</span>
                </div>
              ) : (
                <>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                  {/* Referenced Items */}
                  {msg.referencedItems && msg.referencedItems.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-slate-400 font-medium">
                        📎 Referenced items:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {msg.referencedItems.map((item, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSelectSession({ id: item.id, title: item.title })}
                            className="inline-flex items-center gap-2 px-2 py-1 rounded bg-cyan-900/40 text-cyan-300 text-xs border border-cyan-700/30 hover:bg-cyan-900/60 transition-colors"
                          >
                            <span className="font-mono">{item.refCode}</span>
                            <span className="text-slate-300 truncate max-w-[120px]">{item.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {msg.recommendations && msg.recommendations.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-slate-400 font-medium">
                        Found in your vault:
                      </p>
                      {msg.recommendations.map((rec: any, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => handleSelectSession(rec.session || rec)}
                          className="w-full text-left p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {(rec.session?.refCode || rec.refCode) && (
                              <span className="px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-300 text-[10px] font-mono border border-cyan-700/30">
                                {rec.session?.refCode || rec.refCode}
                              </span>
                            )}
                            <p className="text-sm font-medium text-white truncate flex-1">
                              {rec.session?.title || rec.title}
                            </p>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            {rec.session?.ageGroup || rec.ageGroup} •{" "}
                            {rec.session?.gameModelId || rec.gameModelId}
                            {rec.similarity && (
                              <span className="ml-2 text-emerald-400">
                                {Math.round(rec.similarity * 100)}% match
                              </span>
                            )}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Generate button when ready */}
                  {(msg.intent === "generate" || msg.readyToGenerate || hasMinimumGenerationParams(msg.extractedParams)) && msg.extractedParams && (
                    <div className="mt-3 space-y-2">
                      <button
                        onClick={() => handleGenerateNew(msg.extractedParams)}
                        className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Generate{msg.extractedParams.numberOfSessions > 1 ? ` ${msg.extractedParams.numberOfSessions}-Session Series` : " Session"}
                      </button>
                      <p className="text-xs text-slate-500 text-center">
                        Or tell me more to refine the parameters
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 bg-slate-800 border-t border-slate-700">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you need..."
            rows={1}
            className="flex-1 resize-none bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            Send
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </form>
    </div>
  );
};

export default CoachChat;
