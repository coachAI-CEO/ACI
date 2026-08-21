# Sideline / diagrams / coach AI chat QA — 2026-08-21

**Device:** iPhone 16e Simulator + Expo Go 55  
**Shots:** `~/.gstack/projects/coachAI-CEO-ACI/screenshots/sideline-qa-20260821-0856/`  
**Session under test:** `50884f86-…` (S-ZFNF / Middle Third Transition…)

## Verdict

| Area | Result |
|------|--------|
| Sideline Mode | **PASS** — confirm gate, large type, timer, drill nav, keep-awake copy |
| Diagram visibility | **PASS** — server SVG renders clearly in Sideline + Vault |
| Coach / Board AI chat | **N/A on mobile (by design)** — web-only; handoff messaging present |

## 1) Sideline Mode

Evidence: `09-sideline-live.png`, `10-sideline-drill2.png`

- Confirm alert: “Screen stays on / Large text / Swipe left-right”
- Live UI: `Drill 1/5` → next drill `2/5` via bottom Next control
- Large coaching points (readable pitch-side)
- Timer `15:00` / `20:00` with Start / Reset
- Prev/Next labels show adjacent drill titles
- Dev note: Expo Go Tools gear overlays top-right (not app chrome). Sideline header exit is `✕` only.

Helper added for QA: deep link `…/sideline/:id?autostart=1` skips the confirm alert (Simulator can’t tap RN Alert reliably).

## 2) Diagram visibility

Evidence: `09`, `10`, `12-vault-diagram.png`

- Pitch SVG: green field, cones, blue/red players with roles, pass arrows, yardage, Attack/Defend/Pass legend
- Same diagram quality in **Sideline** and **Vault session** expanded drill
- “Coach” yellow marker on the pitch is a **diagram element**, not an AI chat entry point
- Cooldown drills (if present) are coded to show “Cooldown drills do not include a pitch diagram” via `StoredDrillDiagram`

API path used: `GET /api/diagram-svg/:drillId` (mounted on Express) — working against prod.

## 3) AI chat with coach

**Native app:** no CoachChat / Board AI chat UI.

Evidence:
- Coach Center subtitle: “Curriculum, **chat**, and team editing **stay on web**”
- Boards: “Edit on web for drawing tools” + Edit on web CTA
- Accidental web open landed on `tacticaledge.app` Sign In (`15-boards-view.png`) — confirms browser handoff works; chat requires web auth session

Web surfaces (not exercised logged-in this run):
- `CoachChat` on `/app` (demo/session + main app shell)
- `BoardAiChat` on `/board/[id]` via `POST /boards/:id/ai-chat`

## Findings

1. **P2 (dev UX):** Expo Go Tools gear overlaps long sideline titles — ignore in production builds; or leave more top padding under status bar in Sideline.
2. **P3:** `ROCKLIN_FC` raw enum still shows on vault session meta (humanize elsewhere).
3. **Info:** AI coach chat intentionally frozen on phone; use web for chat interactions.

## Recommendation

Sideline + diagrams are good enough for field use. For AI chat QA, run a logged-in web pass on `/app` CoachChat and `/board/:id` Board AI (Safari or gstack browse with cookies).
