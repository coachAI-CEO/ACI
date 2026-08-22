# Mobile ↔ Web Session Generator Parity Report

**Scope:** `apps/mobile` (Expo / React Native) vs. `apps/web` (Next.js) session/drill/series generators
**Method:** Read every relevant source file end-to-end. Cross-checked shared enums (`packages/shared/src/constants/enums.ts`) and the per-platform label helpers.
**Note:** The web's main app surface is `/demo/session` and `/demo/drill` under `apps/web/src/app/demo/...`, fed by `CoachChat.tsx` on the dashboard `/app` page. The mobile's surface is `apps/mobile/app/(tabs)/generate.tsx`.

---

## 1. Side-by-side fields table

| Field | Mobile | Web | Match? | Notes |
|---|---|---|---|---|
| **Generation type tabs** | Pill row: `drill`, `session`, `series` (no drill-only UI in the mobile store tab; drill is sent via the same form to `/ai/generate-drill`). `apps/mobile/components/generate/GenerateForm.tsx:55-78`, `useGenerate.ts:46-56`. | Single page (`/demo/session`) with a `Generation Mode` radio `Single Session` vs `Progressive Series`. Drill generation is a separate page (`/demo/drill`). `apps/web/src/app/demo/session/page.tsx:2363-2412`; `apps/web/src/app/demo/drill/page.tsx`. | ⚠️ Partial | Web separates drill generation into its own page (`drillType`, `gkOptional`, etc.). Mobile's "drill" tab is just a switch on the same form. |
| **Game model** | `DropdownCell` opens `PickerSheet` over `GAME_MODEL_OPTIONS` from `@aci/shared`. Locked to a single value when the club enforces one (`enforcedGameModelId`). `GenerateForm.tsx:89-93, 166-181, 313-324`; `enums.ts:22-28`. | `<ScopedGameModelSelect>` collapses to club model and renders "Resolving club model…" until scope loads. Hidden input mirrors the value when locked so disabled `<select>` is still posted. `ScopedGameModelSelect.tsx:21-75`. | ✅ Same source-of-truth (`GAME_MODEL_OPTIONS`), same lock semantics. | Web shows "Resolving club model…" placeholder while scope loads; mobile just shows the locked value immediately. |
| **Phase** | 4 values: `ATTACKING`, `DEFENDING`, `TRANSITION_TO_ATTACK`, `TRANSITION_TO_DEFEND`. `GenerateForm.tsx:21, 112`. | 3 values: `ATTACKING`, `DEFENDING`, `TRANSITION`. `page.tsx:253, 2180-2183`. | ❌ Mismatch | Mobile has two transition phases the web doesn't; web collapses them to one `TRANSITION`. **Label/option set differs** — see §4. |
| **Zone (Where)** | Always submitted (`MIDDLE_THIRD` default) but **not exposed in the UI**. `generate.store.ts:14, 46`; `session.service.ts:11`. | `<select name="zone">` with `DEFENSIVE_THIRD / MIDDLE_THIRD / ATTACKING_THIRD`. `page.tsx:2186-2200`. | ❌ Missing on mobile | The mobile submits zone to the API but the coach can never change it. |
| **Topic / focus area** | None. Mobile's request payload sets `focus = form.phase` (`session.service.ts:21`). | `TopicSelect` with ~30 topics per phase×zone combo (180 total), `getTopicsForPhaseAndZone(phase, zone, coachLevel)` (`session-topics.ts:5-294`). Selected topic drives backend `TOPIC LOCK`. | ❌ Missing on mobile | Topic is a major web feature; mobile has no equivalent. |
| **Age group** | `DropdownCell` over `['U8'…'U18']`. `GenerateForm.tsx:20, 103`. | `<select name="ageGroup">` with the same 11 values. `page.tsx:2222-2239`. | ✅ Identical. | |
| **Coach level** | `DropdownCell` over `COACH_LEVELS` from shared (`USSF_D`, `USSF_C`, `USSF_B_PLUS`). Labels via `formatCoachLevelLabel`. `GenerateForm.tsx:104-111`. | Same three options in `<select name="coachLevel">` (`USSF D`, `USSF C`, `USSF B+`). `page.tsx:213-217, 2259-2268`. | ✅ Identical values & labels. | |
| **Player level** | Cycles `BEGINNER → INTERMEDIATE → ADVANCED` by tapping the cell (no sheet). `GenerateForm.tsx:191-200`. **No enforcement rule.** | `<select name="playerLevel">` with same 3 values. Enforces "USSF_C/USSF_B+ coaches never pair with Beginner players" — disables `BEGINNER`, swaps to `INTERMEDIATE`, and shows the rule hint. `page.tsx:152-186, 2275-2286`. | ❌ Mobile missing the coach↔player rule | UI affordance differs (cycle vs picker) — see §3. |
| **Players min / max** | Two separate `DropdownCell`s over discrete values `4,6,8,10,12,14,16,18,20,22,24`. Min/max clamping: picking a higher min auto-bumps max. `GenerateForm.tsx:27-39, 278-312`. | Two `<input type="number">` with `min={2}`; JS clamps max ≥ min live. `PlayerCountInputs.tsx:50-69`. | ✅ Same clamp semantics; UI differs (select vs free number). | Mobile limits to even/4-step values; web allows any integer ≥ 2. |
| **Game duration (session)** | `60 min` / `90 min` only. `GenerateForm.tsx:41-44, 336-349`. | Same two values in `<select name="durationMin">`. `page.tsx:2246-2253`. | ✅ Identical. | |
| **Drill duration** | Not separately exposed — uses session duration. | `<input type="number" name="durationMin" min={10}>` defaulting to 20. `drill/page.tsx:638-645`. | ❌ Mobile has no drill-specific duration. | |
| **Space constraint** | Always submitted as `'HALF'`, **not editable**. `generate.store.ts:51`. | `<select name="spaceConstraint">`: `FULL / HALF / THIRD / QUARTER`. `page.tsx:2325-2334`. | ❌ Missing on mobile | Defaulted but invisible. |
| **Goals available** | Always submitted as `2`, **not editable**. `generate.store.ts:50`. | `<input type="number" name="goalsAvailable" min={0} max={4}>`. `page.tsx:2341-2348`. | ❌ Missing on mobile | |
| **Formation — Attacking** | Always sent (`'4-3-3'` for U13+ / `'2-3-1'` for U10 etc.), **not editable**. `generate.store.ts:53`. | `<FormationSelect>` whose options **change based on age group** (7v7 / 9v9 / 11v11). Helper text "7v7/9v9/11v11 formations". `FormationSelect.tsx:5-117`; `page.tsx:2299-2306`. | ❌ Missing on mobile | Web dynamically swaps formation list when age group changes; mobile doesn't. |
| **Formation — Defending** | Always sent (`'4-4-2'` default), **not editable**. `generate.store.ts:54`. | Same dynamic `FormationSelect`. `page.tsx:2312-2319`. | ❌ Missing on mobile | |
| **Drill type (drill page only)** | n/a | `<select name="drillType">`: `WARMUP / TECHNICAL / TACTICAL / CONDITIONED_GAME / FULL_GAME / COOLDOWN`. `drill/page.tsx:510-522`. | ❌ Missing on mobile | Mobile has no drill-type selector. |
| **GK optional (drill page)** | n/a | `<input type="checkbox" name="gkOptional">`. `drill/page.tsx:649-660`. | ❌ Missing on mobile | |
| **Number of sessions (series)** | Stepper `−` / `+` in a card, range `2…12`, default `3`. `GenerateForm.tsx:204-232`. | `<input type="number" name="numberOfSessions" min={2} max={10}>` shown only when series radio is active. `page.tsx:2402-2410`. | ⚠️ Different range | Web caps at 10; mobile caps at 12. |
| **Club banner** | Mobile-only: shows `Club: {user.clubName}` if set. `GenerateForm.tsx:126-130`. | Not rendered — the enforced model lock already signals club scope. | Mobile-only (harmless). | |
| **Network offline gate** | Mobile-only: blocks form with "Generation requires an internet connection." `apps/mobile/app/(tabs)/generate.tsx:14-18`. | No offline gate. | Mobile-only (correct). | |
| **Settings panel collapse** | n/a | Web-only: `<details>` wrapper around the form with a chevron, default-open when no params. `page.tsx:2131-2435`. | Web-only (cosmetic). | |
| **Reset form link** | n/a | Web-only: "Reset form" link in header when params present. `page.tsx:2416-2422`. | Web-only. | |
| **"Drill of the Day" preset** | n/a | Web dashboard links "Build Session From This" with hard-coded `ageGroup=U14&phase=…` query strings. `apps/web/src/app/app/page.tsx:71-89, 252-262`. | Web-only. | |

### Summary field counts
- **Mobile exposed controls:** 8 (Age, Coach, Players-min, Players-max, Model, Phase, Duration, Player-level) + a number-of-sessions stepper.
- **Web exposed controls (session page):** 14 (Model, Phase, Zone, Topic, Age, Duration, Coach-level, Player-level, Attacking formation, Defending formation, Space constraint, Goals available, Players min/max, Series mode + Number of sessions).
- **Web exposed controls (drill page):** 14 (Model, Phase, Zone, Age, Drill type, Attacking formation, Defending formation, Player-level, Coach-level, Space constraint, Goals available, Players min/max, Duration, GK optional).
- **Mobile invisible-but-sent fields:** `zone`, `formationAttacking`, `formationDefending`, `spaceConstraint`, `goalsAvailable` — all locked to store defaults and never editable from the UI.

---

## 2. Features present in web but missing in mobile

**Generation / form features**
- **Topic / focus-area dropdown.** Web offers ~30 curated topics per phase×zone combo and uses them as a backend "TOPIC LOCK" (`apps/web/src/data/session-topics.ts:5-294`). Mobile has no topic control — the backend is told `focus = phase` (`apps/mobile/services/session.service.ts:21`).
- **Zone picker.** Web exposes "Where (zone)" with three options and uses it to drive topic lists and labels. Mobile hard-codes `MIDDLE_THIRD` (`apps/mobile/stores/generate.store.ts:46`).
- **Editable formations (age-aware).** Web's `FormationSelect` swaps the option list based on age group (7v7/9v9/11v11) and shows a helper line ("7v7 formations"). Mobile sends fixed strings and never changes them.
- **Space constraint selector** (`FULL / HALF / THIRD / QUARTER`). Mobile hard-codes `HALF`.
- **Goals-available numeric input** (`0–4`). Mobile hard-codes `2`.
- **Drill type selector** (`WARMUP / TECHNICAL / TACTICAL / CONDITIONED_GAME / FULL_GAME / COOLDOWN`). Web-only — mobile's "drill" tab reuses the session form.
- **GK-optional checkbox** (drill page).
- **Drill-specific duration** (`min={10}`, default 20). Mobile uses session duration.
- **Coach ↔ Player-level pairing rule.** Web disables `BEGINNER` when coach is USSF_C or USSF_B+ and shows an inline hint; mobile's player-level cell just cycles freely (`GenerateForm.tsx:191-200`).
- **Age-aware formation list updates** triggered by age-group change (live DOM swap + helper text). Mobile rebuilds nothing.
- **"Drill of the Day" / CoachChat deep-linking** on the dashboard that pre-fills `gameModelId/phase/zone/topic/ageGroup/…` via URL params and auto-runs `autoGenerate=true` (`apps/web/src/app/app/page.tsx:184-223`).
- **Session-diversity algorithm** (`getBalancedDefaultCombo`) that rotates to least-used phase/zone/topic from localStorage history (`page.tsx:255-341`). Not relevant for offline mobile UX, but worth noting it exists.
- **Auto-generate from URL params** (`?autoGenerate=true`) — mobile has no equivalent.

**Post-generation / result features**
- **Skill Focus / Player Coaching Emphasis panel.** Web shows a generated `SkillFocus` block with `keySkills`, `coachingPoints`, `psychology.good/bad`, and `sectionPhrases` (`page.tsx:3380-3473`). Mobile result page ignores `session.skillFocus` entirely.
- **"Similar Sessions in Vault" recommendations.** When the backend returns `hasRecommendations + recommendations[]`, web shows a list with match reasons and a "Generate New Anyway" CTA (`page.tsx:2446-2590`). Mobile just calls `generateSession` and routes to the result page — no recommendations handling.
- **Regenerate as another coach level.** Web caches and offers "USSF D / USSF C / USSF B+" variants in-line with a confirm modal (`runCoachLevelRegeneration` at `page.tsx:1972+`; buttons at 3117-3155). Mobile has no equivalent.
- **Full PDF + 1-Page compact PDF export** buttons right in the session header (`page.tsx:3298-3362`). Mobile has a single "Share PDF" that uses the share sheet, gated on `canExportPDF`.
- **Open on tactical board (`createForkSessionBoard`).** Web forks the session into a board when feature `tacticalBoardV1` is enabled (`page.tsx:3170-3198`). Mobile has no board fork.
- **Fork a single drill onto the board** (`createForkBoard` per drill, `page.tsx:3577+`).
- **Drill-of-day / drill-detail with structured `Organization` (setupSteps, area lengthYards/widthYards, rotation, restarts, scoring).** Web renders `DrillDiagramCard` with all this; mobile result page renders only title + meta + coachingPoints (max 3) + progressions (max 2) and a fallback SVG (`apps/mobile/app/session/result.tsx:165-208`).
- **In-progress series card overlay** with "Generating N/M", "Ready N/M", and clickable per-session "Open" links as they finish (`SessionProgress.tsx:197-244`). Mobile shows a single linear progress bar with rotating text labels (`useGenerate.ts:36-43`, `GenerateForm.tsx:234-244`).
- **"5 Coach Build Flow" steps** with rotating detail text (`SessionProgress.tsx:18-64`). Mobile has 6 generic progress messages (`PROGRESS_MESSAGES`, `useGenerate.ts:10-17`).
- **"Reset form" link** after generating (`page.tsx:2416-2422`).
- **Pending background-generation polling.** Web polls the vault for a series when the network drops mid-generation (`page.tsx:1622-1625`, `setPendingSeriesCheck`).
- **QA-score display** (`QAScoresDisplay`). Web shows per-dimension scores + pass/fail. Mobile has no QA display.
- **Ref code copy-to-clipboard pill** (`page.tsx:3037-3044`). Mobile renders ref code as plain text.
- **Series tab strip** with per-session QA score chips (`page.tsx:3010-3015`). Mobile's `series/result.tsx` is a barebones numbered list.
- **Per-drill stage nav** (sticky tabs with current block highlighted + ← → keyboard hint, `page.tsx:3482-3499`). Mobile expands a single drill at a time.

**Mobile-only behaviors that don't change parity but are worth noting**
- Mobile result page has: Save to Vault, Favorite, Schedule (calendar), Create Player Plan, Share ref, Sideline Mode. These roughly match web's equivalent actions except Sideline Mode, which is mobile-specific.
- Mobile session result page does show Theme + Objectives lines (`apps/mobile/app/session/result.tsx:144-160`). Web shows the same in a richer card with QA score, ref code pill, language-level badge, in-vault badge, and Favorite toggle.

---

## 3. Features present in mobile but missing in web

- **Persistent form state across launches.** Mobile uses Zustand `persist` with AsyncStorage (`apps/mobile/stores/generate.store.ts:66-95`). Web has none — it rehydrates only from URL search params.
- **Enforced game-model lock on mobile** is silently applied via `useEffect` patching the form when `enforcedGameModelId` arrives (`GenerateForm.tsx:95-99`). Web renders a "Resolving club model…" placeholder while loading (`ScopedGameModelSelect.tsx:32-49`) — different UX for the same gating.
- **Offline gate** (`apps/mobile/app/(tabs)/generate.tsx:14-18`). Web has no equivalent.
- **Tap-to-cycle player-level cell** instead of opening a picker (`GenerateForm.tsx:191-200`). Functionally a small UX delta.

---

## 4. Label / LOV mismatches

| Enum | Mobile shows | Web shows | Source of truth |
|---|---|---|---|
| `GameModelId.POSSESSION` | "Possession" | "Possession" | ✅ Match (`utils/format.ts:13`, `gameModelLabel` `page.tsx:188-194`). |
| `GameModelId.PRESSING` | "Pressing" | "Pressing" | ✅ |
| `GameModelId.TRANSITION` | "Transition" | "Transition" | ✅ |
| `GameModelId.COACHAI` | **"Balanced"** | **"Balanced model"** | ❌ Mobile `formatGameModelLabel` (`utils/format.ts:15`) drops the "model" word; web uses "Balanced model" in both `gameModelLabel` (`page.tsx:192`) and the drill page (`drill/page.tsx:86`). |
| `GameModelId.ROCKLIN_FC` | "Rocklin FC" | "Rocklin FC" | ✅ |
| `CoachLevel.USSF_D` | "USSF D" | "USSF D" | ✅ |
| `CoachLevel.USSF_C` | "USSF C" | "USSF C" | ✅ |
| `CoachLevel.USSF_B_PLUS` | "USSF B+" | "USSF B+" | ✅ |
| `PlayerLevel.BEGINNER` | "Beginner" (via `humanizeLabel`) | "Beginner" | ✅ |
| `PlayerLevel.INTERMEDIATE` | "Intermediate" | "Intermediate" | ✅ |
| `PlayerLevel.ADVANCED` | "Advanced" | "Advanced" | ✅ |
| `Phase.ATTACKING` | "Attacking" | "Attacking phase" | ⚠️ Different label. Web's `phaseLabel` adds "phase" (`page.tsx:196-200`). Mobile's `formatPhaseLabel` does not (`utils/format.ts:19-25`). |
| `Phase.DEFENDING` | "Defending" | "Defending phase" | ⚠️ Same as above. |
| `Phase.TRANSITION_TO_ATTACK` | "Transition to Attack" (mobile-only enum) | n/a — web has only `TRANSITION` | ❌ Mobile enum mismatch (see below). |
| `Phase.TRANSITION_TO_DEFEND` | "Transition to Defend" (mobile-only enum) | n/a — web has only `TRANSITION` | ❌ Mobile enum mismatch. |
| `Phase.TRANSITION` | (falls back to `humanizeLabel` → "Transition") — only used when mobile sends an unexpected value. | "Transition phase" | ⚠️ Minor. |
| `Zone.DEFENSIVE_THIRD` | Hidden from UI | "Defensive third" | ⚠️ Web lowercase + plural, mobile's `formatZoneLabel` is unused but uses "Defensive Third" (`utils/format.ts:27-31`). |
| `Zone.MIDDLE_THIRD` | Hidden from UI; sent as default | "Middle third" | ⚠️ Same. |
| `Zone.ATTACKING_THIRD` | Hidden from UI | "Attacking third" | ⚠️ Same. |
| `SpaceConstraint.HALF/THIRD/QUARTER/FULL` | Hidden from UI; sent as default `HALF` | "Half pitch" / "Third" / "Quarter" / "Full pitch" (`page.tsx:2330-2333`). | n/a (mobile hides it). |
| `DrillType.*` (WARMUP/TECHNICAL/TACTICAL/CONDITIONED_GAME/FULL_GAME/COOLDOWN) | Not exposed on mobile at all | "Warmup / Technical / Tactical / Conditioned Game / Full Game / Cooldown" (`drill/page.tsx:514-521`). | ❌ Mobile has no drill-type picker. |

**Structural enum mismatch — phases:**
The mobile form types phase as `'ATTACKING' | 'DEFENDING' | 'TRANSITION_TO_ATTACK' | 'TRANSITION_TO_DEFEND'` (`apps/mobile/stores/generate.store.ts:13`) and submits one of those four strings. The web's `Phase` is `"ATTACKING" | "DEFENDING" | "TRANSITION"` (`apps/web/src/data/session-topics.ts:1`). Whatever the backend does with `TRANSITION_TO_ATTACK` vs `TRANSITION`, the surface definitions on the two clients disagree.

---

## 5. Recommended next steps (prioritized)

> Effort estimates: S ≤ 0.5 day • M 1–2 days • L 3+ days. Estimates assume iOS + Android once, with form changes only (no backend changes unless noted).

### P0 — block parity for the core session

- **P0.1 — Expose `Zone` in the mobile form.** New `DropdownCell` + `PickerSheet` for the three zones, default `MIDDLE_THIRD`. Wire into store + `session.service.ts`. (S)
- **P0.2 — Expose `Topic` picker.** Port `getTopicsForPhaseAndZone(phase, zone, coachLevel)` (or a shared package version — `session-topics.ts` already depends only on phase/zone/coachLevel). New `PickerSheet` driven by phase×zone; submit as `topic`/`focus`. (M)
- **P0.3 — Surface the age-aware formation selectors.** Add a second row with `Attacking formation` and `Defending formation` `DropdownCell`s backed by a new shared `getValidFormations(ageGroup)` helper (lift the `FORMATION_BY_AGE` table from `apps/web/src/components/FormationSelect.tsx:5-20` into `@aci/shared`). Update both `formationAttacking` and `formationDefending` when `ageGroup` changes. (M)
- **P0.4 — Add `Space constraint` and `Goals available` controls.** Two more cells (or fold them behind a "Fine-tuning" expander to save space). (S)

### P1 — fix mismatches that surface as wrong content

- **P1.1 — Reconcile Phase enum.** Either collapse mobile's `TRANSITION_TO_ATTACK/_DEFEND` into `TRANSITION` (matching web), or carry them through to the backend. The label set on mobile (`utils/format.ts:19-25`) shows "Transition to Attack" / "Transition to Defend"; web shows "Transition phase" for everything transition-y. Pick one. (S, but needs product input — see §6.)
- **P1.2 — Align labels: `COACHAI` → "Balanced model" and `Phase.ATTACKING/DEFENDING` → "Attacking phase / Defending phase"** to match web. (S)
- **P1.3 — Enforce the coach ↔ player-level pairing rule** on mobile (disable Beginner when coach is C or B+; cycle past it and show the rule hint). (S)
- **P1.4 — Drill type selector.** Add a row that's only shown when `activeType === 'drill'` with the six `drillType` options. Backend already accepts this field on `generateDrill` (`apps/mobile/services/drill.service.ts` doesn't send it — needs adding). (S)
- **P1.5 — Drill-specific duration + GK optional.** Two extra fields in the drill variant. (S)

### P2 — reach deeper parity

- **P2.1 — Skill Focus / Player Coaching Emphasis panel** on the session result screen. Render `session.skillFocus.title/summary/keySkills/coachingPoints/psychology/sectionPhrases` in a card similar to web (`page.tsx:3380-3473`). Backend already returns this payload; mobile just drops it. (M)
- **P2.2 — Similar-sessions recommendation UI.** When `/ai/generate-session` returns `hasRecommendations + recommendations[]`, show them as cards with a "Generate new anyway" CTA. (M)
- **P2.3 — Regenerate-as-other-coach-level** row above the drill list. Cache other-level results in the same Zustand store. (L — needs UX for variants and a confirm modal.)
- **P2.4 — Refactor the in-progress screen to a `SessionProgress`-style overlay** (Coach Build Flow steps, elapsed seconds, cancel button, series-ready list). (M)
- **P2.5 — Series result page** upgrade: tab strip, per-session QA score, expandable session detail, fork-to-board. (M)
- **P2.6 — QA-score display** on each drill card. (S)
- **P2.7 — Range cap on `numberOfSessions`** from 12 → 10 to match web. (XS)

---

## 6. Open questions (need product / design before implementing)

1. **Should mobile keep the four-way phase enum or collapse to web's three?** Both apps call the same backend; the safest move is to align with web so `session-topics.ts` can be shared. But if coaches in the field rely on "to Attack" vs "to Defend" framing in the picker, we may need to keep the mobile distinction and teach the backend to treat both as `TRANSITION`. Confirm with design.
2. **`COACHAI` label: "Balanced" or "Balanced model"?** Web consistently shows "Balanced model"; mobile shows "Balanced". What does the API return for the model "name" in the response payload — does it normalize? Pick one and apply everywhere (including dashboards, results, share messages).
3. **Coach ↔ player-level rule strictness.** Web disables Beginner for USSF_C/B+ entirely. Should mobile do the same, or surface a soft warning and let coaches override? The mobile result screen already trusts whatever the backend returns, so the question is purely UX.
4. **Hidden-but-sent fields: zone, formations, space, goals.** Today the coach can't change them. Should mobile expose them (P0.1/P0.4/P1.4), or should the backend use richer defaults from the game model + age group so coaches don't need to? Product call.
5. **Drill generation page or tab?** Web dedicates a whole `/demo/drill` page (different field set: `drillType`, `gkOptional`, free numeric duration). Mobile currently overloads the same form with an `activeType='drill'` tab that submits to `/ai/generate-drill` without `drillType`. Do we want a dedicated drill screen on mobile, or keep the tab and add `drillType`/`gkOptional`/`duration` only when the drill tab is active?
6. **`numberOfSessions` max — 10 or 12?** Web caps at 10; mobile at 12. Both work with the backend today. Pick the supported cap.
7. **Should mobile ever deep-link from the dashboard?** Web has URL-param pre-fills (`?ageGroup=…&autoGenerate=true`). If we want `Drill of the Day` / coach chat → auto-generate flows on mobile, we need to decide whether the mobile store should accept those params (e.g. via a deep-link config).
8. **PDF export parity.** Mobile has a share-sheet PDF; web has full + 1-page compact. Are both formats needed on mobile, or is mobile's single-PDF acceptable for now? Feature-flag check: web `exportingPdf` state isn't gated by `canExportPDF`, but mobile's `onSharePdf` is (`apps/mobile/app/session/result.tsx:108-111`).
9. **Ref-code copy-to-clipboard pill** — easy to add (mobile has a `<Pressable>` already), but is it wanted on the mobile result screen?
10. **Tactical Board fork** (drill and session) is mobile-only "Sideline Mode" today. Should we add a "Open on Board" button on the result page when the user has `tacticalBoardV1`? Or keep sideline as the only board-adjacent mobile surface?
