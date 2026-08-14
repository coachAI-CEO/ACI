**v2 supersedes this summary** for implementation detail: see [`formation-principles-v2.md`](./formation-principles-v2.md) (Chassis & Spacing Playbook).

# 11v11 Formation Principles (from Tactical Playbook v1)

Source: [`tactical-playbook.pdf`](./tactical-playbook.pdf) — *Inverting the Pyramid: A Systemic Spec Manual for Major Formations*  
Machine-readable extract: [`formation-principles.json`](./formation-principles.json)  
Board geometry contract: [`../tactical-board-phase-positioning.md`](../tactical-board-phase-positioning.md)

These are the **main 11v11 concepts** we need on the tactical board. Playbook phases map 1:1 onto our teaching frames.

| Playbook phase | Board frame (default play-out) | Focus third |
| --- | --- | --- |
| **Build-out** | Frame 1 — Goal-kick / first line | RIGHT (ATT own third) |
| **Progression** | Frame 2 — Midfield pocket | MIDDLE |
| **Attack** | Frame 3 — Final-third progression | LEFT (their box) |

---

## Core principles (all formations)

1. **In possession:** make the pitch **big** (width + depth for passing).  
2. **Out of possession:** make the pitch **small** (compress, strangle playmakers).  
3. **Short team:** keep compact vertical distances (playbook: ≤ ~25m defense→attack in a 4-4-2-style block).  
4. **Coalitions:** pre-programmed local actions (triangles, overlaps, tucks) — not random individual runs.

Board rule we already use: opposition lines hang off the **focus**, not a frozen “away half” dump.

---

## Spec matrix (who creates the system)

| Formation | Pivot | Width source | Key motifs |
| --- | --- | --- | --- |
| **4-3-3** | Single pivot (#6) | Full-backs / wingers | False nine, flank triangles, positional grid rotations |
| **4-4-2** | Flat midfield pair | Overlapping FB / wide mid | Zonal marking, short-team block, target-man hold-up |
| **4-2-3-1** | Double pivot | Overlapping FB / wingers | Inverted wingers, #10 pocket, high pressing |
| **3-5-2** | Triple central midfield | Wing-backs | Libero/sweeper-playmaker, midfield overload |

---

## Per formation × phase (board placement cues)

### 4-3-3

| Phase | Shape cues | Patterns to draw |
| --- | --- | --- |
| Build-out | Back four + **#6 screen**; #8/#10 above; front three higher | GK/CBs → #6; vertical lanes; resist high press with compactness |
| Progression | FBs advance; CMs circulate | **Flank triangles**; interior combinations |
| Attack | False nine drops; **inverted wingers** cut in; FBs provide width | Drop into pocket; diagonal cuts; flank triangles into box |

### 4-4-2

| Phase | Shape cues | Patterns to draw |
| --- | --- | --- |
| Build-out | Compact block; sliding back four; flat mid four; front two | Short-team distances; zonal cover |
| Progression | One wide mid **tucks**; opposite side prepares width | Asymmetrical wing progression |
| Attack | Target hold-up + runner; tucked wide mid + overlapping FB | Hold-up → runner; one-side tuck / other-side overlap |

### 4-2-3-1

| Phase | Shape cues | Patterns to draw |
| --- | --- | --- |
| Build-out | CBs + **doble pivot** (#6/#8) shield; FBs available | Symmetrical build through pivots |
| Progression | Pivots → **#10 pocket**; wingers in half-spaces | Central progression into trequartista zone |
| Attack | ST pins; #10 orchestrates; inverted wingers; overlapping FBs | Cut inside + overlap; feed the focal #9 |

### 3-5-2

| Phase | Shape cues | Patterns to draw |
| --- | --- | --- |
| Build-out | Back three + **libero** stepping; DM screen | Libero into midfield; triangles with DM |
| Progression | **5-man midfield**; wing-backs high | Midfield overload; rapid to advanced WBs |
| Attack | Free #10 between lines; twin STs; WBs as flank runners | WB width; playmaker pockets; dual #9 presence |

---

## How this plugs into our board implementation

| Layer | Job |
| --- | --- |
| `formation-principles.json` | Motifs / pivot / phase patterns per formation |
| Phase placement (`board-phase-placement.ts`) | Where the **block** sits (build-out / pocket / final third) + opposition height |
| Formation slots (`board-formations.ts`) | Relative who-is-next-to-whom |
| Next coding step | Formation-specific **coalitions** (false nine drop, tuck+overlap, doble pivot lanes, libero step, WB advance) on top of the shared phase geometry |

### Frame rules (unchanged, reinforced by playbook)

- **F1 Build-out (default goal kick):** DEF high to the box unless coach asks mid/low block.  
- **F2 Progression:** after high press → first line bypassed, cover becomes the jump; short-team distances held.  
- **F3 Attack:** width + box arrivals; DEF recovering onto their box is correct here.

---

## Implementation checklist (next)

- [ ] Load `formation-principles.json` in API when placing ATT for 4-3-3 / 4-4-2 / 4-2-3-1 / 3-5-2  
- [ ] Per-formation Frame 1: pivot type (single / flat pair / doble / libero+3)  
- [ ] Per-formation Frame 2: motif arrows (flank triangle / tuck+overlap / #10 pocket / WB overload)  
- [ ] Per-formation Frame 3: finish patterns (false nine / target+runner / inverted+overlap / dual ST+WB)  
- [ ] Keep opposition model formation-agnostic (press / cover / rest off focus)
