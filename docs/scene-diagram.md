# Scene Diagram — Architecture & Contract

How a drill's tactical picture gets drawn. This is the **scene-XY** path — the
default since `DIAGRAM_PLACEMENT=scene`. The older compiler path is a forced
rollback only.

Related code:

- Card builder: `apps/api/src/services/scene-card.ts`
- Prompt + coercion + `DrawerParams` mapping: `apps/api/src/services/scene-document.ts`
- Deterministic reconciliation: `apps/api/src/services/scene-kit.ts`
- Generation entry point: `apps/api/src/services/scene-diagram.ts`
- Painter (shared with the compiler): `apps/api/src/services/deterministic-drawer-svg.ts`
- Persist + serve: `apps/api/src/services/drill-diagram-svg.ts`, `apps/api/src/routes/diagram-svg.ts`
- Web render + frame stepper: `apps/web/src/components/StoredDrillSvg.tsx`
- Wire schema (shared with Tactical Board): `apps/api/src/services/board-diagram-schema.ts`, `web-diagram-v1.ts`
- Sampler / scorer / visual judge: `apps/api/src/scripts/scene-thesis/`

---

## Pipeline

```
drill JSON (Gemini model #1 — drill generator)
      │
      ▼
buildSceneCard            scene-card.ts
  • kit line (0 / 1 / 2 full goals) from goalsAvailable
  • drops setup steps that contradict the kit line
  • sub-squad / working-group detection → strips the formation line
  • namedRoster: pulls an explicit per-side role list when the author wrote one
  • inferScenePicture: rondo | center | matchup | (none)  ── a real full goal
    (goalsAvailable >= 1) beats a "rondo"/"1v1" keyword in the model's title
      │  SceneCard { card, drillType, fieldFormat, goalsAvailable,
      │              roster?, twoTeamGame, picture?, ... }
      ▼
promptForScene            scene-document.ts   (SCENE_PROMPT_VERSION = scene-webv1-v3)
      │
      ▼  Gemini model #2 — GEMINI_SCENE_MODEL, default gemini-3.5-flash-lite
      │  (gemini-3.5/3.6-flash non-lite is HARD-BANNED here — see scene-diagram.ts)
      ▼
extractScene              scene-document.ts
  • strip fences, "output ONE JSON object" guard against echoed few-shot examples
  • toWebDiagramV1(loose)  — coerce home/away → ATT/DEF, movement → run, synth pitch
  • parseWebDiagramV1      — strict zod, same schema the board uses
      │  WebDiagramV1 { players[], goals[], balls[], arrows[] (order, from.playerId), areas[], labels[], sequence? }
      ▼
sceneToDrawerParams       scene-document.ts   — WebDiagramV1 → DrawerParams
  • relabelFromRoster → fixRoleSides → separatePlayers → pinGoalsToEnds
  • enforceSceneKit         scene-kit.ts   (keeper/goal reconciliation, defensive gate)
  • reassignArrowOwners     scene-kit.ts   (arrow team correctness — see below)
  • one ball guaranteed; first ordered arrow snapped to it
  • arrows renumbered 1..N contiguously; team set from the origin player
      │  DrawerParams (internal render format — home/away/gk vocab)
      ▼
renderDeterministicDiagramSVG   deterministic-drawer-svg.ts   — the "TE painter"
  • players, ball, numbered arrow badges, arrows coloured by acting team, legend
      │
      ▼
SVG string → drill.diagramSvg  (+ drill.json.sceneDiagram, drill.json.sceneFrames)
```

`WebDiagramV1` is the **wire + storage format**. `DrawerParams` is the
**internal render format**. The boundary is deliberate: all the N1–N5 / kit
logic stays on `DrawerParams` (home/away/gk), untouched by the schema swap.

---

## Coordinate contract

Percent pitch, `0–100` on both axes, origin top-left, `x` right, `y` down.
`home` (blue) attacks toward `x=100`; `away` (red) attacks toward `x=0`.
Full goals sit on the left/right ends only (`x` 0 / 100, `y` 50). Mini-goals
and gates sit on an end line (`x` near 3 / 97), never a touchline.

---

## Layered defense

Every recurring model error gets three independent layers. The pattern matters
more than any single rule:

| Layer | Where | Job |
|---|---|---|
| **Prompt rule** | `promptForScene` | tell the model the right thing |
| **Deterministic guard** | `scene-kit.ts` / `scene-card.ts` | fix the unambiguous subset; **leave the rest** (never fabricate) |
| **Sampler check** | `scene-thesis/score.ts` | flag whatever slipped through, so it stays measurable |

Guards are conservative on purpose. `reassignArrowOwners` rebinds a
wrong-team forward pass only when there's a correct-team shirt within 18
units of the arrow tail; otherwise it leaves the arrow and `scoreArrowDirection`
flags it for a human.

Error classes covered today:

- **Two-team scoring** — `TWO_TEAM_LAW` prompt block + `enforceSceneKit` adds a
  counter-gate on a bare end for a two-team card.
- **Role labels verbatim** (LCB/RCB/LDM…) — painter `CORE_POSITION_CODES`
  L/R-first + `relabelFromRoster` line/side assignment.
- **L/R touchline sides** — `fixRoleSides` reflects a shirt on the wrong
  touchline; away is mirrored (`away R* → top`).
- **Keeper per full goal** — `enforceSceneKit` synthesizes a GK for any bare
  full goal, demotes strays.
- **Arrow ownership / direction** — `ARROW OWNERSHIP` prompt rule +
  `reassignArrowOwners` + `scoreArrowDirection`.
- **Arrow colour** — `arrowStyle(type, team)`: pass/run/press take the acting
  team's colour; the dash pattern still encodes the type.
- **Contradictory picture** — `inferScenePicture` won't call a drill a rondo
  when its card demands a full goal + GK.

---

## Frame sequences (built, dormant)

The scene path can carry `sequence.frames[]` (2–3 frames: a setup frame plus
one action each). `sceneFramesToDrawerParams` paints one `DrawerParams` per
frame with carry-forward (a frame only re-states the shirts that move), and
`StoredDrillSvg` has a prev/next/play stepper for `>= 2` frames.

**The prompt does not ask for sequences.** A live run showed
`gemini-3.5-flash-lite` drops goals and collapses rosters the moment the prompt
mentions frames. Sequences turn on when either a bigger scene model is used or
the sub-principle model (roadmap) gives a per-drill "this teaches mechanism X"
signal — see `~/.gstack/projects/coachAI-CEO-ACI/2026-08-27-scene-diagram-frame-sequence-design.md`.

---

## Config

| Flag | Values | Effect |
|---|---|---|
| `DIAGRAM_PLACEMENT` | `scene` (default) · `compiler` · `gemini-svg` | which painter input |
| `GEMINI_SCENE_MODEL` | model id | scene call model; non-lite `flash` is refused |
| `SCENE_PROMPT_VERSION` | `scene-webv1-v3` | bumped on any prompt change; stored on the drill |

---

## Testing

- `apps/api/src/__tests__/scene-diagram.test.ts` — unit + end-to-end SVG.
- `pnpm --filter api sandbox:scene-sample -- --count N --seed S [--visual]` —
  stratified run through the real two-call pipeline. Frozen checks: goals,
  keepers, roster, overlap, picture, spacing, horizontal, ball, arrowOrder,
  arrowDirection. `--visual` adds a Gemini visual judge. Writes a `report.html`
  contact sheet with a per-diagram "Steps — what each number is" table.

---

## Known limitations

- **Model #1 is the ceiling.** The drill generator writes broken rosters,
  drops teams, and produces self-contradictory setups ("Transition Rondo" that
  wants a goal). `rosterLooksSane` / `inferScenePicture` degrade gracefully;
  a drill-JSON validate-and-repair pass in `services/drill.ts` / `postprocess.ts`
  is the next real lever, not yet built.
- **Wrong-direction transitions** (a defending player's run driving into the
  attacking third) with no nearby correct-team shirt: `reassignArrowOwners`
  can't fix them; `scoreArrowDirection` + the visual judge flag them. ~1/16.
- **Flaky JSON** — `gemini-3.5-flash-lite` occasionally returns malformed JSON
  (~1 per few sampler runs); production falls back to the compiler. A scene-call
  retry would close it.
