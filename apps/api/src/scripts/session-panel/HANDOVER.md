# Session panel lab — handover

Dale's independent football-quality panel for **generated sessions**. Not diagram visual QA. Not the production create-path reviewer.

**Repo:** `aci-diagrams` (diagrams-only compiler + web). **Do not touch** `/Users/macbook/Projects/aci`. Do not commit unless Dale asks. User is Dale.

## What this is

Flash Lite generates a session. Three parallel judges (default `gemini-3.5-flash`, eval only) score **age-appropriate, license-appropriate training they would be proud to run**. Frozen gates (no LLM) catch jargon, format, topic-sticker, clones, idle squad, full-pitch tactical.

Production create **does** run a different QA: `generateAndReviewSession` → CoachAI completeness reviewer (counts, word lengths). Fail still **saves** (`approved: false`). This panel is **not** on every live create (cost/latency). Playbook one-liners **are** injected into `buildSessionPrompt` (production generate).

Do **not** merge the three judges into one call.

## Commands

```bash
# unit tests (file is gitignored by `*.test.ts` — still on disk; tracked via gitignore exception)
pnpm --filter api exec jest --runInBand src/__tests__/session-panel.test.ts

# HTML preview, no LLM
pnpm --filter api sandbox:session-panel -- --preview

# one cell, one hour, learn frozen-gate lessons
pnpm --filter api sandbox:session-panel -- --cells u16-b-rest-defence --learn --count 1

pnpm --filter api sandbox:session-panel -- --list
pnpm --filter api sandbox:session-panel -- --lessons
pnpm --filter api sandbox:session-panel -- --cell u16-b-rest-defence --from-json /tmp/packet.json
```

Generate = `gemini-3.5-flash-lite`. Judges = `gemini-3.5-flash` unless `--judgeModel`. `--cheap` uses lite for judges (weak). `--learn-judges` proposes lessons (stay **proposed** until `--apply`). Leave `--learn-judges` off unless Dale wants slogans.

HTML reports: `apps/api/sandbox-output/session-panel-*/report.html` (gitignored).

## Proud / review / fail

Do not average three opinions into 4.2.

- **proud** — gates pass; all three `wouldRun: yes`; topic, quality ≥ 4; variety ≥ 4 when scored
- **review** — two yes + one rewrite; no hard fail
- **fail** — any frozen gate, any `wouldRun: no`, any hard dimension &lt; 3, or judge parseError after retry

`wouldRun: yes` is overridden to rewrite if topic/quality/variety &lt; 4, to no if &lt; 3.

## Variety (session to session)

Same topic, different **practice form** (grid, numbers, scoring mechanic, constraints). Topic words are stripped so two rest-defence hours are not clones just because they say “rest defence.”

- First hour on a cell: variety N/A (judges omit `v`)
- Later hours: generator gets a **ban list** (not the full prior card — Flash Lite copy-pastes full scoring lines). Judges get a compact PRIOR card and score `v`.
- Clone gate if Jaccard ≥ 0.7 vs last 3 on that fixture
- History: `apps/api/src/data/session-panel-history.json` (KEEP 3). **Do not record clones.** Re-judge `--from-json` must ignore a snapshot of the **same** session (title / ≥0.90 sim) or judges compare the hour to itself and score `v=1`.
- Generator field: `SessionPromptInput.panelPriorCard`

## Improvement loop

Name the fail in **one sentence**, inject it, re-score **that cell only**. Do not rewrite `prompts/session.ts` for each fail.

1. Frozen-gate fails → `--learn` writes **active** lessons (`session-panel-lessons.json`)
2. Judge-only fails → Dale/human one-liner (or `--learn-judges` → proposed)
3. Next generate injects matching active lessons (max **12**)
4. Pause a lesson after 3 fails and 0 helped
5. Gate-only fails must **not** increment unrelated lessons (variety-clone / idle-squad punishing topic rules)

## Current matrix (2026-08-26)

All five first-pass cells **proud**. Variety only fully exercised on U16 (had priors). U9/U11/U12 first hours have empty history for that fixture — **next hour there is the variety test**.

| Cell | Title (approx) | Topic / quality / variety | Notes |
|---|---|---|---|
| `u9-d-open-teammate` | Building Confidence Through Simple Passing… | 5/5/5 · N/A | First session |
| `u11-d-support-nearby` | Connecting with Nearby Teammates… | 5/5/5 · N/A | First session |
| `u12-c-around-press` | Playing Around the First Press… | 5/5/4 · N/A | First session |
| `u14-c-first-pass` | Middle-Third Transition: First Pass… | 5/5/4 · ~37% | Topic-game regex needed `after a regain` |
| `u16-b-rest-defence` | Middle-Third Rest Defence and Counterpress… | 5/5/4–5 · ~33% | Vs original proud 4-3-3 hour; tactical is reduced grid |

Local reports worth reading:

- U16 proud packet: `sandbox-output/session-panel-2026-08-26T03-36-47-557Z/` (logged fail on idle-squad; rotation language later made the gate pass; judges were already all-yes)
- U9: `…T03-40-22-991Z/`
- U11: `…T03-43-13-211Z/`
- U12: `…T03-45-53-326Z/`
- U14 proud packet: `…T03-51-32-478Z/` (logged fail on topic-game; regex miss on “after **a** regain”)

## Playbook (`src/data/session-panel-lessons.json`)

Active rules go into production `buildSessionPrompt`. Topic-scoped rest-defence rules must **not** fire on U9 passing.

Notable humans: warmup/tech must force the topic; setup matches title; tactical is not a second 11v11; second group if squad &gt; working group; game scoring must not copy PRIOR time-bonus (rest-defence only).

## Files

| Path | Role |
|---|---|
| `scripts/session-panel/run.ts` | CLI |
| `frozen-gates.ts` | Deterministic fails |
| `variety.ts` | Fingerprint, history, ban list |
| `agents.ts` | Three judges |
| `verdict.ts` | proud/review/fail |
| `learn.ts` | Gate → lessons |
| `fixtures.ts` | Five cells + `topicSignals` |
| `services/session-lessons.ts` | Load/inject/record |
| `prompts/session.ts` | `panelLessons`, `panelPriorCard` |
| `__tests__/session-panel.test.ts` | Unit tests (~34) |

## Pitfalls (do not relearn the hard way)

- **Gemini 503** on `gemini-3.5-flash`: judges retry with backoff. A 503 is not a football fail; `--from-json` the packet. Parse errors must not increment playbook `failed`.
- **Do not paste full PRIOR scoring into the generator.** Ban stems + grids only.
- **idle-squad** false-positived “split into pairs” / “switch roles every N minutes”. Those mean the squad is working, not watching.
- **topic-game** regex must allow `after a regain`, not only `after the regain` / `after we regain`.
- **tactical-is-match**: TACTICAL on a full-size pitch for that age’s format fails. Only CONDITIONED_GAME is the match.
- Flash Lite **cloned** the first proud U16 at 85% when fed the full prior card. Ban list dropped that to ~25–33%.
- Unit tests live under `*.test.ts` gitignore; exception in root `.gitignore` for this file.

## What to do next

1. **Second hour** on `u9-d-open-teammate` (then U11, U12) with `--learn --count 1` so variety is judged off the proud first session.
2. If clone: strengthen ban list, don’t dump the prior card into Flash Lite.
3. If designer/realism fail: one human sentence, one generate. Not a prompt rewrite.
4. Do not put this panel on every vault create unless Dale asks.

## Product notes Dale already locked

- Sessions are the product. Diagrams have frozen/visual QA; this is the football equivalent.
- Coach language (D banned jargon, C one concept, B+ systemic) is already in `buildSessionPrompt`. Player level is a separate dial.
- Topic + hour must be **detailed quality training**, not a title sticker.
- Proud is three independent yeses, not a blended score.
