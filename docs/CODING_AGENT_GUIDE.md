# NFL Fantasy Draft Helper — Coding Agent Guide

How the system is built and the rules that keep it that way. Current scope
is in [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md); working conventions
and infrastructure gotchas are in [`AGENTS.md`](../AGENTS.md).

## What the app does

A deterministic draft helper: it imports a user's ranking CSV, matches each
row to a Sleeper player ID once, persists the result, and — while a Sleeper
draft runs — shows the highest-ranked players not yet drafted. It also
provides a drag-and-drop ranking editor (see
[`ranking-editor-history.md`](ranking-editor-history.md)), per-user
accounts behind an allowlist or open registration, and an ADP comparison.

## Technology

- pnpm workspaces: `apps/api`, `apps/web` (no shared package — domain types
  are defined per app in `apps/api/src/domain/` and `apps/web/src/types/api.ts`;
  don't add one without a concrete type-duplication problem to solve)
- Frontend: React, TypeScript, Vite, TanStack Query, react-router-dom,
  `@dnd-kit` + `@tanstack/react-virtual` (ranking editor); plain CSS with
  custom properties — no Tailwind
- Backend: Node.js 24, TypeScript, Fastify, Zod, SQLite via built-in
  `node:sqlite`
- Tests: Vitest (web adds jsdom + Testing Library)

## Repository layout

```text
apps/api/src/
├── app.ts, server.ts, app-dependencies.ts
├── clients/        sleeper.client.ts, adp.client.ts — external HTTP only
├── cache/          in-memory player cache
├── domain/         domain types
├── repositories/   all SQL (database.ts, ranking/user repositories)
├── routes/         Fastify routes, Zod-validated
├── services/       business logic and mappers
├── types/          Fastify augmentation, raw Sleeper types
└── utils/          errors, name/tier normalization, auth guard, SPA routes

apps/web/src/
├── App.tsx, main.tsx, config.ts, themes.ts
├── api/            fantasy-api.ts (the only HTTP client), query keys
├── components/     flat component files, ranking-editor/ subfolder
├── hooks/          data, auth, theme, and ranking-editor hooks
└── types/          API response types
```

## Architectural rules

1. **Frontend never calls Sleeper.** The flow is
   `React -> Fastify API -> Sleeper API`.
2. **Business logic lives in backend services.** React displays data and
   manages UI state; no matching, recommendation, or Sleeper logic there.
3. **External API code is isolated.** Clients only fetch; responses are
   validated and mapped before reaching services. Never return raw Sleeper
   payloads or internal `Set`s as JSON.
4. **SQL stays in repositories.** Services never contain queries.
5. **Match at import, never during polling** (see below).
6. **Recommendations are deterministic:** the same ranking and the same
   drafted IDs always give the same result.
7. **Routes are authenticated** except `/health` and `/auth/*`; ranking
   data is always scoped to the requesting user. In `RankingRepository`,
   ranking-level methods (`getMatches`, `hasRanking`, `rename`, `delete`,
   `listRankings`) take a `userId` and scope their SQL by owner;
   editor-level methods (players, tiers, flags) take only a `rankingId`
   that the calling service has already checked with `assertOwnership` or
   `hasRanking`.

### Import vs. poll — the central design decision

```text
CSV import:  parse -> validate -> normalize -> match to Sleeper ID -> persist
Draft poll:  fetch picks -> Set of drafted IDs -> filter persisted ranking -> top N
```

Name matching is the expensive step and happens only at import.

## CSV import

Canonical headers: `rank,player,position,team,tier,notes` (`rank` and
`player` required). Legacy headers `Rank`, `Name`, `Position`, `Team`,
`Tier`, and `player_id` are still accepted; new fixtures and docs use the
canonical ones. The header row is validated first; missing required
columns, empty files, malformed rows, and files without a valid row produce
structured row-level errors — never silently dropped data. A file with no
valid row saves nothing (`422 NO_VALID_ROWS`, errors in `details`); a
partially valid one saves the valid rows and reports the rest. Tiers are
normalized at import to the internal `S`, `A`–`Z` scheme
(`utils/tier.ts`, `normalize-ranking-tiers.ts`).

## Player matching

`normalizePlayerName` (`utils/normalize-player-name.ts`) lowercases,
trims, strips diacritics, removes `.`, `'`, `’`, `` ` ``, and `-`, and
collapses whitespace. It does no fuzzy matching.

`PlayerMatchingService` resolves each row in this order, taking the first
step that yields exactly one player:

1. Explicit Sleeper ID (`player_id` column); a name/team/position
   mismatch adds an `ID_METADATA_MISMATCH` warning
2. Name + position + team
3. Name + position
4. Name + team
5. Name, when it has only one candidate
6. Otherwise `AMBIGUOUS` (several candidates) or `NONE`

Fuzzy suggestions, if ever added, must never create a match automatically.

## Recommendations and polling

`RecommendationService` walks the persisted ranking in order, skipping
unmatched/ambiguous rows, drafted players, and players outside the
position filter, and stops at the limit (default 20, max 100). The
ranking is stored in order, so there is no sorting per request.

The web app polls via TanStack Query (`useDraftRecommendations`): disabled
without both IDs, ~30 s pre-draft, ~3 s while drafting
(`VITE_POLLING_INTERVAL_MS`), stopped once complete or after a terminal
error. Sleeper's pick propagation delay is an accepted limitation (see
[`known-issues.md`](known-issues.md)); the debug UI shows the last
successful refresh time. No WebSockets.

API contracts are documented in the root [`README.md`](../README.md#api);
the database schema is the `CREATE TABLE` statements in
`apps/api/src/repositories/`.

## Error handling

Handle invalid draft IDs, Sleeper failures, invalid CSVs, empty rankings,
and player-cache failures explicitly — don't swallow errors. Every error
body is `{ error: CODE, message }`, understandable without server logs;
see `AGENTS.md` for which error class to throw where.

## Testing priorities

Unit tests for pure logic first: name normalization, matching (including
apostrophes, periods, duplicate names, and each match step with missing
optional fields), recommendations (drafted and unmatched excluded, order
preserved, limit respected, empty ranking), CSV validation, tier
normalization, and ranking-editor helpers. Integration tests cover
persistence across restarts, auth and per-user scoping
(`app.e2e.test.ts`), and draft-state transitions against deterministic
Sleeper fixtures.

## Quality guidelines

- Prefer simple, explicit code; avoid premature abstraction.
- Use TypeScript types rather than `any`; validate external data.
- Add tests before optimizing.
- Stay within `DEVELOPMENT_PLAN.md`'s scope unless explicitly asked.

## Workflow

Before editing: read the nearest implementation and test files, and state
one falsifiable hypothesis about the behavior plus a focused check. After
the first substantive edit, run the narrowest relevant test, and fix
failures before broadening. Before reporting completion, run `pnpm verify`
(and `pnpm smoke` for production-build, auth, or Docker changes), and report
what was run and any gaps.

Commit rules are in [`AGENTS.md`](../AGENTS.md). Don't create branches,
reset the worktree, or revert user changes unless explicitly asked.
