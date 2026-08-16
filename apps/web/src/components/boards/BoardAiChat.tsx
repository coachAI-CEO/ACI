"use client";

import * as React from "react";
import Link from "next/link";
import type { DiagramV1 } from "@/types/diagram";
import { boardAiChat } from "@/lib/boards";
import { useBoardLoadProgress } from "@/lib/use-board-load-progress";
import { BoardAiReplyBody } from "@/components/boards/BoardAiReply";

type SessionRec = {
  id: string;
  title: string;
  ageGroup?: string | null;
  gameModelId?: string | null;
  phase?: string | null;
  zone?: string | null;
  formationUsed?: string | null;
  durationMin?: number | null;
  similarity: number;
  summary?: string | null;
  openUrl: string;
};

type SessionBridge = {
  recommendations: SessionRec[];
  generatorUrl: string;
  generatorPrompt: string;
};

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  applied?: boolean;
  imagePreview?: string | null;
  fileName?: string | null;
  fileKind?: "image" | "pdf" | null;
  sessionBridge?: SessionBridge | null;
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
  onBusyChange?: (busy: boolean) => void;
};

function welcomeForFormat(format?: string | null): ChatMsg {
  const fmt = String(format || "").toUpperCase();
  const playOut =
    fmt === "7V7"
      ? "“best way to play out using a 2-3-1 vs a 3-2-1”"
      : fmt === "9V9"
        ? "“best way to play out using a 3-2-3 vs a 2-3-2-1”"
        : "“best way to play out using a 433 vs a 442”";
  const example =
    fmt === "7V7"
      ? "“7v7 2-3-1 vs 3-2-1, playing out in our half”"
      : fmt === "9V9"
        ? "“9v9 3-2-3 vs 2-3-2-1, win it in the middle and go”"
        : "“11v11 4-2-3-1 vs 3-5-2, play out left channel”";
  return {
    id: "welcome",
    role: "assistant",
    content:
      "Describe a scenario and I’ll set it on the board using your club’s game model.\n\nUpload a photo or PDF of a whiteboard, notebook, playbook page, or another board — I’ll read it and recreate it here.\n\nWhen the picture looks right, ask how to train it — I’ll recommend vault sessions and give you a pre-filled Session Builder prompt.\n\nExamples:\n• " +
      playOut +
      "\n• “how can my team improve in this area?”\n• “recommend a session for what’s on the board”\n• " +
      example,
  };
}

function chatStorageKey(boardId: string) {
  return `aci-board-chat:${boardId}`;
}

function loadStoredChat(boardId: string, format?: string | null): ChatMsg[] {
  const fallback = [welcomeForFormat(format)];
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(chatStorageKey(boardId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as ChatMsg[];
    if (!Array.isArray(parsed) || parsed.length < 2) return fallback;
    return parsed
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(0, 80);
  } catch {
    return fallback;
  }
}

function persistChat(boardId: string, messages: ChatMsg[]) {
  if (typeof window === "undefined") return;
  if (messages.length <= 1) return;
  try {
    const slim = messages.slice(-80).map(({ imagePreview, ...rest }) => ({
      ...rest,
      imagePreview: undefined,
    }));
    window.localStorage.setItem(chatStorageKey(boardId), JSON.stringify(slim));
  } catch {
    // quota — chat still works this session
  }
}

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

function formatLabel(value?: string | null) {
  if (!value) return null;
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
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

type PendingImage = {
  mimeType: string;
  data: string;
  preview: string;
  fileName: string;
};

const FILE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf";

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

async function prepareBoardImage(file: File): Promise<PendingImage> {
  const name = file.name || "tactical-file";
  if (isPdfFile(file)) {
    if (file.size > 5 * 1024 * 1024) throw new Error("PDF too large (max 5MB).");
    const data = await fileToBase64(file);
    if (!data) throw new Error("That PDF could not be read.");
    return {
      mimeType: "application/pdf",
      data,
      preview: "",
      fileName: name,
    };
  }

  const looksImage =
    file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(name);
  if (!looksImage) throw new Error("Use a JPG, PNG, WebP, GIF, or PDF.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Image too large (max 8MB).");

  const bitmap = await createImageBitmap(file);
  const maxEdge = 1280;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not read that image.");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const dataUrl = canvas.toDataURL(mime, mime === "image/jpeg" ? 0.82 : undefined);
  const comma = dataUrl.indexOf(",");
  const data = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const bytes = Math.floor((data.length * 3) / 4);
  if (bytes > 4 * 1024 * 1024) {
    throw new Error("Image is still too large after shrinking — try a tighter crop.");
  }
  return { mimeType: mime, data, preview: dataUrl, fileName: name };
}

function lastAssistantOfferedAllDiagrams(messages: ChatMsg[]): boolean {
  const last = [...messages].reverse().find((m) => m.role === "assistant" && m.id !== "welcome");
  return /Reply \*\*all\*\*|drew diagram 1 of |drew the first diagram/i.test(last?.content || "");
}

function lastAssistantOfferedImportReview(messages: ChatMsg[]): boolean {
  const last = [...messages].reverse().find((m) => m.role === "assistant" && m.id !== "welcome");
  return /Reply \*\*A A A\*\*|pictures · us · draw|before I draw/i.test(last?.content || "");
}

function isDrawAllDiagramsAsk(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/^(all|all \d+|yes|y|ok|okay|sure|the rest|remaining)$/i.test(t)) return true;
  return /\b(draw all|all diagrams?|every diagram|all frames|each diagram)\b/i.test(t);
}

function SessionBridgeCards({ bridge }: { bridge: SessionBridge }) {
  const [copied, setCopied] = React.useState(false);
  const autoUrl = bridge.generatorUrl.includes("autoGenerate=false")
    ? bridge.generatorUrl.replace("autoGenerate=false", "autoGenerate=true")
    : `${bridge.generatorUrl}&autoGenerate=true`;

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(bridge.generatorPrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
      {bridge.recommendations.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">
            Vault sessions
          </p>
          {bridge.recommendations.map((rec) => (
            <Link
              key={rec.id}
              href={rec.openUrl}
              className="block rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 transition hover:border-emerald-500/40 hover:bg-emerald-500/10"
            >
              <p className="text-[12px] font-medium text-slate-100">{rec.title}</p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {[
                  rec.ageGroup,
                  formatLabel(rec.phase),
                  formatLabel(rec.zone),
                  rec.formationUsed,
                  rec.durationMin ? `${rec.durationMin} min` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {rec.summary ? (
                <p className="mt-1 line-clamp-2 text-[10px] text-slate-500">{rec.summary}</p>
              ) : null}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <Link
          href={bridge.generatorUrl}
          className="inline-flex items-center rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 py-1.5 text-[11px] font-medium text-sky-100 hover:bg-sky-500/25"
        >
          Open in Session Builder
        </Link>
        <Link
          href={autoUrl}
          className="inline-flex items-center rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-medium text-emerald-100 hover:bg-emerald-500/25"
        >
          Generate now
        </Link>
        <button
          type="button"
          onClick={() => void copyPrompt()}
          className="inline-flex items-center rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-white/[0.08]"
        >
          {copied ? "Copied" : "Copy prompt"}
        </button>
      </div>
    </div>
  );
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
  onBusyChange,
}: Props) {
  const [messages, setMessages] = React.useState<ChatMsg[]>(() =>
    loadStoredChat(boardId, diagram.pitch?.format)
  );
  const [input, setInput] = React.useState("");
  const [pendingImage, setPendingImage] = React.useState<PendingImage | null>(null);
  const [sending, setSending] = React.useState(false);
  const [progressKind, setProgressKind] = React.useState<"text" | "image" | "pdf">("text");
  const [error, setError] = React.useState<string | null>(null);
  const [audience, setAudience] = React.useState({
    coachLevel: coachLevel || null,
    playerLevel: playerLevel || derivePlayerLevel(coachLevel, ageGroup),
  });
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const lastFileRef = React.useRef<PendingImage | null>(null);
  const diagramRef = React.useRef(diagram);
  diagramRef.current = diagram;
  const progress = useBoardLoadProgress(sending, progressKind);

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

  React.useEffect(() => {
    onBusyChange?.(sending);
  }, [sending, onBusyChange]);

  React.useEffect(() => {
    setMessages(loadStoredChat(boardId, diagram.pitch?.format));
  }, [boardId]);

  React.useEffect(() => {
    persistChat(boardId, messages);
  }, [boardId, messages]);

  const attachFile = async (file: File | null | undefined) => {
    if (!file || sending || !canEdit) return;
    setError(null);
    try {
      const prepared = await prepareBoardImage(file);
      setPendingImage(prepared);
    } catch (e: any) {
      setError(e?.message || "Could not read that file.");
    }
  };

  const send = async () => {
    const text = input.trim();
    let image = pendingImage;
    const reuseLastFile =
      !image &&
      Boolean(lastFileRef.current) &&
      (
        (isDrawAllDiagramsAsk(text) && lastAssistantOfferedAllDiagrams(messages)) ||
        (lastAssistantOfferedImportReview(messages) && Boolean(text))
      );
    if (reuseLastFile) image = lastFileRef.current;
    if ((!text && !image) || sending || !canEdit) return;
    setInput("");
    setPendingImage(null);
    setError(null);
    if (image) lastFileRef.current = image;
    const showAttach = Boolean(image) && !reuseLastFile;
    const userMsg: ChatMsg = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text || (image?.mimeType === "application/pdf"
        ? "Recreate this PDF on the board."
        : "Recreate this picture on the board."),
      imagePreview: showAttach ? image?.preview || null : null,
      fileName: showAttach ? image?.fileName || null : null,
      fileKind: showAttach ? (image?.mimeType === "application/pdf" ? "pdf" : "image") : null,
    };
    setMessages((prev) => [...prev, userMsg]);
    setProgressKind(image ? (image.mimeType === "application/pdf" ? "pdf" : "image") : "text");
    setSending(true);
    try {
      const history = [...messages, userMsg]
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await boardAiChat(boardId, {
        message: text,
        diagram: diagramRef.current,
        history,
        ...(image
          ? {
              image: {
                mimeType: image.mimeType,
                data: image.data,
                fileName: image.fileName,
              },
            }
          : {}),
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
      const bridge = res.sessionBridge
        ? {
            recommendations: res.sessionBridge.recommendations || [],
            generatorUrl: res.sessionBridge.generatorUrl,
            generatorPrompt: res.sessionBridge.generatorPrompt,
          }
        : null;
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: res.reply || (res.applied ? "Updated the board." : "Got it."),
          applied: Boolean(res.applied),
          sessionBridge: bridge,
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
            className={`rounded-xl px-3 py-2.5 text-[13px] leading-relaxed break-words [overflow-wrap:anywhere] ${
              m.role === "user"
                ? "whitespace-pre-wrap bg-sky-500/15 text-sky-50 border border-sky-500/20"
                : "bg-white/[0.04] text-slate-100 border border-white/10"
            }`}
          >
            {m.imagePreview ? (
              <img
                src={m.imagePreview}
                alt=""
                className="mb-2 max-h-36 w-auto rounded-lg border border-white/10 object-contain"
              />
            ) : m.fileKind === "pdf" ? (
              <p className="mb-2 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-slate-300">
                PDF · {m.fileName || "tactical.pdf"}
              </p>
            ) : null}
            {m.role === "assistant" ? <BoardAiReplyBody text={m.content} /> : m.content}
            {m.applied ? (
              <span className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">
                Applied to board
              </span>
            ) : null}
            {m.sessionBridge ? <SessionBridgeCards bridge={m.sessionBridge} /> : null}
          </div>
        ))}
        {progress.visible ? (
          <div className="mr-4 space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[12px] text-emerald-100/90">{progress.label}</p>
              <span className="text-[11px] tabular-nums text-emerald-300/90">{progress.percent}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400/90 transition-[width] duration-200 ease-out"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-white/10 p-3">
        {error ? <p className="mb-2 text-[11px] text-rose-300">{error}</p> : null}
        {!canEdit ? (
          <p className="text-[11px] text-slate-500">View-only — AI edits are disabled.</p>
        ) : (
          <div className="space-y-2">
            {pendingImage ? (
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 p-1.5">
                {pendingImage.mimeType === "application/pdf" ? (
                  <div className="flex h-12 w-12 items-center justify-center rounded bg-rose-500/20 text-[10px] font-semibold text-rose-200">
                    PDF
                  </div>
                ) : (
                  <img
                    src={pendingImage.preview}
                    alt=""
                    className="h-12 w-12 rounded object-cover"
                  />
                )}
                <p className="min-w-0 flex-1 truncate text-[11px] text-slate-300">
                  {pendingImage.fileName}
                </p>
                <button
                  type="button"
                  onClick={() => setPendingImage(null)}
                  className="rounded px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200"
                  aria-label="Remove file"
                >
                  Remove
                </button>
              </div>
            ) : null}
            <div className="flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={FILE_ACCEPT}
              className="hidden"
              data-qa-file="board-chat"
              aria-label="Upload tactical photo or PDF file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                void attachFile(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={sending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] text-slate-300 hover:border-emerald-500/40 hover:text-emerald-200 disabled:opacity-40"
              aria-label="Upload tactical photo or PDF"
              title="Upload a photo or PDF"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="M17 8l-5-5-5 5" />
                <path d="M12 3v12" />
              </svg>
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={(e) => {
                const file = Array.from(e.clipboardData?.files || []).find((f) =>
                  f.type.startsWith("image/")
                );
                if (!file) return;
                e.preventDefault();
                void attachFile(file);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={3}
              placeholder="Ask, or attach a photo or PDF…"
              className="min-h-[4.5rem] flex-1 resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500/40"
              disabled={sending}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || (!input.trim() && !pendingImage)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-100 disabled:opacity-40"
              aria-label="Send"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
