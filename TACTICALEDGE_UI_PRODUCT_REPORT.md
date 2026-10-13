# TacticalEdge Product + UI Report (for landing page and pitch decks)

**Last updated:** 27 August 2026  
**Audience:** landing-page specialist, deck editor, anyone selling the product  
**Source of truth for:** `pitch-deck.html`, `pitch-deck-coach.html`, `pitch-deck-club.html`, `pitch-deck-tech.html`, `apps/web/src/app/landing/page.jsx`

Do not copy older API scratch notes under `apps/api/*.md` or the unbuilt mobile plan in `docs/mobile/`. Those are not product messaging.

---

## 1) Product overview

**Product name:** TacticalEdge (legacy label “ACI Training Platform” still appears in a few internal docs)

**What it is:**
A soccer coaching OS for youth and academy clubs. Coaches run a season from **Coach Center**. They generate age-appropriate drills and sessions with tactical diagrams. They teach on a live **Tactical Board**. Directors run philosophy and staff oversight from the **Director of Coaching (DOC) Console**.

**Naming:** spell it **Director of Coaching (DOC) Console** on first mention in any surface, **DOC Console** after that. Do not use "Technical Director" or "TD" — that label is retired (archive decks `Tactical-Edge Club Pitch.html` and `TacticalEdge_Coach_Pitch_v2.html` still carry it; they are frozen, do not edit).

**Feature hierarchy (matches the landing page):**
- **Flagship — four products coaches and directors open every week:** Coach Center, Session Builder, Tactical Board, Director of Coaching (DOC) Console.
- **Supporting — everything else in the platform:** Content Vault, Player Homework (`/player-plans`), Video Analysis (beta), Drill Generator.

Lead with the four flagship products. Do not present a flat 10-tile feature grid.

**Core value:**
Turn club philosophy + this week’s theme + the next match into field-ready sessions, game-day sheets, and printable PDFs, without planning from scratch.

**Primary users:**
- Grassroots through USSF B+ coaches (U8–U18)
- Club coaches assigned to a team
- Directors of Coaching / section directors

**Do not claim:**
- A 7-day free trial on production. Signup is paused unless `TRIALS_ENABLED=true` (API) and `NEXT_PUBLIC_TRIALS_ENABLED=true` (web). Landing already says “View Plans.”
- “Player Focus & Wellbeing.” That copy exists only on the old landing feature grid. There is no product behind it.
- A shipped mobile app. `docs/mobile/` is a plan, not a release.
- Video analysis as the newest flagship. It is live as **beta**. Coach Center, Tactical Board, and DOC Console shipped after it.

---

## 2) What the application does

### A. Coach Center (`/coach-center`) — daily driver

Season workspace for **one assigned team** (admins can switch teams).

| Area | Route | What the coach gets |
|---|---|---|
| Overview | `/coach-center` | This week’s curriculum theme, upcoming sessions, next match |
| Team | `/coach-center/team` | Age group, game model, coach/player level |
| Curriculum | `/coach-center/curriculum` | 16-week season plan across the four moments of the game |
| Calendar | `/coach-center/calendar` | This week’s training vs what is already scheduled |
| Season chat | `/coach-center/chat` | Team, last session, what comes next |
| Next sessions | `/coach-center/next-sessions` | Vault matches + generate link for this week’s theme |
| Game day | `/coach-center/game-day` | Match sheet (focus, DNA, set pieces) and match recap |
| Settings | `/coach-center/settings` | Team-level settings |

Empty-state copy in the product: “Coach Center follows one team through the season — curriculum, calendar, chat, and game-day sheets.”

### B. Generation

- **Session Builder** (`/demo/session`): 60/90-minute session with warmup → technical → tactical → conditioned game → cooldown. Export **full session PDF** or **Coach’s Sheet** (landscape A4, one page, up to four drills with diagrams).
- **Drill Generator** (`/demo/drill`): one drill with tactical context and diagram.
- **Progressive series**: 2+ sessions with progression logic.

### C. Tactical Board (`/boards`, `/board/[id]`)

Live pitch with drawing tools, formation × phase chassis (7v7 / 9v9 / 11v11), principles library, AI chat in coach-level language, session fork onto the board, PDF import. Feature flag `tacticalBoardV1` (on by default). Design contract: `docs/tactical-board-phase-positioning.md`.

### D. DOC Console (`/doc-hub`) — club leadership

Role-gated (DOC, section director, super admin). Not a generic admin analytics page.

| Area | Route | What the director gets |
|---|---|---|
| Overview | `/doc-hub` | Coaches managed, weekly AI sessions, empty weeks, high-attention items |
| Game Model | `/doc-hub/game-model` | Club philosophy / DNA, one game model per club |
| Attention | `/doc-hub/attention` | Club Attention: who needs a look this week |
| Coaches | `/doc-hub/coaches` | Usage snapshot |
| Teams | `/doc-hub/teams` | Team catalog |
| Calendar | `/doc-hub/calendar` | Assign / auto-populate / reassign sessions onto coach calendars |

### E. Content and planning

- **Vault** (`/vault`): saved drills, sessions, series. Club-scoped for club members. Reference codes D-XXXX, S-XXXX, SR-XXXX.
- **Favorites** (`/vault/favorites`)
- **Calendar** (`/calendar`): personal schedule (Coach Center calendar is the team week).
- **Player Homework** (`/player-plans`): team session → solo player plan, PDF ready to send home. (Route is `/player-plans`; the landing label is "Player Homework".)
- **Video analysis** (`/video-analysis`): beta. Short clip → observations → corrective session.

### F. Auth, billing, admin

- Auth: login / register / verify / reset. Production register is gated while trials are paused.
- Plans on `/pricing`: **Starter Coach $10/mo**, **Club Pro $40/mo** (up to 5 coaches), **Academy Elite** custom (`mailto:admin@tacticaledge.app`).
- Admin: users, clubs, teams, analytics, game models, content tools.

---

## 3) Current information architecture

Logged-in app sidebar (`AppHeader.tsx`):

1. Coach Center
2. Session Builder
3. Vault
4. Favorites
5. Calendar
6. Tactical Board (if `tacticalBoardV1`)
7. Video Analysis (beta badge)
8. DOC Console (if DOC / section director / super admin)
9. Settings

Coach Center and DOC Console use their own sidebars. Public marketing routes (`/`, `/landing`, `/pricing`, `/login`) hide the app chrome.

**Typical coach week (sell this, not “open the generator first”):**
1. Open Coach Center for the assigned team
2. See this week’s curriculum theme
3. Build or reuse a session (vault match or Session Builder)
4. Export PDF / Coach’s Sheet for the field
5. Teach shape on Tactical Board if needed
6. Game-day sheet before Saturday, recap after

**Typical director week:**
1. Open DOC Console
2. Check Attention + empty weeks
3. Confirm philosophy is on the club game model
4. Assign or reassign calendar coverage

---

## 4) UX and visual notes

- App chrome is dark, slate panels, emerald CTAs in generators/vault.
- Coach Center / DOC Console use **sky** as the local accent (sky-600 buttons, sky-300 active nav). Decks can stay lime/emerald; do not invent a third brand.
- Dense cards, not marketing whitespace, inside the app.
- Tactical diagrams: dark green pitch, ATT blue / DEF red / NEUTRAL gold, pass/run/press arrows. Session PDFs rasterize the **stored** SVG so the printout matches the vault picture.

---

## 5) Messaging

Keep: direct, coaching-oriented, time-to-field.

Headline directions that still work:
- Coaches: “Built around how you actually coach.”
- Clubs: “One philosophy. Every coach. Every age group.”
- General: “Session planning built for serious coaches.”

Supporting line names the season workspace, not only generation (this is the live landing copy):

> Coach Center runs the week. Session Builder writes the plan. Tactical Board teaches the picture. The Director of Coaching (DOC) Console keeps the club on one game model.

Hero badge: `Coach Center · Board · DOC Console` (no "AI-powered platform" tagline).

**CTAs (production):**
- Primary: the signup CTA is trials-gated — "Register" when `NEXT_PUBLIC_TRIALS_ENABLED=true`, otherwise "View Plans" → `/pricing`.
- Secondary: "Log In" → `/login`. The old "Explore App" → `/app` button and the footer "App Home" / "Session Generator" links were removed.
- Landing closes with two audience cards: **For coaches** → signup CTA; **For Directors of Coaching** → `/pricing` ("Club Pro & Elite").
- Do not use "Start Free" or "Try Free for 7 Days" until trials are turned back on.

**Pricing page vs shipped product (`apps/web/src/app/pricing/page.jsx`) — known gap, not yet fixed:**
The plan bullets still read generically and predate the flagship products. They should name what a buyer actually gets:
- Club Pro lists "Advanced analytics" / "Club-wide content vault" — should also name **Coach Center per team**, **Tactical Board**, **DOC Console (club roles)**, **Session PDF + Coach's Sheet**.
- Academy Elite says "Custom DC dashboard" — rename to **DOC Console** for consistency.
- Starter Coach lists "AI coach assistant" / "Calendar planning" — fine, but confirm the flagship framing (Session Builder, not "AI coach assistant").

---

## 6) Technical (for the tech deck)

- Frontend: Next.js App Router (`apps/web`), Vercel, domain `tacticaledge.app`
- API: Express (`apps/api`), Render
- DB: PostgreSQL via Prisma (Supabase)
- AI: Google Gemini for generation, chat parse, QA, board talk
- Session PDF: `pdf-export.ts` full runsheet + compact Coach’s Sheet; diagrams via stored SVG rasterization (`pdf-diagram-image.ts`, `fit-diagram-viewbox.ts`)
- Board layout: TypeScript chassis + principles JSON (`apps/api/src/data/formation-principles-v2.json`), not raw LLM coordinates for F1–F3 play-out
- Generation still uses structured constraints, QA grader, fixer, coach-level language transforms

---

## 7) Deck update map

| Deck | Keep | Change |
|---|---|---|
| `pitch-deck-coach.html` | Coach-level language, drill-as-runsheet, diagrams, 90-minute session, philosophy, coaching brief | Add Coach Center + Board + session PDF. Drop 7-day trial CTA. |
| `pitch-deck-club.html` | One philosophy, 5-phase session, vault as club IP | Replace “Admin Analytics Dashboard” with DOC Console. Name Coach Center as the coach daily driver. Drop trial banner. |
| `pitch-deck.html` | Problem, market, plans | Feature grid: Coach Center, Board, DOC Console. Business model is paid SaaS, not freemium, while trials are paused. |
| `pitch-deck-tech.html` | QA, fixer, diagram validation, logging | Add session PDF rasterization + board chassis/principles. |
| `TacticalEdge_Coach_Pitch_v2.html` / `Tactical-Edge Club Pitch.html` | Archive | Do not edit. The four `pitch-deck-*.html` files are current. |

---

## 8) File references

- App nav: `apps/web/src/components/AppHeader.tsx`
- Coach Center: `apps/web/src/app/coach-center/`
- DOC Console: `apps/web/src/app/doc-hub/`
- Tactical Board list: `apps/web/src/app/boards/page.tsx`
- Session PDF: `apps/api/src/services/pdf-export.ts`
- Trials gate: `apps/web/src/lib/trials.ts`, `apps/api/src/config/trials.ts`
- Landing: `apps/web/src/app/landing/page.jsx`
- Pricing: `apps/web/src/app/pricing/page.jsx`
- Board design contract: `docs/tactical-board-phase-positioning.md`
- Skill routing: `CLAUDE.md`

---

## 9) One-line summary

TacticalEdge is a dark, tactical soccer coaching OS: Coach Center runs the season, Session Builder and the vault write the week, Tactical Board teaches the picture, and DOC Console keeps every coach on one club philosophy.
