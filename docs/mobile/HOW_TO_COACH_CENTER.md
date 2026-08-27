# How to: Coach Center on mobile

On-the-go recipes for the mobile Coach Center (Phases A–E). Inventory:
[`../COACH_CENTER_MOBILE_INVENTORY.md`](../COACH_CENTER_MOBILE_INVENTORY.md).
Week walkthrough: [`TUTORIAL_COACH_CENTER_WEEK.md`](TUTORIAL_COACH_CENTER_WEEK.md).

Authoring (create team, edit curriculum, rich game-day showcase) stays on
**web** — use the in-app "Open on web" CTAs.

---

## Open Coach Center

1. Home Quick Action **Coach Center**, or Settings → Coach Center.
2. Root lists **clubs** + **teams** from `GET /coach-center/access`.
3. Tap a team → team overview.

---

## Team overview

Route: `/coach-center/[teamId]`

Typical cards / rows:

- This week's curriculum (theme, phase, zone) + **Build this session** when
  generate params are available
- Next match → game day detail
- Upcoming sessions (Sideline / Session / Mark done)
- Recommended next sessions
- Section rows → Curriculum, Week calendar, Game days, Next sessions, Season chat
- Web rows → curriculum edit / team settings

---

## Browse the 16-week curriculum

1. Team → **Curriculum** (`/coach-center/[teamId]/curriculum`).
2. Select a week on the chip strip (current week highlighted).
3. Read knowledge card, constraints, session breakdown.
4. Open vault matches for that week when listed.
5. **Build this session** deep-links into Generate with age/coach/player/phase/zone.

---

## Next sessions + generate

1. Team → **Next sessions**.
2. Use the hero **Generate this week's session** when present.
3. Open a recommendation into the vault/session detail.

---

## Season chat

1. Team → **Season chat**.
2. Read history; send a message (composer + Send).
3. Wait for the assistant bubble ("Thinking with this week's plan…" while pending).
4. Long threads / admin tooling → Open on web.

---

## Week calendar

1. Team → **This week calendar** (or Calendar section).
2. Prev / This / Next week.
3. Per event: Sideline, Session, Mark done.

Full club calendar (multi-team filter polish) may still be richer on web —
see calendar inventory.

---

## Game day + match recap

1. Team → **Game days** → open a pack.
2. Review key focus / attacking / defending / set pieces.
3. Fill Us / Them, headline, summary, proud-of → save recap.
4. **Share summary** (system share sheet) or **Share PDF**.
5. **Edit pack on web** for showcase / richer modes.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Empty teams list | User needs Coach Center access / club membership on API |
| Build this session missing | Overview must include generate-ready week params |
| Chat send fails | Network + `POST .../chat`; confirm team id |
| PDF share fails | Check game-day PDF endpoint + device share permissions |

---

## Related

- Plan: [`../COACH_CENTER_IMPLEMENTATION_PLAN.md`](../COACH_CENTER_IMPLEMENTATION_PLAN.md)
- Tutorial: [`TUTORIAL_COACH_CENTER_WEEK.md`](TUTORIAL_COACH_CENTER_WEEK.md)
- Calendar: [`../CALENDAR_MOBILE_INVENTORY.md`](../CALENDAR_MOBILE_INVENTORY.md)
- Mobile hub: [`README.md`](README.md)
- Docs hub: [`../../DOCUMENTATION.md`](../../DOCUMENTATION.md)
