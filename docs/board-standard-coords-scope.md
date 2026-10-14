# Board placement: standard coordinates + relative presets (scope)

Status 2026-10-14 (branch `codex/standard-coords`, local, unpushed): steps 1-4 done, step 5 not done on purpose (see below).

## Outcome
- Step 1 done: `team-frame.ts` (per-team local frame). Correction to the plan above: a shared board cannot have both
  teams attack the same way, so the frame is per TEAM (each team's own view), not one global frame.
- Step 2 done for the defending block (runs in DEF's local frame; goal kick and pocket identical to the baseline,
  generic final-third lines made flank-aware) and, via `possession: 'DEF'`, for the whole placement (180-degree
  rotation + team swap; symmetry tested on 48 combinations).
- Step 3 done: conversion lives inside placement; storage, editor and renderers untouched, nothing migrates.
- Step 4 done behind `BOARD_RELATIVE_PRESETS=1`: pure offsets from the base were too narrow and clumped, so width is a
  role rule and a two-way spacing pass keeps shirts 7 / 6.5 units apart. Still not a drop-in for the authored shapes.
- Step 5 NOT done: the AI contract is already coach-relative ("Us = ATT blue, own goal RIGHT") and play-out requests
  already go through the deterministic placement. Rewriting ~45 regex-driven sites in `board-ai-chat.ts` needs a live
  Gemini evaluation to prove it is not a regression, with little to gain; prefer routing free-form edits through the
  symbolic DSL + layout solver.

## Problem
Stored boards use one frame where the meaning of `y` flips by team: ATT attacks toward low y
(own goal right), DEF toward high y. Every placement rule re-derives "forward", "our side",
"right flank" per team. That is where the DEF goal-kick flank bug came from (DEF reused ATT's
left/right constants), and it is why AI placement needs so many special cases.

Renderfoot/Tactico: one fixed orientation for both teams, and phases/presets as offsets from
formation slots (anchor = formation base position, offset = role-band profile × block depth).

## Footprint (team-dependent direction logic, non-test, `main`)
- `board-ai-chat.ts` ~45 sites (prompt rules, "toward our goal", wrong-way guards, mirroring)
- `board-phase-placement.ts` ~16, `board-layout-solver.ts` ~16
- web: `UniversalDrillDiagram.tsx` ~11, `DrillPitchDiagram.tsx` ~10, `TacticalBoardEditor.tsx` ~4
- smaller: `session.ts`, `board-symbolic-dsl.ts`, `web-diagram-v1.ts`, `board-combo-composer.ts`,
  `drill-to-drawer-params.ts`, PDF/SVG drawers

## Recommended approach: canonical frame at the placement boundary, no storage migration
1. Add `toCanonical(diagram)` / `fromCanonical(diagram)` (pure, in `packages/shared`). Canonical =
   both teams attack toward +y, own goal at y=0, x=0 is the team's own left. Identity round-trip
   is tested for every formation.
2. Placement (`placePhaseSnapshot`, solver, press) runs in canonical frame only. `placeDefBlock`
   stops being a mirror of ATT code: one team-agnostic function.
3. Stored `WebDiagramV1`, the editor, PDF/SVG renderers keep today's frame. Adapter converts at
   the API edge. No data migration, no prompt change on day one.
4. Relative presets: per phase, `anchor = formation base slot`, `offset = f(role band, block)`,
   generalising `pressRelative` (already written for goal-kick). Roll out phase by phase
   behind `BOARD_PRESS_RELATIVE`-style flags; compare with `press-compare.ts` across all 4
   formations x 3 blocks before flipping any default.
5. Last, optional: move the AI prompt/model contract to the canonical frame (removes the
   ~45 sites in `board-ai-chat.ts`). Needs a live-model eval; do not bundle with 1-4.

## Risks
- Left/right: the flip must mirror x for the defending team in `fromCanonical` (the exact bug
  class we just fixed); round-trip test per formation is the guard.
- `board-ai-chat.ts` has regex-driven rules tied to the current frame; leave untouched until step 5.
- Chassis copy in `apps/web/src/lib/chassis/` is generated; the sync test must keep passing.
- Existing boards/sequence frames must render identically (snapshot test on sample JSONs in
  `apps/api/samples/tactical-boards/`).

## Effort (CC, rough)
Step 1-2: ~half day plus tests. Step 3: ~1 hour. Step 4: ~1 day for all phases with the
comparison harness. Step 5: ~1-2 days including a live eval. Steps 1-4 are shippable
without touching stored data or the AI contract.

## Open questions for the owner
- Is step 5 (AI speaks canonical) wanted, or is adapter-only enough?
- Which phases matter most to coaches first (build-up, pocket, final third)?
