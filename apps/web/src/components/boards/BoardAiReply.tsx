import * as React from "react";

type Block =
  | { type: "heading"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

function isBullet(line: string): boolean {
  return /^\s*(?:[-•*]|\d+[.)])\s+\S/.test(line);
}

function bulletText(line: string): string {
  return line.trim().replace(/^(?:[-•*]|\d+[.)])\s+/, "");
}

function isHeading(line: string, next: string | undefined): boolean {
  const t = line.trim();
  if (!t || isBullet(t)) return false;
  if (/^\*\*[^*].*\*\*$/.test(t)) return true;
  if (/^#{1,3}\s+\S/.test(t)) return true;
  if (/^[A-Za-z][^.\n]{0,42}:$/.test(t)) return true;
  const words = t.replace(/[*#]/g, "").trim().split(/\s+/);
  const looksTitle =
    t.length <= 48 &&
    words.length <= 7 &&
    !/[.!?]$/.test(t) &&
    /^[A-Z0-9]/.test(t.replace(/^\*+/, ""));
  if (!looksTitle) return false;
  if (next == null) return false;
  const n = next.trim();
  return !n || isBullet(n) || isHeading(n, undefined);
}

function headingText(line: string): string {
  return line
    .trim()
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .replace(/^#{1,3}\s+/, "")
    .replace(/:$/, "");
}

export function parseBoardAiReply(raw: string): Block[] {
  const lines = String(raw || "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    const text = para.join(" ").replace(/\s+/g, " ").trim();
    para = [];
    if (text) blocks.push({ type: "p", text });
  };
  const flushList = () => {
    if (list.length) blocks.push({ type: "ul", items: list });
    list = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      flushPara();
      flushList();
      continue;
    }
    if (isHeading(trimmed, lines[i + 1])) {
      flushPara();
      flushList();
      blocks.push({ type: "heading", text: headingText(trimmed) });
      continue;
    }
    if (isBullet(trimmed)) {
      flushPara();
      list.push(bulletText(trimmed));
      continue;
    }
    flushList();
    para.push(trimmed);
  }
  flushPara();
  flushList();
  return blocks;
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        const bold = part.match(/^\*\*([^*]+)\*\*$/);
        if (bold) {
          return (
            <strong key={i} className="font-semibold text-slate-50">
              {bold[1]}
            </strong>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

export function BoardAiReplyBody({ text }: { text: string }) {
  const blocks = parseBoardAiReply(text);
  if (!blocks.length) return null;
  return (
    <div className="space-y-2.5 break-words [overflow-wrap:anywhere]">
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return (
            <p
              key={i}
              className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400/90"
            >
              {block.text}
            </p>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={i} className="space-y-1 pl-3.5 text-[13px] leading-relaxed text-slate-100">
              {block.items.map((item, j) => (
                <li key={j} className="list-disc marker:text-emerald-400/80">
                  <InlineText text={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-[13px] leading-relaxed text-slate-100">
            <InlineText text={block.text} />
          </p>
        );
      })}
    </div>
  );
}
