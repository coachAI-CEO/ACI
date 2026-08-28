"use client";

import * as React from "react";
import { fitDiagramSvgViewBox } from "@/lib/diagram-svg";

type StoredDrillSvgProps = {
  drillId?: string | null;
  goalsAvailable?: number | null;
  drillType?: string | null;
  size?: "small" | "large";
  className?: string;
  showRegenerate?: boolean;
  initialSvg?: string | null;
};

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const accessToken =
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

function isUsableSvg(svg: string | null | undefined): svg is string {
  return Boolean(svg && /<svg[\s>]/i.test(svg) && !/Diagram generating/i.test(svg));
}

type SceneFrame = { svg: string; role?: string; note?: string; durationMs?: number };

function parseFrames(value: unknown): SceneFrame[] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const frames = value.filter(
    (f): f is SceneFrame => Boolean(f && typeof (f as SceneFrame).svg === "string" && isUsableSvg((f as SceneFrame).svg))
  );
  return frames.length >= 2 ? frames : null;
}

export default function StoredDrillSvg({
  drillId,
  goalsAvailable,
  drillType,
  size = "large",
  className = "",
  showRegenerate = false,
  initialSvg,
}: StoredDrillSvgProps) {
  const isCooldown = String(drillType || "").toUpperCase() === "COOLDOWN";
  const [svg, setSvg] = React.useState<string | null>(isUsableSvg(initialSvg) ? initialSvg : null);
  const [frames, setFrames] = React.useState<SceneFrame[] | null>(null);
  const [frameIdx, setFrameIdx] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [drawing, setDrawing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const loadingRef = React.useRef(false);

  React.useEffect(() => {
    setError(null);
    if (isUsableSvg(initialSvg)) setSvg(initialSvg);
  }, [initialSvg]);

  // Filmstrip playback: advance to the last frame, then stop.
  React.useEffect(() => {
    if (!playing || !frames || frames.length < 2) return;
    if (frameIdx >= frames.length - 1) {
      setPlaying(false);
      return;
    }
    const ms = Math.max(1000, Math.min(4000, Number(frames[frameIdx]?.durationMs) || 1800));
    const t = setTimeout(() => setFrameIdx((i) => i + 1), ms);
    return () => clearTimeout(t);
  }, [playing, frames, frameIdx]);

  const fetchStored = React.useCallback(async () => {
    if (!drillId || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/diagram-svg/${encodeURIComponent(drillId)}`, {
        credentials: "include",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.hasStoredSvg && typeof data.svg === "string") {
        setSvg(data.svg);
        const parsed = parseFrames(data.frames);
        setFrames(parsed);
        setFrameIdx(0);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load diagram");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [drillId]);

  React.useEffect(() => {
    if (isCooldown) return;
    if (isUsableSvg(svg) || isUsableSvg(initialSvg)) return;
    if (drillId) void fetchStored();
  }, [drillId, isCooldown, svg, initialSvg, fetchStored]);

  const regenerate = React.useCallback(async () => {
    if (!drillId || loadingRef.current) return;
    loadingRef.current = true;
    setDrawing(true);
    setError(null);
    try {
      const res = await fetch("/api/diagram-svg/generate", {
        method: "POST",
        credentials: "include",
        headers: authHeaders(),
        body: JSON.stringify({
          drillId,
          force: true,
          goalsAvailable: String(drillType || "").toUpperCase().includes("WARMUP") ? 0 : goalsAvailable,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.svg) {
        throw new Error(data.error || data.reason || "SVG generation failed");
      }
      setSvg(data.svg);
      setFrames(parseFrames(data.frames));
      setFrameIdx(0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "SVG generation failed");
    } finally {
      loadingRef.current = false;
      setDrawing(false);
    }
  }, [drillId, goalsAvailable, drillType]);

  const maxWidth = size === "small" ? "max-w-[420px]" : "max-w-[760px]";
  const padding = size === "small" ? "p-2" : "";

  if (isCooldown) return null;

  if (!drillId && !svg) {
    return (
      <div className={`w-full ${maxWidth} rounded-xl border border-slate-800/70 bg-slate-950/50 ${padding} ${className}`}>
        <div className="flex min-h-[180px] items-center justify-center text-xs text-slate-500">
          Save this drill to generate SVG.
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${maxWidth} ${className}`}>
      {showRegenerate && drillId && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => regenerate()}
            disabled={drawing}
            className="inline-flex h-8 items-center rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            title={`Regenerate SVG for ${drillId}`}
          >
            {drawing ? "Drawing SVG..." : svg ? "Regenerate SVG" : "Generate SVG"}
          </button>
        </div>
      )}

      {frames && frames.length > 1 ? (
        <div className="space-y-2">
          <div
            className={`overflow-hidden rounded-2xl border border-slate-800/70 bg-[#08111f] p-2 shadow-2xl shadow-black/30 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full [&>svg]:max-w-full ${padding}`}
            dangerouslySetInnerHTML={{
              __html: fitDiagramSvgViewBox(frames[Math.min(frameIdx, frames.length - 1)].svg),
            }}
          />
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setFrameIdx((i) => Math.max(0, i - 1));
              }}
              disabled={frameIdx === 0}
              className="inline-flex h-7 items-center rounded-full border border-slate-700 px-2.5 font-semibold text-slate-300 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => {
                if (frameIdx >= frames.length - 1) setFrameIdx(0);
                setPlaying((p) => !p);
              }}
              className="inline-flex h-7 items-center rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 font-semibold text-cyan-300"
            >
              {playing ? "Pause" : frameIdx >= frames.length - 1 ? "Replay" : "Play"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setFrameIdx((i) => Math.min(frames.length - 1, i + 1));
              }}
              disabled={frameIdx >= frames.length - 1}
              className="inline-flex h-7 items-center rounded-full border border-slate-700 px-2.5 font-semibold text-slate-300 disabled:opacity-40"
            >
              Next
            </button>
            <span className="tabular-nums">
              {Math.min(frameIdx, frames.length - 1) + 1} / {frames.length}
            </span>
          </div>
          {frames[Math.min(frameIdx, frames.length - 1)].note && (
            <p className="rounded-lg border border-slate-800/70 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
              {frames[Math.min(frameIdx, frames.length - 1)].note}
            </p>
          )}
        </div>
      ) : svg ? (
        <div
          className={`overflow-hidden rounded-2xl border border-slate-800/70 bg-[#08111f] p-2 shadow-2xl shadow-black/30 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full [&>svg]:max-w-full ${padding}`}
          dangerouslySetInnerHTML={{ __html: fitDiagramSvgViewBox(svg) }}
        />
      ) : (
        <div className={`rounded-2xl border border-slate-800/70 bg-[#08111f] ${padding}`}>
          <div className="flex min-h-[180px] items-center justify-center text-xs text-slate-500">
            {loading ? "Loading diagram..." : "SVG diagram unavailable"}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {error}
        </div>
      )}
    </div>
  );
}
