# 11v11 Formation Principles — Volume II (Chassis & Spacing)

Source: [`tactical-playbook-v2.pdf`](./tactical-playbook-v2.pdf) — *Advanced Chassis & Spacing Playbook v2.0*  
Machine-readable: [`formation-principles-v2.json`](./formation-principles-v2.json)  
Geometry contract: [`../tactical-board-phase-positioning.md`](../tactical-board-phase-positioning.md)  
Earlier summary (v1): [`formation-principles.md`](./formation-principles.md)

**v2 is the authoritative coaching spec** for board placement. It adds concrete spacing, rotations, and rest-defense rules per phase.

---

## Phase map (playbook → board)

| Playbook phase | Board frame | Focus |
| --- | --- | --- |
| **Build-out** | F1 Goal-kick / first line | RIGHT |
| **Progression** | F2 Midfield pocket | MIDDLE |
| **Attack** | F3 Final third | LEFT |
| **Defensive transition** | Optional 4th beat / overlay | On the ball after loss |

---

## Universal chassis rules

1. **In possession:** expand the pitch. **Out of possession:** compress it.  
2. **Coalitions > individuals** (Lobanovskyi).  
3. **Short team:** keep vertical distances tight (classic 4-4-2 block ≤ ~25m deepest→striker).  
4. **Grid discipline (4-3-3 positional play):** avoid stacking — roughly ≤3 on one horizontal line, ≤2 vertically in the same channel.  
5. **Rest defense** is part of every system (not an afterthought).

---

## 4-3-3 — Total Football / Positional Play

| Phase | Chassis (what to show) |
| --- | --- |
| **Build-out** | Sweeper-keeper triangle with **split CBs**; **#6 drops between CBs** (temp back-three vs 2-ST press); **FBs high-wide** to drag wingers |
| **Progression** | **Flank triangles** (FB + #8 + winger) with rotations; pivot conducts sideways then **diagonal switch**; support in front *and* behind the ball |
| **Attack** | **False nine drops** → CBs dragged; **inverted wingers** slice in behind; **FBs overlap** for cutbacks (POMO); #8/#10 late box runs |
| **Def transition** | Nearest **3 swarm in 3–5s**; high line squeezes; if bypassed → compact zonal block |

---

## 4-4-2 — Zonal pressing / balanced lines

| Phase | Chassis (what to show) |
| --- | --- |
| **Build-out** | Back four as a **sliding arc**; two CMs as **deep double screen** (not into the back line); FBs deeper as safe outlets |
| **Progression** | Whole block moves ≤**25m**; lateral slide; **asymmetry** — one WM wide, opposite WM **tucks** to overload center |
| **Attack** | **Target hold-up + runner**; one flank crosses, other tuck frees **overlapping FB**; CMs to edge of box |
| **Def transition** | Instant **two banks of four** (low/mid block); harass + lateral squeeze; coordinated offside step |

---

## 4-2-3-1 — Doble pivot / spacing symmetry

| Phase | Chassis (what to show) |
| --- | --- |
| **Build-out** | Split CBs; **symmetrical doble pivot** (one pressed → other supports); FBs **liberated high-wide** |
| **Progression** | Pivots + **#10 triangle**; if press narrow → swivel to overlapping FBs; if wide → wingers tuck for central overload |
| **Attack** | **#10 enganche** in the hole; inverted wingers in **inside channels**; FB overlaps; mobile #9 unpins CBs → 5-man wave |
| **Def transition** | Pivots stay as **permanent rest-defense screen**; front players drop to 4-5-1 / 4-4-2 OOP |

---

## 3-5-2 — Wing-back overloads / central anchors

| Phase | Chassis (what to show) |
| --- | --- |
| **Build-out** | Back three; **libero carries** into midfield; side CBs split; **DM sluice gate**; **WBs high** to stretch press |
| **Progression** | **5-man midfield overload**; WBs drag wide → open center; **contra swaps** (CM↔WB); libero drives, DM covers |
| **Attack** | Free **#10**; WBs to goal line (cross/cut-in); twin STs; late CMs; libero recycles |
| **Def transition** | WBs drop → **5-3-2**; three CBs tight; mid trio shields; force wide then isolate |

---

## Implementation notes (for code)

Use `formation-principles-v2.json` `boardCues` as the checklist when placing each frame:

1. Shared geometry from `board-phase-placement.ts` (F1 high press default, F2 role rotate, F3 recover).  
2. Layer **formation chassis** on top (pivot type, width source, motif arrows).  
3. Optional 4th frame for **defensive transition** using each system’s rest-defense rule.  
4. Respect coach override: `low block` / `mid block` still wins over default high press on F1.

### Motif arrows to prioritize next

| Formation | Signature arrows |
| --- | --- |
| 4-3-3 | CB split + #6 drop; flank triangle; false-nine drop + invert + FB cutback |
| 4-4-2 | Double screen; tuck + opposite overlap; hold-up → runner |
| 4-2-3-1 | Doble platform; pass into #10 hole; invert + FB overlap |
| 3-5-2 | Libero step; WB advance; #10 between twin STs; WB drop to 5-back on transition |
