# Fantasy Draft Helper

Fantasy Draft Helper is a deterministic NFL fantasy draft assistant. It imports a player ranking CSV, matches players to Sleeper IDs, monitors a Sleeper draft, and displays the highest-ranked available players.

The application keeps the required flow:

```text
React web app -> Fastify API -> Sleeper API
```

## MVP Features

- Import a player ranking CSV.
- Match ranking rows to Sleeper player IDs during import.
- Report matched, unmatched, and ambiguous players.
- Persist imported rankings in SQLite.
- Monitor Sleeper draft picks.
- Exclude drafted players from recommendations.
- Display the top available players in ranking order.
- Poll before and during a draft using status-aware intervals.
- Stop polling when the draft completes or a terminal request error occurs.

## Prerequisites

- Node.js 24 or newer. The API uses Node's built-in `node:sqlite` module.
- pnpm 11 or newer.

Install dependencies from the repository root:

```bash
pnpm install
```

## Run Locally

Start the API and web app together:

```bash
pnpm dev
```

Open the web app at [http://localhost:5173](http://localhost:5173).

The API listens on port `3000`. Its health endpoint is available at [http://localhost:3000/health](http://localhost:3000/health).

The default SQLite database is created at `data/fantasy-draft-helper.db`. Set `RANKINGS_DATABASE_PATH` to use a different database file:

```bash
RANKINGS_DATABASE_PATH=/path/to/rankings.db pnpm --filter @fantasy-draft-helper/api dev
```

## Ranking CSV

The canonical CSV format uses lowercase headers:

```csv
rank,player,position,team,tier,notes
1,Ja'Marr Chase,WR,CIN,1,Target share leader
2,Bijan Robinson,RB,ATL,1,
```

Required columns:

- `rank`: positive integer.
- `player`: non-empty player name.

Optional columns:

- `position`: `QB`, `RB`, `WR`, `TE`, `K`, or `DEF`.
- `team`: team abbreviation.
- `tier`.
- `notes`.

For compatibility, the importer also accepts the existing legacy headers `Rank`, `Name`, `Position`, `Team`, `Tier`, and `player_id`.

The sample file is [test-data/example-rankings.csv](test-data/example-rankings.csv).

## API

### Health

```text
GET /health
```

### Import rankings

```text
POST /rankings
Content-Type: multipart/form-data
```

The multipart field is `file`. The response includes a `rankingId` and import counts:

```json
{
  "rankingId": "string",
  "playersImported": 250,
  "playersMatched": 247,
  "playersAmbiguous": 1,
  "playersUnmatched": 2
}
```

### Get a draft

```text
GET /drafts/:draftId
```

Returns normalized draft metadata, including `PRE_DRAFT`, `DRAFTING`, `COMPLETE`, or `UNKNOWN` status.

### Get recommendations

```text
GET /drafts/:draftId/recommendations?rankingId=<rankingId>&limit=20
```

The response includes draft status, total picks, drafted-player count, last pick when available, freshness timestamps, and recommendations.

The frontend communicates only with these API endpoints. It does not call Sleeper directly.

## Polling Behavior

The web app uses TanStack Query:

- No draft ID or ranking ID: monitoring is disabled.
- Pre-draft: approximately every 30 seconds.
- Active draft: approximately every 3 seconds.
- Completed draft: polling stops.
- Terminal request errors: polling stops and a retry action is shown.

The active interval can be changed with `VITE_POLLING_INTERVAL_MS`:

```bash
VITE_POLLING_INTERVAL_MS=5000 pnpm --filter @fantasy-draft-helper/web dev
```

## Development Commands

Run all tests:

```bash
pnpm test
```

Build all workspaces:

```bash
pnpm build
```

Lint the web app:

```bash
pnpm --filter @fantasy-draft-helper/web lint
```

## Smoke Test

1. Run `pnpm dev`.
2. Open [http://localhost:5173](http://localhost:5173).
3. Upload [test-data/example-rankings.csv](test-data/example-rankings.csv).
4. Confirm the import summary and matched count.
5. Enter a valid Sleeper draft ID and start monitoring.
6. Confirm draft status, pick progress, freshness time, and recommendations appear.
7. During an active draft, confirm a reported pick removes that player after the next refresh.
8. Confirm a completed draft displays the completed state and stops polling.
9. Try an invalid draft ID and confirm the error is shown without an endless polling loop.
10. Try an invalid CSV and confirm row-level errors and re-import guidance are shown.

Sleeper may delay exposing picks through its API. Recommendations represent the latest state returned by Sleeper and may briefly be stale during that delay.

## Project Structure

```text
apps/api/       Fastify API, Sleeper client, domain services, SQLite repository
apps/web/       React and Vite dashboard
packages/shared Shared TypeScript package
docs/           Agent guide, MVP completion plan, and known issues
 test-data/      Sample ranking CSV
```

The authoritative engineering rules are in [docs/CODING_AGENT_GUIDE.md](docs/CODING_AGENT_GUIDE.md), and the acceptance checklist is in [docs/MVP_COMPLETION_PLAN.md](docs/MVP_COMPLETION_PLAN.md).

## MVP Scope

The MVP intentionally does not include authentication, payments, collaboration, WebSockets, automated drafting, machine learning, positional scarcity, roster optimization, or advanced draft strategy.
