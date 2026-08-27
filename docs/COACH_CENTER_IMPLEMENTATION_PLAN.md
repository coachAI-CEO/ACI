# Coach Center — Mobile Implementation Plan

> **Status (2026-08):** Phases **A–E shipped** on `codex/mobile-app` — shared types,
> team overview parity, curriculum view, next sessions, and season chat.
> Later phases (F+) remain open. Inventory: `docs/COACH_CENTER_MOBILE_INVENTORY.md`.

Goal: make the mobile Coach Center the equal of the web for the **on-the-go
coach workflow** (this week's plan, next match, today's session, recap), while
keeping authoring (team editing, curriculum authoring, full chat history) on
the web. Every API endpoint we need already exists in `routes-coach-center.ts`
and `services/coach-center.ts` — this is mostly a UI + types alignment job.

The full feature inventory is in `docs/COACH_CENTER_MOBILE_INVENTORY.md`.
This plan assumes that doc has been read.

---

## Principles

1. **Mobile owns the in-game experience, web owns authoring.** Anything a
   coach needs at the field (this week's session, sideline jump-off, recap
   entry, share PDF) ships on mobile. Anything that benefits from a wider
   canvas or richer authoring (team creation, curriculum editing, season
   chat history beyond the current week) keeps a "Open on web" CTA and is
   not duplicated.
2. **Use the same shared types where possible.** Lift `CoachCenterTeam`,
   `CurriculumWeek`, `WeekKnowledge`, `CalendarDay`, `Recommendation`,
   `GameDayItem`, `ChatMessage` into `@aci/shared` so mobile + web consume
   one shape. Today the mobile service has its own narrower types
   (`CoachCenterTeam`, `CoachCenterOverview`, `CoachCenterWeekDay`, etc.)
   that drop fields the mobile would benefit from.
3. **Don't regress the existing 4-screen flow.** Today the mobile has a
   compact Coach Center that works on a phone. Every change here is
   additive — new screens, not rewrites.
4. **One feature per phase, ships behind its own commit.** Phases are sized
   to land in a single working session.

---

## Phase A — Shared types (no UI yet) ✅ SHIPPED

**Goal**: stop the two clients from drifting on Coach Center data shapes.

A1. Inventory current usage on both sides
  - Mobile: `apps/mobile/services/coach-center.service.ts`
  - Web: `apps/web/src/app/coach-center/_lib/types.ts`
  - Confirm nothing on the mobile side relies on the narrower types' missing
    fields (it doesn't — the screens render only the fields present).

A2. Lift the web's types into `packages/shared/src/types/coach-center.ts`:
  - `ClubOption`, `WeekSessionIdea`, `WeekKnowledge`, `CurriculumWeek`,
    `TeamSeason`, `TeamSummary`, `CalendarDay`, `Recommendation`,
    `GameDayItem`, `ChatMessage`.
  - The mobile types alias to the shared ones (no behaviour change yet).
  - Re-export from `packages/shared/src/index.ts`.

A3. Mobile typecheck. Web typecheck. No behaviour change.

---

## Phase B — Team overview parity ✅ SHIPPED

**Goal**: the team overview screen surfaces the same "this week's plan"
context as the web's Overview page.

B1. Overview payload now returns the full season (`season: { weeks, currentWeekIndex }`)
  via the shared `TeamSummary` type. Verify the API does this today by reading
  `getTeamOverview` in `apps/api/src/services/coach-center.ts` — `serializeTeam`
  already returns the season; the mobile service just doesn't carry it through.
  If it doesn't, surface `season.weeks` from the overview endpoint.

B2. Add a hero "This week's curriculum" card to
  `apps/mobile/app/coach-center/[teamId]/index.tsx` mirroring the web:
  - Eyebrow "THIS WEEK'S CURRICULUM" (sky / primary tint).
  - Theme title, phase · zone · moment inline.
  - Focus paragraph.
  - **Build this session** CTA → `router.push` with `generateHref`-style
    search params (ageGroup, coachLevel, playerLevel, phase, zone, topic).
    Re-use the existing `GenerateForm` deep-link contract used by the
    video-to-generate flow.

B3. Surface a single **Team / Season week / Upcoming sessions / Next match**
  2×2 KPI grid at the top of the team page, same labels as web. Use the
  shared `TeamSummary` shape — values: name / current week index / upcoming
  count / next match opponent. Tight grid, 2 columns.

B4. Add a section card grid at the bottom of the team page that mirrors
  the web's six section cards. Each card is a single full-width row
  (`QuickActionRow` style — icon + title + chevron), pointing at the
  existing or new mobile screens where they exist:

  - **Curriculum** → new screen `coach-center/[teamId]/curriculum.tsx` (Phase C)
  - **Calendar** → existing `coach-center/[teamId]/week.tsx`
  - **Game day** → existing `coach-center/[teamId]/game-days/index.tsx`
  - **Next sessions** → new screen `coach-center/[teamId]/next-sessions.tsx` (Phase D)
  - **Season chat** → new screen `coach-center/[teamId]/chat.tsx` (Phase E)
  - **Authoring on web** → keep the existing Linking CTA to
    `webPath('/coach-center/curriculum')` etc., but split into one row per
    destination (Curriculum / Team settings on web).

---

## Phase C — Curriculum screen (web parity) ✅ SHIPPED

**Goal**: mobile coaches can pick any week of the 16-week season and see
the same "knowledge card" + "session breakdown" + vault recommendations
the web shows.

C1. New file `apps/mobile/app/coach-center/[teamId]/curriculum.tsx` mounted
  under `Stack.Screen name="coach-center/[teamId]/curriculum"` in
  `apps/mobile/app/_layout.tsx`.

C2. Layout (single-column, vertically scrollable):
  - **Season weeks** list at the top — horizontally scrollable chip strip
    (current week highlighted with a primary-tinted background). Tap to
    select. Use the same `currentWeekIndex` indicator the web sidebar uses.
  - **Selected week** card below with:
    - Eyebrow `WEEK N · TOPIC`
    - Theme H1
    - Focus paragraph
    - Chips for ageGroup, playerLevel, coachLevel, moment, phase, zone
      (reuse `Badge` with `tone="muted"`)
    - **Build this session** CTA → same deep link as Phase B2.
    - "For {audienceLabel}" knowledge card (sky-tinted, "Why this week" copy)
    - "This week's constraints" bulleted list
    - "Session breakdown" — 4 slot cards (slot eyebrow + title + detail)
    - "Vault sessions that can work this week" — fetched from
      `GET /coach-center/teams/{teamId}/recommendations?weekIndex=N`

C3. Cache the 16 weeks from the season payload (Phase B1) so the screen
    doesn't refetch when switching weeks. Only the vault recommendations
    need a per-week query.

---

## Phase D — Next sessions ✅ SHIPPED

**Goal**: web's `/coach-center/next-sessions/page.tsx` parity.

D1. New screen `apps/mobile/app/coach-center/[teamId]/next-sessions.tsx`.
D2. Top "Generate this week's session" hero card mirroring the web's sky
    hero: subtitle naming the team's age/coach/player levels, CTA deep-links
    to the session builder with the right params (same as Phase B2/B5).
D3. Below, list of `Recommendation` items from
    `GET /coach-center/teams/{teamId}/recommendations`. Each row: title,
    `refCode · ageGroup · duration min`, `matchReason`, and a single
    **Open** secondary CTA that pushes `/vault/session/[id]` using the
    recommendation's `href` (or the id directly if the web `href` is a web URL).

---

## Phase E — Season chat ✅ SHIPPED

**Goal**: mobile can read and post messages on the team's season chat
(where the API is `/coach-center/teams/:teamId/chat`).

E1. New screen `apps/mobile/app/coach-center/[teamId]/chat.tsx`. Mounted
    under `Stack.Screen`.
E2. Hook `useTeamChat(teamId)` backed by `GET /chat` and `POST /chat`,
    with optimistic insertion (insert the user's bubble immediately, then
    append the assistant's reply).
E3. Layout:
  - Header: "Season chat · {teamName}" with the current week theme inline.
  - Messages list — reverse-flex column, user bubbles right-aligned
    primary-tinted, assistant bubbles left-aligned `surface` cards. Long
    bubbles wrap.
  - "Thinking with this week's plan…" ActivityIndicator while awaiting
    the assistant reply.
  - Bottom composer: `TextInput` (multiline, 2 rows) + **Send** button.
    Disable when sending or empty. Use `KeyboardAvoidingView` so the
    composer stays visible.
  - Empty state: prompt card inviting the coach to ask about the team.

E4. Add `listChat` + `sendChat` wrappers to
    `apps/mobile/services/coach-center.service.ts`. Types: `role:
    'user' | 'assistant'`, `id`, `content`, `createdAt`.

E5. Add the section card on the team page (Phase B4).

---

## Phase F — Calendar visual parity

**Goal**: the existing weekly calendar becomes a proper day-grid with team
highlighting, matching the web's 7-column view.

F1. Replace `apps/mobile/app/coach-center/[teamId]/week.tsx` rendering with
  a single 7-column grid (scrollable horizontally on narrow phones, 2 rows
  of 7 on wider phones). Each column:
  - Day-of-week label + date
  - List of events, each a colored card
    - `forThisTeam: true` → primary tint, full-color title
    - `forThisTeam: false` → muted tint, "(other team)" small label
  - "Open" event cards push `/vault/session/[id]` or `/sideline/[id]`.

F2. Bottom action row (mirrors the web footer):
  - **Plan this week's session** → deep link to builder (Phase B2).
  - **Open full calendar** → `/coach-center/[teamId]/week` is itself the
    team week; this CTA should go to the global `/calendar` tab instead
    (`router.push('/(tabs)/calendar')`). Use the same `Button` row pattern.

F3. Replace the existing `formatDate` helper with the shared
    `formatMonthLabel` / `formatEventTime` from `apps/mobile/utils/format.ts`
    so day labels match the rest of the app.

---

## Phase G — Game-day rich recap (web parity)

**Goal**: match the web's `/coach-center/game-day` rich recap form
(at least the parts that fit a phone screen).

G1. Extend `GameDayItem` mobile type with the fields the web form already
    uses: `matchDate`, `kickoffTime`, `venue`, `competition`, `formation`,
    `keyFocus`, `attackingNotes`, `defendingNotes`, `setPieces`, `recap`.
    Most are already on the shared type — verify and document the deltas.

G2. Replace the single `Match recap` form with two sections:
  - **Match header** (read-only) — match date, opponent, venue, kickoff,
    competition, formation, key focus, attacking / defending / set pieces.
    One `Card` per section.
  - **Recap entry** — current `usScore` / `themScore` / `headline` /
    `summary` / `proudOf` inputs. Optional `keepBuilding`, `nextUp[]`
    list (text inputs, one per slot, plus an "Add another" button).
    Save → `PATCH /game-days/{id}` with the same payload shape the web
    sends.

G3. Match recap preview — after save, render a compact summary card above
    the form showing the saved recap (`score` headline, summary, proudOf,
    keepBuilding, nextUp). Replace the existing "Saved recap" card so it
    uses the richer shape.

G4. `Share PDF` continues to use `downloadGameDayPdf`; rename the inline
    `Share summary` to **Share recap text** to avoid confusion with the
    PDF share. Use the same `Share.share` API.

---

## Phase H — Settings polish

**Goal**: surface the new Coach Center sub-screens from Settings, like the
home grid does.

H1. In `apps/mobile/app/settings.tsx`, replace the single `Coach Center`
    row with 3 rows in a Tools section:
    - **Coach Center** — `/coach-center` (current row)
    - **Curriculum** — `/coach-center/[teamId]/curriculum`
      (uses `selectedTeamId` from `useCoachCenterStore`)
    - **Season chat** — `/coach-center/[teamId]/chat`
    - **Game days** — `/coach-center/[teamId]/game-days`
  - Each row uses the `compact` `Row` variant already in settings.

H2. Add an empty-state guard: if `selectedTeamId` is null, fall through to
    `/coach-center` and let the user pick a team first.

---

## Phase I — Team picker in the top bar (web parity)

**Goal**: when a coach has more than one team, they can switch teams from
any Coach Center screen (currently they have to back out to the root).

I1. Add a header picker component to the mobile Coach Center screens. Since
    `Tabs`/`Stack` only gives a native iOS header (no custom widget area),
    put the picker as a sticky `<View>` directly under the screen title
    on each Coach Center screen, *not* in the native header. Style: chip
    with team name + chevron, opens a `PickerSheet` (existing) listing
    all teams from `useCoachCenterStore`.

I2. Show only when `teams.length > 1`. Otherwise render a static
    `<Text>` of the team name (still searchable context for the
    "All teams" admin flag, surfaced as a small amber `Badge` next to
    the name — same as the web top bar).

I3. Hide the picker on the Coach Center root (it already shows the team
    list, so the picker would be redundant).

I4. Make sure the `setSelectedTeamId` store action already exists and is
    persisted via `persist` middleware. Reuse it.

---

## Phase J — Pull-to-refresh + offline cache

**Goal**: Coach Center is usable on the field with poor connectivity
(sideline, between pitches).

J1. The existing screens already call `useQuery` with
    `RefreshControl`; verify the cache keys are stable and add
    `placeholderData: keepPreviousData` on the team overview + week + game-day
    list queries so a refetch doesn't blank the screen.

J2. Add `staleTime: 60_000` to the chat query (so swapping screens doesn't
    hit the API again). Bump to `5 * 60_000` on the season weeks payload
    (it changes only once a week).

J3. Errors already show `ErrorMessage` — confirm each screen has a
    `Retry` secondary action (`Button title="Retry"` calls
    `query.refetch()`).

J4. Add a small offline banner under the screen title when `isOnline` is
    false (reuse the existing `NetworkBanner` plumbing).

---

## Effort & PR breakdown

| Phase | Description | Effort | PRs |
|---|---|---|---|
| A | Shared types | XS | 1 |
| B | Team overview hero + KPI grid + section cards | S | 1 |
| C | Curriculum screen | M | 1–2 |
| D | Next sessions screen | S | 1 |
| E | Season chat screen | M | 1–2 |
| F | Calendar day-grid + footer | S | 1 |
| G | Game-day rich recap | M | 1 |
| H | Settings polish | XS | 1 |
| I | Team picker in top bar | S | 1 |
| J | Pull-to-refresh / offline polish | XS | 1 |

Total: **~9–11 PRs**, grouped by feature. Phases A, H, I, J can land in any
order once B is done; C/D/E/F/G are independent features and can ship in
parallel.

---

## Risks & open questions

1. **Server response shapes.** Several phases assume the API returns
   `season.weeks` in `overview` and chat supports `keepBuilding` /
   `nextUp[]`. Verify in `apps/api/src/services/coach-center.ts` before
   coding the mobile side — if any field is missing, either widen the
   API or skip the dependent sub-section.
2. **Chat scope.** Today the chat is per-team and stores messages but no
   thread concept. Don't try to introduce threads on mobile without a
   matching web change.
3. **Curriculum knowledge card.** Verify `WeekKnowledge.knowledge` is in
   the serialized team payload. The web reads it from `serializeTeam`'s
   output — confirm it lands on the mobile too.
4. **Generate deep link.** The `generateHref` on web encodes multiple
   params (age, coach, player, phase, zone, topic, teamName). The mobile
   Generate form accepts search params for some of these — verify which
   ones are read today and add the rest before Phase B2 ships.
5. **Team picker in mobile Coach Center.** A team picker rendered per
   screen is heavier than the web's single top bar. Consider putting it
   only on the team detail / curriculum / chat / next-sessions screens
   (not on week + game days, which already know the team via `teamId`).

---

## Definition of done

- Each Coach Center mobile screen has a working back chevron + in-page
  back link (mirrors the Vault session fix from `f82834d`).
- All 7 new mobile screens are reachable from the Quick Action grid OR
  the Settings page.
- Every screen respects `useAuth` → `features` gates (e.g., chat behind
  `canChat` if such a feature flag exists; otherwise just behind auth).
- Pull-to-refresh works on every list screen.
- TypeScript is clean, web parity report updated (`docs/GENERATE_PARITY_REPORT.md`
  gets a sibling `docs/COACH_CENTER_PARITY_REPORT.md`).
- Each phase lands as its own commit + push.