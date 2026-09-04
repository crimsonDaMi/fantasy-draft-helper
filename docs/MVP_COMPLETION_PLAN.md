# MVP Completion Plan

This document is the verification checklist for the Fantasy Draft Helper MVP. It records the target contract, the current baseline, the implementation sequence, and the evidence required to call the MVP complete.

## Verification Commands

Run from the repository root:

```bash
pnpm test
pnpm build
pnpm --filter @fantasy-draft-helper/web lint
```

The MVP must pass all three commands. Add focused tests before changing shared behavior.

## Current Baseline

Verified on 2026-09-04:

- `pnpm test`: 20 API test files, 64 tests passing.
- `pnpm build`: API and web builds passing.
- The API has working Sleeper client, player cache, CSV import, deterministic matching, draft state, and recommendation services.
- The web app has draft input, CSV upload, recommendation display, loading state, and error state.

Known gaps that block MVP completion:

- The parser uses legacy headers and requires team and position, conflicting with the documented CSV contract.
- Recommendations do not return draft status, total picks, or last pick.
- Recommendation polling is hand-written, fixed at three seconds, and does not stop for completed drafts.
- TanStack Query is not installed or used.
- The recommendation route calculates recommendations twice per request.
- The shared package is not the source of shared API/domain contracts.

## Canonical MVP Contract

### CSV

The canonical headers are:

```csv
rank,player,position,team,tier,notes
1,Ja'Marr Chase,WR,CIN,1,Target share leader
```

Required columns:

- `rank`: positive integer.
- `player`: non-empty player name.

Optional columns:

- `position`: normalized to an allowed fantasy position when present.
- `team`: normalized to an uppercase team abbreviation when present.
- `tier`: preserved as ranking metadata.
- `notes`: preserved only if the UI or API exposes it; otherwise it may be ignored after validation.

The importer may support the existing legacy headers (`Rank`, `Name`, `Position`, `Team`, `Tier`, `player_id`) for compatibility, but the canonical format must be documented and tested. Missing required headers, empty files, malformed rows, and rankings with no valid rows must produce structured validation errors.

### API

- `GET /health` returns `{ "status": "ok" }`.
- `POST /rankings` accepts `multipart/form-data` with a CSV file and returns a unique `rankingId` plus matched, ambiguous, unmatched, and error counts.
- `GET /drafts/:draftId` returns normalized draft metadata, including status.
- `GET /drafts/:draftId/recommendations?rankingId=<id>&limit=10` returns draft status, pick count, last pick when available, freshness timestamp, and recommendations.
- Internal `Set` values and raw Sleeper responses are never returned as JSON.
- Invalid input, missing rankings, unknown rankings, invalid draft IDs, and Sleeper failures use structured, user-readable errors.

### Persistence

SQLite stores at least:

- `rankings`: `id`, `name`, `created_at`.
- `ranking_players`: ranking ID, rank, name, position, team, tier, Sleeper ID, and match status.

Repositories hide SQL from services. After an API restart, an imported ranking remains available by `rankingId`.

### Polling

The frontend uses TanStack Query with a query key containing both `draftId` and `rankingId`:

- Required IDs missing: disabled.
- `PRE_DRAFT`: approximately 30 seconds.
- `DRAFTING`: approximately 3 seconds.
- `COMPLETE`: disabled.

The UI shows the draft status and the timestamp of the latest successful refresh. Sleeper propagation delay is represented as freshness information, not hidden or guessed around.

## Implementation Sequence

### Phase 1: Contract and persistence

- [x] Choose and document the SQLite library, database path, schema initialization, and test database strategy.
- [x] Add ranking and ranking-player repositories.
- [x] Generate a stable ranking ID per import.
- [x] Persist pre-matched ranking rows and import summaries.
- [x] Make recommendation requests select rankings by ID.
- [x] Add restart/persistence tests.

Exit evidence: an imported ranking can be retrieved and used for recommendations after reconstructing application dependencies. SQLite uses Node 24's built-in `node:sqlite`; the default database is `data/fantasy-draft-helper.db`, configurable with `RANKINGS_DATABASE_PATH`, and tests use temporary files or `:memory:`.

### Phase 2: CSV and matching correctness

- [ ] Support canonical lowercase headers and optional team/position.
- [ ] Validate required headers, empty files, invalid rows, and no-valid-row files.
- [ ] Add exact name + team matching fallback.
- [ ] Make player-cache initialization safe for concurrent first requests.
- [ ] Add tests for all required normalization and matching cases.

Exit evidence: focused CSV and matching tests cover every rule in the guide and pass.

### Phase 3: Recommendation API

- [ ] Remove duplicate recommendation calculation in the route.
- [ ] Return draft status, total picks, last pick, and freshness timestamp.
- [ ] Preserve ranking order without sorting on every polling request.
- [ ] Add route-level tests for successful, missing-ranking, invalid-draft, and completed-draft responses.

Exit evidence: one request makes one draft-state fetch and one recommendation calculation, with the documented JSON shape.

### Phase 4: Frontend monitoring

- [ ] Add TanStack Query and a dedicated recommendations query hook.
- [ ] Store the returned `rankingId` after import.
- [ ] Enable monitoring only when both IDs are present.
- [ ] Use status-aware polling and stop polling after completion.
- [ ] Display status, pick progress, last pick, import details, loading, error, and freshness states.

Exit evidence: a browser workflow can import a ranking, start monitoring, see recommendations update, and stop refreshing for a completed draft.

### Phase 5: End-to-end verification

- [ ] Add deterministic fixtures or mocked Sleeper responses for pre-draft, active, and complete states.
- [ ] Verify a drafted player disappears from recommendations after the next refresh.
- [ ] Verify unmatched and ambiguous players never appear in recommendations.
- [ ] Verify API restart does not lose the ranking.
- [ ] Run all verification commands and record results in the change summary.

## Definition of Done

The MVP is complete only when all of the following are true:

- [ ] A user can start the API and web app using documented commands.
- [ ] A valid CSV can be imported using the canonical format.
- [ ] The response provides a stable `rankingId` and match summary.
- [ ] Unmatched and ambiguous players are visible to the user and excluded from recommendations.
- [ ] Rankings survive an API restart.
- [ ] A valid Sleeper draft ID returns normalized draft state.
- [ ] The UI displays the top 10 pre-matched, available players in ranking order.
- [ ] A newly reported Sleeper pick removes that player from recommendations.
- [ ] Polling uses the required interval for the draft status and stops when the draft completes.
- [ ] `pnpm test`, `pnpm build`, and web lint pass.
- [ ] No non-MVP feature has been added without explicit approval.

## Known External Limitation

Sleeper may delay exposing draft picks through its API. The MVP must show the last successful refresh time and use the state returned by Sleeper. It must not infer picks, claim real-time consistency, or add WebSockets to compensate for this limitation.
