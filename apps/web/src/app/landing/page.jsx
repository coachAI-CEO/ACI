"use client";

import { useState, useEffect, useRef } from "react";

// ─── Animated Counter ───────────────────────────────────────────────
function Counter({ end, suffix = "", duration = 2000 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          let start = 0;
          const step = end / (duration / 16);
          const timer = setInterval(() => {
            start += step;
            if (start >= end) {
              setCount(end);
              clearInterval(timer);
            } else {
              setCount(Math.floor(start));
            }
          }, 16);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return (
    <span ref={ref}>
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

// ─── Fade-in on scroll ──────────────────────────────────────────────
function FadeIn({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Tactical Diagram Renderer (matches UniversalDrillDiagram style) ─────
function TacticalDiagram({ drill, id }) {
  const W = 500, H = 340;
  const pad = 10;
  const fw = W - pad * 2, fh = H - pad * 2;
  const sx = (x) => pad + (x / 100) * fw;
  const sy = (y) => pad + (y / 100) * fh;

  const teamColor = (t) => t === "ATT" ? "#3b82f6" : t === "DEF" ? "#ef4444" : "#eab308";
  const teamStroke = (t) => t === "ATT" ? "#60a5fa" : t === "DEF" ? "#f87171" : "#facc15";

  const arrowStyle = (type) => {
    if (type === "pass") return { stroke: "rgba(255,255,255,0.75)", dash: "none", width: 1.8, head: `arrow-pass-${id}` };
    if (type === "movement") return { stroke: "rgba(255,255,255,0.45)", dash: "6 4", width: 1.5, head: `arrow-move-${id}` };
    return { stroke: "rgba(239,68,68,0.7)", dash: "4 3", width: 1.8, head: `arrow-press-${id}` };
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.5))" }}>
      <defs>
        <linearGradient id={`pg-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e4d3a" />
          <stop offset="50%" stopColor="#265c45" />
          <stop offset="100%" stopColor="#1e4d3a" />
        </linearGradient>
        <marker id={`arrow-pass-${id}`} markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
          <polygon points="0,0 10,4 0,8" fill="rgba(255,255,255,0.8)" />
        </marker>
        <marker id={`arrow-move-${id}`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0,0 8,3 0,6" fill="rgba(255,255,255,0.5)" />
        </marker>
        <marker id={`arrow-press-${id}`} markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
          <polygon points="0,0 10,4 0,8" fill="rgba(239,68,68,0.8)" />
        </marker>
        <pattern id={`hz-att-${id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(59,130,246,0.2)" strokeWidth="2" />
        </pattern>
        <pattern id={`hz-def-${id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(239,68,68,0.2)" strokeWidth="2" />
        </pattern>
        <pattern id={`hz-neu-${id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(234,179,8,0.2)" strokeWidth="2" />
        </pattern>
        <filter id={`glow-${id}`}>
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Pitch */}
      <rect x={pad} y={pad} width={fw} height={fh} rx="4" fill={`url(#pg-${id})`} />
      {[0,1,2,3,4,5,6,7].map(i => (
        <rect key={i} x={pad + i * (fw / 8)} y={pad} width={fw / 8} height={fh} fill={i % 2 === 0 ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.02)"} />
      ))}

      {/* Field lines */}
      <rect x={pad} y={pad} width={fw} height={fh} rx="4" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <line x1={W / 2} y1={pad} x2={W / 2} y2={H - pad} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      <circle cx={W / 2} cy={H / 2} r={fh * 0.14} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      <circle cx={W / 2} cy={H / 2} r="2.5" fill="rgba(255,255,255,0.4)" />

      {/* Penalty areas */}
      {drill.pitch !== "HALF" && <>
        <rect x={pad} y={sy(28)} width={fw * 0.16} height={fh * 0.44} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        <rect x={pad} y={sy(38)} width={fw * 0.06} height={fh * 0.24} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      </>}
      <rect x={W - pad - fw * 0.16} y={sy(28)} width={fw * 0.16} height={fh * 0.44} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      <rect x={W - pad - fw * 0.06} y={sy(38)} width={fw * 0.06} height={fh * 0.24} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />

      {/* Goals */}
      {drill.goals.map((g, i) => {
        const gx = sx(g.x);
        const gy = sy(g.y);
        const gh = fh * (g.width / 100);
        return (
          <g key={i}>
            <rect x={g.x < 50 ? gx - 6 : gx} y={gy - gh / 2} width={6} height={gh}
              fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
            {[0,1,2].map(j => (
              <line key={j} x1={g.x < 50 ? gx - 6 + j * 2 : gx + j * 2} y1={gy - gh / 2}
                x2={g.x < 50 ? gx - 6 + j * 2 : gx + j * 2} y2={gy + gh / 2}
                stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
            ))}
          </g>
        );
      })}

      {/* Safe Zones */}
      {(drill.safeZones || []).map((z, i) => {
        const zx = sx(z.x), zy = sy(z.y), zw = (z.width / 100) * fw, zh = (z.height / 100) * fh;
        const pat = z.team === "ATT" ? `hz-att-${id}` : z.team === "DEF" ? `hz-def-${id}` : `hz-neu-${id}`;
        return <rect key={i} x={zx} y={zy} width={zw} height={zh} rx="3" fill={`url(#${pat})`} stroke={z.team === "ATT" ? "rgba(59,130,246,0.25)" : z.team === "DEF" ? "rgba(239,68,68,0.25)" : "rgba(234,179,8,0.25)"} strokeWidth="1" strokeDasharray="5 3" />;
      })}

      {/* Arrows */}
      {(drill.arrows || []).map((a, i) => {
        const s = arrowStyle(a.type);
        const x1 = sx(a.from.x), y1 = sy(a.from.y), x2 = sx(a.to.x), y2 = sy(a.to.y);
        const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
        const shortenBy = 14;
        const ex = x2 - (dx / len) * shortenBy, ey = y2 - (dy / len) * shortenBy;
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={ex} y2={ey} stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} markerEnd={`url(#${s.head})`} />
            {a.label && (
              <g>
                <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r="8" fill="rgba(255,255,255,0.85)" stroke="rgba(0,0,0,0.3)" strokeWidth="1" />
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 + 3.5} textAnchor="middle" fill="#000" fontSize="8" fontWeight="bold">{a.label}</text>
              </g>
            )}
          </g>
        );
      })}

      {/* Annotations */}
      {(drill.annotations || []).map((a, i) => (
        <g key={i} filter={`url(#glow-${id})`}>
          <rect x={sx(a.x) - 48} y={sy(a.y) - 10} width="96" height="20" rx="10" fill={a.bg || "rgba(16,185,129,0.2)"} stroke={a.border || "rgba(16,185,129,0.4)"} strokeWidth="0.5" />
          <text x={sx(a.x)} y={sy(a.y) + 4} textAnchor="middle" fill={a.color || "#34d399"} fontSize="7.5" fontWeight="bold" letterSpacing="0.8">{a.text}</text>
        </g>
      ))}

      {/* Players */}
      {drill.players.map((p, i) => (
        <g key={i}>
          <circle cx={sx(p.x)} cy={sy(p.y)} r="12" fill={teamColor(p.team)} stroke={teamStroke(p.team)} strokeWidth="1.5" opacity="0.92" />
          <text x={sx(p.x)} y={sy(p.y) + 4} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">{p.role}</text>
        </g>
      ))}

      {/* Drill title bar */}
      <rect x={pad} y={pad} width={fw} height="28" rx="4" fill="rgba(0,0,0,0.5)" />
      <text x={pad + 12} y={pad + 18} fill="#10b981" fontSize="8" fontWeight="bold" fontFamily="monospace" letterSpacing="1.5">{drill.code}</text>
      <text x={W / 2} y={pad + 18} textAnchor="middle" fill="#e2e8f0" fontSize="9.5" fontWeight="bold">{drill.title}</text>
      <text x={W - pad - 12} y={pad + 18} textAnchor="end" fill="#64748b" fontSize="7.5">{drill.meta}</text>
    </svg>
  );
}

// ─── Drill Data for 4 Diagrams ──────────────────────────────────────
const DRILLS = [
  {
    code: "D-1042",
    title: "Rondo 4v2 Positional Play",
    meta: "4v2 • 15×15 yd",
    pitch: "QUARTER",
    goals: [],
    safeZones: [{ x: 25, y: 20, width: 50, height: 60, team: "ATT" }],
    players: [
      { x: 25, y: 30, team: "ATT", role: "CM" }, { x: 75, y: 30, team: "ATT", role: "CM" },
      { x: 25, y: 70, team: "ATT", role: "CB" }, { x: 75, y: 70, team: "ATT", role: "CB" },
      { x: 45, y: 45, team: "DEF", role: "PR" }, { x: 55, y: 55, team: "DEF", role: "PR" },
    ],
    arrows: [
      { from: { x: 25, y: 30 }, to: { x: 75, y: 30 }, type: "pass", label: "1" },
      { from: { x: 75, y: 30 }, to: { x: 75, y: 70 }, type: "pass", label: "2" },
      { from: { x: 45, y: 45 }, to: { x: 35, y: 35 }, type: "press" },
      { from: { x: 55, y: 55 }, to: { x: 65, y: 45 }, type: "press" },
    ],
    annotations: [{ x: 50, y: 10, text: "KEEP POSSESSION", color: "#6ee7b7", bg: "rgba(16,185,129,0.2)", border: "rgba(16,185,129,0.4)" }],
  },
  {
    code: "D-2187",
    title: "Build-Up 6v4 Against Press",
    meta: "6v4 • Half Pitch",
    pitch: "HALF",
    goals: [{ x: 2, y: 50, width: 12 }],
    safeZones: [
      { x: 0, y: 0, width: 30, height: 100, team: "ATT" },
      { x: 65, y: 20, width: 35, height: 60, team: "DEF" },
    ],
    players: [
      { x: 5, y: 50, team: "ATT", role: "GK" },
      { x: 18, y: 30, team: "ATT", role: "CB" }, { x: 18, y: 70, team: "ATT", role: "CB" },
      { x: 35, y: 50, team: "ATT", role: "DM" },
      { x: 50, y: 25, team: "ATT", role: "CM" }, { x: 50, y: 75, team: "ATT", role: "CM" },
      { x: 55, y: 40, team: "DEF", role: "CF" }, { x: 55, y: 60, team: "DEF", role: "CF" },
      { x: 75, y: 35, team: "DEF", role: "CM" }, { x: 75, y: 65, team: "DEF", role: "CM" },
    ],
    arrows: [
      { from: { x: 5, y: 50 }, to: { x: 18, y: 30 }, type: "pass", label: "1" },
      { from: { x: 18, y: 30 }, to: { x: 35, y: 50 }, type: "pass", label: "2" },
      { from: { x: 35, y: 50 }, to: { x: 50, y: 25 }, type: "pass", label: "3" },
      { from: { x: 55, y: 40 }, to: { x: 35, y: 50 }, type: "press" },
      { from: { x: 50, y: 75 }, to: { x: 65, y: 60 }, type: "movement" },
    ],
    annotations: [
      { x: 15, y: 8, text: "SAFE BUILD ZONE", color: "#93c5fd", bg: "rgba(59,130,246,0.2)", border: "rgba(59,130,246,0.3)" },
      { x: 82, y: 8, text: "HIGH PRESS ZONE", color: "#fca5a5", bg: "rgba(239,68,68,0.2)", border: "rgba(239,68,68,0.3)" },
    ],
  },
  {
    code: "D-3091",
    title: "Counter-Press 6v6 + GK",
    meta: "6v6+GK • 50×40 yd",
    pitch: "FULL",
    goals: [{ x: 2, y: 50, width: 10 }, { x: 98, y: 50, width: 10 }],
    safeZones: [{ x: 55, y: 15, width: 40, height: 70, team: "ATT" }],
    players: [
      { x: 95, y: 50, team: "ATT", role: "GK" },
      { x: 78, y: 30, team: "ATT", role: "CB" }, { x: 78, y: 70, team: "ATT", role: "CB" },
      { x: 60, y: 50, team: "ATT", role: "CM" },
      { x: 45, y: 25, team: "ATT", role: "LW" }, { x: 45, y: 75, team: "ATT", role: "RW" },
      { x: 30, y: 45, team: "ATT", role: "ST" },
      { x: 5, y: 50, team: "DEF", role: "GK" },
      { x: 22, y: 30, team: "DEF", role: "CB" }, { x: 22, y: 70, team: "DEF", role: "CB" },
      { x: 38, y: 50, team: "DEF", role: "DM" },
      { x: 52, y: 30, team: "DEF", role: "CM" }, { x: 52, y: 70, team: "DEF", role: "CM" },
    ],
    arrows: [
      { from: { x: 60, y: 50 }, to: { x: 45, y: 25 }, type: "pass", label: "1" },
      { from: { x: 45, y: 25 }, to: { x: 30, y: 45 }, type: "pass", label: "2" },
      { from: { x: 45, y: 75 }, to: { x: 35, y: 55 }, type: "movement" },
      { from: { x: 38, y: 50 }, to: { x: 45, y: 42 }, type: "press" },
      { from: { x: 52, y: 30 }, to: { x: 45, y: 28 }, type: "press" },
    ],
    annotations: [{ x: 75, y: 8, text: "COUNTER-PRESS", color: "#fca5a5", bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.3)" }],
  },
  {
    code: "D-4415",
    title: "Transition Game 5v5 + 2N",
    meta: "5v5+2 • 40×30 yd",
    pitch: "FULL",
    goals: [{ x: 2, y: 50, width: 10 }, { x: 98, y: 50, width: 10 }],
    safeZones: [
      { x: 0, y: 0, width: 25, height: 100, team: "DEF" },
      { x: 75, y: 0, width: 25, height: 100, team: "ATT" },
    ],
    players: [
      { x: 85, y: 35, team: "ATT", role: "RW" }, { x: 85, y: 65, team: "ATT", role: "LW" },
      { x: 70, y: 50, team: "ATT", role: "CM" }, { x: 60, y: 30, team: "ATT", role: "CM" },
      { x: 60, y: 70, team: "ATT", role: "CM" },
      { x: 15, y: 35, team: "DEF", role: "CB" }, { x: 15, y: 65, team: "DEF", role: "CB" },
      { x: 30, y: 50, team: "DEF", role: "CM" }, { x: 40, y: 30, team: "DEF", role: "CM" },
      { x: 40, y: 70, team: "DEF", role: "CM" },
      { x: 50, y: 15, team: "NEU", role: "N" }, { x: 50, y: 85, team: "NEU", role: "N" },
    ],
    arrows: [
      { from: { x: 70, y: 50 }, to: { x: 85, y: 35 }, type: "pass", label: "1" },
      { from: { x: 85, y: 35 }, to: { x: 50, y: 15 }, type: "pass", label: "2" },
      { from: { x: 50, y: 15 }, to: { x: 60, y: 30 }, type: "pass", label: "3" },
      { from: { x: 40, y: 30 }, to: { x: 60, y: 30 }, type: "press" },
      { from: { x: 30, y: 50 }, to: { x: 50, y: 40 }, type: "movement" },
    ],
    annotations: [
      { x: 13, y: 8, text: "DEF SAFE ZONE", color: "#fca5a5", bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.3)" },
      { x: 87, y: 8, text: "ATT SAFE ZONE", color: "#93c5fd", bg: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.3)" },
      { x: 50, y: 94, text: "8 SEC TRANSITION = 3 PTS", color: "#fde68a", bg: "rgba(234,179,8,0.15)", border: "rgba(234,179,8,0.3)" },
    ],
  },
];

// ─── Diagram Carousel ───────────────────────────────────────────────
function DiagramCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setActive((p) => (p + 1) % DRILLS.length), 4500);
    return () => clearInterval(timer);
  }, [paused]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ position: "relative", width: "100%" }}
    >
      {/* Diagram container */}
      <div style={{
        borderRadius: "16px",
        overflow: "hidden",
        border: "1px solid rgba(51,65,85,0.4)",
        background: "rgba(15,23,42,0.5)",
        position: "relative",
      }}>
        {DRILLS.map((drill, i) => (
          <div key={i} style={{
            position: i === 0 ? "relative" : "absolute",
            top: 0,
            left: 0,
            width: "100%",
            opacity: active === i ? 1 : 0,
            transform: active === i ? "scale(1)" : "scale(0.96)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
            pointerEvents: active === i ? "auto" : "none",
          }}>
            <TacticalDiagram drill={drill} id={`d${i}`} />
          </div>
        ))}
      </div>

      {/* Legend bar */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: "16px",
        marginTop: "12px",
        flexWrap: "wrap",
      }}>
        {[
          { color: "#3b82f6", label: "Attack" },
          { color: "#ef4444", label: "Defend" },
          { color: "#eab308", label: "Neutral" },
          { label: "Pass", line: true, dash: false },
          { label: "Run", line: true, dash: true },
          { label: "Press", line: true, dash: true, red: true },
        ].map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            {l.line ? (
              <svg width="18" height="8">
                <line x1="0" y1="4" x2="18" y2="4"
                  stroke={l.red ? "rgba(239,68,68,0.7)" : "rgba(255,255,255,0.6)"}
                  strokeWidth="1.5"
                  strokeDasharray={l.dash ? "4 3" : "none"} />
              </svg>
            ) : (
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: l.color }} />
            )}
            <span style={{ fontSize: "10px", color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "12px" }}>
        {DRILLS.map((d, i) => (
          <button key={i} onClick={() => setActive(i)} style={{
            width: active === i ? "28px" : "8px",
            height: "8px",
            borderRadius: "4px",
            background: active === i ? "#10b981" : "rgba(100,116,139,0.4)",
            border: "none",
            cursor: "pointer",
            transition: "all 0.3s ease",
            padding: 0,
          }} />
        ))}
      </div>
    </div>
  );
}

// ─── Session Card Mockup ────────────────────────────────────────────
function SessionCardMockup() {
  const drills = [
    { phase: "WARM-UP", name: "Rondo 4v2 Positional", dur: "10 min", color: "#fbbf24" },
    { phase: "TECHNICAL", name: "Passing Combos Under Press", dur: "15 min", color: "#3b82f6" },
    { phase: "TACTICAL", name: "Build-up 6v4 Half Pitch", dur: "20 min", color: "#10b981" },
    { phase: "GAME", name: "Conditioned Match 8v8", dur: "20 min", color: "#ef4444" },
    { phase: "COOL-DOWN", name: "Recovery + Debrief", dur: "5 min", color: "#8b5cf6" },
  ];

  return (
    <div style={{
      background: "rgba(15,23,42,0.85)",
      border: "1px solid rgba(51,65,85,0.6)",
      borderRadius: "16px",
      padding: "24px",
      backdropFilter: "blur(20px)",
      maxWidth: "380px",
      width: "100%",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
        <span style={{ fontSize: "10px", letterSpacing: "2px", color: "#10b981", fontWeight: "700", fontFamily: "'JetBrains Mono', monospace" }}>SESSION S-1247</span>
        <span style={{ fontSize: "10px", color: "#64748b" }}>90 MIN</span>
      </div>
      <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#e2e8f0", margin: "8px 0", fontFamily: "'Space Grotesk', sans-serif" }}>Building from the Back: U14</h3>
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        {["4-3-3", "Build-up", "U14"].map(tag => (
          <span key={tag} style={{
            fontSize: "10px",
            padding: "3px 10px",
            borderRadius: "99px",
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.25)",
            color: "#6ee7b7",
            fontFamily: "'JetBrains Mono', monospace",
          }}>{tag}</span>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {drills.map((d, i) => (
          <div key={i} style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px 12px",
            background: "rgba(30,41,59,0.5)",
            borderRadius: "10px",
            border: "1px solid rgba(51,65,85,0.4)",
          }}>
            <div style={{ width: "3px", height: "28px", borderRadius: "2px", background: d.color, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "9px", color: d.color, fontWeight: "700", letterSpacing: "1.5px", fontFamily: "'JetBrains Mono', monospace" }}>{d.phase}</div>
              <div style={{ fontSize: "12px", color: "#cbd5e1", fontWeight: "500" }}>{d.name}</div>
            </div>
            <span style={{ fontSize: "10px", color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>{d.dur}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Landing Page ──────────────────────────────────────────────
export default function TacticalEdgeLanding() {
  const [mobileMenu, setMobileMenu] = useState(false);

  // Load fonts
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=DM+Sans:wght@400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      background: "#020617",
      color: "#e2e8f0",
      minHeight: "100vh",
      overflowX: "hidden",
    }}>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        ::selection { background: rgba(16,185,129,0.3); color: #fff; }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 0.6; } 100% { transform: scale(2); opacity: 0; } }
        @keyframes slide-in { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes gradient-shift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .hero-gradient {
          background: radial-gradient(ellipse 80% 50% at 50% 0%, rgba(16,185,129,0.12) 0%, transparent 60%),
                      radial-gradient(ellipse 60% 40% at 80% 20%, rgba(6,182,212,0.06) 0%, transparent 50%);
        }
        .cta-btn {
          background: linear-gradient(135deg, #059669 0%, #10b981 100%);
          color: #fff;
          border: none;
          padding: 14px 32px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
          font-family: 'Space Grotesk', sans-serif;
          letter-spacing: 0.3px;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(16,185,129,0.3); }
        .cta-secondary {
          background: transparent;
          color: #6ee7b7;
          border: 1px solid rgba(16,185,129,0.3);
          padding: 14px 32px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          font-family: 'Space Grotesk', sans-serif;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .cta-secondary:hover { background: rgba(16,185,129,0.08); border-color: rgba(16,185,129,0.5); }
        .nav-link {
          color: #94a3b8;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s;
          font-family: 'Space Grotesk', sans-serif;
        }
        .nav-link:hover { color: #10b981; }
        .feature-card {
          background: rgba(15,23,42,0.6);
          border: 1px solid rgba(51,65,85,0.5);
          border-radius: 16px;
          padding: 28px;
          transition: all 0.4s ease;
          backdrop-filter: blur(10px);
        }
        .feature-card:hover { border-color: rgba(16,185,129,0.3); transform: translateY(-4px); box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
        .grid-pattern {
          background-image: radial-gradient(rgba(51,65,85,0.3) 1px, transparent 1px);
          background-size: 32px 32px;
        }
        .workflow-step { position: relative; padding-left: 48px; }
        .workflow-step::before {
          content: '';
          position: absolute;
          left: 15px;
          top: 36px;
          bottom: -24px;
          width: 1px;
          background: linear-gradient(to bottom, rgba(16,185,129,0.4), transparent);
        }
        .workflow-step:last-child::before { display: none; }
        input:focus { outline: none; }
        @media (max-width: 768px) {
          .hero-flex { flex-direction: column !important; text-align: center; }
          .hero-flex > div:first-child { align-items: center !important; }
          .hero-ctas { justify-content: center !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .workflow-layout { flex-direction: column !important; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .footer-grid { grid-template-columns: 1fr !important; text-align: center; }
          .nav-links-desktop { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-menu-btn { display: none !important; }
          .mobile-menu { display: none !important; }
        }
      `}</style>

      {/* ═══ NAV ═══ */}
      <nav style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: "16px 24px",
        background: "rgba(2,6,23,0.8)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(51,65,85,0.3)",
      }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img
              src="/images/tacticaledge-emblem.png"
              alt="TacticalEdge"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
              style={{
              width: "52px",
              height: "52px",
              borderRadius: "8px",
              objectFit: "cover",
            }} />
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: "700", fontSize: "22px", color: "#f8fafc", letterSpacing: "-0.3px" }}>
              Tactical<span style={{ color: "#10b981" }}>Edge</span>
            </span>
          </div>
          <div className="nav-links-desktop" style={{ display: "flex", gap: "32px", alignItems: "center" }}>
            <a href="#features" className="nav-link">Features</a>
            <a href="#diagrams" className="nav-link">Diagrams</a>
            <a href="#workflow" className="nav-link">Workflow</a>
            <a href="/login?next=/app" className="nav-link">Log In</a>
            <a href="/register" className="cta-btn" style={{ padding: "10px 24px", fontSize: "13px" }}>Start Free →</a>
          </div>
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenu(!mobileMenu)}
            style={{
              display: "none",
              alignItems: "center",
              justifyContent: "center",
              background: "none",
              border: "1px solid rgba(51,65,85,0.5)",
              borderRadius: "8px",
              padding: "8px",
              cursor: "pointer",
              color: "#94a3b8",
            }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {mobileMenu ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
        {mobileMenu && (
          <div className="mobile-menu" style={{
            padding: "16px 0",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            borderTop: "1px solid rgba(51,65,85,0.3)",
            marginTop: "12px",
          }}>
            <a href="#features" className="nav-link" onClick={() => setMobileMenu(false)}>Features</a>
            <a href="#diagrams" className="nav-link" onClick={() => setMobileMenu(false)}>Diagrams</a>
            <a href="#workflow" className="nav-link" onClick={() => setMobileMenu(false)}>Workflow</a>
            <a href="/login?next=/app" className="nav-link" onClick={() => setMobileMenu(false)}>Log In</a>
            <a href="/register" className="cta-btn" style={{ padding: "10px 24px", fontSize: "13px", textAlign: "center", justifyContent: "center" }}>Start Free →</a>
          </div>
        )}
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="hero-gradient" style={{ paddingTop: "140px", paddingBottom: "80px", position: "relative" }}>
        <div className="grid-pattern" style={{ position: "absolute", inset: 0, opacity: 0.4 }} />
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px", position: "relative" }}>
          <div className="hero-flex" style={{ display: "flex", gap: "60px", alignItems: "center" }}>
            <div style={{ flex: "1", display: "flex", flexDirection: "column", gap: "24px", alignItems: "flex-start" }}>
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 16px",
                borderRadius: "99px",
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.2)",
              }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", animation: "pulse-ring 2s infinite" }} />
                <span style={{ fontSize: "12px", color: "#6ee7b7", fontFamily: "'JetBrains Mono', monospace", fontWeight: "500" }}>AI-POWERED COACHING PLATFORM</span>
              </div>

              <h1 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "clamp(36px, 5vw, 64px)",
                fontWeight: "700",
                lineHeight: "1.1",
                letterSpacing: "-1.5px",
                color: "#f8fafc",
              }}>
                Session planning<br />
                built for <span style={{
                  background: "linear-gradient(135deg, #10b981, #34d399, #67e8f9)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundSize: "200% 200%",
                  animation: "gradient-shift 4s ease infinite",
                }}>serious coaches</span>
              </h1>

              <p style={{
                fontSize: "18px",
                lineHeight: "1.7",
                color: "#94a3b8",
                maxWidth: "520px",
              }}>
                Generate drills, full sessions, and progressive series with tactical diagrams — all tailored to your age group, formation, and game model.
              </p>

              <div className="hero-ctas" style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <a href="/register" className="cta-btn">
                  Start Free
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </a>
                <a href="/login?next=/app" className="cta-secondary">
                  Explore App
                </a>
              </div>

              <div style={{ display: "flex", gap: "32px", marginTop: "8px" }}>
                {[["U8–U18", "Age Groups"], ["4-3-3 / 4-4-2 / 3-5-2", "Formations"], ["60–90 min", "Sessions"]].map(([val, label]) => (
                  <div key={label}>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#6ee7b7", fontFamily: "'JetBrains Mono', monospace" }}>{val}</div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ flex: "1", minWidth: "0" }}>
              <DiagramCarousel />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <section style={{
        borderTop: "1px solid rgba(51,65,85,0.3)",
        borderBottom: "1px solid rgba(51,65,85,0.3)",
        background: "rgba(15,23,42,0.5)",
        padding: "40px 24px",
      }}>
        <div className="stats-grid" style={{
          maxWidth: "900px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "32px",
          textAlign: "center",
        }}>
          {[
            ["500+", "Drills Generated"],
            ["120+", "Sessions Created"],
            ["50+", "Coaches Active"],
            ["6", "Training Phases"],
          ].map(([num, label]) => (
            <div key={label}>
              <div style={{ fontSize: "32px", fontWeight: "700", fontFamily: "'Space Grotesk', sans-serif", color: "#10b981" }}>{num}</div>
              <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="features" style={{ padding: "100px 24px", position: "relative" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: "64px" }}>
              <span style={{ fontSize: "12px", letterSpacing: "3px", color: "#10b981", fontFamily: "'JetBrains Mono', monospace", fontWeight: "600" }}>FEATURES</span>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: "700", marginTop: "12px", letterSpacing: "-0.8px", color: "#f8fafc" }}>
                Everything a coach needs
              </h2>
              <p style={{ fontSize: "16px", color: "#64748b", marginTop: "12px", maxWidth: "540px", marginLeft: "auto", marginRight: "auto" }}>
                From individual drills to full progressive series — with intelligent tactical context at every step.
              </p>
            </div>
          </FadeIn>

          <div className="features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
            {[
              {
                icon: "⚡",
                title: "Drill Generator",
                desc: "Generate individual drills with full tactical context, player setup, coaching points, and diagrams.",
                accent: "#10b981",
              },
              {
                icon: "📋",
                title: "Session Builder",
                desc: "Complete 60–90 minute sessions with warmup, technical, tactical, conditioned game, and cooldown phases.",
                accent: "#3b82f6",
              },
              {
                icon: "📈",
                title: "Progressive Series",
                desc: "Multi-session plans with built-in progression logic that evolves concepts across training days.",
                accent: "#8b5cf6",
              },
              {
                icon: "🗂",
                title: "Content Vault",
                desc: "Save, organize, and retrieve your drills and sessions with reference codes and favorites.",
                accent: "#f59e0b",
              },
              {
                icon: "📅",
                title: "Calendar Planning",
                desc: "Schedule sessions, view your training week, and generate parent communication summaries.",
                accent: "#06b6d4",
              },
              {
                icon: "💬",
                title: "AI Coach Assistant",
                desc: "Describe what you need in natural language and let the AI extract parameters and generate content.",
                accent: "#ec4899",
              },
            ].map((f, i) => (
              <FadeIn key={f.title} delay={i * 100}>
                <div className="feature-card" style={{ height: "100%" }}>
                  <div style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    background: `${f.accent}15`,
                    border: `1px solid ${f.accent}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    marginBottom: "16px",
                  }}>{f.icon}</div>
                  <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "17px", fontWeight: "700", color: "#f8fafc", marginBottom: "8px" }}>{f.title}</h3>
                  <p style={{ fontSize: "14px", color: "#64748b", lineHeight: "1.6" }}>{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ DIAGRAM SHOWCASE ═══ */}
      <section id="diagrams" style={{
        padding: "100px 24px",
        background: "linear-gradient(180deg, rgba(15,23,42,0.3) 0%, rgba(2,6,23,1) 100%)",
        position: "relative",
      }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div className="hero-flex" style={{ display: "flex", gap: "60px", alignItems: "center" }}>
            <FadeIn style={{ flex: "1" }}>
              <div style={{ flex: "1" }}>
                <span style={{ fontSize: "12px", letterSpacing: "3px", color: "#10b981", fontFamily: "'JetBrains Mono', monospace", fontWeight: "600" }}>TACTICAL DIAGRAMS</span>
                <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: "700", marginTop: "12px", letterSpacing: "-0.8px", color: "#f8fafc" }}>
                  See the pitch,<br />not just the plan
                </h2>
                <p style={{ fontSize: "16px", color: "#94a3b8", marginTop: "16px", lineHeight: "1.7", maxWidth: "460px" }}>
                  Every drill comes with an AI-generated tactical diagram showing player positions, movement patterns, passing lanes, and press zones.
                </p>
                <div style={{ marginTop: "28px", display: "flex", flexDirection: "column", gap: "14px" }}>
                  {[
                    "Attack, defense, and neutral player positioning",
                    "Pass, run, and press arrow overlays",
                    "Zonal highlights with tactical annotations",
                    "Formation-aware spatial layout",
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "20px", height: "20px", borderRadius: "6px", background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="12" height="12" fill="none" stroke="#10b981" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
                      </div>
                      <span style={{ fontSize: "14px", color: "#cbd5e1" }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={200} style={{ flex: "1" }}>
              <div style={{ flex: "1", display: "flex", justifyContent: "center" }}>
                <SessionCardMockup />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ═══ WORKFLOW ═══ */}
      <section id="workflow" style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: "64px" }}>
              <span style={{ fontSize: "12px", letterSpacing: "3px", color: "#10b981", fontFamily: "'JetBrains Mono', monospace", fontWeight: "600" }}>WORKFLOW</span>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: "700", marginTop: "12px", letterSpacing: "-0.8px", color: "#f8fafc" }}>
                From idea to field in minutes
              </h2>
            </div>
          </FadeIn>

          <div style={{ maxWidth: "600px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
            {[
              { step: "01", title: "Describe", desc: "Set your age group, formation, training phase, and topic — or just tell the AI what you need.", color: "#10b981" },
              { step: "02", title: "Generate", desc: "The AI builds a structured session with phase-appropriate drills, coaching points, and variations.", color: "#3b82f6" },
              { step: "03", title: "Review", desc: "Explore drill cards with tactical diagrams, tweak parameters, and adjust to your group.", color: "#8b5cf6" },
              { step: "04", title: "Save & Schedule", desc: "Send to your vault, add favorites, and place it on the calendar for your next training day.", color: "#f59e0b" },
            ].map((s, i) => (
              <FadeIn key={s.step} delay={i * 120}>
                <div className="workflow-step">
                  <div style={{
                    position: "absolute",
                    left: "0",
                    top: "4px",
                    width: "32px",
                    height: "32px",
                    borderRadius: "10px",
                    background: `${s.color}18`,
                    border: `1.5px solid ${s.color}40`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "12px",
                    fontWeight: "700",
                    color: s.color,
                  }}>{s.step}</div>
                  <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "18px", fontWeight: "700", color: "#f8fafc", marginBottom: "6px" }}>{s.title}</h3>
                  <p style={{ fontSize: "14px", color: "#64748b", lineHeight: "1.6" }}>{s.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CONTEXT TRUST ═══ */}
      <section style={{
        padding: "80px 24px",
        background: "rgba(15,23,42,0.4)",
        borderTop: "1px solid rgba(51,65,85,0.2)",
        borderBottom: "1px solid rgba(51,65,85,0.2)",
      }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", textAlign: "center" }}>
          <FadeIn>
            <span style={{ fontSize: "12px", letterSpacing: "3px", color: "#10b981", fontFamily: "'JetBrains Mono', monospace", fontWeight: "600" }}>CONTEXT-AWARE</span>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: "700", marginTop: "12px", letterSpacing: "-0.5px", color: "#f8fafc" }}>
              Built for real coaching context
            </h2>
            <p style={{ fontSize: "16px", color: "#64748b", marginTop: "12px", maxWidth: "600px", marginLeft: "auto", marginRight: "auto", lineHeight: "1.7" }}>
              Every session respects your age group, development phase, formation preference, and tactical focus — because a U10 possession drill is nothing like a U16 press-resistance exercise.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap", marginTop: "32px" }}>
              {["Age-appropriate complexity", "Formation constraints", "Phase of play", "Game model alignment", "Progressive overload", "Tactical periodization"].map(tag => (
                <span key={tag} style={{
                  fontSize: "13px",
                  padding: "8px 18px",
                  borderRadius: "99px",
                  background: "rgba(15,23,42,0.8)",
                  border: "1px solid rgba(51,65,85,0.5)",
                  color: "#94a3b8",
                  fontFamily: "'DM Sans', sans-serif",
                }}>{tag}</span>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ TAILORED SECTION ═══ */}
      <section style={{
        padding: "100px 24px",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: "64px" }}>
              <span style={{ fontSize: "12px", letterSpacing: "3px", color: "#10b981", fontFamily: "'JetBrains Mono', monospace", fontWeight: "600" }}>TAILORED TO YOUR REALITY</span>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: "700", marginTop: "12px", letterSpacing: "-0.8px", color: "#f8fafc" }}>
                Goes further than tactics
              </h2>
              <p style={{ fontSize: "16px", color: "#64748b", marginTop: "12px", maxWidth: "580px", marginLeft: "auto", marginRight: "auto", lineHeight: "1.7" }}>
                Every club is different. TacticalEdge adapts to your actual constraints — your pitch, your staff, your philosophy — so every session fits your world, not a template.
              </p>
            </div>
          </FadeIn>

          <div className="features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
            {[
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="3" y1="15" x2="21" y2="15" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                    <line x1="15" y1="3" x2="15" y2="21" />
                  </svg>
                ),
                title: "Field Space Constraints",
                desc: "Half pitch, quarter pitch, full field — sessions adapt to whatever space you actually have available on training day.",
                accent: "#10b981",
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                    <path d="M12 8v4l2 2" />
                    <circle cx="12" cy="12" r="1" fill="#3b82f6" />
                  </svg>
                ),
                title: "GK Available Toggle",
                desc: "No goalkeeper at training? No problem. Sessions intelligently adjust drill setups and finishing exercises based on GK availability.",
                accent: "#3b82f6",
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                ),
                title: "Fully Customizable",
                desc: "Override any parameter. Adjust player counts, dimensions, duration, coaching points — make every drill truly yours.",
                accent: "#8b5cf6",
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ),
                title: "Club-Wide Visibility",
                desc: "Technical directors and head coaches see everything — every session, every age group, every coach's plan — in one unified view.",
                accent: "#f59e0b",
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                ),
                title: "Club Game Model",
                desc: "Define your club's playing philosophy once — possession-based, counter-press, positional play — and every session aligns automatically.",
                accent: "#06b6d4",
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                ),
                title: "Club-Wide Sync",
                desc: "Everyone on the same page. From U8 to U18, every coach works within the same methodology, terminology, and progression framework.",
                accent: "#ec4899",
              },
            ].map((f, i) => (
              <FadeIn key={f.title} delay={i * 100}>
                <div className="feature-card" style={{ height: "100%" }}>
                  <div style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    background: `${f.accent}15`,
                    border: `1px solid ${f.accent}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "16px",
                  }}>{f.icon}</div>
                  <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "17px", fontWeight: "700", color: "#f8fafc", marginBottom: "8px" }}>{f.title}</h3>
                  <p style={{ fontSize: "14px", color: "#64748b", lineHeight: "1.6" }}>{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={300}>
            <div style={{
              marginTop: "48px",
              padding: "24px 32px",
              borderRadius: "16px",
              background: "rgba(16,185,129,0.05)",
              border: "1px solid rgba(16,185,129,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              textAlign: "center",
              flexWrap: "wrap",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <path d="M22 4L12 14.01l-3-3" />
              </svg>
              <span style={{ fontSize: "15px", color: "#cbd5e1", fontWeight: "500" }}>
                One club. One philosophy. Every age group aligned. <span style={{ color: "#6ee7b7", fontWeight: "700" }}>That's the edge.</span>
              </span>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: "640px", margin: "0 auto", textAlign: "center" }}>
          <FadeIn>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: "700", letterSpacing: "-0.8px", color: "#f8fafc" }}>
              Ready to level up your sessions?
            </h2>
            <p style={{ fontSize: "16px", color: "#64748b", marginTop: "12px", lineHeight: "1.7" }}>
              Join coaches already using TacticalEdge to plan smarter, faster training.
            </p>

            <div style={{ marginTop: "32px", display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <a href="/register" className="cta-btn" style={{ fontSize: "16px", padding: "16px 36px" }}>
                Start Free Now
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>
            </div>

            <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginTop: "32px" }}>
              <a href="https://x.com/tacticaledge" target="_blank" rel="noopener noreferrer" style={{
                width: "48px", height: "48px", borderRadius: "12px",
                background: "rgba(15,23,42,0.8)", border: "1px solid rgba(51,65,85,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#94a3b8", transition: "all 0.3s ease", textDecoration: "none",
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://instagram.com/tacticaledge" target="_blank" rel="noopener noreferrer" style={{
                width: "48px", height: "48px", borderRadius: "12px",
                background: "rgba(15,23,42,0.8)", border: "1px solid rgba(51,65,85,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#94a3b8", transition: "all 0.3s ease", textDecoration: "none",
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
              <a href="mailto:hello@tacticaledge.app" style={{
                width: "48px", height: "48px", borderRadius: "12px",
                background: "rgba(15,23,42,0.8)", border: "1px solid rgba(51,65,85,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#94a3b8", transition: "all 0.3s ease", textDecoration: "none",
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{
        borderTop: "1px solid rgba(51,65,85,0.3)",
        padding: "48px 24px 32px",
        background: "rgba(2,6,23,0.9)",
      }}>
        <div className="footer-grid" style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr",
          gap: "40px",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <img
                src="/images/tacticaledge-emblem.png"
                alt="TacticalEdge"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
                style={{
                width: "54px",
                height: "54px",
                borderRadius: "7px",
                objectFit: "cover",
              }} />
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: "700", fontSize: "16px", color: "#f8fafc" }}>
                Tactical<span style={{ color: "#10b981" }}>Edge</span>
              </span>
            </div>
            <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6", maxWidth: "280px" }}>
              AI-powered session planning for soccer coaches who take development seriously.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: "12px", letterSpacing: "2px", color: "#64748b", fontWeight: "700", fontFamily: "'JetBrains Mono', monospace", marginBottom: "16px" }}>PRODUCT</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <a href="/login?next=/app" className="nav-link" style={{ fontSize: "13px" }}>App Home</a>
              <a href="/login?next=/demo/session" className="nav-link" style={{ fontSize: "13px" }}>Session Generator</a>
              <a href="/login?next=/demo/drill" className="nav-link" style={{ fontSize: "13px" }}>Drill Generator</a>
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: "12px", letterSpacing: "2px", color: "#64748b", fontWeight: "700", fontFamily: "'JetBrains Mono', monospace", marginBottom: "16px" }}>ACCOUNT</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <a href="/register" className="nav-link" style={{ fontSize: "13px" }}>Register</a>
              <a href="/login?next=/app" className="nav-link" style={{ fontSize: "13px" }}>Login</a>
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: "12px", letterSpacing: "2px", color: "#64748b", fontWeight: "700", fontFamily: "'JetBrains Mono', monospace", marginBottom: "16px" }}>CONNECT</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <a href="mailto:hello@tacticaledge.app" className="nav-link" style={{ fontSize: "13px" }}>Contact</a>
              <a href="https://x.com/tacticaledge" target="_blank" rel="noopener noreferrer" className="nav-link" style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                Twitter / X
              </a>
              <a href="https://instagram.com/tacticaledge" target="_blank" rel="noopener noreferrer" className="nav-link" style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                Instagram
              </a>
            </div>
          </div>
        </div>
        <div style={{
          maxWidth: "1200px",
          margin: "32px auto 0",
          paddingTop: "24px",
          borderTop: "1px solid rgba(51,65,85,0.2)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
        }}>
          <span style={{ fontSize: "12px", color: "#334155" }}>© 2025 TacticalEdge. All rights reserved.</span>
          <span style={{ fontSize: "12px", color: "#334155" }}>Built for coaches, by coaches.</span>
        </div>
      </footer>
    </div>
  );
}
