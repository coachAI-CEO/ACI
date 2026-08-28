"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Trophy,
  Users,
  Layout,
  Calendar,
  ClipboardList,
  Zap,
  Activity,
  BarChart3,
  FileText,
  ArrowRight,
  Instagram,
  Twitter,
  Video,
} from "lucide-react";
import { trialsEnabled } from "@/lib/trials";

export default function TacticalEdgeLanding() {
  const trialsOpen = trialsEnabled();
  const signupHref = trialsOpen ? "/register" : "/pricing";
  const signupLabel = trialsOpen ? "Start Free" : "View Plans";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const emblemUrl = "/images/logo.png";
  const socialLinks = [
    { label: "Instagram", href: "https://www.instagram.com/tacticaledge.app/", icon: <Instagram size={18} /> },
    { label: "X", href: "https://x.com/tacticaledgeapp", icon: <Twitter size={18} /> },
  ];

  const stats = [
    { label: "Drills Generated", value: "1500+", icon: <Zap size={20} /> },
    { label: "Sessions Created", value: "250+", icon: <Calendar size={20} /> },
    { label: "Coaches Active", value: "50+", icon: <Users size={20} /> },
    { label: "Training Phases", value: "5", icon: <Activity size={20} /> },
    { label: "Age Groups", value: "U8-U18", icon: <Trophy size={20} /> },
    { label: "Formations", value: "12+", icon: <Layout size={20} /> },
  ];

  const flagship = [
    {
      icon: <Trophy size={28} />,
      title: "Coach Center",
      desc: "Season workspace for one team: 16-week curriculum, calendar, chat, next sessions, game-day sheet and recap.",
    },
    {
      icon: <ClipboardList size={28} />,
      title: "Session Builder",
      desc: "60–90 minute sessions with the 5-phase structure. Export a full PDF or a one-page Coach’s Sheet for the field.",
    },
    {
      icon: <Layout size={28} />,
      title: "Tactical Board",
      desc: "Live pitch, formation × phase chassis, principles library, and AI talk in your coaching language.",
    },
    {
      icon: <BarChart3 size={28} />,
      title: "Director of Coaching (DOC) Console",
      desc: "Club philosophy, coach usage, empty weeks, and assign or reassign sessions onto coach calendars.",
    },
  ];

  const supporting = [
    {
      icon: <FileText size={22} />,
      title: "Content Vault",
      desc: "Save drills and sessions with reference codes. Club-scoped for staff.",
    },
    {
      icon: <Users size={22} />,
      title: "Player Homework",
      desc: "Turn a team session into a solo player plan. PDF ready to send home.",
    },
    {
      icon: <Video size={22} />,
      title: "Video Analysis",
      badge: "Beta",
      desc: "Upload a short clip. Get ranked observations and a corrective session.",
    },
    {
      icon: <Zap size={22} />,
      title: "Drill Generator",
      desc: "One drill with tactical context, diagram, coaching points, and variations.",
    },
  ];

  const workflow = [
    { step: 1, title: "Open Coach Center", desc: "Your assigned team, this week’s curriculum theme, next match" },
    { step: 2, title: "Generate", desc: "Build or reuse a session for that theme" },
    { step: 3, title: "Review", desc: "Drill cards, tactical diagrams, coaching points" },
    { step: 4, title: "Print or teach", desc: "Session PDF, Coach’s Sheet, or Tactical Board" },
    { step: 5, title: "Game day", desc: "Match sheet: focus, DNA, set pieces" },
    { step: 6, title: "Recap", desc: "Record the match, then pick up next week’s theme" },
  ];

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050605] font-sans text-white selection:bg-[#ADFF2F]/30">
      <div className="fixed inset-0 z-0">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&q=80&w=2000')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black via-transparent to-[#050605]" />
      </div>

      <nav className="fixed z-50 w-full border-b border-white/5 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex h-28 max-w-7xl items-center justify-between px-6">
          <button className="flex items-center gap-4" onClick={() => scrollToSection("hero")}>
            <div className="logo-spin-wrap h-24 w-24 overflow-hidden rounded-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={emblemUrl} alt="Tactical Edge" className="logo-coin h-full w-full scale-[1.35] object-cover" />
            </div>
            <span className="hidden text-xl font-black uppercase tracking-tighter sm:block">
              Tactical<span className="text-[#ADFF2F]">Edge</span>
            </span>
          </button>

          <div className="hidden items-center gap-8 text-sm font-medium md:flex">
            <button onClick={() => scrollToSection("features")} className="text-gray-300 hover:text-[#ADFF2F]">Features</button>
            <button onClick={() => scrollToSection("workflow")} className="text-gray-300 hover:text-[#ADFF2F]">Workflow</button>
            <Link href="/pricing" className="text-gray-300 hover:text-[#ADFF2F]">Plans</Link>
            <Link href="/login" className="text-gray-300 hover:text-[#ADFF2F]">Log In</Link>
            <Link href={signupHref} className="rounded-sm bg-[#ADFF2F] px-6 py-2.5 text-xs font-bold uppercase text-black hover:bg-white">{signupLabel}</Link>
          </div>

          <button className="md:hidden" onClick={() => setMobileMenuOpen((v) => !v)}>
            ☰
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="space-y-4 bg-black/95 px-6 py-4 md:hidden">
            <button onClick={() => scrollToSection("features")} className="block text-gray-300">Features</button>
            <button onClick={() => scrollToSection("workflow")} className="block text-gray-300">Workflow</button>
            <Link href="/pricing" className="block text-gray-300" onClick={() => setMobileMenuOpen(false)}>Plans</Link>
            <Link href="/login" className="block text-gray-300" onClick={() => setMobileMenuOpen(false)}>Log In</Link>
            <Link href={signupHref} className="block w-full rounded-sm bg-[#ADFF2F] py-3 text-center text-sm font-bold uppercase text-black" onClick={() => setMobileMenuOpen(false)}>{signupLabel}</Link>
          </div>
        )}
      </nav>

      <header id="hero" className="relative px-6 pb-20 pt-40">
        <div className="mx-auto max-w-7xl text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#ADFF2F]/20 bg-[#ADFF2F]/10 px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-[#ADFF2F]">
            Coach Center · Board · DOC Console
          </div>
          <h1 className="mb-8 text-5xl font-black uppercase tracking-tighter text-white [text-shadow:0_4px_20px_rgba(0,0,0,0.95)] md:text-7xl">
            Session planning
            <br />
            <span className="text-[#ADFF2F]">
              built for serious coaches
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-3xl text-lg font-semibold leading-relaxed text-gray-100 [text-shadow:0_3px_14px_rgba(0,0,0,0.85)] md:text-2xl">
            Coach Center runs the week. Session Builder writes the plan. Tactical Board teaches the picture. The Director of Coaching (DOC) Console keeps the club on one game model.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href={signupHref} className="flex h-14 items-center gap-3 rounded-sm bg-[#ADFF2F] px-10 text-xs font-black uppercase text-black transition-all hover:bg-white">
              <span>{signupLabel}</span>
              <ArrowRight size={18} />
            </Link>
            <Link href="/login" className="h-14 rounded-sm border border-white/10 bg-white/5 px-10 text-xs font-black uppercase text-white hover:bg-white/10 inline-flex items-center">
              Log In
            </Link>
          </div>

          <div className="mt-20 grid grid-cols-2 gap-px rounded-sm border border-white/10 bg-white/5 md:grid-cols-6">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-[#050605]/90 p-6 text-center hover:bg-[#ADFF2F]/[0.05]">
                <div className="mb-3 flex justify-center text-[#ADFF2F]">{stat.icon}</div>
                <p className="text-2xl font-black md:text-3xl">{stat.value}</p>
                <p className="text-xs uppercase tracking-wider text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <section id="features" className="border-y border-white/10 bg-black/60 px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-3 text-4xl font-black uppercase tracking-tighter text-white [text-shadow:0_4px_20px_rgba(0,0,0,0.95)] md:text-6xl">
              The weekly coaching <span className="text-[#ADFF2F]">OS</span>
            </h2>
            <p className="text-lg text-gray-200">Four products coaches and directors actually open. Everything else supports them.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {flagship.map((feature) => (
              <div key={feature.title} className="group rounded-2xl border border-white/15 bg-black/55 p-8 backdrop-blur-sm transition-all hover:border-[#ADFF2F]/60 hover:bg-black/65">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-[#ADFF2F]/35 bg-[#ADFF2F]/12 text-[#ADFF2F] transition-all duration-200 group-hover:scale-105 group-hover:border-[#ADFF2F]/80 group-hover:bg-[#ADFF2F] group-hover:text-black group-hover:shadow-[0_0_24px_rgba(173,255,47,0.45)]">
                  {feature.icon}
                </div>
                <h3 className="mb-3 text-xl font-black uppercase tracking-tight text-white [text-shadow:0_3px_14px_rgba(0,0,0,0.9)]">{feature.title}</h3>
                <p className="text-sm text-gray-300">{feature.desc}</p>
              </div>
            ))}
          </div>

          <p className="mb-6 mt-16 text-center text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Also in the platform</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {supporting.map((feature) => (
              <div key={feature.title} className="rounded-xl border border-white/10 bg-black/40 p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#ADFF2F]/25 bg-[#ADFF2F]/10 text-[#ADFF2F]">
                    {feature.icon}
                  </div>
                  {feature.badge && (
                    <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
                      {feature.badge}
                    </span>
                  )}
                </div>
                <h3 className="mb-2 text-sm font-black uppercase tracking-tight text-white">{feature.title}</h3>
                <p className="text-sm text-gray-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="text-4xl font-black uppercase tracking-tighter text-white [text-shadow:0_4px_20px_rgba(0,0,0,0.95)] md:text-6xl">
              How a week <span className="text-[#ADFF2F]">actually runs</span>
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {workflow.map((step) => (
              <div key={step.step} className="rounded-2xl border border-white/15 bg-black/55 p-8 backdrop-blur-sm">
                <div className="mb-4 flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ADFF2F] text-lg font-black text-black">{step.step}</div>
                  <h3 className="text-xl font-black uppercase text-white [text-shadow:0_3px_14px_rgba(0,0,0,0.9)]">{step.title}</h3>
                </div>
                <p className="text-gray-300">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-black/60 px-6 py-24">
        <div className="mx-auto max-w-7xl text-center">
          <h2 className="mb-4 text-4xl font-black uppercase tracking-tighter text-white [text-shadow:0_4px_20px_rgba(0,0,0,0.95)] md:text-6xl">
            Proven 5-Phase <span className="text-[#ADFF2F]">Structure</span>
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-300">
            Then print the Coach’s Sheet or teach the shape on Tactical Board.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {["Warmup", "Technical", "Tactical", "Game", "Cooldown"].map((phase, i) => (
              <div key={phase} className="flex items-center gap-4">
                <div className="rounded-xl border border-white/15 bg-black/55 px-8 py-4 backdrop-blur-sm">
                  <span className="block font-mono text-sm text-[#ADFF2F]">PHASE {i + 1}</span>
                  <span className="text-xl font-black uppercase">{phase}</span>
                </div>
                {i < 4 && <ArrowRight size={20} className="hidden text-gray-600 sm:block" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
          <div className="rounded-[2rem] border border-[#ADFF2F]/25 bg-black/45 p-10 backdrop-blur-sm md:p-12">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#ADFF2F]">For coaches</p>
            <h2 className="mb-4 text-3xl font-black uppercase tracking-tighter text-white md:text-4xl">
              Run the week from Coach Center
            </h2>
            <p className="mb-8 text-gray-300">
              Theme, session, PDF, board, game-day sheet. Stop planning from a blank page on Tuesday night.
            </p>
            <Link
              href={signupHref}
              className="inline-flex min-w-[160px] justify-center rounded-md bg-[#ADFF2F] px-8 py-4 text-sm font-black uppercase text-black transition-all hover:bg-[#c6ff5f]"
            >
              {signupLabel}
            </Link>
          </div>
          <div className="rounded-[2rem] border border-white/15 bg-black/45 p-10 backdrop-blur-sm md:p-12">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-gray-400">For Directors of Coaching</p>
            <h2 className="mb-4 text-3xl font-black uppercase tracking-tighter text-white md:text-4xl">
              One philosophy. Every age group.
            </h2>
            <p className="mb-8 text-gray-300">
              The DOC Console shows empty weeks, attention, and calendar coverage so every coach stays on the club game model.
            </p>
            <Link
              href="/pricing"
              className="inline-flex min-w-[160px] justify-center rounded-md border border-white/20 bg-black/40 px-8 py-4 text-sm font-black uppercase text-white transition-all hover:border-white/40"
            >
              Club Pro &amp; Elite
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-black/65 px-6 py-16 backdrop-blur-sm transition-colors hover:border-[#ADFF2F]/35">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-10 rounded-2xl border border-white/10 bg-black/45 px-6 py-5 md:flex-row">
          <div className="flex items-center gap-4">
            <div className="logo-spin-wrap h-20 w-20 overflow-hidden rounded-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={emblemUrl} alt="Tactical Edge" className="logo-coin h-full w-full scale-[1.35] object-cover" />
            </div>
            <span className="text-lg font-black uppercase">
              Tactical<span className="text-[#ADFF2F]">Edge</span>
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            <Link href="/pricing" className="rounded-md border border-transparent px-3 py-1.5 text-gray-300 transition hover:border-[#ADFF2F]/40 hover:bg-[#ADFF2F]/10 hover:text-[#ADFF2F]">Plans</Link>
            <Link href="/coach-center" className="rounded-md border border-transparent px-3 py-1.5 text-gray-300 transition hover:border-[#ADFF2F]/40 hover:bg-[#ADFF2F]/10 hover:text-[#ADFF2F]">Coach Center</Link>
            <Link href={signupHref} className="rounded-md border border-transparent px-3 py-1.5 text-gray-300 transition hover:border-[#ADFF2F]/40 hover:bg-[#ADFF2F]/10 hover:text-[#ADFF2F]">{trialsOpen ? "Register" : "View Plans"}</Link>
            <Link href="/login" className="rounded-md border border-transparent px-3 py-1.5 text-gray-300 transition hover:border-[#ADFF2F]/40 hover:bg-[#ADFF2F]/10 hover:text-[#ADFF2F]">Login</Link>
          </div>
          <div className="flex items-center gap-4">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/55 text-gray-200 transition-all hover:-translate-y-0.5 hover:border-[#ADFF2F]/70 hover:bg-[#ADFF2F]/20 hover:text-[#ADFF2F]"
              >
                {social.icon}
              </a>
            ))}
            <a href="mailto:admin@tacticaledge.app" className="rounded-md border border-transparent px-3 py-1.5 text-sm text-gray-200 transition hover:border-[#ADFF2F]/40 hover:bg-[#ADFF2F]/10 hover:text-[#ADFF2F]">admin@tacticaledge.app</a>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-7xl border-t border-white/10 pt-6 text-center">
          <p className="text-sm text-gray-400">© 2026 TacticalEdge. Built for coaches, by coaches.</p>
        </div>
      </footer>
    </div>
  );
}
