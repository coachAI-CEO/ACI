"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CoachChat from "@/components/CoachChat";
import { DrillDiagram } from "@/components/DrillDiagram";
import { SAMPLE_DIAGRAM_V1 } from "@/sample-diagram-v1";
import type { DiagramV1 } from "@/types/diagram";

const coachQuotes = [
  {
    quote: "Attack wins you games, defence wins you titles.",
    author: "Sir Alex Ferguson",
  },
  {
    quote: "Simple football is the most difficult.",
    author: "Johan Cruyff",
  },
  {
    quote: "We must have a team with the ability to suffer together.",
    author: "Jose Mourinho",
  },
  {
    quote: "If you do not believe you can do it then you have no chance at all.",
    author: "Arsene Wenger",
  },
  {
    quote: "Players make mistakes, and there are always things to improve, but if we don't support them, they don't improve.",
    author: "Carlo Ancelotti",
  },
];

const PRESSING_DIAGRAM: DiagramV1 = {
  pitch: {
    variant: "HALF",
    orientation: "HORIZONTAL",
    showZones: true,
    zones: {
      leftWide: false,
      leftHalfSpace: false,
      centralChannel: true,
      rightHalfSpace: true,
      rightWide: true,
    },
  },
  players: [
    { id: "D1", number: 4, team: "DEF", role: "CB", x: 38, y: 40 },
    { id: "D2", number: 6, team: "DEF", role: "DM", x: 46, y: 54 },
    { id: "D3", number: 7, team: "DEF", role: "W", x: 60, y: 58 },
    { id: "A1", number: 2, team: "ATT", role: "RB", x: 73, y: 62 },
    { id: "A2", number: 8, team: "ATT", role: "CM", x: 62, y: 47 },
    { id: "A3", number: 9, team: "ATT", role: "ST", x: 67, y: 36 },
  ],
  coach: { x: 14, y: 80, label: "Coach" },
  balls: [],
  cones: [],
  goals: [{ id: "G1", type: "BIG", width: 22, x: 90, y: 20 }],
  arrows: [
    { from: { playerId: "A1" }, to: { playerId: "A2" }, type: "pass", style: "solid", weight: "normal" },
    { from: { playerId: "D3" }, to: { playerId: "A1" }, type: "press", style: "solid", weight: "bold" },
    { from: { playerId: "D2" }, to: { playerId: "A2" }, type: "run", style: "dashed", weight: "normal" },
  ],
  areas: [],
  labels: [],
};

const drillOfDayEntries: Array<{
  title: string;
  focus: string;
  promptHint: string;
  diagram: DiagramV1;
}> = [
  {
    title: "Third-Man Combination to Mini Goals",
    focus: "Timing support runs and wall passes in the final third.",
    promptHint: "Use this structure in U14 attacking sessions with 10 players.",
    diagram: SAMPLE_DIAGRAM_V1,
  },
  {
    title: "Wide Pressing Trap",
    focus: "Force play to the right sideline, then lock passing lanes.",
    promptHint: "Build a 20-minute defending phase around this pressing trigger.",
    diagram: PRESSING_DIAGRAM,
  },
];

const quickLinks = [
  {
    href: "/demo/drill",
    label: "New Drill",
    desc: "Generate a custom drill",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    ),
    color: "from-emerald-500/25 to-teal-500/10 border-emerald-500/25 hover:border-emerald-400/50",
    hoverGlow: "hover:shadow-emerald-500/15",
    textColor: "text-emerald-400",
  },
  {
    href: "/demo/session",
    label: "New Session",
    desc: "Build a full training session",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="4" y="4" width="16" height="16" rx="2.5" />
        <path d="M8 9.5h8M8 13h8M8 16.5h5" />
      </svg>
    ),
    color: "from-blue-500/25 to-indigo-500/10 border-blue-500/25 hover:border-blue-400/50",
    hoverGlow: "hover:shadow-blue-500/15",
    textColor: "text-blue-400",
  },
  {
    href: "/vault",
    label: "My Vault",
    desc: "Saved drills & sessions",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M3.5 7.5h17v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11z" />
        <path d="M3.5 7.5l2-3h13l2 3" />
        <path d="M10 13h4" />
      </svg>
    ),
    color: "from-violet-500/25 to-purple-500/10 border-violet-500/25 hover:border-violet-400/50",
    hoverGlow: "hover:shadow-violet-500/15",
    textColor: "text-violet-400",
  },
  {
    href: "/calendar",
    label: "Calendar",
    desc: "Schedule & plan ahead",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17" />
      </svg>
    ),
    color: "from-amber-500/25 to-orange-500/10 border-amber-500/25 hover:border-amber-400/50",
    hoverGlow: "hover:shadow-amber-500/15",
    textColor: "text-amber-400",
  },
];

export default function Home() {
  const router = useRouter();
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [drillIndex, setDrillIndex] = useState(0);
  const [greeting, setGreeting] = useState("Good evening");

  useEffect(() => {
    const quoteKey = "dashboardCoachQuoteIndex";
    const selectDrillByDay = () => {
      const dayIndex = Math.floor(Date.now() / 86_400_000) % drillOfDayEntries.length;
      setDrillIndex(dayIndex);
    };

    const chooseQuote = () => {
      const previous = Number(localStorage.getItem(quoteKey) ?? "-1");
      let next = Math.floor(Math.random() * coachQuotes.length);
      if (coachQuotes.length > 1 && next === previous) {
        next = (next + 1) % coachQuotes.length;
      }
      localStorage.setItem(quoteKey, String(next));
      setQuoteIndex(next);
    };

    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    selectDrillByDay();
    chooseQuote();
    window.addEventListener("userLogin", chooseQuote);
    return () => window.removeEventListener("userLogin", chooseQuote);
  }, []);

  const drillOfDay = drillOfDayEntries[drillIndex];

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-[#060a13] text-slate-50">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-emerald-600/[0.07] blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[400px] w-[400px] rounded-full bg-blue-600/[0.05] blur-[120px]" />
        <div className="absolute -bottom-20 left-1/3 h-[350px] w-[350px] rounded-full bg-violet-600/[0.04] blur-[120px]" />
      </div>

      {/* Top bar with greeting + quick actions */}
      <div className="relative shrink-0 border-b border-white/[0.06] bg-gradient-to-r from-emerald-950/20 via-transparent to-blue-950/15 px-6 py-4">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="text-lg font-semibold text-white/90">{greeting}, Coach</h1>
            <p className="mt-0.5 text-[13px] text-slate-500">Ready to build something great today?</p>
          </div>
          <div className="flex gap-2.5">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`group relative flex items-center gap-2.5 rounded-xl border bg-gradient-to-br px-4 py-2.5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${link.color} ${link.hoverGlow}`}
              >
                <span className={`${link.textColor} transition-transform duration-200 group-hover:scale-110`}>{link.icon}</span>
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold text-white/90">{link.label}</span>
                  <span className="text-[10px] text-slate-500 group-hover:text-slate-400">{link.desc}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Main content grid — fills remaining space */}
      <div className="relative flex-1 min-h-0 grid gap-4 p-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Coach Chat - primary */}
        <section className="flex flex-col min-h-0 rounded-2xl border border-emerald-500/[0.08] bg-gradient-to-b from-[#0a1118]/80 to-[#0a0f1a]/60 overflow-hidden shadow-[0_0_40px_-12px_rgba(16,185,129,0.08)]">
          <div className="shrink-0 flex items-center gap-3 border-b border-emerald-500/[0.06] bg-gradient-to-r from-emerald-950/25 to-transparent px-5 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </div>
            <div>
              <h2 className="text-[13px] font-semibold text-white/90">Coach Assistant</h2>
              <p className="text-[11px] text-slate-500">Describe what you need in plain language</p>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <CoachChat
              onSessionSelect={(session) => {
                if (session?.id) {
                  router.push(`/demo/session?sessionId=${session.id}`);
                }
              }}
              onGenerateRequest={(params) => {
                const queryParams = new URLSearchParams();
                if (params.ageGroup) queryParams.set("ageGroup", params.ageGroup);
                if (params.gameModelId) queryParams.set("gameModelId", params.gameModelId);
                if (params.phase) queryParams.set("phase", params.phase);
                if (params.zone) queryParams.set("zone", params.zone);
                if (params.topic) queryParams.set("topic", params.topic);
                if (params.durationMin) queryParams.set("durationMin", String(params.durationMin));
                if (params.numbersMin) queryParams.set("numbersMin", String(params.numbersMin));
                if (params.numbersMax) queryParams.set("numbersMax", String(params.numbersMax));
                if (params.formationAttacking) queryParams.set("formationAttacking", params.formationAttacking);
                if (params.formationDefending) queryParams.set("formationDefending", params.formationDefending);
                if (params.playerLevel) queryParams.set("playerLevel", params.playerLevel);
                if (params.coachLevel) queryParams.set("coachLevel", params.coachLevel);
                if (params.goalsAvailable !== null && params.goalsAvailable !== undefined) queryParams.set("goalsAvailable", String(params.goalsAvailable));
                if (params.numberOfSessions && params.numberOfSessions > 1) {
                  queryParams.set("series", "true");
                  queryParams.set("numberOfSessions", String(params.numberOfSessions));
                }
                queryParams.set("autoGenerate", "true");
                router.push(`/demo/session?${queryParams.toString()}`);
              }}
            />
          </div>
        </section>

        {/* Right column — scrollable within its space */}
        <div className="flex flex-col gap-4 min-h-0 overflow-y-auto pr-1">
          {/* Drill of the Day */}
          <article className="shrink-0 rounded-2xl border border-teal-500/[0.1] bg-gradient-to-b from-[#0a1318]/80 to-[#0a0f1a]/60 overflow-hidden shadow-[0_0_30px_-12px_rgba(20,184,166,0.06)]">
            <div className="flex items-center gap-3 border-b border-teal-500/[0.06] bg-gradient-to-r from-teal-950/25 to-transparent px-5 py-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/20 shadow-[0_0_12px_rgba(20,184,166,0.15)]">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-teal-400" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="6.5" cy="6.5" r="2.5" />
                  <circle cx="17.5" cy="17.5" r="2.5" />
                  <path d="M8.5 8.5l7 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-[13px] font-semibold text-white/90">Drill of the Day</h2>
                <p className="text-[11px] text-slate-500">Fresh tactical pattern</p>
              </div>
            </div>
            <div className="p-4">
              <h3 className="text-sm font-bold text-white/90">{drillOfDay.title}</h3>
              <p className="mt-1 text-xs text-slate-400">{drillOfDay.focus}</p>
              <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.06] bg-[#060a13]/60 p-1.5">
                <DrillDiagram diagram={drillOfDay.diagram} width={340} height={190} />
              </div>
              <Link
                href={`/demo/drill?prompt=${encodeURIComponent(drillOfDay.promptHint)}`}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-300 transition hover:border-emerald-400/50 hover:bg-emerald-500/15 hover:text-emerald-200"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                Build Session From This
              </Link>
            </div>
          </article>

          {/* Quote */}
          <article className="relative shrink-0 overflow-hidden rounded-2xl border border-emerald-500/[0.1] bg-gradient-to-br from-emerald-950/30 via-[#0a0f1a]/80 to-teal-950/20 p-5">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-500/[0.08] blur-3xl" />
            <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-teal-500/[0.06] blur-3xl" />

            <p className="text-[11px] font-medium uppercase tracking-widest text-emerald-500/60">Inspiration</p>
            <p className="mt-3 text-3xl leading-none text-emerald-400/20 select-none">&ldquo;</p>
            <blockquote className="-mt-1 text-base font-semibold leading-relaxed text-white/85">
              {coachQuotes[quoteIndex].quote}
            </blockquote>
            <p className="mt-3 text-sm font-medium text-emerald-300/70">
              {coachQuotes[quoteIndex].author}
            </p>
          </article>
        </div>
      </div>
    </main>
  );
}
