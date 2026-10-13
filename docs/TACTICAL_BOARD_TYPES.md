# Tactical Board — Canonical Types

How the `WebDiagramV1` type is shared across the webapp, the mobile app, and the API.

## TL;DR

There is **one** canonical type (`WebDiagramV1`) and it lives in **`packages/shared/src/types/tactical-board.ts`**. Both `apps/web` and `apps/api` re-export it from `@aci/shared`. Adding a new field is a 3-step change.

## The shape

```
packages/shared/src/types/tactical-board.ts
└── WebDiagramV1                ← canonical, what the wire format is
    ├── pitch                   { variant, orientation, format, showZones, showThirds, zones }
    ├── players[]               { id, number, team, role, x, y, facingAngle, labelStyle }
    ├── goals[]                 (optional)
    ├── coach                   (optional)
    ├── balls[]                 (optional)
    ├── cones[]                 (optional)
    ├── elements[]              (optional, practice kit: mini-goal/cone/mannequin/pole)
    ├── arrows[]                { from, to, type, style, weight, arrowhead?, control?, path?, order? }
    ├── areas[]                 (optional)
    ├── labels[]                (optional)
    └── sequence?               { activeFrameId, frames[] }  // each frame is a full layers snapshot
```

All coordinates are **0–100 normalized**. `pitch.orientation` decides the axis semantics:
- `HORIZONTAL` → x is length, y is width (full pitch is wider than tall)
- `VERTICAL` → x is width, y is length (full pitch is taller than wide; mobile uses this)

## Where each app consumes it

| App | Import | Notes |
|---|---|---|
| `packages/shared` | **source of truth** | declares `WebDiagramV1` + `BoardElement` + helpers (`clamp01to100`) |
| `apps/web` | `import type { DiagramV1 } from '@/types/diagram'` | `apps/web/src/types/diagram.ts` re-exports `@aci/shared` under the legacy `Diagram*` names so the existing 2,800-line editor keeps working without a big refactor |
| `apps/api` | `import type { WebDiagramV1 } from './services/web-diagram-v1'` | `apps/api/src/services/web-diagram-v1.ts` re-exports from `@aci/shared`. The API also keeps the **normalize pipeline** (`toWebDiagramV1`, formation presets, session/board axis remap) local — those are runtime logic, not types |
| `apps/api/src/services/board-diagram-schema.ts` | `WebDiagramV1Schema` (Zod) | **stays in the API**. Runtime validation is a backend concern. The inferred TS type comes from the Zod schema, which mirrors `WebDiagramV1` field-by-field. |
| `apps/mobile` | `import type { WebDiagramV1 } from '@aci/shared'` | Live consumer. `BoardPreview`, `BoardCanvas`, `boards.service`, and the editor all use the shared type. Mobile defaults pitch orientation to `VERTICAL` for portrait fill (see Phase G.5). |

## Why the type was hoisted

Before this sync:
- `apps/web/src/types/diagram.ts` declared `DiagramV1`, `DiagramPlayer`, `DiagramArrow`, … (web UI types)
- `apps/api/src/services/web-diagram-v1.ts` declared a near-duplicate `WebDiagramV1` (API store shape)
- `apps/api/src/services/board-diagram-schema.ts` mirrored the API shape in Zod

The two TS types drifted independently. Adding `facingAngle` to the web type, for example, required two edits. Hoisting into `@aci/shared` before the native editor meant mobile never needed a third copy.

After this sync:
- One declaration in `@aci/shared`
- Three re-exports (`apps/web/src/types/diagram.ts`, `apps/api/src/services/web-diagram-v1.ts`, and the API Zod schema which still lives in the API but infers the same shape)
- One canonical wire format
- Mobile, web, and API all resolve to the same interfaces for `WebDiagramV1` and the board helpers (`pitch-formats`, `elements`, `lines`, `player-spacing`, `sequence`)

## How to add a new field

1. **`packages/shared/src/types/tactical-board.ts`** — add the field to the relevant interface.
2. **`apps/api/src/services/board-diagram-schema.ts`** — add the field to the Zod schema. **Required**: both the TS type and the Zod schema must stay in lockstep. The Zod schema is what runs at the API boundary.
3. Run `pnpm exec tsc --noEmit -p packages/shared` (and the per-app typechecks below) to confirm no breakage.

If the new field is also accepted from legacy/session JSON on the API side, extend `toWebDiagramV1()` in `apps/api/src/services/web-diagram-v1.ts` and add a fixture test under `apps/api/src/__tests__/tactical-board-diagram.test.ts`.

## API normalize pipeline (local to the API)

These helpers are not types — they're runtime logic that maps incoming JSON (from drills, sessions, AI outputs) into the canonical `WebDiagramV1` shape. They live in the API and are not part of the shared type contract.

| File | Purpose |
|---|---|
| `apps/api/src/services/web-diagram-v1.ts` | `toWebDiagramV1()` — accepts legacy `{ startingPositions, safeZones, ... }` or already-web JSON and emits a clean `WebDiagramV1`. |
| `apps/api/src/services/board-elements.ts` | `mergePracticeElements()` — folds cones + SMALL goals into the unified `elements[]` layer. |
| `apps/api/src/services/web-diagram-v1.ts` | `defaultMatchBoardDiagram()` + `build11v11FormationPlayers()` — formation presets. |
| `apps/api/src/services/web-diagram-v1.ts` | `remapSessionDiagramToBoard()` — swaps x/y when converting session JSON to board store coords. |
| `apps/api/src/services/web-diagram-v1.ts` | `isDiagramThinForFork()` — `true` when a diagram is missing players or has no arrows (candidates for vault enrich). |
| `apps/api/src/services/web-diagram-v1.ts` | `formatFromAgeGroup()` — `U7` → `'7V7'`, `U11` → `'9V9'`, `U13+` → `'11V11'`. |

## Verify the sync

```bash
pnpm install
cd packages/shared && pnpm exec tsc --noEmit -p tsconfig.json
cd apps/api && pnpm exec tsc --noEmit -p tsconfig.json
cd apps/web && pnpm exec tsc --noEmit -p tsconfig.json
cd apps/mobile && pnpm exec tsc --noEmit -p tsconfig.json
cd apps/api && pnpm exec jest --runInBand src/__tests__/tactical-board-diagram.test.ts
```

All four packages typecheck and the diagram schema tests pass. The HTTP test (which exercises the real API routes) requires `GEMINI_API_KEY` in `.env`.

## Related docs

- `docs/TACTICAL_BOARD_MOBILE_INVENTORY.md` — current mobile/web/API board surfaces (native editor shipped through G.5).
- `docs/TACTICAL_BOARD_MOBILE_PLAN.md` — roadmap. **A→G.5 shipped** on `codex/mobile-app`; Phase H / F v2 parked.

## History

- **2026-08-25** — Mobile is a live consumer of shared board types + editor through G.5.
- **2026-08-24** — Hoisted `WebDiagramV1` out of `apps/api/src/services/web-diagram-v1.ts` and the web's `DiagramV1` into `packages/shared/src/types/tactical-board.ts`. The web `Diagram*` names and the API `WebDiagram*` names are now re-exports.
- **2026-08-24** — Identified that more web libs (`pitch-formats.ts`, `board-elements.ts`, `board-lines.ts`, `board-player-spacing.ts`, `board-sequence.ts`) are pure functions on `WebDiagramV1` and need to follow the same pattern. Captured as Phase A.5 (now shipped).