# Future Work

Things identified during the game-model build that are real, worth doing, and
deliberately not started yet — noted here instead of built on top of an
already-substantial pile of unvalidated infrastructure.

## Player-level ability ladder

Today, readiness (`FOUNDATIONAL` / `DEVELOPING` / `ADVANCED`) and
`TrainingPriority` are both scoped to `Team`, not to individual players.
That's a real limitation: within one U13 team, some players are individually
ready for DEVELOPING-tier concepts while teammates aren't, and nothing in the
current model captures that variance.

**What this would need** (there is no `Player` entity in the product today —
`Team`'s own code comment says "roster later"; `PlayerPlan` is a solo-practice
plan owned by a `User`, not a rostered player):

- A real `Player` entity, rostered to a `Team`
- A per-player analog to `TrainingPriority` — which specific subprinciples
  *this player* has shown consistently vs. rarely, not just what the team as
  a whole worked on
- A per-player readiness signal, independent of the team's default ceiling

**Why it matters:** this is what would let a DOC ask "which specific kids
have actually absorbed this" instead of just "is my staff teaching this" —
the natural next layer once team-level tracking (which now exists) is
validated.

**Why it's not started:** it's a genuinely new layer (new entity, new
tracking mechanism), not a small extension of what exists. Scope it after
the current team-level build has been validated with a real coach/director,
not before.
