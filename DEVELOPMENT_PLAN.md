# Development Plan

Status as of this writing: MVP has been tested live in an actual draft (1 minute
per pick). Sleeper API latency was **not** a problem at that pace. Distribution
is a single Docker image, published to GHCR
(`ghcr.io/crimsondami/fantasy-draft-helper`), versioned with git-tag-synced
tags (`vX.Y.Z`) — see `RELEASING.md`.

**v0.2.0** ships Phase 1 item #2, position-based filtering.
**v0.3.0** ships Phase 1 item #1, the dev/prod UI switch (see below).
**v0.4.0** ships the production UI pass (draft-day view redesign).
**v0.5.0** ships Phase 1 item #3, the ADP vs. ranking diff — Phase 1 complete.
**v0.7.0** ships Phase 2 and Phase 3 in full: authentication (#7), the
allowlist (#8), online hosting (#4), clean user data separation (#6), and
multi-user support (#5) — the entire roadmap in this document is complete
as of this version.

This document tracks the next round of feature ideas: their complexity,
benefit, dependencies, and the agreed implementation order. Intended for
both human contributors and coding agents picking up work on this repo —
read this before starting on any of the items below.

## Candidate features

| #   | Feature                                                 | Complexity                   | Benefit                                             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------- | ---------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ~~Dev/prod UI switch~~ — **done, v0.3.0**               | M                            | High                                                | `VITE_UI_MODE` (`debug` \| `draft`), defaulting from `import.meta.env.DEV` — `pnpm dev` gets `debug`, `vite build`/Docker gets `draft`, overridable via `--build-arg VITE_UI_MODE=debug`. `isDebugUi` flag in `config.ts` gates raw draft ID, exact timestamps, polling interval, and the full rankings-import breakdown in `MonitoringStatus.tsx` and `App.tsx`. `DraftForm`, `RankingsUpload`, and `RecommendationsList` were not touched by this pass — worth a look during future production-UI polish.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2   | ~~Position-based filtering~~ — **done, v0.2.0**         | S                            | High                                                | `positions` query param on `GET /drafts/:draftId/recommendations`, filtered in `RecommendationService`, `PositionFilter` checkbox UI in `App.tsx`. Route + service test coverage added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 3   | ~~ADP vs. personal ranking diff~~ — **done, v0.5.0**    | S–M                          | High                                                | Sourced from Sleeper's official, publicly-shared ADP Google Sheet (@SleeperHQ) — keyed by real Sleeper `player_id`, so no fuzzy matching needed, no cost, no ToS conflict. `AdpClient` fetches the sheet's CSV export; `AdpService` caches it with a 24h refresh interval and failure backoff, degrading gracefully (omits the `adp` field) rather than breaking recommendations on fetch failure or format changes. Reads the "Redraft SF ADP" column, matching this league's Superflex format (change `ADP_COLUMN` in `adp.service.ts` for other formats). `Recommendation.adp = { value, diff }`, where `diff = your rank − ADP value`. UI shows a sign-colored badge in `RecommendationsList`, muted below a ±1 threshold.                                                                                                                                                                                                                                                                                            |
| 4   | ~~Host the app online~~ — **done, v0.7.0**              | M alone / prerequisite-gated | Medium alone, High as enabler                       | Self-hosted on a Raspberry Pi 4B (running alongside an existing Pi-hole), not the originally-planned cloud PaaS — Oracle Cloud was ruled out (debit card rejected at signup) and direct port forwarding turned out not to be possible on the home network. Exposed via Tailscale Funnel: no port forwarding, no owned domain, stable `<device>.<tailnet>.ts.net` HTTPS URL, TLS handled entirely by Tailscale. An earlier DuckDNS + Caddy (DNS-01) plan was built and abandoned once the port-forwarding blocker was discovered. Deployed via `deploy/pi/` (its own `docker-compose.yml`, `.env`, and a dedicated `deploy/pi/README.md` runbook) — the deployment itself predates v0.7.0, but the code enabling it (auth, scoping) ships as part of that version.                                                                                                                                                                                                                                                         |
| 5   | ~~Multi-user support~~ — **done, v0.7.0**               | L                            | High (if the league wants an always-on shared tool) | Backend was already mostly there once #6 landed — rankings/recommendations were the only genuinely per-user data, and both were already scoped. The actual #5 work was proving and closing the remaining gaps: an end-to-end test (`app.e2e.test.ts`) exercising the real request pipeline (cookie → session → `request.user` → scoped route) with two real registered users, confirming neither can read the other's ranking; the logged-in username now shown in the header (`App.tsx`); a 24h cooldown on `POST /players/refresh` per Sleeper's own API guidance ("you do not need to call this endpoint more than once per day"), since it was previously callable without limit by any authenticated user; and session-expiry handling on the frontend (`onUnauthorized` subscription in `fantasy-api.ts`, wired into `useAuth`) so a dead session bounces back to login with a clear message instead of a generic error. First frontend test infrastructure (Vitest + jsdom + Testing Library) added along the way. |
| 6   | ~~Clean user data separation~~ — **done, v0.7.0**       | M                            | Medium                                              | `rankings` table scoped by `user_id`; threaded through `RankingRepository` → `RankingStoreService` → `RecommendationService` → both route handlers. Request-level identity via `request.user`, decorated by `app.ts`'s auth `onRequest` hook. Along the way, fixed a real bug: `RankingRepository.clear()` was previously unscoped (`DELETE FROM rankings` with no `WHERE`), which would have wiped every user's data, not just the caller's. Full test coverage including cross-user isolation (`ranking.repository.test.ts`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 7   | ~~User authentication~~ — **done, v0.7.0**              | M                            | Medium                                              | Username/password, hashed with `scrypt`, session cookies via `@fastify/cookie`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 8   | ~~Sign-in confirmation / allowlist~~ — **done, v0.7.0** | S–M                          | Medium                                              | Hardcoded `ALLOWED_USERNAMES` env var, checked case-insensitively at registration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## Dependency graph

```
7 (auth) ──┐
           ├──> 4 (hosting) ──┐
8 (allowlist) ──┘             ├──> 5 (multi-user)
                6 (separation) ┘
                (8 also feeds 5 directly)
```

1, 2, and 3 have no dependencies on the above chain and work fine within the
current single-container, run-it-yourself distribution model.

## Agreed implementation order

### Phase 1 — ship fast, no architecture change — **complete**

1. ~~**#2 Position-based filtering**~~ — done, released as **v0.2.0**.
2. ~~**#1 Dev/prod UI switch**~~ — done, released as **v0.3.0**.
3. ~~**Production UI pass**~~ — done, released as **v0.4.0** (not a numbered
   candidate above, but the natural follow-on once #1 shipped the mechanism).
4. ~~**#3 ADP vs. ranking diff**~~ — done, released as **v0.5.0**.

Phase 1 is fully shipped. Next decision point is whether to start Phase 2
(see "Decision framing" below) or stay on the current feature set.

### Phase 2 — only if hosting is actually wanted (bigger commitment) — **complete, v0.7.0**

4. ~~**#7 Authentication**~~ — implemented.
5. ~~**#8 Allowlist / sign-in confirmation**~~ — implemented.
6. ~~**#4 Online hosting**~~ — implemented (Raspberry Pi + Tailscale Funnel).

### Phase 3 — only if the league wants a shared always-on tool — **complete, v0.7.0**

7. ~~**#6 Clean user data separation**~~ — implemented.
8. ~~**#5 Multi-user support**~~ — implemented.

All candidate features from this document are shipped as of **v0.7.0**. No
new version tag was cut for Phase 2/3's work in progress — per earlier
discussion, that happened once Phase 3 as a whole was considered done,
which it now is. Next step: decide what (if anything) goes on a future
version of this plan — there's no pre-agreed Phase 4.

## Phase 4 — Ranking Editor (in progress)

Not one of the original eight candidate features above — proposed and
scoped after Phase 3 completed, with no pre-agreed plan to build it.
Full requirements: [`docs/ranking-editor-requirements.md`](docs/ranking-editor-requirements.md).

In short: a drag-and-drop UI for editing a user's rankings — reordering
players, moving them between tiers, adding/removing tier boundaries, and
moving players in and out of an "unranked" pool — as its own route,
separate from the draft-monitoring view.

**Progress so far:**

- Tier-normalization logic (`apps/api/src/utils/tier.ts`,
  `normalize-ranking-tiers.ts`): converts CSV tier values (numeric or
  letter) to the app's single internal representation (`S`, then `A`-`Z`,
  numeric 1:1 via `S=1, A=2, B=3, ...`), and resolves missing/unrecognized
  tiers by borrowing from nearby rows — forward to the nearest
  worse-ranked tiered row, or for trailing untiered rows, one tier worse
  than the last tiered row (capped at `Z`). Wired into
  `RankingImportService.importCsv` so every import normalizes tiers
  before matching. Full test coverage in `tier.test.ts` and
  `normalize-ranking-tiers.test.ts`.
- No schema change needed for this piece — `ranking_players.tier` already
  existed as a plain `TEXT` column; only its _meaning_ changed, from
  "whatever the CSV said" to "always a normalized internal label."

**Still to build:**

- ~~Four mutation API endpoints~~ — done. `PATCH`/`DELETE` on
  `/rankings/:rankingId/players/:sleeperId` (move/add, remove);
  `POST`/`DELETE` on `/rankings/:rankingId/tiers[/:position]` (insert,
  remove-and-merge). Tiers are now tracked as their own ordered list
  (`ranking_tiers` table) so an empty tier can exist before any player
  is dropped into it. See the requirements doc's "API surface" section.
- ~~An "unranked, active-this-season players" endpoint~~ — done.
  `GET /rankings/:rankingId/unranked-players`, backed by
  `RankingEditorService.getUnrankedPlayers` (reuses
  `isFantasyRelevantPlayer` and `PlayerService.getAllPlayers`, diffed
  against the ranking's matched Sleeper IDs).
- ~~Frontend routing~~ — done. `react-router-dom` added; `/` is the
  existing draft dashboard, `/rankings/edit` is the new ranking editor
  route.
- ~~Read-only ranking editor UI~~ — done. Tiers rendered as grouped
  sections in rank order plus an unranked side panel, backed by
  `GET /rankings/:rankingId` and `GET /rankings/:rankingId/unranked-players`
  via TanStack Query.
- ~~Drag-and-drop mutations~~ — done. `@dnd-kit/core` +
  `@dnd-kit/sortable` + `@dnd-kit/utilities`, wired to the existing
  PATCH/DELETE player endpoints. Local state reorders immediately on
  drag (dnd-kit needs this to feel responsive); the mutation fires on
  drop, and both the ranking-detail and ranking-unranked queries are
  invalidated on settle so the UI reconciles to the server's actual
  (renumbered) state right after. Cross-tier drops translate a
  within-tier drop index to the PATCH endpoint's whole-ranking rank by
  summing the preceding tiers' player counts (`computeGlobalRank`,
  unit-tested directly rather than via simulated drags).
  Still open: explicit add/remove-tier controls, numeric/alphabetical
  tier display toggle.
- Re-import-while-editor-is-open behavior (full replace, per the
  requirements doc).

Phases 2 and 3 together amount to roughly a rewrite of the data and auth
layer. The live draft test already showed the local, run-it-yourself model
works fine at a 1-minute pick clock — Sleeper API latency was not an issue.
Phases 2/3 buy convenience (not having to run the app locally on draft day),
not a missing capability. Before starting Phase 2, confirm with the league
whether "the host runs it locally on draft day" is an actual pain point —
treat this as a deliberate go/no-go decision, not a default continuation of
Phase 1.
