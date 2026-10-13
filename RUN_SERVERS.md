# How to Run the Servers

You need two processes:

1. **API** — Express, default **http://localhost:4000** (`PORT` or 4000)
2. **Web** — Next.js, default **http://localhost:3000** (Next picks the next free port if 3000 is busy)

After both are up, log in and open **Coach Center** (`/coach-center`), not only the drill generator.

---

## Prerequisites

- Node.js and pnpm
- Root `.env` for the API (not `.env.local`). `apps/api/src/config/load-env.ts` also tries `apps/api/.env`.
- PostgreSQL via `DATABASE_URL` (required for vault, Coach Center, auth)

---

## Environment

Put secrets in the **repo root `.env`**. The API does not load `.env.local`.

Minimum:

```bash
GEMINI_API_KEY=your_api_key_here
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

Auth, Stripe, and mail need additional vars in production. See `apps/api/ENVIRONMENT_VARS.md` for names (treat values as untrusted).

Trials: production signup is off unless **both** `TRIALS_ENABLED=true` (API register) and `NEXT_PUBLIC_TRIALS_ENABLED=true` (web CTA).

---

## Install

From the repo root:

```bash
pnpm install
```

---

## Run

**Terminal 1 — API**

```bash
cd apps/api
pnpm dev
```

You should see `ACI API listening on 0.0.0.0:4000` (or whatever `PORT` is).

**Terminal 2 — Web**

```bash
cd apps/web
pnpm dev
```

Open the Local URL Next prints. If 3000 is taken it will be 3001+.

Then:

- Marketing: `/` or `/landing`
- App: `/login` → `/coach-center`
- Session Builder: `/demo/session`
- Health: `curl http://localhost:4000/ai/ping`

---

## Troubleshooting

**GEMINI_API_KEY is not set** — add it to the root `.env`.

**Port already in use**

```bash
lsof -ti:4000 | xargs kill
lsof -ti:3000 | xargs kill
```

**Cannot connect to database** — `DATABASE_URL` must be reachable. This project’s shared dev DB is hosted Postgres, not a disposable local empty schema. Do not run `prisma migrate reset` against it.

**Web cannot reach API** — API must be running. Check `CORS_ORIGIN` if you set it.

---

## Ports

| Service | Default | URL |
|---|---|---|
| API | 4000 | http://localhost:4000 |
| Web | 3000 | http://localhost:3000 |
| Coach Center | web | http://localhost:3000/coach-center |
| Session Builder | web | http://localhost:3000/demo/session |

---

## Quick commands

```bash
pnpm install
cd apps/api && pnpm dev
cd apps/web && pnpm dev
lsof -ti:4000 | xargs kill
lsof -ti:3000 | xargs kill
curl http://localhost:4000/ai/ping
```
