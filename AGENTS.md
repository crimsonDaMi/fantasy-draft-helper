# Agent Instructions

Self-hosted NFL fantasy draft helper for a Sleeper Superflex league. pnpm
monorepo: Fastify/Node/SQLite API (`apps/api`) + React/Vite web app
(`apps/web`). Single Docker image, published to GHCR; shared instances
are deployed with `deploy/server/`.

## Read these first

- `docs/CODING_AGENT_GUIDE.md` — architecture rules and coding workflow
- `DEVELOPMENT_PLAN.md` — current scope, out-of-scope list, deferred ideas
- `RELEASING.md` — versioning and release process
- `docs/ranking-editor-history.md` — design constraints of the ranking
  editor; read it before touching `apps/web/src/components/RankingEditorPage.tsx`,
  `ranking-editor-logic.ts`, `components/ranking-editor/`, the editor
  hooks in `apps/web/src/hooks/` (`useEdgeAutoscroll`,
  `useContainerCollisionDetection`, `useRankingEditorMutations`), or the
  `/rankings/edit` route

New feature work needs its scope confirmed with the user before starting.

## Working conventions

- File-specific diffs over full-file dumps, except for genuinely new files
- Conventional commit messages, split by concern when it makes sense
  (e.g. keep a tooling-setup commit separate from mass reformatting)
- Documentation updated in the same commit as the code change that
  necessitates it, not as a follow-up — including a `CHANGELOG.md` entry
  under `## Unreleased` for anything user-facing (`pnpm release` refuses
  to run with that section empty)
- Generic placeholders in test fixtures (e.g. `"testuser"`), never real
  names
- Minimal, targeted changes over large refactors
- No blank lines between arguments, object properties, interface members,
  or imports within a group (packages, then relative imports). Prettier
  preserves such blank lines rather than removing them, so this is by
  convention only
- Guardrails belong in local scripts, not offloaded entirely to CI
- Agents may commit on their own once a meaningful change set is complete
  and passes the verification gate below — one commit per concern, never
  a work-in-progress commit. Never push; the user reviews and pushes
- Don't create branches, reset the worktree, or revert user changes
  unless explicitly asked
- A change isn't done until it passes the full verification gate below —
  not just the test suite

## Verification gate

```bash
pnpm verify   # = pnpm test && pnpm build && pnpm lint && pnpm format:check
```

`.github/workflows/verify.yml` runs the same gate on every PR and push to
`main`; it's a backstop, not a substitute for running it locally.

`pnpm lint` runs both workspaces: `apps/web` via oxlint, `apps/api` via
oxlint with type-aware rules (`oxlint --type-aware`), then knip for
unused files/exports/dependencies (knip doesn't see unused class
methods — those still need a manual grep). Formatting is Prettier for both
workspaces (`pnpm format` / `pnpm format:check`) — oxfmt is deliberately
not used yet (still alpha, not fully Prettier-compatible). `pnpm build`
type-checks test files in both workspaces (vitest itself doesn't), so a
stale test fixture fails the gate rather than drifting.

For anything touching the served production build (SPA routing, auth,
Docker) or real-scale manual behavior (drag-and-drop, filtering), also run
`pnpm smoke` and verify manually — `pnpm dev` runs the web app and API
on different origins, so it doesn't exercise the same-origin production
setup.

## Dependency maintenance

A weekly audit workflow (moderate+ severity, opens a `dependency-audit`
issue on failure), weekly Dependabot PRs, and a Node LTS check (opens a
`node-lts` issue) run on GitHub; `pnpm run audit` is the same audit
locally. `@types/node` majors are ignored by Dependabot — they must track
the Dockerfile's Node major. Wait for the `verify.yml` result before
merging a Dependabot PR. Details in `RELEASING.md`.

## Infrastructure gotchas

- **No migration system, on purpose.** A schema change (new/altered
  column in any repository's `CREATE TABLE`) breaks any existing SQLite
  file, since `CREATE TABLE IF NOT EXISTS` is a no-op against an
  already-existing table with the old schema. Accepted policy for both
  environments: delete the database file and let it recreate from
  scratch (prod: `docker compose down -v` + re-register/re-import; local
  dev: delete `apps/api/data/fantasy-draft-helper.db`, which is
  `process.cwd()`-relative, i.e. inside `apps/api/`, not the repo root).
  Do not build a migration system without an explicit request. Repositories
  run their schema through `applySchema`
  (`apps/api/src/repositories/database.ts`), which refuses to start against
  a database whose existing tables differ from the expected schema. Any
  schema change is a **major** version bump (see `RELEASING.md`).
- **`pnpm dev` is cross-origin.** The web dev server (5173) calls the
  API (3000) directly, so every non-simple request goes through CORS
  preflight. `@fastify/cors` only allows GET/HEAD/POST by default; the
  allowed `methods` list in `apps/api/src/app.ts` must include any new
  HTTP method the web app starts using (currently PATCH and DELETE).
  Production is same-origin via `@fastify/static` and never hits this.
- **Error handler registration order.** `app.setErrorHandler(errorHandler)`
  (`apps/api/src/utils/error-handler.ts`) must stay above every
  `await app.register(...)` in `buildApp` — an awaited plugin captures the
  handler in effect when it loads, so one set later silently never applies
  (ZodErrors then become 500s). Every error body is `{ error: CODE,
message }`. For expected failures, services and repositories throw
  the domain errors in `utils/domain-errors.ts` — `UnauthorizedError`,
  `ForbiddenError`, `NotFoundError`, `ConflictError`, `TooManyRequestsError`
  (message, CODE), mapped to 401/403/404/409/429 by the handler;
  `HttpError(status, message, CODE)` is for the HTTP-facing layers (routes,
  the auth guard, `require-user`, and clients reporting upstream failures).
  The handler logs 4xx at `info` and 5xx at `error`. Guarded by
  `app.e2e.test.ts`.
- **New client-side routes** must be added to the SPA-route allowlist
  (`apps/api/src/utils/spa-client-routes.ts`), or a direct load hits the
  API instead of the app.
- `apps/api/package.json`'s `dev` script echoes the current
  `ALLOWED_USERNAMES` value on startup — there's no `.env` file for the
  API, it's an env var only, exported manually or passed inline.
