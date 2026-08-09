"use client";

import * as React from "react";

type StoredDrillSvgProps = {
  drillId?: string | null;
  goalsAvailable?: number | null;
  drillType?: string | null;
  size?: "small" | "large";
  className?: string;
  showRegenerate?: boolean;
  // Session generation now draws every drill's diagram server-side, in
  // parallel, before the session response is even sent back -- so the
  // session and its diagrams can render together instead of the diagram
  // popping in several seconds after the text (each drill previously
  // fetched its own SVG separately, on mount, after the session was
  // already visible). When the caller already has this, skip the fetch
  // entirely instead of re-requesting something already in hand.
  initialSvg?: string | null;
};

export default function StoredDrillSvg({
  drillId,
  goalsAvailable,
  drillType,
  size = "large",
  className = "",
  showRegenerate = true,
  initialSvg,
}: StoredDrillSvgProps) {
  const isCooldown = String(drillType || "").toUpperCase() === "COOLDOWN";
  const [svg, setSvg] = React.useState<string | null>(initialSvg || null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadSvg = React.useCallback(
    async (force = false) => {
      if (!drillId || loading) return;
      setLoading(true);
      setError(null);
      try {
        const accessToken =
          typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

        const res = await fetch("/api/diagram-svg/generate", {
          method: "POST",
          headers,
          body: JSON.stringify({ drillId, force, goalsAvailable }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.svg) {
          throw new Error(data.error || data.reason || "SVG generation failed");
        }
        setSvg(data.svg);
        if (data.generationFailed) {
          setError(`SVG fallback returned: ${data.reason || "unknown reason"}`);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "SVG generation failed");
      } finally {
        setLoading(false);
      }
    },
    [drillId, goalsAvailable, loading]
  );

  React.useEffect(() => {
    setError(null);
    if (initialSvg) {
      setSvg(initialSvg);
      return;
    }
    setSvg(null);
    if (drillId && !isCooldown) void loadSvg(false);
  }, [drillId, isCooldown, initialSvg]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxWidth = size === "small" ? "max-w-[420px]" : "max-w-[760px]";
  const padding = size === "small" ? "p-2" : "";

  if (isCooldown) return null;

  if (!drillId) {
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
      {showRegenerate && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => loadSvg(true)}
            disabled={loading}
            className="inline-flex h-8 items-center rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            title={`Regenerate SVG for ${drillId}`}
          >
            {loading ? "Drawing SVG..." : svg ? "Regenerate SVG" : "Generate SVG"}
          </button>
        </div>
      )}

      {svg ? (
        <div
          className={`overflow-hidden rounded-2xl border border-slate-800/70 bg-[#08111f] shadow-2xl shadow-black/30 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full ${padding}`}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className={`rounded-2xl border border-slate-800/70 bg-[#08111f] ${padding}`}>
          <div className="flex min-h-[180px] items-center justify-center text-xs text-slate-500">
            {loading ? "Drawing SVG..." : "SVG diagram unavailable"}
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
