# Release process

This repo uses long‑lived agent branches (`codex/mobile-app`, `codex/web-prod-release`, …) so work in progress doesn't depend on landing to `dev` to be tested.

## Render staging deploy target

`render.yaml` pins the staging API service (`tacticaledge-api-dev`) to the
**active release branch**:

| If active work is on…    | Set `render.yaml → services[0].branch` to… |
| ------------------------ | ------------------------------------------ |
| `codex/mobile-app`       | `codex/mobile-app`                         |
| `codex/web-prod-release` | `codex/web-prod-release`                   |
| `main` / `dev` release   | `main` (or `dev`)                          |

After flipping the branch in `render.yaml`, **Render Dashboard → `tacticaledge-api-dev` → Manual Deploy** to force a one‑off rebuild, or push a commit to the new branch and Render's auto‑deploy will pick it up.

## Pilot coach test accounts

The three Rocklin FC pilot coaches live in the seed (`apps/api/src/scripts/seed-pilot-coaches.ts`):

- `7v7.coach@rocklinfc.org` — U8–U10
- `9v9.coach@rocklinfc.org` — U11–U12
- `11v11.coach@rocklinfc.org` — U13–U18

Shared default password: `TestPilot!`

When the staging DB gets reseeded, the password hashes for those accounts
may no longer match. To reset all three without opening Render shell:

1. In Render Dashboard → `tacticaledge-api-dev` → Environment, ensure:
   - `ENABLE_DEV_SEED_ROUTES=1`
   - `DEV_SEED_SECRET=<your chosen secret>`
2. From your laptop:
   ```bash
   curl -X POST 'https://tacticaledge-api.onrender.com/admin/dev/reset-pilot-coaches' \
     -H 'Content-Type: application/json' \
     -H "X-DEV-SEED-SECRET: <your secret>" \
     -d '{}'
   ```
   Pass `{"password":"NewPass!"}` to override the default.

Set `ENABLE_DEV_SEED_ROUTES=0` (or remove the var) when you're done — the
endpoint should not be left enabled in any environment that holds real data.

## Mobile Expo against staging / Render

Active mobile work lives on `codex/mobile-app` (often in worktree
`aci-mobile-dev`). Metro needs `apps/mobile/.env` or it defaults to
`http://localhost:4000` and looks like the API is down:

```env
EXPO_PUBLIC_API_URL=https://tacticaledge-api.onrender.com
EXPO_PUBLIC_WEB_URL=https://tacticaledge.app
```

Restart Metro with `--reset-cache` after changing `.env`. Board + Coach Center
docs: `docs/mobile/README.md`, `docs/TACTICAL_BOARD_MOBILE_PLAN.md`,
`docs/COACH_CENTER_IMPLEMENTATION_PLAN.md`.
