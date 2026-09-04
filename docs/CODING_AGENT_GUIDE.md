# NFL Fantasy Draft Helper — Coding Agent Development Guide

## Mission

Implement an MVP web application that monitors a Sleeper NFL fantasy draft and recommends the highest-ranked available players according to a user-uploaded CSV ranking.

The MVP is a deterministic ranking helper. Do not implement advanced fantasy strategy, AI recommendations, positional scarcity, roster optimization, or authentication unless explicitly requested.

The verification checklist for this guide is [`MVP_COMPLETION_PLAN.md`](MVP_COMPLETION_PLAN.md). Keep that document updated when an acceptance criterion or API contract changes.

## Current Repository State

The repository already contains a working Fastify API, Sleeper client, in-memory player cache, CSV import services, deterministic matching, draft-state services, recommendation services, React UI components, and focused API tests.

The remaining MVP work is tracked explicitly in the completion plan. Phases 1 through 5 are implemented; the completion plan records the final verification evidence and any future operational evaluation separately.

Do not describe any of those items as complete until the corresponding checklist item and verification evidence exist.

---

# 1. Primary Requirements

The application must:

1. Accept a Sleeper draft ID.
2. Accept a CSV ranking file.
3. Parse and validate the CSV.
4. Obtain NFL player metadata from Sleeper and cache it.
5. Match CSV players to Sleeper player IDs.
6. Report matched, ambiguous, and unmatched players.
7. Obtain draft picks from Sleeper.
8. Determine which players have already been drafted.
9. Return the highest-ranked available players.
10. Poll regularly while the draft is active.
11. Display recommendations in a React UI.

---

# 2. Required Technology

## Monorepo

- pnpm workspaces

## Frontend

- React
- TypeScript
- Vite
- TanStack Query
- Tailwind CSS

## Backend

- Node.js
- TypeScript
- Fastify
- Zod for validation

## Storage

- SQLite for the MVP

## Testing

Use the project's standard TypeScript testing setup. Prefer unit tests for algorithms and services.

Do not introduce unnecessary frameworks.

---

# 3. Repository Layout

Create:

```text
fantasy-draft-helper/
├── apps/
│   ├── api/
│   └── web/
├── packages/
│   └── shared/
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

Backend:

```text
apps/api/src/
├── app.ts
├── server.ts
├── clients/
│   └── sleeper.client.ts
├── routes/
│   ├── health.routes.ts
│   ├── drafts.routes.ts
│   └── rankings.routes.ts
├── services/
│   ├── draft.service.ts
│   ├── ranking.service.ts
│   ├── player.service.ts
│   └── recommendation.service.ts
├── algorithms/
│   ├── player-matcher.ts
│   └── recommendation-engine.ts
├── repositories/
│   ├── ranking.repository.ts
│   └── player.repository.ts
├── cache/
│   └── player-cache.ts
├── domain/
│   ├── player.ts
│   ├── draft.ts
│   ├── ranking.ts
│   └── recommendation.ts
└── utils/
    └── normalize-name.ts
```

Frontend:

```text
apps/web/src/
├── main.tsx
├── App.tsx
├── components/
│   ├── DraftHeader/
│   ├── RecommendationList/
│   ├── RankingUpload/
│   └── PositionFilter/
├── features/
│   ├── draft/
│   └── rankings/
├── hooks/
│   └── useDraftPolling.ts
└── lib/
    └── api-client.ts
```

Shared package:

```text
packages/shared/src/
├── player.ts
├── draft.ts
├── ranking.ts
└── recommendation.ts
```

---

# 4. Architectural Rules

## Rule 1: Frontend must not call Sleeper directly

Required flow:

```text
React -> Fastify API -> Sleeper API
```

## Rule 2: Business logic belongs in backend services/algorithms

React should display data and manage UI state.

Do not put:

- Player matching logic in React.
- Recommendation logic in React.
- Sleeper API client logic in React.

## Rule 3: Separate external API code from business logic

`sleeper.client.ts` only communicates with Sleeper.

It must not:

- Match players.
- Calculate recommendations.
- Parse CSV.

## Rule 4: Match players during CSV import

Never repeatedly match CSV names to Sleeper players during polling.

After import, a ranking player should contain a resolved `sleeperId` where possible.

## Rule 5: Keep the MVP deterministic

Given:

- The same ranking.
- The same drafted player IDs.

The recommendation result must always be identical.

---

# 5. Domain Models

Use explicit domain types.

Example:

```typescript
export interface SleeperPlayer {
  sleeperId: string;
  fullName: string;
  position?: string;
  team?: string;
}

export interface RankedPlayer {
  id: string;
  rankingId: string;
  rank: number;
  name: string;
  position?: string;
  team?: string;
  tier?: number;
  sleeperId?: string;
  matchStatus: MatchStatus;
}

export type MatchStatus = "MATCHED" | "AMBIGUOUS" | "UNMATCHED";

export interface DraftPick {
  playerId: string;
  pickNo: number;
  round: number;
  rosterId: number;
}
```

Do not expose internal Sets through JSON responses.

---

# 6. Sleeper Client

Create a dedicated client.

Responsibilities:

- Get draft metadata.
- Get draft picks.
- Get NFL players.

Conceptual methods:

```typescript
class SleeperClient {
  getDraft(draftId: string): Promise<unknown>;
  getDraftPicks(draftId: string): Promise<unknown[]>;
  getNFLPlayers(): Promise<Record<string, unknown>>;
}
```

Use Node's built-in `fetch` unless there is a compelling reason not to.

All Sleeper response transformation should happen in the backend boundary layer.

Do not leak unvalidated raw API objects throughout the application.

---

# 7. Player Cache

The Sleeper NFL player dataset must not be downloaded for every recommendation request.

Implement an initial in-memory cache.

Suggested interface:

```typescript
interface PlayerCache {
  getPlayers(): Promise<SleeperPlayer[]>;
  refresh(): Promise<void>;
}
```

The cache should support:

- Lookup by Sleeper ID.
- Lookup by normalized name.

Suggested indexes:

```text
Map<sleeperId, SleeperPlayer>
Map<normalizedName, SleeperPlayer[]>
```

Keep cache implementation isolated so persistence can be changed later.

---

# 8. CSV Import Requirements

The canonical CSV format is:

```csv
rank,player,position,team,tier,notes
1,Ja'Marr Chase,WR,CIN,1,Target share leader
```

Required columns:

- `rank`
- `player`

Optional columns:

- `position`
- `team`
- `tier`
- `notes`

Validate:

- Rank is a positive integer.
- Player is non-empty.
- Position/team are normalized if present.

The importer may accept the existing legacy headers (`Rank`, `Name`, `Position`, `Team`, `Tier`, and `player_id`) for compatibility, but new documentation and fixtures must use the canonical lowercase headers. `Rank` maps to `rank`, `Name` maps to `player`, and `player_id` may be used as an explicit Sleeper ID after validation.

Validate the header row before processing records. Reject missing required columns, empty files, malformed CSV, and files that contain no valid ranking rows. Return structured row-level errors rather than silently dropping invalid data.

Do not silently ignore malformed required data.

After parsing:

1. Validate the header and rows.
2. Normalize values.
3. Match each player.
4. Persist the ranking and pre-matched rows.
5. Return a stable `rankingId` and import summary.

The ranking import endpoint is `POST /rankings` with `multipart/form-data`. A compatibility endpoint may remain temporarily, but it must return the same contract. An imported ranking must remain available after an API restart; the process-global ranking store is not sufficient for the completed MVP.

---

# 9. Name Normalization Algorithm

Implement a reusable function:

```typescript
normalizeName(name: string): string
```

The function should:

1. Convert to lowercase.
2. Normalize Unicode.
3. Remove diacritics.
4. Remove punctuation.
5. Collapse repeated whitespace.
6. Trim.

Examples:

```text
Ja'Marr Chase -> jamarr chase
D.J. Moore -> dj moore
```

Do not perform fuzzy matching inside this function.

Unit-test this utility thoroughly.

---

# 10. Player Matching Algorithm

Implement deterministic matching.

Input:

- CSV ranking player.
- Indexed Sleeper players.

Matching order:

1. Exact normalized name + exact position + exact team.
2. Exact normalized name + exact position.
3. Exact normalized name + exact team.
4. Exact normalized name when there is exactly one candidate.
5. Otherwise return AMBIGUOUS or UNMATCHED.

Pseudocode:

```text
candidates = playersByNormalizedName[name]

if no candidates:
    return UNMATCHED

if exactly one candidate matching name + position + team:
    return MATCHED

if exactly one candidate matching name + position:
    return MATCHED

if exactly one candidate matching name + team:
    return MATCHED

if candidates contains exactly one player:
    return MATCHED

if candidates has multiple plausible players:
    return AMBIGUOUS

return UNMATCHED
```

Do not automatically use fuzzy matching in the MVP.

If fuzzy suggestions are later added, they must not automatically create a MATCHED result.

---

# 11. Match Result

Represent the result explicitly.

```typescript
interface PlayerMatchResult {
  status: MatchStatus;
  sleeperId?: string;
  confidence?: number;
  candidateSleeperIds?: string[];
}
```

For the MVP, confidence may be a numeric score or omitted. Match status is mandatory.

---

# 12. Recommendation Algorithm

The ranking should be stored or loaded in ascending rank order.

Input:

- Ranked players.
- `Set<string>` containing drafted Sleeper IDs.
- Limit, default 10.

Algorithm:

```text
result = []

for player in ranking order:
    if player.matchStatus is not MATCHED:
        continue

    if player.sleeperId is missing:
        continue

    if player.sleeperId is drafted:
        continue

    add player to result

    if result.length equals limit:
        stop

return result
```

Avoid sorting on every request when the ranking is already ordered.

The recommendation engine should be a pure function where practical.

---

# 13. Draft Polling Flow

## MVP design

The frontend polls the backend.

```text
React
  |
  | GET recommendations every 3 seconds while drafting
  v
Fastify API
  |
  v
Sleeper API
  |
  v
Draft Picks
  |
  v
Extract drafted player IDs
  |
  v
Recommendation Engine
  |
  v
JSON response
```

## Polling intervals

- Pre-draft: approximately 30 seconds.
- Active draft: approximately 3 seconds.
- Complete draft: polling disabled.

Use TanStack Query on the frontend.

Do not use WebSockets in the MVP.

---

# 14. Draft Change Detection

Optionally cache recommendations when the draft has not changed.

Create a draft version based on:

```text
<pick count>:<last player id>
```

Example:

```text
42:12345
```

If the next poll produces the same version, cached recommendations can be returned.

Correctness is more important than aggressive optimization.

---

# 15. API Contract

## Health

```text
GET /health
```

Response:

```json
{
  "status": "ok"
}
```

## Import ranking

```text
POST /rankings
```

Content type:

- multipart/form-data

Response:

```json
{
  "rankingId": "string",
  "playersImported": 250,
  "playersMatched": 247,
  "playersAmbiguous": 1,
  "playersUnmatched": 2
}
```

## Get draft

```text
GET /drafts/:draftId
```

Return useful normalized draft information.

## Get recommendations

```text
GET /drafts/:draftId/recommendations?rankingId=<rankingId>
```

Response should include:

- Draft ID.
- Draft status.
- Total picks.
- Current pick count where available.
- Last pick where available.
- Last updated timestamp.
- Recommendations.

Do not return raw Sleeper responses unless explicitly required.

---

# 16. Database

Use SQLite for the MVP.

Minimum conceptual tables:

## rankings

- id
- name
- created_at

## ranking_players

- id
- ranking_id
- rank
- name
- position
- team
- tier
- sleeper_id
- match_status

Repositories should hide database details from services. Choose and document the SQLite library, database path, schema initialization, and test database strategy. Services must not contain SQL. Verify that an imported ranking remains available after recreating application dependencies or restarting the API.

Business services should not contain SQL.

---

# 17. Frontend Requirements

Create a simple dashboard containing:

1. Draft ID input.
2. CSV ranking upload.
3. Import summary.
4. Draft status.
5. Total/current pick information where available.
6. Last pick where available.
7. Top 10 available players.
8. Loading state.
9. Error state.
10. Automatic refresh during an active draft.

Initial UI does not need elaborate styling.

Prioritize:

- Readability.
- Clear state.
- Fast visual updates.
- Useful error messages.

---

# 18. TanStack Query Requirements

Recommendations should be fetched through a dedicated API module and hook.

Example conceptual query:

```typescript
useQuery({
  queryKey: ["recommendations", draftId, rankingId],
  queryFn: fetchRecommendations,
  enabled: Boolean(draftId && rankingId),
  refetchInterval: dynamicInterval,
});
```

The polling interval must be disabled when:

- Required IDs are missing.
- The draft is complete.

Use approximately 30 seconds before the draft and 3 seconds while drafting. Show draft status, pick progress, last pick, and the timestamp of the last successful refresh so Sleeper propagation delay is visible.

---

# 19. Error Handling

Handle:

- Invalid draft ID.
- Sleeper network failure.
- Invalid CSV.
- Missing required columns.
- Empty ranking.
- Player cache failure.
- Unmatched players.

Do not swallow errors.

Return structured, useful API errors.

Frontend errors should be understandable without reading server logs.

---

# 20. Testing Requirements

Prioritize tests in this order:

1. `normalizeName`.
2. Player matching.
3. Recommendation engine.
4. CSV validation.
5. Draft service.

Required matching tests:

- Apostrophes.
- Periods.
- Duplicate names.
- Name + position + team.
- Name + position.
- Name + team.
- Unique name.
- Ambiguous name.
- Unmatched player.
- Missing optional position.
- Missing optional team.
- Name + team without position.

Required recommendation tests:

- Drafted players are excluded.
- Unmatched players are excluded.
- Ranking order is preserved.
- Limit is respected.
- Empty rankings return empty results.

Required integration coverage:

- Missing CSV headers and empty files return structured errors.
- Ranking imports return a stable `rankingId`.
- Persisted rankings survive application restart.
- Recommendation responses include draft status and pick metadata.
- Completed drafts disable frontend polling.

---

# 21. Development Sequence

The detailed, checkable sequence and exit evidence are maintained in [`MVP_COMPLETION_PLAN.md`](MVP_COMPLETION_PLAN.md). Use that document as the task checklist and keep this section as the architectural order.

Implement in this order.

## Step 1: Repository foundation

- Initialize pnpm workspace.
- Create API application.
- Create web application.
- Create shared package.
- Verify all applications build.

## Step 2: API foundation

- Create Fastify app.
- Add health endpoint.
- Add error handling.
- Add CORS.

## Step 3: Sleeper integration

- Implement Sleeper client.
- Implement draft fetch.
- Implement picks fetch.
- Implement player dataset fetch.

## Step 4: Player cache

- Implement in-memory cache.
- Build indexes.
- Add tests.

## Step 5: CSV import

- Implement upload endpoint.
- Parse CSV.
- Validate schema.
- Normalize values.

## Step 6: Player matcher

- Implement deterministic matching.
- Add extensive tests.
- Return import summary.

## Step 7: Persistence

- Add SQLite.
- Persist rankings and ranking players.
- Implement repositories.

## Step 8: Recommendation engine

- Implement pure filtering algorithm.
- Add tests.

## Step 9: Recommendation API

- Combine ranking, draft picks, and recommendation engine.
- Return normalized response.

## Step 10: Frontend

- Draft ID input.
- CSV upload.
- Recommendations.
- Loading/errors.

## Step 11: Polling

- Add TanStack Query.
- Add dynamic polling interval.
- Verify UI updates after a draft pick.

---

# 22. Definition of Done for MVP

The MVP is complete when a user can:

1. Start the application.
2. Enter a valid Sleeper draft ID.
3. Upload a valid ranking CSV.
4. See how many players were matched.
5. See unmatched or ambiguous players.
6. Start monitoring the draft.
7. See the top 10 highest-ranked available players.
8. See recommendations automatically change after a new draft pick.
9. Stop polling automatically when the draft completes.

Also required:

10. Imported rankings survive an API restart and are addressed by `rankingId`.
11. The canonical CSV format is accepted, while legacy fixtures remain supported only for compatibility.
12. The API returns status, pick metadata, and freshness information.
13. `pnpm test`, `pnpm build`, and `pnpm --filter @fantasy-draft-helper/web lint` pass.

---

# 23. Non-Goals

Do not implement in the MVP:

- Authentication.
- Payments.
- Multi-user collaboration.
- WebSockets.
- Advanced draft strategy.
- Machine learning.
- Value-over-replacement calculations.
- Positional scarcity.
- Roster optimization.
- Automated drafting.
- Direct interaction with Sleeper on behalf of the user.

---

# 24. Quality Guidelines

- Prefer simple, explicit code.
- Avoid premature abstraction.
- Keep external API boundaries isolated.
- Keep algorithms independently testable.
- Use TypeScript types rather than `any`.
- Validate external data.
- Do not duplicate domain models unnecessarily.
- Keep recommendation logic deterministic.
- Add tests before optimizing.
- Do not introduce features outside MVP scope without approval.

---

# 25. Critical Design Decision

The ranking import is the expensive matching phase.

Runtime draft polling must NOT repeatedly perform player-name matching.

Required flow:

```text
CSV Import
    |
    v
Normalize CSV Player
    |
    v
Match to Sleeper ID
    |
    v
Persist Pre-Matched Ranking


Draft Poll
    |
    v
Get Draft Picks
    |
    v
Create Set of Drafted Sleeper IDs
    |
    v
Filter Pre-Matched Ranking
    |
    v
Return Top 10
```

This is the intended MVP architecture.

# 26. Coding Agent Workflow

Before editing:

1. Read this guide and [`MVP_COMPLETION_PLAN.md`](MVP_COMPLETION_PLAN.md).
2. Inspect the nearest implementation and test files.
3. State one falsifiable local hypothesis and one focused validation check.

After the first substantive edit:

1. Run the narrowest relevant test, typecheck, build, or lint command immediately.
2. Repair failures in the same slice before expanding scope.
3. Add focused tests for behavior changes.

Before reporting completion:

1. Run `pnpm test` and `pnpm build` for backend or cross-workspace changes.
2. Run `pnpm --filter @fantasy-draft-helper/web lint` for frontend changes.
3. Report commands run, results, and any unchecked completion-plan items.

Agents must not commit, create branches, reset the worktree, or revert user changes unless explicitly asked. Keep unrelated changes untouched.
