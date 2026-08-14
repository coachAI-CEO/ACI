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
  const [svg, setSvg] = React.useState<string | null>(initialSvg || null);
  const [loading, setLoading] = React.useState(false);
  const [drawing, setDrawing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const loadingRef = React.useRef(false);

  React.useEffect(() => {
    setError(null);
    if (initialSvg) {
      setSvg(initialSvg);
    }
  }, [initialSvg]);

  const fetchStored = React.useCallback(async () => {
    if (!drillId || loadingRef.current || initialSvg) return;
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
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load diagram");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [drillId, initialSvg]);

  React.useEffect(() => {
    if (isCooldown || initialSvg || svg) return;
    if (drillId) void fetchStored();
  }, [drillId, isCooldown, initialSvg, svg, fetchStored]);

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
        body: JSON.stringify({ drillId, force: true, goalsAvailable }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.svg) {
        throw new Error(data.error || data.reason || "SVG generation failed");
      }
      setSvg(data.svg);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "SVG generation failed");
    } finally {
      loadingRef.current = false;
      setDrawing(false);
    }
  }, [drillId, goalsAvailable]);

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

      {svg ? (
        <div
          className={`overflow-hidden rounded-2xl border border-slate-800/70 bg-[#08111f] shadow-2xl shadow-black/30 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full [&>svg]:max-w-full [&>svg]:overflow-hidden ${padding}`}
          style={{ overflow: "hidden", contain: "paint" }}
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
