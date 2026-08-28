#!/usr/bin/env bash
# Resets the three Rocklin FC pilot coaches against staging.
# Requires staging env vars ENABLE_DEV_SEED_ROUTES=1 and DEV_SEED_SECRET=<secret>
# on the tacticaledge-api-dev Render service.

set -euo pipefail

SECRET="${DEV_SEED_SECRET:-CHANGE_ME}"
URL="${STAGING_API_URL:-https://tacticaledge-api.onrender.com}"

# Default action: reset to the documented shared password "TestPilot!".
# Override by passing an argument, e.g. ./reset-pilot-coaches.sh Pilot2026!
PASSWORD="${1:-TestPilot!}"

curl -sS -X POST "$URL/admin/dev/reset-pilot-coaches" \
  -H 'Content-Type: application/json' \
  -H "X-DEV-SEED-SECRET: $SECRET" \
  -d "{\"password\":\"$PASSWORD\"}" | jq
