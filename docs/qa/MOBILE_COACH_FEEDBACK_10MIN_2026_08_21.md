# Mobile coach feedback — 10 minutes × 3

**Date:** 2026-08-21  
**Goal:** Visual + quality feedback from the three Rocklin pilot coaches.  
**Focus:** Does the app look coach-ready? Can they find and use Home → Vault → Session/Series → Sideline without getting lost?  
**Not in scope:** Generating new sessions, Doc Hub admin, board editor, IAP.

---

## Coaches

| Coach | Email | Age band | Format |
|-------|-------|----------|--------|
| 7v7 Test Coach | `7v7.coach@rocklinfc.org` | U8–U10 | 7v7 |
| 9v9 Test Coach | `9v9.coach@rocklinfc.org` | U11–U12 | 9v9 |
| 11v11 Test Coach | `11v11.coach@rocklinfc.org` | U13–U18 | 11v11 |

**Password (shared for this session):** `RocklinPilot-0821`  
Reset on staging DB 2026-08-21 for this feedback run.

---

## Expo Go on LAN + staging (ready)

**API:** staging `https://tacticaledge-api.onrender.com` (already in `apps/mobile/.env`)  
**Metro:** same Wi‑Fi as this Mac (`en0`)

### Coach phone steps
1. Install **Expo Go** (SDK 55 / current App Store build).
2. Join the **same Wi‑Fi** as the facilitator Mac.
3. Open Expo Go → **Scan QR** from the Metro terminal (or enter `exp://<LAN-IP>:8081`).
4. Log in with **their** email + `RocklinPilot-0821`.
5. Follow the 10-minute script below.

### Facilitator checklist
- [ ] Metro running: `cd apps/mobile && REACT_NATIVE_PACKAGER_HOSTNAME=$(ipconfig getifaddr en0) pnpm exec expo start --lan`
- [ ] QR visible in terminal / browser
- [ ] Spot-check login once on a phone before coaches arrive
- [ ] Ignore Expo Go developer gear in feedback (dev-only)

If the phone can’t load the bundle: confirm Wi‑Fi (no guest/client isolation), Mac firewall allows 8081, and LAN IP hasn’t changed.
---

## 10-minute script (same for all three)

| Min | Ask them to… | Watch for |
|-----|----------------|-----------|
| 0:00 | Log in with **their** coach email + `RocklinPilot-0821` | Login clarity, keyboard, errors |
| 1:00 | Glance at **Home** — what is this app for? | Greeting, quick actions, clutter |
| 2:00 | Open **Vault** → immediately tap **their age chip** (7v7→U10, 9v9→U12, 11v11→U16). Default list can look empty until age is selected. | Tabs + chips obvious? |
| 3:00 | Try **Filters** if shown; scroll cards | Speed, labels, Rocklin model clutter |
| 4:30 | Open a **session** card | Spec strip readable? “On calendar” clear if shown? |
| 5:30 | From session: open **Sideline** (or note if missing) | Typography, diagram crop, Previous/Next, Exit |
| 7:00 | Back → **Series** tab → open one series if any appear for their ages | Title readable, parts list |
| 8:30 | Peek **Calendar** (or schedule affordance) | “Already on calendar” makes sense? |
| 9:30 | Stop. Voice feedback only (see prompts) | Capture quotes |

If they finish early: ask them to favorite a session and find it under Favorites.

---

## Voice prompts (last ~1–2 min)

Ask exactly these — don’t lead:

1. **First impression:** “In one sentence, how does this feel compared to the web app?”
2. **Trust:** “Would you use this on the sideline tomorrow? Why / why not?”
3. **Visual:** “Anything that looks unfinished, cramped, or hard to read?”
4. **Confusion:** “Where did you hesitate or guess?”
5. **One fix:** “If we could change one thing before coaches see this, what is it?”

---

## Scorecard (copy ×3)

**Coach:** _____________   **Device:** _____________   **Build:** _____________

Rate 1–5 (1 = poor, 5 = excellent)

| Area | Score | Note |
|------|:-----:|------|
| Overall visual polish |  |  |
| Home clarity |  |  |
| Vault filters / cards |  |  |
| Series readability |  |  |
| Session detail / calendar cue |  |  |
| Sideline on-field usability |  |  |
| Trust / “ship-ready” feel |  |  |

**Would use on next training?**  Yes / Maybe / No  

**Quotes**

-

-

**Bugs / broken moments**

-

-

**Must-fix before wider pilot**

-

---

## Roll-up (after all three)

| Area | 7v7 | 9v9 | 11v11 | Avg |
|------|-----|-----|-------|-----|
| Overall visual |  |  |  |  |
| Vault |  |  |  |  |
| Series |  |  |  |  |
| Sideline |  |  |  |  |
| Trust |  |  |  |  |

**Top 3 themes**
1.
2.
3.

**Ship call:** Ready for wider coach pilot / Needs another polish pass / Blocked  

---

## Notes for this build

Recent mobile work coaches will notice:
- Home matchday editorial look
- Vault compact toolbar (search + Filters + age chips)
- Session cards with Age / Phase / Where / Form / Players
- Series cards + full titles; calendar “On calendar” badges
- Sideline typography / diagram crop / Exit top-only

Ignore Expo Go developer gear in feedback (dev-only).

---

## Agent run (2026-08-21)

Three parallel coach-persona agents are running the script on the shared iOS Simulator (flocked):

| Persona | Agent |
|---------|-------|
| 7v7 | [7v7 coach QA](024e4808-be9f-4f32-a348-1e32ecce8540) |
| 9v9 | [9v9 coach QA](47d3927b-8fef-4179-a5fc-43503255ceed) |
| 11v11 | [11v11 coach QA](59617511-58c1-425d-b21c-e0140240840b) |

Scorecards land in:
`~/.gstack/projects/coachAI-CEO-ACI/coach-agent-feedback-2026-08-21/{7v7,9v9,11v11}/SCORECARD.md`
