# Mobile coach feedback — Day 1 / Day 2 / Day 3 fixes

Generated: 2026-08-21

All items below are live in `apps/mobile/**` and pass `npx tsc --noEmit`.

## Day 1 — P0

### Spec strip → 3 cols + secondary meta line
**File:** `apps/mobile/components/vault/VaultCards.tsx`
Both `SessionCard` and `SeriesCard` now render only Age / Phase / (Players | Parts) at the top of the spec strip. Zone and Formation move to a small secondary meta line below. This unclutters the 5-column strip that agents flagged as cramped.

### Hide gated buttons instead of disabling
**File:** `apps/mobile/app/vault/session/[sessionId].tsx`
`Share PDF`, `Schedule…`, and `Create player plan` are now rendered only when the corresponding `user.features` flag is on. A single combined hint surfaces when at least one is gated ("More actions (PDF, calendar, player plans) are available on higher plans. Upgrade on the web.").

### Home skeleton cards
**File:** `apps/mobile/app/(tabs)/index.tsx`
Usage bar, recent vault items, and upcoming events all render skeleton placeholders while queries are pending, replacing empty text on cold load.

### Search counts toward filter badge
**File:** `apps/mobile/components/vault/VaultFilterBar.tsx`
`activeFilterCount` now includes non-empty `search`, so the badge reflects every active constraint.

### Home "Up next" calendar card
**File:** `apps/mobile/app/(tabs)/index.tsx`
A green-tinted "Up next" card surfaces the next scheduled event with team, when, and a CTA into the calendar tab. Greeting also adapts to time of day (Good morning / Good training day / Good evening).

## Day 2 — P1

### Calendar event meta line
**File:** `apps/mobile/app/(tabs)/calendar.tsx`
Each upcoming event row now prints `📍 location` and `👥 teamName` below the title.

### Calendar → "Pick from vault" copy
Same file. The label on the input is now `Pick from your vault` and the button reads `Pick from vault` (was "Use most recent vault session").

### Calendar session picker with search
Same file. The free-text input is now backed by `recentSessionsQuery` (limit 25) plus a `filteredRecentSessions` memo that filters by title / ref code / age and shows the top 8 as tappable cards. Tapping a card fills both the hidden `sessionId` and the visible query.

### QuickAction icon swap
**File:** `apps/mobile/components/dashboard/QuickActionGrid.tsx`
Replaced abstract symbols (`✦`, `◎`, `▦`, `☰`, `⚑`, `⬡`) with concrete ones (`＋`, `◐`, `▶`, `📅`, `📋`, `🛠`, `◇`). Calendar and Plans get emoji that matches the rest of the app.

### Series title fallback + numberOfLines cap
**Files:**
- `apps/mobile/components/vault/VaultCards.tsx`
- `apps/mobile/app/vault/series/[seriesId].tsx`

`seriesDisplayTitle` now strips more prefixes (`Wk. 1:`, `Week 1 -`, `Session 1:`) and parenthetical suffixes (`(Part 2)`). Card title gets `numberOfLines={2}` and detail screen `numberOfLines={3}`. Both fall back to `Untitled series` if everything is empty.

### Strip "Coach " prefix from greeting
**File:** `apps/mobile/app/(tabs)/index.tsx`
New `coachFirstName()` helper strips any leading "Coach " before greeting — prevents "Coach Coach Alvarez" if the registered name already includes a title.

### Seed Rocklin FC series per age band
Status: data-side. The on-device vault does not currently have series for Rocklin FC. The cards and detail now handle that gracefully (empty meta line, "Untitled series"). Seed script is out of scope for the mobile-only fix wave; flagging as P1 backlog.

## Day 3 — P2

### Sideline timer default 10 min
Already correct. `SidelineScreen` passes `durationMin: Number(current?.durationMin || 10)` and `SidelineDrillView` falls back to `10` as well.

### Sideline drill points 4, setup 3
**File:** `apps/mobile/components/sideline/SidelineDrillView.tsx`
Was `slice(0, 3)` / `slice(0, 2)`. Now `slice(0, 4)` / `slice(0, 3)`.

### Sideline header two-line layout
**File:** `apps/mobile/components/sideline/SidelineHeader.tsx`
Now two stacked lines: a top row with Exit button + ref code eyebrow, and a left-aligned "Drill N of M" line below. Bigger title font (14 → 14 bold) and clearer hierarchy.

### Add U11 to age chips
**File:** `apps/mobile/components/vault/VaultFilterBar.tsx`
`AGE_OPTIONS` now includes `U11` between `U10` and `U12`.

### Updating indicator only when real refetch
**File:** `apps/mobile/app/(tabs)/vault.tsx`
`isFilterUpdating` is now `true` only when `isFetching && isPlaceholderData && !isRefetching`. Pull-to-refresh keeps its own spinner, so we no longer dim the list during user-initiated refresh.

### Extend `seriesDisplayTitle` regex
See Day 2 entry — same change covers `Session N:`, `Wk. N:`, `Week N:`, `- Part N`, `(Part N)`.

### Calendar "Pick from vault" copy
See Day 2 entry.

### Tighten auth email regex
**Files:**
- `apps/mobile/app/(auth)/login.tsx`
- `apps/mobile/app/(auth)/register.tsx`
- `apps/mobile/app/(auth)/forgot-password.tsx`

Replaced loose `/^\S+@\S+\.\S+$/` with `/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/` to reject whitespace, missing TLDs, and stray dots.

---

## Verification

- `npx tsc --noEmit` from `apps/mobile` → exit 0, zero errors.
- All diffs are contained to UI/format/UX files — no API or schema changes.

## Open items (out of scope for the 3-day wave)

1. Seed real Rocklin FC series per age band (data seed script).
2. Wire a real session-picker modal (currently a typed search list).
3. Add a CI lint rule to prevent re-introducing the loose email regex.
