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

This document tracks the next round of feature ideas: their complexity,
benefit, dependencies, and the agreed implementation order. Intended for
both human contributors and coding agents picking up work on this repo —
read this before starting on any of the items below.

## Candidate features

| #   | Feature                                                | Complexity                   | Benefit                                             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------ | ---------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ~~Dev/prod UI switch~~ — **done, v0.3.0**              | M                            | High                                                | `VITE_UI_MODE` (`debug` \| `draft`), defaulting from `import.meta.env.DEV` — `pnpm dev` gets `debug`, `vite build`/Docker gets `draft`, overridable via `--build-arg VITE_UI_MODE=debug`. `isDebugUi` flag in `config.ts` gates raw draft ID, exact timestamps, polling interval, and the full rankings-import breakdown in `MonitoringStatus.tsx` and `App.tsx`. `DraftForm`, `RankingsUpload`, and `RecommendationsList` were not touched by this pass — worth a look during future production-UI polish.                                                                                                                                                                                                                                                |
| 2   | ~~Position-based filtering~~ — **done, v0.2.0**        | S                            | High                                                | `positions` query param on `GET /drafts/:draftId/recommendations`, filtered in `RecommendationService`, `PositionFilter` checkbox UI in `App.tsx`. Route + service test coverage added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 3   | ~~ADP vs. personal ranking diff~~ — **done, v0.5.0**   | S–M                          | High                                                | Sourced from Sleeper's official, publicly-shared ADP Google Sheet (@SleeperHQ) — keyed by real Sleeper `player_id`, so no fuzzy matching needed, no cost, no ToS conflict. `AdpClient` fetches the sheet's CSV export; `AdpService` caches it with a 24h refresh interval and failure backoff, degrading gracefully (omits the `adp` field) rather than breaking recommendations on fetch failure or format changes. Reads the "Redraft SF ADP" column, matching this league's Superflex format (change `ADP_COLUMN` in `adp.service.ts` for other formats). `Recommendation.adp = { value, diff }`, where `diff = your rank − ADP value`. UI shows a sign-colored badge in `RecommendationsList`, muted below a ±1 threshold.                             |
| 4   | ~~Host the app online~~ — **implemented**              | M alone / prerequisite-gated | Medium alone, High as enabler                       | Self-hosted on a Raspberry Pi 4B (running alongside an existing Pi-hole), not the originally-planned cloud PaaS — Oracle Cloud was ruled out (debit card rejected at signup) and direct port forwarding turned out not to be possible on the home network. Exposed via Tailscale Funnel: no port forwarding, no owned domain, stable `<device>.<tailnet>.ts.net` HTTPS URL, TLS handled entirely by Tailscale. An earlier DuckDNS + Caddy (DNS-01) plan was built and abandoned once the port-forwarding blocker was discovered. Deployed via `deploy/pi/` (its own `docker-compose.yml`, `.env`, and a dedicated `deploy/pi/README.md` runbook); not version-tagged separately, since it's a deployment milestone rather than an application code change. |
| 5   | Multi-user support                                     | L                            | High (if the league wants an always-on shared tool) | Biggest lift. Touches nearly every API route and the data model — rankings/drafts need to become per-user instead of singular. Depends on #4, #6, #8 — **all three are now done**, unblocking this.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 6   | ~~Clean user data separation~~ — **implemented**       | M                            | Medium                                              | `rankings` table scoped by `user_id`; threaded through `RankingRepository` → `RankingStoreService` → `RecommendationService` → both route handlers. Request-level identity via `request.user`, decorated by `app.ts`'s auth `onRequest` hook. Along the way, fixed a real bug: `RankingRepository.clear()` was previously unscoped (`DELETE FROM rankings` with no `WHERE`), which would have wiped every user's data, not just the caller's. Full test coverage including cross-user isolation (`ranking.repository.test.ts`).                                                                                                                                                                                                                            |
| 7   | ~~User authentication~~ — **implemented**              | M                            | Medium                                              | Username/password, hashed with `scrypt`, session cookies via `@fastify/cookie`. Not yet version-tagged — will ship alongside #4's release.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 8   | ~~Sign-in confirmation / allowlist~~ — **implemented** | S–M                          | Medium                                              | Hardcoded `ALLOWED_USERNAMES` env var, checked case-insensitively at registration. Same release as above.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

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

### Phase 2 — only if hosting is actually wanted (bigger commitment) — **complete**

4. ~~**#7 Authentication**~~ — implemented.
5. ~~**#8 Allowlist / sign-in confirmation**~~ — implemented.
6. ~~**#4 Online hosting**~~ — implemented (Raspberry Pi + Tailscale Funnel).

### Phase 3 — only if the league wants a shared always-on tool

7. ~~**#6 Clean user data separation**~~ — implemented.
8. **#5 Multi-user support** — unblocked, all prerequisites done. **Next up.**

## Decision framing for Phases 2 & 3

Phases 2 and 3 together amount to roughly a rewrite of the data and auth
layer. The live draft test already showed the local, run-it-yourself model
works fine at a 1-minute pick clock — Sleeper API latency was not an issue.
Phases 2/3 buy convenience (not having to run the app locally on draft day),
not a missing capability. Before starting Phase 2, confirm with the league
whether "the host runs it locally on draft day" is an actual pain point —
treat this as a deliberate go/no-go decision, not a default continuation of
Phase 1.
