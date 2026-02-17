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
  Brain,
  BarChart3,
  FileText,
  Heart,
  Sparkles,
  ArrowRight,
  Instagram,
  Twitter,
} from "lucide-react";

export default function TacticalEdgeLanding() {
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
    { label: "Training Phases", value: "6", icon: <Activity size={20} /> },
    { label: "Age Groups", value: "U8-U18", icon: <Trophy size={20} /> },
    { label: "Formations", value: "12+", icon: <Layout size={20} /> },
  ];

  const features = [
    { icon: <Zap size={28} />, title: "Drill Generator", desc: "Individual drills with tactical context, diagrams, coaching points, and variations tailored to your squad." },
    { icon: <ClipboardList size={28} />, title: "Session Builder", desc: "Complete 60-90 minute sessions with our proven 5-phase structure." },
    { icon: <Activity size={28} />, title: "Progressive Series", desc: "Multi-session plans with progression logic that builds on each session." },
    { icon: <Users size={28} />, title: "Player Sessions", desc: "Auto-generate individual player homework for development outside team training." },
    { icon: <Heart size={28} />, title: "Player Focus & Wellbeing", desc: "Psychological and motivational support with confidence tracking." },
    { icon: <Brain size={28} />, title: "AI Coach Assistant", desc: "Natural language input that learns from your feedback." },
    { icon: <FileText size={28} />, title: "Content Vault", desc: "Save, organize, and search sessions with reference codes." },
    { icon: <Calendar size={28} />, title: "Calendar Planning", desc: "Drag & drop scheduling with parent communication." },
    { icon: <BarChart3 size={28} />, title: "Club Analytics", desc: "Admin dashboard with cross-coach visibility." },
  ];

  const workflow = [
    { step: 1, title: "Describe", desc: "Set age group, formation, and training phase" },
    { step: 2, title: "Generate", desc: "AI builds complete structured session" },
    { step: 3, title: "Review", desc: "Explore drill cards, tweak parameters" },
    { step: 4, title: "Save & Schedule", desc: "Send to vault, calendar, notify parents" },
    { step: 5, title: "Reflect", desc: "Post-training feedback loop" },
    { step: 6, title: "Progress", desc: "AI builds next session based on outcomes" },
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
            <Link href="/register" className="rounded-sm bg-[#ADFF2F] px-6 py-2.5 text-xs font-bold uppercase text-black hover:bg-white">Start Free</Link>
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
            <Link href="/register" className="block w-full rounded-sm bg-[#ADFF2F] py-3 text-center text-sm font-bold uppercase text-black" onClick={() => setMobileMenuOpen(false)}>Start Free</Link>
          </div>
        )}
      </nav>

      <header id="hero" className="relative px-6 pb-20 pt-40">
        <div className="mx-auto max-w-7xl text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#ADFF2F]/20 bg-[#ADFF2F]/10 px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-[#ADFF2F]">
            <Sparkles size={14} /> AI-POWERED COACHING PLATFORM
          </div>
          <h1 className="mb-8 text-5xl font-black uppercase tracking-tighter text-white [text-shadow:0_4px_20px_rgba(0,0,0,0.95)] md:text-7xl">
            Session planning
            <br />
            <span className="text-[#ADFF2F]">
              built for serious coaches
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-3xl text-lg font-semibold leading-relaxed text-gray-100 [text-shadow:0_3px_14px_rgba(0,0,0,0.85)] md:text-2xl">
            Generate drills, full sessions, and progressive series with tactical diagrams, all tailored to your age group, formation, and game model.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/register" className="flex h-14 items-center gap-3 rounded-sm bg-[#ADFF2F] px-10 text-xs font-black uppercase text-black transition-all hover:bg-white">
              <span>Start Free</span>
              <ArrowRight size={18} />
            </Link>
            <Link href="/app" className="h-14 rounded-sm border border-white/10 bg-white/5 px-10 text-xs font-black uppercase text-white hover:bg-white/10 inline-flex items-center">
              Explore App
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
              Complete Coaching <span className="text-[#ADFF2F]">Solution</span>
            </h2>
            <p className="text-lg text-gray-200">Everything you need to plan, execute, and analyze</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="group rounded-2xl border border-white/15 bg-black/55 p-8 backdrop-blur-sm transition-all hover:border-[#ADFF2F]/60 hover:bg-black/65">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-[#ADFF2F]/35 bg-[#ADFF2F]/12 text-[#ADFF2F] transition-all duration-200 group-hover:scale-105 group-hover:border-[#ADFF2F]/80 group-hover:bg-[#ADFF2F] group-hover:text-black group-hover:shadow-[0_0_24px_rgba(173,255,47,0.45)]">
                  {feature.icon}
                </div>
                <h3 className="mb-3 text-xl font-black uppercase tracking-tight text-white [text-shadow:0_3px_14px_rgba(0,0,0,0.9)] hover:text-[#ADFF2F]">{feature.title}</h3>
                <p className="text-sm text-gray-300">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="text-4xl font-black uppercase tracking-tighter text-white [text-shadow:0_4px_20px_rgba(0,0,0,0.95)] md:text-6xl">
              How It <span className="text-[#ADFF2F]">Works</span>
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
          <h2 className="mb-6 text-4xl font-black uppercase tracking-tighter text-white [text-shadow:0_4px_20px_rgba(0,0,0,0.95)] md:text-6xl">
            Proven 5-Phase <span className="text-[#ADFF2F]">Structure</span>
          </h2>
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
        <div className="mx-auto max-w-4xl text-center">
          <div className="group rounded-[3rem] border border-[#ADFF2F]/25 bg-black/45 p-12 backdrop-blur-sm transition-all duration-300 hover:border-[#ADFF2F]/45 hover:bg-black/55 md:p-20">
          <h2 className="mb-6 text-4xl font-black uppercase tracking-tighter text-white [text-shadow:0_4px_20px_rgba(0,0,0,0.95)] md:text-6xl">
              Ready to level up?
            </h2>
            <p className="mb-6 text-lg text-gray-200">Join hundreds of coaches using TacticalEdge.</p>
            <p className="mb-10 text-2xl font-black uppercase tracking-tight text-[#ADFF2F] [text-shadow:0_2px_14px_rgba(0,0,0,0.75)] md:text-3xl">
              "One club. One philosophy. Every age group aligned. That&apos;s the edge."
            </p>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-5">
              <Link
                href="/register"
                className="min-w-[180px] rounded-md bg-[#ADFF2F] px-12 py-5 text-center text-sm font-black uppercase text-black transition-all hover:-translate-y-0.5 hover:bg-[#c6ff5f] hover:shadow-[0_8px_22px_rgba(173,255,47,0.25)]"
              >
                Start Free
              </Link>
              <Link
                href="/login"
                className="min-w-[180px] rounded-md border border-white/20 bg-black/40 px-12 py-5 text-center text-sm font-black uppercase text-white transition-all hover:-translate-y-0.5 hover:border-white/40 hover:bg-black/55"
              >
                Log In
              </Link>
            </div>
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
            <Link href="/app" className="rounded-md border border-transparent px-3 py-1.5 text-gray-300 transition hover:border-[#ADFF2F]/40 hover:bg-[#ADFF2F]/10 hover:text-[#ADFF2F]">App Home</Link>
            <Link href="/pricing" className="rounded-md border border-transparent px-3 py-1.5 text-gray-300 transition hover:border-[#ADFF2F]/40 hover:bg-[#ADFF2F]/10 hover:text-[#ADFF2F]">Plans</Link>
            <Link href="/demo/session" className="rounded-md border border-transparent px-3 py-1.5 text-gray-300 transition hover:border-[#ADFF2F]/40 hover:bg-[#ADFF2F]/10 hover:text-[#ADFF2F]">Session Generator</Link>
            <Link href="/register" className="rounded-md border border-transparent px-3 py-1.5 text-gray-300 transition hover:border-[#ADFF2F]/40 hover:bg-[#ADFF2F]/10 hover:text-[#ADFF2F]">Register</Link>
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
      </footer>    </div>
  );
}
