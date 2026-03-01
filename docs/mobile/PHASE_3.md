# Phase 3 — Vault, Favorites & Search

> **Duration:** Week 6–7
> **Goal:** Full vault browser with sessions, drills, and series. Search and filter. Favorites management. Ref-code lookup. Drill extraction from sessions.

---

## Deliverables

- [ ] Vault tab with three sub-tabs: Sessions / Series / Drills
- [ ] Session list with filter bar
- [ ] Series list with sessions grouped
- [ ] Drill list
- [ ] Search by keyword, ref code, age group, game model, phase, zone
- [ ] Favorites page (bookmarks across all content types)
- [ ] Session detail view from vault (same as Phase 2 result, but from DB)
- [ ] Series detail view (list of sessions with progression info)
- [ ] Ref code lookup by manual entry or copy-paste
- [ ] Pull-to-refresh + infinite scroll pagination
- [ ] Drill extraction from vault session
- [ ] Similar sessions suggestion

---

## File Structure for This Phase

```
app/
└── (tabs)/
    └── vault.tsx                 Tab entry with sub-tabs

app/
└── vault/
    ├── session/
    │   └── [sessionId].tsx       Session detail (reuses Phase 2 components)
    ├── series/
    │   └── [seriesId].tsx        Series overview
    ├── drill/
    │   └── [drillId].tsx         Drill detail (reuses Phase 2 DrillTabView)
    └── favorites.tsx             Favorites screen

components/
├── vault/
│   ├── VaultSubTabs.tsx          Sessions / Series / Drills switcher
│   ├── SessionCard.tsx           Session list item card
│   ├── SeriesCard.tsx            Series list item card
│   ├── DrillCard.tsx             Drill list item card
│   ├── VaultFilterBar.tsx        Horizontal scrollable filter chips
│   ├── VaultSearchBar.tsx        Search input with debounce
│   ├── VaultEmptyState.tsx       Empty state with CTA
│   ├── RefCodeLookup.tsx         Manual ref code entry
│   ├── SimilarSessionsSheet.tsx  Bottom sheet with similar sessions
│   └── FavoriteStar.tsx          Star icon toggle (reusable)

services/
├── vault.service.ts              sessions, series, drills CRUD + search
└── favorites.service.ts          get, add, remove, check

hooks/
├── useVault.ts                   Paginated vault queries
├── useVaultSearch.ts             Debounced search with filters
├── useFavorites.ts               Favorites state + mutations
└── useRefCodeLookup.ts           Lookup single item by code
```

---

## Screen Specifications

### Vault Tab (`app/(tabs)/vault.tsx`)

#### Sub-tabs
```
[Sessions]  [Series]  [Drills]
```

Each sub-tab maintains its own scroll position and filter state independently. State stored in `vault.store.ts`.

#### Filter Bar (all sub-tabs share same filter chips)
```
Horizontal scroll:
[All Ages ▾]  [All Models ▾]  [All Phases ▾]  [All Zones ▾]  [Saved ♥]
```

Each chip opens a bottom sheet with options. Active filters shown with filled/colored chip.

#### Search Bar
```
[🔍 Search sessions, ref codes...]
```
Debounced 400ms. Calls `POST /vault/sessions/search` with search term + active filters.

#### Ref Code Button
Top-right corner: `[D-S-SR]` icon → opens `RefCodeLookup` modal where user can type/paste any ref code to jump directly to that item.

---

### Sessions Sub-tab

**List item card:**
```
┌──────────────────────────────────┐
│  S-M9V4                    [❤️] │
│  U14 Boys · Pressing · 60 min   │
│  Mid 3rd · Intermediate         │
│                                  │
│  [Compactness] [High Press]      │  ← SkillFocus tags (max 3 shown)
│                                  │
│  Jan 15, 2026         [📄] [📅] │  ← date, PDF, schedule quick actions
└──────────────────────────────────┘
```

- Tap card body → session detail
- Tap ❤️ → toggle favorite (optimistic update)
- Tap 📄 → export PDF
- Tap 📅 → quick schedule (opens date picker)

**Pagination:** Load 20 per page. "Load more" button at bottom (not infinite auto-scroll — prevents accidental trigger). Show total count: "Showing 20 of 47 sessions".

**Empty state:**
```
┌──────────────────────────────────┐
│         [icon: clipboard]        │
│                                  │
│  No sessions in your vault yet   │
│                                  │
│  [⚡ Generate your first session]│
└──────────────────────────────────┘
```

**Filtered empty state:**
```
No sessions match your filters.
[Clear filters]
```

---

### Series Sub-tab

**Series card:**
```
┌──────────────────────────────────┐
│  SR-K9P2                   [❤️] │
│  U12 Possession                  │
│  4 sessions · 1 per week         │
│                                  │
│  Session 1 of 4    S-A1B2        │
│  Session 2 of 4    S-C3D4        │
│  Session 3 of 4    S-E5F6        │
│  Session 4 of 4    S-G7H8        │
│                                  │
│  Created Jan 10, 2026            │
└──────────────────────────────────┘
```

Tap card → `app/vault/series/[seriesId].tsx`

**Series Detail screen:**
```
SR-K9P2
U12 Boys · Possession
4 Sessions · Weekly Progression
─────────────────────────────────
Week 1  →  S-A1B2  [Open]
Week 2  →  S-C3D4  [Open]
Week 3  →  S-E5F6  [Open]
Week 4  →  S-G7H8  [Open]
─────────────────────────────────
[📄 Export All PDFs]  [📅 Schedule Series]
[Similar Series →]
```

---

### Drills Sub-tab

**Drill card:**
```
┌──────────────────────────────────┐
│  D-A7K2                    [❤️] │
│  Rondos 4v2                      │
│  Technical · Attacking · Mid 3rd │
│  15 min · 6–8 players            │
│                                  │
│  U14 Boys · Intermediate         │
└──────────────────────────────────┘
```

Tap → drill detail (Phase 2 `DrillTabView`).

---

### Favorites Screen (`app/vault/favorites.tsx`)

Accessible from the vault filter bar OR from the profile icon menu.

Three sub-tabs: **Sessions** / **Series** / **Drills**

Same card layout as vault sub-tabs, but sourced from `GET /favorites`.

```
Favorites (12)
─────────────────────────────────
[Sessions (8)]  [Series (2)]  [Drills (2)]
─────────────────────────────────
[session cards...]
```

Unfavoriting from this screen removes from list with animation. Uses `useFavorites` hook with optimistic updates.

---

### Ref Code Lookup (`RefCodeLookup` modal)

Bottom sheet modal:

```
┌──────────────────────────────────┐
│  Look up by Code            [✕] │
│──────────────────────────────────│
│  [D-  /  S-  /  SR-  /  VA-]    │  ← prefix selector
│                                  │
│  Code: [  A7K2  ]               │  ← just the suffix, 4 chars
│                                  │
│  [Look Up →]                     │
│──────────────────────────────────│
│  Or paste full code:             │
│  [S-M9V4               ] [Go]   │
└──────────────────────────────────┘
```

**API:** `GET /vault/lookup/:refCode`

On success → dismiss modal and navigate to correct detail screen.

On not found → inline error "No item found with code S-XXXX".

---

## API Calls in This Phase

| Action | Method | Endpoint |
|---|---|---|
| List sessions | GET | `/vault/sessions` |
| Search sessions | POST | `/vault/sessions/search` |
| Get session | GET | `/vault/sessions/:sessionId` |
| List series | GET | `/vault/series` |
| Get series | GET | `/vault/series/:seriesId` |
| Lookup by ref code | GET | `/vault/lookup/:refCode` |
| Get favorites | GET | `/favorites` |
| Favorite session | POST | `/favorites/session/:id` |
| Unfavorite session | DELETE | `/favorites/session/:id` |
| Favorite drill | POST | `/favorites/drill/:id` |
| Unfavorite drill | DELETE | `/favorites/drill/:id` |
| Favorite series | POST | `/favorites/series/:id` |
| Unfavorite series | DELETE | `/favorites/series/:id` |
| Check favorite status | POST | `/favorites/check` |
| Similar sessions | POST | `/vault/sessions/similar` |
| Orphaned sessions | GET | `/vault/orphaned-sessions` |

---

## Testing Scenarios — Phase 3

### VAULT-001: Sessions List Loads

```
Steps:
1. Navigate to Vault tab → Sessions sub-tab
2. Assert: GET /vault/sessions called
3. Assert: session cards rendered with correct data
4. Assert: each card shows: ref code, age group, model, duration, date
5. Assert: skill focus tags shown (max 3)

API mock: GET /vault/sessions → [20 sessions with full metadata]
```

---

### VAULT-002: Filter by Age Group

```
Steps:
1. Open Vault → Sessions
2. Tap [All Ages ▾] filter chip
3. Assert: bottom sheet opens with age group list
4. Select U14
5. Assert: bottom sheet closes, chip updates to [U14 ▾]
6. Assert: POST /vault/sessions/search called with { ageGroup: "U14_BOYS" }
7. Assert: list updates to show only U14 sessions

API mock: POST /vault/sessions/search → filtered results
```

---

### VAULT-003: Multiple Filters Combined

```
Steps:
1. Set filter: Age=U14, Model=Pressing
2. Assert: API called with { ageGroup: "U14_BOYS", gameModelId: "PRESSING" }
3. Assert: both chips show active state (filled/colored)
4. Tap [Clear all filters]
5. Assert: all chips reset to "All"
6. Assert: full list reloaded
```

---

### VAULT-004: Search by Keyword

```
Steps:
1. Tap search bar
2. Type "rondos" (debounced 400ms)
3. Assert: after 400ms, POST /vault/sessions/search called with { query: "rondos" }
4. Assert: results update
5. Clear search
6. Assert: full list restored

API mock: POST /vault/sessions/search → sessions containing "rondos"
```

---

### VAULT-005: Search by Ref Code

```
Steps:
1. Type "S-M9V4" in search bar
2. Assert: API called with { query: "S-M9V4" }
3. Assert: exact session shown
4. Alternatively: tap ref code icon → type S-M9V4 in lookup modal
5. Assert: GET /vault/lookup/S-M9V4 called
6. Assert: navigated directly to session detail

API mock: GET /vault/lookup/S-M9V4 → session object
```

---

### VAULT-006: Load More Pagination

```
Steps:
1. Vault shows 20 sessions (total: 47)
2. Assert: "Showing 20 of 47 sessions" shown
3. Scroll to bottom → tap [Load 20 more]
4. Assert: GET /vault/sessions?page=2 called
5. Assert: 20 more sessions appended
6. Assert: "Showing 40 of 47 sessions"
7. Tap [Load 7 more]
8. Assert: all 47 shown, no "Load more" button visible
```

---

### VAULT-007: Empty Vault State

```
Steps:
1. Login as new user with no vault sessions
2. Navigate to Vault → Sessions
3. Assert: empty state shown with icon and message
4. Assert: [Generate your first session] button shown
5. Tap button → Assert: navigates to Generate tab

API mock: GET /vault/sessions → { data: [], total: 0 }
```

---

### VAULT-008: Pull to Refresh

```
Steps:
1. Load vault sessions list
2. Pull down to trigger refresh gesture
3. Assert: loading indicator shown
4. Assert: GET /vault/sessions called again
5. Assert: list updates with fresh data
```

---

### FAV-001: Favorite a Session from List

```
Steps:
1. View session list with unfavorited sessions (heart outline)
2. Tap heart on session card
3. Assert: heart fills immediately (optimistic update)
4. Assert: POST /favorites/session/:id called
5. Assert: success (no error toast)
6. Navigate to Favorites tab
7. Assert: session appears in Favorites → Sessions

API mock: POST /favorites/session/:id → 201
```

---

### FAV-002: Unfavorite a Session

```
Steps:
1. View session list with favorited session (heart filled)
2. Tap heart
3. Assert: heart empties immediately (optimistic update)
4. Assert: DELETE /favorites/session/:id called
5. Navigate to Favorites → Sessions
6. Assert: session no longer listed

API mock: DELETE /favorites/session/:id → 200
```

---

### FAV-003: Optimistic Update Rollback on Error

```
Steps:
1. View unfavorited session
2. Tap heart → heart fills (optimistic)
3. Mock: API returns 500
4. Assert: heart reverts to empty
5. Assert: error toast "Failed to save favorite. Try again."

API mock: POST /favorites/session/:id → 500
```

---

### FAV-004: Favorites Screen Sub-tabs

```
Steps:
1. Navigate to Vault → Favorites
2. Assert: three sub-tabs: Sessions (8) / Series (2) / Drills (2)
3. Assert: counts shown in tab labels
4. Each sub-tab shows correct content type
5. Unfavorite from favorites screen → item animates out of list

API mock: GET /favorites → { sessions: [...8], series: [...2], drills: [...2] }
```

---

### LOOKUP-001: Ref Code Lookup — Session Found

```
Steps:
1. Tap ref code icon (top-right of Vault)
2. Lookup modal opens
3. Select prefix [S-], type suffix "M9V4"
4. Tap [Look Up]
5. Assert: GET /vault/lookup/S-M9V4 called
6. Assert: modal closes
7. Assert: navigated to session detail for S-M9V4

API mock: GET /vault/lookup/S-M9V4 → session object
```

---

### LOOKUP-002: Ref Code Lookup — Not Found

```
Steps:
1. Open ref code lookup
2. Enter S-ZZZZ
3. Tap [Look Up]
4. Assert: inline error "No item found with code S-ZZZZ"
5. Assert: modal stays open (user can try again)

API mock: GET /vault/lookup/S-ZZZZ → 404
```

---

### LOOKUP-003: Paste Full Code

```
Steps:
1. Open ref code lookup
2. Paste "SR-K9P2" into full code input
3. Tap [Go]
4. Assert: GET /vault/lookup/SR-K9P2 called
5. Assert: navigated to series detail for SR-K9P2

API mock: GET /vault/lookup/SR-K9P2 → series object
```

---

### SERIES-001: Series Detail View

```
Steps:
1. Navigate to Vault → Series sub-tab
2. Tap a series card (SR-K9P2, 4 sessions)
3. Assert: series detail screen shows 4 session rows
4. Assert: each row shows session number, ref code
5. Tap [Open] on Session 2
6. Assert: navigated to session detail for that session
7. Back navigation returns to series detail

API mock: GET /vault/series/SR-K9P2 → series with sessions array
```

---

## Acceptance Criteria for Phase 3

- [ ] Vault loads sessions, series, drills from API
- [ ] Filter chips work independently and in combination
- [ ] Filter state persists across tab navigation
- [ ] Search debounces 400ms before API call
- [ ] Ref code search finds item directly
- [ ] Ref code lookup modal works with prefix selector and paste
- [ ] Pagination loads 20 at a time with explicit "Load more"
- [ ] Empty state shown with generate CTA when vault is empty
- [ ] Filtered empty state shown with "Clear filters" option
- [ ] Pull-to-refresh works on all sub-tabs
- [ ] Favorites toggle works with optimistic update from list view
- [ ] Optimistic update rolls back correctly on API error
- [ ] Favorites screen shows correct counts in tab labels
- [ ] Unfavoriting from favorites screen removes item from list with animation
- [ ] Series detail shows all sessions with navigation to each
- [ ] Session detail from vault reuses all Phase 2 components
- [ ] Save/unsave works correctly when viewing from vault (already-saved state shown)
