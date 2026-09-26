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
`pnpm smoke` and verify manually — don't rely on `pnpm dev` for this, see
the CORS gotcha below.

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
- **`pnpm dev` has a known CORS gap.** The web dev server and API run on
  different origins in dev, so ranking-editor mutation endpoints
  (PATCH/DELETE on `/rankings/:rankingId/players/:sleeperId`, tier
  endpoints) fail CORS preflight. Not a problem in the production Docker
  build (same-origin via `@fastify/static`). Use `pnpm smoke` to test
  these locally, not `pnpm dev`.
- `apps/api/package.json`'s `dev` script echoes the current
  `ALLOWED_USERNAMES` value on startup — there's no `.env` file for the
  API, it's an env var only, exported manually or passed inline.

## Current backlog (ranking editor)

Three items, not yet started — don't pick one up without confirming
scope with the user first, same as every item resolved so far:

1. **Dev-mode CORS** (see gotcha above) — no fix designed yet.
2. **Editor save/format auto-modification**: saving
   `RankingEditorPage.tsx` in the user's editor repeatedly strips two
   spaces of indentation in the `collisionDetectionStrategy`'s
   `droppableContainers: args.droppableContainers.filter(...)` block,
   failing `pnpm format:check`. This is an editor/auto-format-on-save
   config issue on the user's machine, not a code bug — don't try to fix
   it in the repo.
3. **Unranked list long-name line wrap**: a long player name in the
   unranked panel wraps to a second line within its list item, pushing
   the separator/border down into the next row — visually looks like the
   *next* row's name is struck through.

Full history of everything already resolved (the ranking editor's build,
a major drag-and-drop performance investigation, several container-
boundary bugs, the six-item polish backlog, the from-scratch-ranking
feature, and the oxlint migration) is in
`docs/ranking-editor-history.md` — read it before re-investigating
anything that looks like a already-solved problem in that area.
