# Fantasy Draft Helper — Claude Code notes

Self-hosted NFL fantasy draft helper for a Sleeper Superflex league. pnpm
monorepo: Fastify/Node/SQLite API (`apps/api`) + React/Vite web app
(`apps/web`). Single Docker image, published to GHCR, self-hosted on a
Raspberry Pi via Tailscale Funnel.

## Read these first

The repo's authoritative docs — read before making changes, not just this
file:

- `AGENTS.md` — points at everything below
- `docs/CODING_AGENT_GUIDE.md` — architecture rules, coding-agent workflow
- `DEVELOPMENT_PLAN.md` — current scope/status (the MVP itself is done;
  this tracks post-MVP feature work)
- `docs/MVP_COMPLETION_PLAN.md` — historical record only, not live scope
- `RELEASING.md` — versioning and release process
- `docs/ranking-editor-history.md` — condensed history of the ranking
  editor feature (Phase 4) and its current backlog; read this before
  touching anything under `apps/web/src/components/RankingEditorPage.tsx`,
  `ranking-editor-logic.ts`, or the `/rankings/edit` route

## Working conventions

- File-specific diffs over full-file dumps, except for genuinely new files
- Conventional commit messages, split by concern when it makes sense
  (e.g. keep a tooling-setup commit separate from mass reformatting)
- Documentation updated in the same commit as the code change that
  necessitates it, not as a follow-up
- Generic placeholders in test fixtures (e.g. `"testuser"`), never real
  names
- Minimal, targeted changes over large refactors
- Guardrails belong in local scripts, not offloaded entirely to CI
- A change isn't done until it passes the full verification gate below —
  not just the test suite

## Verification gate

```bash
pnpm test && pnpm build && pnpm lint && pnpm format:check
```

`pnpm lint` runs both workspaces: `apps/web` via oxlint, `apps/api` via
oxlint with type-aware rules (`oxlint --type-aware`). Formatting is
Prettier for both workspaces (`pnpm format` / `pnpm format:check`) — oxfmt
is deliberately not used yet (still alpha, not fully Prettier-compatible).

For anything touching the served production build (SPA routing, auth,
Docker) or real-scale manual behavior (drag-and-drop, filtering), also run
`pnpm smoke` and verify manually — `pnpm dev` runs the web app and API
on different origins, so it doesn't exercise the same-origin production
setup.

## Infrastructure gotchas worth knowing up front

- **No migration system, on purpose.** A schema change (new/altered
  column in any repository's `CREATE TABLE`) breaks any existing SQLite
  file, since `CREATE TABLE IF NOT EXISTS` is a no-op against an
  already-existing table with the old schema. Accepted policy for both
  environments: delete the database file and let it recreate from
  scratch (prod: `docker compose down -v` + re-register/re-import; local
  dev: delete `apps/api/data/fantasy-draft-helper.db`, which is
  `process.cwd()`-relative, i.e. inside `apps/api/`, not the repo root).
  Do not build a migration system without an explicit request — this is
  a deliberate decision, not an oversight.
- **`pnpm dev` is cross-origin.** The web dev server (5173) calls the
  API (3000) directly, so every non-simple request goes through CORS
  preflight. `@fastify/cors` only allows GET/HEAD/POST by default; the
  allowed `methods` list in `apps/api/src/app.ts` must include any new
  HTTP method the web app starts using (currently PATCH and DELETE, for
  the ranking editor). Production is same-origin via `@fastify/static`
  and never hits this.
- `apps/api/package.json`'s `dev` script echoes the current
  `ALLOWED_USERNAMES` value on startup — there's no `.env` file for the
  API, it's an env var only, exported manually or passed inline.

## Current backlog (ranking editor)

Empty — every known item has been resolved. New items still need their
scope confirmed with the user before starting, same as every item
resolved so far.

Full history of everything already resolved (the ranking editor's build,
a major drag-and-drop performance investigation, several container-
boundary bugs, the six-item polish backlog, the from-scratch-ranking
feature, the oxlint migration, the format-on-save fix, the dev-mode CORS
fix, and the unranked long-name wrap fix) is in
`docs/ranking-editor-history.md` — read it before re-investigating
anything that looks like a already-solved problem in that area.
