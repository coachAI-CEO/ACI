"use client";

import React, { useState, useRef, useEffect } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
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

export const CoachChat: React.FC<CoachChatProps> = ({
  onSessionSelect,
  onGenerateRequest,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
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
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Add loading message
    const loadingId = `loading-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: loadingId, role: "assistant", content: "", isLoading: true },
    ]);

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
        return [
          ...filtered,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: data.message || data.error || "Something went wrong",
            recommendations: data.recommendations,
            referencedItems: data.referencedItems,
            extractedParams: data.extractedParams,
            readyToGenerate: data.readyToGenerate,
          },
        ];
      });
    } catch (err: any) {
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== loadingId);
        return [
          ...filtered,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: "Sorry, I had trouble processing that. Please try again.",
          },
        ];
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
    if (onGenerateRequest) {
      onGenerateRequest(params);
    }
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
                  {msg.readyToGenerate && msg.extractedParams && (
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
