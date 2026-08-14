# DOC Hub: Cursor Handoff

> Snapshot date: 2026-08-11
> Repository: `coachAI-CEO/ACI`
> Working branch: `codex/diagram-v2`
> Base branch: `main`
> HEAD at handoff: `af24891` (`Add Club/Section/ClubMembership schema for DOC Hub (Phase 0)`)
> Working tree: clean except `.DS_Store` and this file (both harmless, no need to touch).

This document picks up a feature build in progress. Read it before touching `Club`/`Section`/`ClubMembership`/`CalendarEvent`/`AccessPermission` or anything under `/doc-hub`.

There is also a separate, broader (and now partially stale) `CLAUDE_HANDOVER.md` at the repo root from an earlier snapshot (2026-08-07). It still flags one **unresolved P0**: `apps/api/.env.example` contains live-format credentials (a real Gemini key, real Postgres connection strings). Do not print, copy, or commit those values anywhere. That issue is orthogonal to DOC Hub and hasn't been addressed — flag it to the owner if it hasn't already been actioned.

## 1. Product vision (why this feature exists)

In the owner's own words: the platform's daily driver for coaches is generating sessions/series and scheduling them. Above the coach sits their "boss" — a **DOC (Director of Coaching)** who owns the club's playing philosophy and can see what every coach is working on. Some clubs also have **middle management** (e.g. an age-group director overseeing a subset of coaches) — this varies by club, so the model must not assume a fixed two-level hierarchy. When a coach covers for a colleague, the session should already be on their calendar, placed there via an **explicit reassignment** by a manager (not silent shared-visibility).

A club runs **exactly one game model** — so game-model choice is club-level, not a per-session picker. Session generation should inherit the club's model automatically once a coach has a `ClubMembership`.

A later, explicitly deferred phase: individual player-level sessions (personalized off the team session) and a parent-facing view of upcoming development. Nothing built so far should assume "one session, one audience" in a way that forecloses this — but do not build toward it yet, it's out of scope for this round.

## 2. What's already true about the codebase (confirmed by direct research, not assumption)

- `apps/web/src/app/doc-hub/page.tsx` (424 lines) is a **100% static mock** — hardcoded arrays, no `fetch`, no state, every button a no-op. Treat it as a UI spec, not working code.
- **The `/doc-hub` nav item is visible to every logged-in user regardless of role today** (`AppHeader.tsx`, `app/app/page.tsx`), mislabeled as "Training docs & guides." Harmless right now because there's nothing behind it — **this must be role-gated before any real club data flows through the route.**
- `coachLevel` is a vocabulary dial, not a difficulty gate, and is writable by three uncoordinated actors with no audit trail: the coach themself (`PATCH /auth/me`), a platform admin, and a `CLUB`-role org owner via `inviteCoach()`.
- `teamAgeGroups` on `User` is a free-form display field — it gates nothing. The real access gate is the unrelated `AccessPermission.ageGroups`.
- `AccessPermission` **defaults to allow-all when no rows exist for a scope.** A DOC "restricting" a coach will silently do nothing until a row actually exists. Design the DOC-facing permission UI around this explicitly — don't let it look broken.
- There was, before this session's Phase 0 work, **no hierarchy concept anywhere** (no `managerId`, `parentId`, `section`, nothing) and **no real `Club` Prisma model** — clubs lived in a hand-rolled raw-SQL table (`apps/api/src/services/clubs-store.ts`), outside migration history. One real club exists in the database: **Rocklin FC** (`game_model_id = ROCKLIN_FC`).
- `prompts/session.ts`'s `getSessionGameModelGuidance()` hardcodes Rocklin FC's actual philosophy as an if-branch — proof of the pattern to replace, not something to keep long-term.

## 3. Decisions already made (do not re-litigate these without the owner)

1. **Hierarchy is a join table, not a role enum.** `ClubMembership { userId, clubId, sectionId?, role: DOC | SECTION_DIRECTOR | COACH }`, with `Section` optional per club. This lets a club skip middle management entirely (`sectionId: null`) or use it, without a schema change either way.
2. **One game model per club.** Lives on `Club`, not per-session. Session generation will derive it from the coach's `ClubMembership → Club`, replacing the free per-session `gameModelId` picker for club-affiliated coaches.
3. **Coverage/reassignment is explicit**, not shared visibility. A DOC or Section Director must formally reassign a `CalendarEvent` to a substitute coach — implemented as an audit trail on the event itself (see §4), not a separate approval workflow table.
4. **Player/parent personalization is out of scope for this phase.** Don't design session/drill data around it yet, just don't foreclose it.

## 4. What's done: Phase 0 schema (commit `af24891`)

All of this is live in the dev database (`db.tszflbpomcvknnnjxbms.supabase.co`) and verified — not just written to `schema.prisma`.

- **`Club`** — brought the pre-existing raw-SQL `clubs` table under Prisma management via `@@map("clubs")`. Added the DOC's "Club DNA" fields: `philosophyAttackingOrganization`, `philosophyDefensiveTransition`, `philosophyDefensiveOrganization`, `philosophyAttackingTransition`, plus `philosophyUpdatedAt`/`philosophyUpdatedBy`. `gameModelId` changed from raw `TEXT` to the real `GameModelId` enum (see §5 for how this was done safely).
- **`Section`** (new table) — `{ id, clubId, name }`, unique on `(clubId, name)`.
- **`ClubMembership`** (new table) — `{ id, userId, clubId, sectionId?, role: ClubRole }`, unique on `(userId, clubId)`.
- **`ClubRole`** enum — `DOC | SECTION_DIRECTOR | COACH`.
- **`CalendarEvent`** extended with `originalCoachId`, `assignedByUserId`, `reassignedBy`, `reassignedAt` — all nullable, so every existing row stays valid with no backfill. `userId` remains the current owner/executor field that every existing query already filters on; reassignment only ever changes `userId` plus these audit fields.
- **`AccessPermission`** extended with `createdByUserId` (real FK to `User`, replacing the unused `createdBy` string for new code) and `clubId` (scoping FK to `Club`).

Two migrations, applied in order:
1. `20260810080000_baseline_existing_clubs_table` — a no-op baseline (`CREATE TABLE IF NOT EXISTS` guards that never actually fire), marked applied via `prisma migrate resolve --applied` **without running it**, purely to reconcile Prisma's migration history with the table that already existed in the real database.
2. `20260811011320_doc_hub_club_hierarchy` — the real additive migration. Hand-edited from Prisma's auto-generated version to fix a destructive default: Prisma wanted to `DROP COLUMN game_model_id` + `ADD COLUMN` (would have destroyed the real Rocklin FC row's value) instead of casting in place. Replaced with `ALTER COLUMN "game_model_id" TYPE "GameModelId" USING ("game_model_id"::"GameModelId")`. Also hand-added `@@unique(map: "clubs_name_unique_idx")` / `@@index(map: "clubs_active_idx")` to the `Club` model so the migration didn't drop and recreate those two pre-existing indexes under new names.

**Verified**: `Rocklin FC`'s row was queried before and after the migration — `game_model_id` correctly became a real enum value, name/active/id all intact.

## 5. A safety pattern worth knowing before touching this schema again

Running `prisma migrate dev` against this database for the `Club`-related change initially produced:

```
Drift detected: Your database schema is not in sync with your migration history.
...
We need to reset the "public" schema at "db.tszflbpomcvknnnjxbms.supabase.co:5432"
You may use prisma migrate reset to drop the development database. All data will be lost.
```

**This is because the `clubs` table was created by raw SQL, entirely outside Prisma's migration history — not an actual DB problem.** Do **not** run `prisma migrate reset` here. It would drop the real `public` schema on what is a real Supabase database (this project runs live traffic, not a disposable sandbox). If you hit this again for any other hand-rolled-table reconciliation, use the baseline pattern from migration #1 above: write a migration matching the table's real current shape, `prisma migrate resolve --applied` it without running it, *then* generate your real additive migration.

Also: the Prisma CLI does not pick up this repo's `.env` loading convention automatically (`DIRECT_URL not found` unless you load it). A quick wrapper (delete after use, it's not meant to be committed):

```js
// _tmp_prisma_run.js, run from apps/api/
require('dotenv').config({ path: '../../.env' });
const { spawnSync } = require('child_process');
const r = spawnSync('npx', ['prisma', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
process.exit(r.status);
```

## 6. What's NOT done yet

### Phase 0 (finish the foundation)
- **Backfill migration**: create a `Club` row + `ClubMembership` rows from the existing `organizationName`-based orgs (there's at least the Rocklin FC one, likely others under the flat `organizationName` string-matching in `services/organization.ts`). Keep `organizationName` as a read-only mirror during the transition — don't rip it out in the same change.
- **New auth middleware**: `requireClubRole('DOC' | 'SECTION_DIRECTOR', scope)`, separate from `requireAdmin` (which stays `SUPER_ADMIN`-only per the existing admin system — do not conflate the two).
- **Fix the `/doc-hub` nav item and route gating** before any real endpoint is wired behind it.

### Phase 1 — steer the game model
- Club philosophy read/write endpoint.
- Thread the club's philosophy into `SessionPromptInput` → `buildSessionPrompt` → `getSessionGameModelGuidance` (replacing the hardcoded Rocklin FC if-branch with real club-authored data, generalized to any club).
- Auto-derive `gameModelId` from the coach's `ClubMembership → Club` instead of a free picker, for club-affiliated coaches.

### Phase 2 — view coaches' sessions/calendars/trends
- Club/section-scoped analytics endpoints, adapted from the existing (global, `SUPER_ADMIN`-gated) `ApiMetrics`/`DailyMetrics`/`QAReport` aggregation queries in `routes-admin.ts`, filtered through `ClubMembership`.
- Wire the DOC Hub's Coach Usage Snapshot and Weekly Calendar sections to real data.

### Phase 3 — assign/allocate sessions
- Reassignment endpoint using the new `CalendarEvent` fields, authorized by walking the `ClubMembership` chain (requester must actually manage both the original and substitute coach).
- Wire "Add to Coach" / "Auto Populate Week."

### Phase 4 — deferred, no schema exists at all
- Director Alerts, AI Agent Monitoring, Topic Discussion Board. Treat as new product surface, separate scoping conversation.

### Phase 5 — explicitly deferred by the owner
- Individual player-level sessions personalized off the coach's team session, and a parent-facing view of upcoming development. Don't build toward this yet.

## 7. Known risks to design around on purpose (not accidentally)

1. `AccessPermission` default-allow-when-empty (see §2) — a DOC's restriction needs an explicit seeded row, or it'll look like a no-op.
2. `coachLevel`'s three uncoordinated writers — once a DOC has real authority here, route DOC-driven changes through the same authorized/audited path as calendar reassignment, not the old free-for-all `inviteCoach()` write.
3. `organizationName` string-matching is still load-bearing in `routes-organization.ts` and `access-permissions.ts` — don't remove it until `ClubMembership` fully replaces its call sites, and do that as its own reviewed change.

## 8. Verification before/after any further schema work

```bash
cd apps/api
pnpm exec tsc --noEmit -p tsconfig.json
```

Should be clean (was clean as of `af24891`). For any live-DB check, use the dotenv wrapper pattern in §5 — do not assume `npx prisma <cmd>` works standalone in this repo.

## 9. Files most relevant to continuing this

- `apps/api/prisma/schema.prisma` — `Club`, `Section`, `ClubMembership`, `ClubRole`, extended `CalendarEvent`/`AccessPermission`.
- `apps/api/prisma/migrations/20260810080000_baseline_existing_clubs_table/` and `20260811011320_doc_hub_club_hierarchy/`.
- `apps/api/src/services/clubs-store.ts` — old raw-SQL club access; migrate call sites onto Prisma `Club` as part of the backfill work, don't leave both alive long-term.
- `apps/api/src/services/organization.ts`, `apps/api/src/routes-organization.ts` — current flat org model, to be reconciled with `ClubMembership`.
- `apps/api/src/services/access-permissions.ts`, `apps/api/src/middleware/admin-auth.ts` — existing permission engine and admin auth pattern to mirror for the new DOC-scoped middleware.
- `apps/api/src/prompts/session.ts` (`getSessionGameModelGuidance`, `SessionPromptInput`) — where club philosophy needs to get threaded in.
- `apps/api/src/routes-admin.ts` (`CLUB_GAME_MODELS`, `/admin/clubs*`) — current SUPER_ADMIN-only club CRUD, reference for query patterns.
- `apps/web/src/app/doc-hub/page.tsx` — the static mock to build the real page against.
- `apps/web/src/components/AppHeader.tsx`, `apps/web/src/app/app/page.tsx` — where the nav-gating fix needs to land.
