# Plan: Mobile tactical board → web parity

**Goal:** Close the gap between the web `TacticalBoardEditor` and the Expo board editor so a coach can author a complete board on phone without bouncing to web for routine work.

**Out of scope (for now):** Pixel-perfect desktop chrome, keyboard shortcuts, AI Principles library as a full sidebar, board PDF export (neither client has it).

**North star UX:** Match the interactive mock feel we already chased (full-bleed pitch, token size, ATT green / DEF red, Pass / Run / Press arrows) while unlocking the missing **authoring** controls.

**Status baseline:** Mobile already has list/create/delete/share, move/player/ball/erase, always-pass arrows, frames + play, undo/redo, AI text chat, player popover. Web still owns formations, setup phase, equipment, line variants, AI image/PDF import.

---

## Principles

1. **Phone-first interactions** — tap/drag/long-press; no `window.prompt` patterns; ActionSheets over multi-panel inspectors where possible.
2. **Shared model stays canonical** — `@aci/shared` types + sequence/spacing/lines; don’t invent a second diagram shape.
3. **Root layers = live frame** — keep writing/reading root; `syncActiveFrame` on save / frame switch (already the contract).
4. **Ship vertical slices** — each phase leaves the editor usable; no “big bang” rewrite of `BoardCanvas`.
5. **Web handoff stays** for rare denser flows until that phase lands; don’t pretend parity early.

---

## Success metrics

| Metric | Target |
|--------|--------|
| Coach can draw Pass / Run / Press without web | Yes |
| Coach can use full web **line types** on phone (Free / Straight / Arrow / Dashed / Curved ×2) | Yes |
| Coach can apply a formation + tweak on phone | Yes |
| Coach can place cones / mini-goals | Yes |
| Half / Third actually crops the pitch | Yes |
| “Open on web” required for routine mark-up | No |
| Regressions on drag players / frames / save | None |

---

## Phase 0 — Stabilize current editor (1–2 days)

Fix foundations so later features don’t fight the canvas.

| # | Work | Why |
|---|------|-----|
| 0.1 | Arrow type persistence verified end-to-end (create → save → reload → frame sync) | Prevents “arrow doesn’t work” class bugs |
| 0.2 | Document gesture contract in `HOW_TO_TACTICAL_BOARDS.md` (Arrow = press-drag-release) | Coaches + QA |
| 0.3 | Detail screen: either wire format control or remove dead “Phase D” no-op | Honest UI |
| 0.4 | Snapshot QA: 11v11 Full, draw pass, save, kill app, reopen | Baseline |

**Exit:** Editor reliably saves/loads what you draw.

---

## Phase 1 — Arrow types (highest leverage) (2–3 days)

Closes the #1 mock + coach gap: “how do I pick different arrows?”

### 1A — Create-time picker

- Add compact **Pass · Run · Press** segmented control when Arrow tool is active (above palette or under team pill).
- Map to diagram:
  - **Pass** → `type: pass`, `style: solid`, `arrowhead: true`
  - **Run** → `type: run`, `style: dashed`, `arrowhead: true`, optional default `control` curve
  - **Press** → `type: press`, `style: dashed`, `weight: bold`, `arrowhead: true`
- Draft ghost uses the same stroke/dash as selection.

### 1B — Edit after draw

- Tap existing arrow (Move or Arrow tool) → docked bar: type, flip curve (if control), delete.
- Move tool → drag shaft / gold ends to reposition (parity with web select + drag).
- Reuse render path already in `boardTheme.ts`.

### 1C — Web line types (required) (2–3 days)

Parity with web `BoardToolbar` **Line types** flyout (`LINE_ITEMS` + `lineToolToArrow`). Not optional.

Phone UI: when Arrow tool is active, expose a second row (or long-press / “More lines” sheet) with the same six modes — keep Pass / Run / Press as the fast coaching presets, and add geometry modes coaches already use on web.

| Web line type | Shortcut (web) | Diagram mapping |
|---------------|----------------|-----------------|
| **Free Draw** | D | `type: transition`, solid, no head, `geometry: freehand` → store `path[]` while dragging |
| **Straight Line** | L | `type: transition`, solid, no head, `geometry: straight` |
| **Arrow** | A | `type: pass`, solid, `arrowhead: true`, straight |
| **Dashed Line** | S | `type: run`, dashed, no head, straight |
| **Curved Arrow** | C | `type: pass`, solid, head, `geometry: curve`, bulge `+0.28` |
| **Curved other way** | X | same as curved, bulge `-0.28` |

Implementation notes:

1. Port `lineToolToArrow` / `LineGeometry` into mobile `boardTheme` (or shared) so create + draft + edit stay one source of truth with web.
2. `BoardCanvas` draft: freehand samples points on pan; curve sets `control` from bulge; straight/arrow/dashed use from→to.
3. Render already handles `path` / `control` / dash — verify heads-off for Free / Straight / Dashed.
4. Selected-arrow dock: switch among the six line types (and keep Pass / Run / Press shortcuts or map them onto Arrow / Dashed / Press as today).
5. Docs: update `HOW_TO_TACTICAL_BOARDS.md` with the line-type table.

**Exit:** Coach can mark build-up with Pass/Run/Press **and** draw every web line type on phone without opening web.

---

## Phase 2 — Expose missing basic tools (2 days)

Code already has shape + label paths; palette hides them.

| Tool | Behavior |
|------|----------|
| **Label** | Tap place → inline TextInput sheet (edit text); long-press edit; erase works |
| **Shape** | Spotlight first; then circle / rect via small subtype row |
| **Ball** | Keep single-ball replace (match web convention) |

Also: Android-safe frame rename (replace iOS-only `Alert.prompt`).

**Exit:** Labels and spotlight usable without web; frames rename on both platforms.

---

## Phase 3 — Formations + format reset (3–4 days)

Biggest “I can’t set the board up” gap.

1. Port or shared-ize formation catalogs from web `board-formations.ts` into `@aci/shared` (or thin mobile import of shared data).
2. Editor overflow / Setup sheet:
   - Format 7v7 / 9v9 / 11v11 → confirm → `defaultMatchBoardDiagram` + unstack
   - ATT formation picker + DEF formation picker → `buildFormationPlayers`
   - Show/hide ATT or DEF
3. Keep mobile portrait VERTICAL after apply; run uniform-gap unstack.

**Exit:** New board → pick 11v11 + 4-3-3 / 4-2-3-1 on phone in &lt;30s.

---

## Phase 4 — Equipment kit (2–3 days)

Render-only today; web places these.

| Element | Place | Edit |
|---------|-------|------|
| Cone | Tap | Drag, erase, color optional |
| Mini-goal | Tap | Drag; long-press rotate +90° |
| Mannequin / Pole | Tap | Drag, erase |

UI: overflow tool **Kit** or long-press on Player tool → subtype sheet (keeps bottom bar at 5–6 icons).

**Exit:** Rondo / unopposed patterns without web.

---

## Phase 5 — Real pitch zoom (2–3 days)

Both clients store `pitch.variant` but mobile `void zoom`s.

1. Shared viewport helper: FULL / HALF / THIRD → visible length band in diagram %.
2. `BoardCanvas` / `BoardPreview`: crop viewBox or clip + remap gestures through the same transform.
3. Wire detail + editor zoom segments to persist `diagram.pitch.variant`.

**Exit:** Half/Third show the correct slice; touches map correctly.

---

## Phase 6 — Setup phase (web chassis) (3–5 days)

Web’s Phase / Zone / Channel placement.

1. Sharedize `apply-setup-phase` / chassis placement (or call API if already server-side).
2. Mobile Setup sheet: Phase × Third × Channel → place subject team.
3. Optional lanes / thirds toggles (`showZones` / `showThirds`).

**Exit:** “Defending · Middle third · Centre” setups work on phone.

---

## Phase 7 — AI parity (2–3 days)

| Feature | Plan |
|---------|------|
| Text chat + apply | Done |
| Image attach | Wire `expo-image-picker` → existing `image` payload |
| PDF import | Defer or handoff-to-web until upload path proven on device |
| Principles | Thin “Suggested prompts” list (not full web panel) |
| Session bridge | Surface returned `sessionBridge` as “Open Session Builder” link |

**Exit:** Photo → board works on device; principles are prompt shortcuts only.

---

## Phase 8 — Polish & list parity (1–2 days)

- Board **title** edit (patch `title`)
- List filters: Favorites + Forked (API already shapes cards)
- Age group on create (payload already allows it)
- Empty-state copy: remove “drawing still on web” where false

---

## Explicitly deferred

| Item | Reason |
|------|--------|
| Board PDF / PNG export | Neither web nor mobile ships it; separate project |
| Full Principles curriculum UI | Heavy; prompt chips enough |
| Desktop keyboard shortcuts | N/A on phone (line-type *modes* still ship; shortcuts don’t) |
| Cover / dotted as first-class tools | Render if present; create via Press / Dashed first |
| Multi-ball | Web max 8; coaches rarely need on phone |
| Pinch-reset control | Nice-to-have |

---

## Suggested sequencing (calendar)

```
Week 1     Phase 0 + Phase 1A/1B (Pass/Run/Press) + Phase 1C (web line types)
Week 1–2   Phase 2 (label/shape) + start Phase 3 (formations)
Week 2–3   Phase 3 finish + Phase 4 (equipment)
Week 3     Phase 5 (zoom crop)
Week 4     Phase 6 (setup) and/or Phase 7 (AI image) — pick by coach feedback
Ongoing    Phase 8 polish
```

If capacity is tight, **cut order**: 1A/1B → **1C** → 3 → 4 → 5 → 2 → 7 → 6 → 8.

---

## Workstream ownership (suggested)

| Stream | Owner focus | Primary files |
|--------|-------------|---------------|
| Canvas / gestures | Line types + freehand path, zoom crop, kit hit-testing | `BoardCanvas.tsx`, `boardTheme.ts`, web `BoardToolbar.tsx` (`lineToolToArrow`) |
| Editor chrome | Setup sheet, tool subtypes, title | `[id]/edit.tsx`, `BoardToolPalette.tsx`, `ArrowTypePicker.tsx` |
| Shared model | Formations + setup phase hoist | `packages/shared/src/board/*` |
| AI | Image picker + prompts | `BoardAiSheet.tsx`, `boards.service.ts` |
| Docs / QA | How-tos + device checklist | `docs/mobile/*`, Simulator scripts |

---

## Test plan (every phase)

1. iPhone sim: create board → draw → save → cold start → verify.
2. Two frames: edit frame 1, switch, edit frame 2, play tween, save.
3. 11v11 crowded pitch: unstack still holds after formation apply.
4. Club share + favorite + open web link still works.
5. Undo/redo across arrow type changes and formation apply.

---

## Decision log (fill as we go)

| Date | Decision | Choice |
|------|----------|--------|
| 2026-08-25 | Arrow create UX | Segmented Pass/Run/Press (coaching presets) shipped |
| 2026-08-25 | Web line types | **Required** Phase 1C — full Free/Straight/Arrow/Dashed/Curved×2 parity with web flyout |
| | Line-type chrome | Second row under Arrow tool vs “More lines” sheet |
| | Kit entry point | 6th palette slot vs long-press subtypes |
| | Formations source | Hoist to `@aci/shared` vs duplicate mobile catalog |
| | Phase 6 vs 7 next | Coach feedback: setup vs photo import |

---

**Immediate next step**

~~**Start Phase 1A** — Pass / Run / Press segmented control on Arrow tool, wire create + draft preview.~~

**Done (2026-08-25):** Phase 0.3 (detail format is read-only text) + Phase 1A/1B — Pass/Run/Press picker, styled draft, tap/drag arrow edit (type / flip / delete / move).

**Done (2026-08-25):** Phase **1C — web line types** — Free Draw, Straight Line, Arrow, Dashed Line, Curved, Curved other way (create picker + edit dock + freehand path / curve bulge on canvas).

**Done (2026-08-25):** Phase **2** — Label + Shape in tool tray (Spot/Circle/Rect), label text dock, area hit/drag/erase, Android-safe frame rename.

**Done (2026-08-25):** Phase **3** — formations in `@aci/shared`, Setup sheet (format reset · ATT/DEF formations · show/hide teams), vertical unstack on apply.

**Done (2026-08-25):** Phase **4** — Kit tool (Cone / mini-goal / Mannequin / Pole): place, drag, erase; long-press mini-goal rotates +90°.

**Done (2026-08-25):** Phase **5** — Real pitch zoom: shared `diagramVisibleBand` / `viewBoxForBand` / gesture remap; `BoardCanvas` + `BoardPreview` crop; editor + detail persist `pitch.variant`.

**Done (2026-08-25):** Phase **6** — Setup phase: Phase × Third × Channel via `POST /boards/:id/phase-place`, lanes/thirds toggles, shared setup types.

**Done (2026-08-25):** Phase **7** — AI photo attach (`expo-image-picker` → `image` payload), suggested prompt chips, Session Builder bridge link. PDF import still deferred.

**Done (2026-08-25):** Phase **8** — Rename board, list Favorites/Forked filters, age group on blank create, empty-state copy updated.

**Done (follow-up):** Landscape editor layout — side tool rail + compact frame strip so `HORIZONTAL` pitch gets real canvas height.

**Done (follow-up):** HORIZONTAL token roundness — `tokenRadiusY` / `stretchAspect` swap compensation under 90° remap (was applying VERTICAL `ry=rx·W/H` → ~6× sausages). Validated with vitest + SVG before/after fixture.

**Locked target (2026-08-25):** Landscape chrome follows Gemini demo `docs/mobile/TACTICAL_BOARD_LANDSCAPE_DEMO.jsx` (TacticsLab LANDSCAPE):
- Top bar: undo/redo · format · zoom · zones · save
- Left tools rail (Move / Player / Arrow / Ball / Erase + clear)
- Center pitch (true horizontal aspect, round tokens)
- Right HUD: ATT/DEF/NEU · arrow type · selected-player inspector
- Bottom sequence: Play · named phase chips · + Frame / Duplicate / Delete
- Portrait can keep the denser phone tray; landscape does **not** stack chrome under the pitch.

**Done (implement):** Expo landscape shell in `boards/[id]/edit` — `BoardLandscapeHud` + `BoardLandscapeSequence` + left `BoardToolPalette` column; portrait tray unchanged.

**Next:** Device QA (rotate landscape — shell + round tokens); deferred items stay deferred.
