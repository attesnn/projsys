# Agent instructions

Before changing this codebase, read **[README.md](./README.md)** in full. It is the continuity brief for product intent, domain invariants, tab behavior, Gantt scales, allocation metrics, stakeholder roles, conflicts, storage, and file ownership.

Do not reintroduce removed features (column locking, task `due`-only model, assignment-row Resource allocation, stored `allocationPct` on Assignment) unless the user asks.

Stakeholder **resource** mode is a demo persona switch (not auth): keep data scoped via `effectiveResourceFilterId` and do not restore manager-only tabs/actions while that role is active.

## Cursor Cloud specific instructions

The app needs a **PostgreSQL 16** backend (Prisma + Next.js Route Handlers under `/api/app-data`). Standard commands live in `package.json` scripts and the README "How to run" section; only the non-obvious cloud caveats are below. The startup dependency refresh (`npm install`, `.env` from `.env.example`, `npx prisma generate`) is already handled by the environment update script — do not repeat it.

- **Docker is pre-installed but not managed by systemd.** Start the daemon manually once per session before using Postgres: run `sudo dockerd` in a background/tmux session (it stays in the foreground). The `ubuntu` user is already in the `docker` group, so `docker` / `npm run db:up` work without `sudo` in a *new* shell; `dockerd` itself still needs `sudo`.
- **Bring up Postgres each session:** `npm run db:up` (docker compose, container `projsys-postgres`, port 5432). Wait for it to be healthy (`docker inspect --format '{{.State.Health.Status}}' projsys-postgres`) before running Prisma or the app.
- **Migrations are NOT in the update script** (they need the DB running). After Postgres is up, run `npx prisma migrate deploy`. Data volume `projsys_pgdata` persists across restarts, so migrate/seed only when the DB is fresh/empty.
- **Seeding:** `npm run prisma:seed` loads ~50 resources / 9 projects / ~1.1k tasks. `GET /api/app-data` also auto-seeds an empty DB on first load, so a manual seed is optional.
- **Run the app (dev):** `npm run dev -- --port 3000`, then http://localhost:3000. Quick backend check: `curl -s http://localhost:3000/api/app-data` returns the full `AppData` JSON snapshot from Postgres.
- **Lint currently reports pre-existing errors** (`react-hooks/set-state-in-effect` in `StoreContext.tsx`, `prefer-const` in `store.ts`) unrelated to environment setup — `npm run lint` runs fine; those are code issues, not setup breakage.
