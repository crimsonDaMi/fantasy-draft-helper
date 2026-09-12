# Development Plan

Status as of this writing: MVP has been tested live in an actual draft (1 minute
per pick). Sleeper API latency was **not** a problem at that pace. Distribution
is a single Docker image, published to GHCR
(`ghcr.io/crimsondami/fantasy-draft-helper`), versioned with git-tag-synced
tags (`vX.Y.Z`) — see `RELEASING.md`.

**v0.2.0** ships Phase 1 item #2, position-based filtering.
**v0.3.0** ships Phase 1 item #1, the dev/prod UI switch (see below).

This document tracks the next round of feature ideas: their complexity,
benefit, dependencies, and the agreed implementation order. Intended for
both human contributors and coding agents picking up work on this repo —
read this before starting on any of the items below.

## Candidate features

| # | Feature | Complexity | Benefit | Notes |
|---|---|---|---|---|
| 1 | ~~Dev/prod UI switch~~ — **done, v0.3.0** | M | High | `VITE_UI_MODE` (`debug` \| `draft`), defaulting from `import.meta.env.DEV` — `pnpm dev` gets `debug`, `vite build`/Docker gets `draft`, overridable via `--build-arg VITE_UI_MODE=debug`. `isDebugUi` flag in `config.ts` gates raw draft ID, exact timestamps, polling interval, and the full rankings-import breakdown in `MonitoringStatus.tsx` and `App.tsx`. `DraftForm`, `RankingsUpload`, and `RecommendationsList` were not touched by this pass — worth a look during future production-UI polish. |
| 2 | ~~Position-based filtering~~ — **done, v0.2.0** | S | High | `positions` query param on `GET /drafts/:draftId/recommendations`, filtered in `RecommendationService`, `PositionFilter` checkbox UI in `App.tsx`. Route + service test coverage added. |
| 3 | ADP vs. personal ranking diff — **spike complete, feasible, in progress** | S–M | High | Sleeper's public API doesn't expose ADP, but Sleeper's official account (@SleeperHQ) publicly shares an actively-maintained ADP Google Sheet, explicitly inviting external reuse. Confirmed against real data (`all-players_sleeper.json`, `draft-picks_sleeper.json`, an actual league ranking CSV): the sheet's "Player Id" column is a direct, exact-match Sleeper `player_id` — no fuzzy name/team matching needed, no cost, no ToS conflict. Complexity dropped from the original M–L estimate since the ID-matching risk that justified it is gone. League format is Redraft Superflex (per `REDRAFT_SF-rankings.csv`) — use the sheet's "Redraft SF ADP" column. Treat the sheet as a soft dependency (no formal API contract): cache locally, refresh infrequently (Sleeper updates it every 1–2 weeks), and degrade gracefully (omit the diff indicator) if a fetch fails or the format changes. |
| 4 | Host the app online | M alone / prerequisite-gated | Medium alone, High as enabler | Container work is largely done. Remaining: choose a host, wire env vars/secrets, TLS, and — importantly — confirm the hosting tier has a **persistent** volume (many cheap PaaS tiers are ephemeral, which would silently lose the SQLite DB). **Should not go publicly live before #7 and #8 exist** — otherwise it's an open, unauthenticated endpoint making Sleeper API calls on your behalf. |
| 5 | Multi-user support | L | High (if the league wants an always-on shared tool) | Biggest lift. Touches nearly every API route and the data model — rankings/drafts need to become per-user instead of singular. Depends on #4, #6, #8. |
| 6 | Clean user data separation | M | Medium | `user_id` scoping on every table and query handler. Mostly hardening/trust, not a user-visible feature by itself. Prerequisite for #5. |
| 7 | User authentication | M | Medium | Plumbing, not itself a draft-day feature. A lightweight approach (e.g. magic-link or simple credentials) is proportionate for a ~10-person closed league — full OAuth is likely overkill. Prerequisite for #4. |
| 8 | Sign-in confirmation / allowlist | S–M | Medium | Since the league is a small, known, fixed group, this can be a simple hardcoded allowlist of usernames/emails rather than a general signup-approval flow. Cheap once #7 exists. Prerequisite for #4 and #5. |

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

### Phase 1 — ship fast, no architecture change

1. ~~**#2 Position-based filtering**~~ — done, released as **v0.2.0**.
2. ~~**#1 Dev/prod UI switch**~~ — done, released as **v0.3.0**.
3. **#3 ADP vs. ranking diff** — feasibility spike complete (see table above):
   a free, no-matching-risk data source exists (Sleeper's own publicly-shared
   ADP sheet, keyed by real Sleeper player IDs). **In progress.**

### Phase 2 — only if hosting is actually wanted (bigger commitment)

4. **#7 Authentication**
5. **#8 Allowlist / sign-in confirmation** (natural continuation of #7; both
   needed before going public)
6. **#4 Online hosting** — now safe to expose publicly

### Phase 3 — only if the league wants a shared always-on tool

7. **#6 Clean user data separation**
8. **#5 Multi-user support**

## Decision framing for Phases 2 & 3

Phases 2 and 3 together amount to roughly a rewrite of the data and auth
layer. The live draft test already showed the local, run-it-yourself model
works fine at a 1-minute pick clock — Sleeper API latency was not an issue.
Phases 2/3 buy convenience (not having to run the app locally on draft day),
not a missing capability. Before starting Phase 2, confirm with the league
whether "the host runs it locally on draft day" is an actual pain point —
treat this as a deliberate go/no-go decision, not a default continuation of
Phase 1.
