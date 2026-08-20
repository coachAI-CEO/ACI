# TacticalEdge (ACI)

Soccer coaching platform. Web app in `apps/web`, API in `apps/api`. Brand is TacticalEdge.

## Docs

- Engineering map: `DOCUMENTATION.md`
- How to run locally: `RUN_SERVERS.md`
- Marketing / decks: `TACTICALEDGE_UI_PRODUCT_REPORT.md`, `pitch-deck-*.html`
- Board design: `docs/tactical-board-phase-positioning.md`
- DOC Console history (Phases 1–3 shipped): `DOC_HUB_HANDOFF.md`
- Video analysis (beta, original MVP spec): `SHORT_VIDEO_ANALYSIS_FEATURE_SPEC.md`

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
