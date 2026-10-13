# Game Model Authoring Template

Fill this out for **one game model** (pick the one you know best, or the one you'd
demo first). Don't try to do all five existing `GameModelId` values — one, done
deep, is the entire point of the pilot.

Target scope for one game model: **4 moments × 2-4 principles × 2-3
subprinciples each ≈ 20-40 entries total.** That's the size that took a
director-level conversation a few hours to produce in the worked example — treat
that as the right amount of time to spend, not a form you fill in five minutes.

---

## Game model name

`________________________` (e.g. "Rocklin FC First Team" — this becomes the
`gameModelId` or a club-scoped override of one)

## One-sentence identity

The game-idea-level statement — what you'd say to a parent or a new coach in one
breath. (e.g. "We build from the back, create overloads before switching, and
counterpress like our lives depend on it for the first five seconds after we lose
it.")

`________________________________________________________`

---

## Moment 1 — Attacking Organization (in possession)

**Moment summary** (1-2 sentences — the "session theme" line):
`________________________________________________________`

### Principle 1.1

**Statement** (the "what" — one line):
`________________________________________________________`

**Subprinciple A**
- Trigger (the specific game situation that activates this — name the players/roles):
  `________________________________________________________`
- Response (the specific collective action — who does what):
  `________________________________________________________`
- What NOT to do here (the common mistake, if there is one):
  `________________________________________________________`

**Subprinciple B**
- Trigger:
  `________________________________________________________`
- Response:
  `________________________________________________________`
- What NOT to do here:
  `________________________________________________________`

*(add Subprinciple C if this principle needs it — not every principle does)*

### Principle 1.2

**Statement:**
`________________________________________________________`

**Subprinciple A**
- Trigger:
  `________________________________________________________`
- Response:
  `________________________________________________________`

**Subprinciple B**
- Trigger:
  `________________________________________________________`
- Response:
  `________________________________________________________`

*(add Principle 1.3 / 1.4 only if this moment genuinely needs more than two —
most won't)*

---

## Moment 2 — Defensive Transition (immediately after losing the ball)

**Moment summary:**
`________________________________________________________`

### Principle 2.1
**Statement:** `________________________________________________________`

**Subprinciple A**
- Trigger: `________________________________________________________`
- Response: `________________________________________________________`

**Subprinciple B**
- Trigger: `________________________________________________________`
- Response: `________________________________________________________`

### Principle 2.2
**Statement:** `________________________________________________________`

**Subprinciple A**
- Trigger: `________________________________________________________`
- Response: `________________________________________________________`

**Subprinciple B**
- Trigger: `________________________________________________________`
- Response: `________________________________________________________`

---

## Moment 3 — Defensive Organization (out of possession)

**Moment summary:**
`________________________________________________________`

### Principle 3.1
**Statement:** `________________________________________________________`

**Subprinciple A**
- Trigger: `________________________________________________________`
- Response: `________________________________________________________`

**Subprinciple B**
- Trigger: `________________________________________________________`
- Response: `________________________________________________________`

### Principle 3.2
**Statement:** `________________________________________________________`

**Subprinciple A**
- Trigger: `________________________________________________________`
- Response: `________________________________________________________`

**Subprinciple B**
- Trigger: `________________________________________________________`
- Response: `________________________________________________________`

---

## Moment 4 — Attacking Transition (immediately after winning the ball)

**Moment summary:**
`________________________________________________________`

### Principle 4.1
**Statement:** `________________________________________________________`

**Subprinciple A**
- Trigger: `________________________________________________________`
- Response: `________________________________________________________`

**Subprinciple B**
- Trigger: `________________________________________________________`
- Response: `________________________________________________________`

### Principle 4.2
**Statement:** `________________________________________________________`

**Subprinciple A**
- Trigger: `________________________________________________________`
- Response: `________________________________________________________`

**Subprinciple B**
- Trigger: `________________________________________________________`
- Response: `________________________________________________________`

---

## Worked example (fully filled, for reference — don't edit this section)

This is the Attacking Organization moment for a POSSESSION-style model, filled
out to the target depth, so you can see the level of specificity to match:

### Moment: Attacking Organization

**Moment summary:** Build centrally through secure possession before committing
numbers wide; every switch has to be earned by an overload first, not thrown
early to escape pressure.

**Principle 1 — Build centrally before committing wide**

- Subprinciple: Center-backs split to the width of the box, keeper joins as an
  auxiliary passing option. Holding mid only drops between them if the opponent
  presses with two forwards — if they press with one, he stays higher and offers
  the angle instead.
  - What NOT to do: dropping the pivot automatically regardless of the
    opponent's press shape — it just gives the opponent a free extra body to
    mark higher up.
- Subprinciple: **Trigger** — winger receives on the touchline with the
  opposing fullback showing outside (denying the line inside). **Response** —
  the inside forward checks into the half-space to offer the underlap, the
  third-man option that breaks the fullback's cover shadow.

**Principle 2 — Overload before you switch**

- Subprinciple: **Trigger** — the ball-side winger has already fixed the
  opposing fullback 1v1. **Response** — only then does the ball-side fullback
  overlap; overlapping earlier just gives the opponent a second body to mark.
- Subprinciple: **Trigger** — three or more defenders have shifted ball-side and
  the weak-side winger has space to receive in stride. **Response** — switch
  immediately; waiting one more pass lets the block reset and the space closes.

---

## Notes for whoever authors this (you, or anyone else on staff)

- **Write the trigger and response as one causal sentence, not two separate
  facts.** "When X happens, player Y does Z" — if you can't fill in that
  sentence, the subprinciple probably isn't specific enough yet.
- **Name roles, not just concepts.** "The winger" and "the ball-side fullback,"
  not "attacking players." The product's coach-level language layer (D/C/B+
  vocabulary tiers already in `prompts/session.ts`) handles translating role
  names into the right vocabulary for each license level later — you don't need
  to write three versions, just the clearest version once.
- **"What NOT to do" is optional but valuable** — it's often the fastest way to
  say what you mean, and it's exactly the kind of thing that gets lost when a
  coach leaves and someone else inherits the team.
- **Don't force every principle to have exactly the same number of
  subprinciples.** Some principles are genuinely simpler than others.
