# TacticalEdge Product + UI Report (for Landing Page / Web UI Specialist)

## 1) Product Overview

**Product name:** TacticalEdge (legacy label “ACI Training Platform” still appears in parts of UI)

**What it is:**
A soccer coaching platform that uses AI to generate:
- Individual drills
- Full 60/90-minute training sessions
- Progressive multi-session series
- Tactical diagrams (players, arrows, zones, annotations)

**Core value proposition:**
Take coaching intent (age, phase, game model, topic, formation constraints) and convert it into structured, usable field sessions quickly.

**Primary users:**
- Youth / academy coaches (U8–U18)
- Club coaches and staff
- Technical directors

---

## 2) What the Application Does (Functional Scope)

### A. Generation
- **Drill Generator** (`/demo/drill`): one drill with tactical context and diagram
- **Session Generator** (`/demo/session`): complete session with drill stack (warmup → technical → tactical → conditioned game → cooldown)
- **Progressive Series**: 2+ sessions with progression logic across sessions

### B. AI Assistant
- **Coach Assistant Chat** (home): natural-language intent capture
- Extracts generation parameters from coach prompts
- Finds related vault content and can trigger generation flow

### C. Content Management
- **Vault** (`/vault`): browse saved drills, sessions, and series
- **Favorites** (`/vault/favorites`)
- **Reference code system**: D-XXXX, S-XXXX, SR-XXXX lookups

### D. Planning / Operations
- **Calendar** (`/calendar`) for scheduled sessions/series
- Weekly summary generation for parent comms

### E. User + Admin
- Auth (register/login/reset/verify)
- Subscription/feature gating
- Admin dashboard with analytics, QA, enrichment/normalization tools, user management

---

## 3) Current Information Architecture (Top Navigation)

Persistent header contains:
- Home
- Drill Generator
- Session Generator
- Vault
- Favorites
- Calendar
- Settings
- Auth button (Login/Logout/user)
- Admin link visible for admin roles

---

## 4) UX Patterns and Interaction Model

### Main interaction model
- Form-driven generation with structured soccer parameters
- AI-assisted shortcut via chat on home
- Save → review in vault → schedule in calendar

### Typical generation flow
1. Coach sets context (age, phase, zone, topic, formation, constraints)
2. App checks for similar sessions
3. App generates session/series
4. Coach reviews drill cards + tactical diagrams
5. Coach saves to vault / favorites / calendar

### UI behavior style
- Dense dashboard-like cards
- Dark mode first
- Emphasis color is emerald/teal for primary actions and headings
- Frequent use of subtle borders, translucent panel backgrounds, rounded corners

---

## 5) Visual Design System (Current State)

## 5.1 Brand feel
- Tactical, analytical, technical
- Dark command-center aesthetic
- Accent-driven hierarchy (emerald for CTAs / key labels)

## 5.2 Core palette used in code (Tailwind classes + hex)

### Foundation neutrals (Slate)
- `slate-950` `#020617` (primary page background)
- `slate-900` `#0f172a` (cards/panels)
- `slate-800` `#1e293b` (secondary panel backgrounds)
- `slate-700` `#334155` (borders)
- `slate-600` `#475569` (input/border states)
- `slate-500` `#64748b` (muted metadata text)
- `slate-400` `#94a3b8` (secondary body text)
- `slate-300` `#cbd5e1` (higher-contrast support text)
- `slate-200` `#e2e8f0` (high-contrast text)
- `slate-50` `#f8fafc` (white-like foreground)

### Primary accent (Emerald)
- `emerald-600` `#059669` (primary button / user chat bubble)
- `emerald-500` `#10b981` (CTA, key labels)
- `emerald-400` `#34d399` (headings, links)
- `emerald-300` `#6ee7b7` (hover/secondary accent)

### Supporting accents
- Cyan: `cyan-300` `#67e8f9`, `cyan-400` `#22d3ee` (reference code chips, linked metadata)
- Red: `red-400` `#f87171`, `red-300` `#fca5a5` (errors/warnings)
- Amber/Yellow used for caution and tactical highlights

## 5.3 Surfaces and effects
- Large rounded cards (`rounded-2xl` / `rounded-3xl`)
- Semi-transparent card fills (`bg-slate-900/70`, `bg-slate-800/50`)
- Soft border lines (`border-slate-700/70`)
- Deep drop shadows (`shadow-black/40` on heavy cards)

## 5.4 Typography
- Current global default: Arial/Helvetica fallback stack
- UI is utility-typography driven (Tailwind sizing/weight)
- Character:
  - Title: semibold, high contrast
  - Metadata: smaller slate-400
  - Labels: uppercase/letter-spaced in tactical diagram areas

---

## 6) Tactical Diagram Visual Language

Component: `UniversalDrillDiagram`

### Pitch treatment
- Dark green gradient pitch
- Alternating stripe overlays
- White field markings and goal geometry

### Team colors
- ATT players: blue
- DEF players: red
- NEUTRAL players: yellow/gold

### Tactical layers
- **Arrows**
  - Pass: white solid
  - Movement/Run: dashed white
  - Press: red
- **Safe zones**
  - ATT zone: blue hatch
  - DEF zone: red hatch
  - NEUTRAL zone: yellow hatch
- **Annotations**
  - Colorized tactical labels, optional background chips

### Diagram card composition
- “TACTICAL DIAGRAM” kicker
- Drill title
- Quick metadata row (`XvY • dimensions • zone`)
- Pitch SVG
- Legend row (Attack/Defend/Pass/Run/Press)

---

## 7) Product Messaging in Current UI

Current microcopy style:
- Direct and coaching-oriented
- Practical phrasing (“Generate session”, “Describe your training needs”)
- Minimal marketing language, mostly utility language

For landing page, this means:
- You can preserve directness
- Add stronger business-level framing (time saved, tactical quality, workflow centralization)

---

## 8) Technical Architecture (for UI specialist context)

- **Frontend:** Next.js App Router (`apps/web`)
- **Backend:** Express API (`apps/api`)
- **DB:** PostgreSQL via Prisma (Supabase-hosted DB in current deployment)
- **AI:** Google Gemini models for generation + chat parsing
- **Hosting:** Web on Vercel, API on Render, domain `tacticaledge.app`

Frontend uses Next API routes as proxy/adapters to backend API for many flows.

---

## 9) Current Brand/UX Inconsistencies to Note

These are important for landing-page alignment and future product polish:

1. **Naming mismatch**
- UI still shows “ACI Training Platform” in multiple locations
- Brand target is “TacticalEdge”

2. **Iconography style mix**
- Heavy emoji usage in nav and labels (useful internally, less premium for public marketing)

3. **Design maturity variance**
- Core generator/vault/admin screens are production-functional but stylistically uneven in density and spacing

4. **Diagnostic UI residue**
- Some tactical diagram debug indicators (e.g., orientation labels) have appeared during recent iterations

---

## 10) Landing Page Brief (Actionable for UI Specialist)

### Objective
Design a marketing landing page that:
- Introduces TacticalEdge clearly
- Demonstrates product value in under 10 seconds
- Drives sign-up and demo exploration

### Positioning headline direction
- “AI session planning built for serious soccer coaches.”
- Supporting line should mention drill/session generation + tactical diagrams + progression.

### Suggested section structure
1. Hero (core promise + CTA)
2. Product proof strip (Drills, Sessions, Series, Vault, Calendar, Admin)
3. Tactical diagram showcase panel
4. Workflow section (“Describe → Generate → Save → Schedule”)
5. Feature grid by role (Coach / Club / Admin)
6. Trust + implementation (“built for age/phase/formation context”)
7. CTA + footer

### CTA strategy
- Primary: “Start Free”
- Secondary: “See Session Generator” / “View Example Diagram”

### Visual constraints to preserve from app
- Dark background foundation
- Emerald as primary action signal
- Tactical/pitch visual motif
- High information clarity (structured cards, clean labels)

### What can be improved for landing
- Reduce emoji usage
- Increase typographic discipline and visual hierarchy
- Add stronger story arc (problem → solution → proof)
- Introduce motion sparingly (diagram reveal, workflow progression)

---

## 11) File/Code References for UI Specialist Handoff

- Main shell + nav: `/Users/macbook/Projects/aci/apps/web/src/app/layout.tsx`
- Home + assistant experience: `/Users/macbook/Projects/aci/apps/web/src/app/page.tsx`
- Login visual style: `/Users/macbook/Projects/aci/apps/web/src/app/login/page.tsx`
- Session generator app experience: `/Users/macbook/Projects/aci/apps/web/src/app/demo/session/page.tsx`
- Drill card wrapper: `/Users/macbook/Projects/aci/apps/web/src/components/DrillDiagramCard.tsx`
- Tactical diagram renderer: `/Users/macbook/Projects/aci/apps/web/src/components/UniversalDrillDiagram.tsx`
- Diagram JSON adapter: `/Users/macbook/Projects/aci/apps/web/src/lib/diagram-adapter.ts`
- Existing brand foundation: `/Users/macbook/Projects/aci/TACTICALEDGE_BRAND_FOUNDATION.md`

---

## 12) One-line Summary for the Designer

TacticalEdge is a dark, tactical, AI-first soccer coaching platform where emerald highlights signal action; the landing page should translate a functional coach dashboard aesthetic into a premium, conversion-oriented product narrative.
