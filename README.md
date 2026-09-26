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

## Post-MVP Features

- Filter recommendations by position (`positions` query param / UI checkboxes).
- Draft-day vs. debug UI mode (`VITE_UI_MODE`) — see "UI Modes" below.
- ADP vs. personal ranking diff, sourced from Sleeper's publicly-shared ADP
  sheet — see "ADP Data Source" below.

## Prerequisites

- Node.js 24 or newer. The API uses Node's built-in `node:sqlite` module.
- pnpm 11 or newer.

Install dependencies from the repository root:

```bash
pnpm install
```

## Deployment Options

This app can run two ways:

- **Self-run locally**, per-user, via the `docker-compose.yml` in this
  repo's root — each person runs their own instance during their own
  draft. See "Run Locally" below.
- **Centrally hosted**, one instance shared by a whole league, with
  authentication gating access. [`deploy/pi/README.md`](deploy/pi/README.md)
  documents a real working example of this (Raspberry Pi + Tailscale
  Funnel, no port forwarding or owned domain required) — adaptable to
  any always-on device.

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

There is no migration system for local development, matching the
production policy in [`RELEASING.md`](RELEASING.md#telling-league-mates-about-an-update):
a schema change (a new/altered column in any repository's `CREATE TABLE`)
is a breaking change for an existing database file, since
`CREATE TABLE IF NOT EXISTS` is a no-op against a table that already
exists under the old schema. If `pnpm dev` fails at API startup with a
SQLite error like `no such column: ...`, delete your local
`data/fantasy-draft-helper.db` (or whatever `RANKINGS_DATABASE_PATH`
points at) and restart — a fresh database will be created automatically,
and you'll need to re-register and re-import your rankings.

## UI Modes (Debug vs. Draft)

The web app renders in one of two modes, controlled by `VITE_UI_MODE`:

- **`debug`** — shows all monitoring detail: draft ID, exact Sleeper-refresh
  and generated timestamps, polling interval, and the full rankings-import
  breakdown (imported/matched/unmatched/ambiguous/errors). Used automatically
  by `pnpm dev`.
- **`draft`** — condensed, draft-day-focused view: pick progress, last pick,
  a human-readable draft status, and a one-line rankings-import confirmation.
  Used automatically by `vite build` (and therefore by the Docker image).

The mode is chosen automatically from `import.meta.env.DEV`, so no
configuration is needed for the normal case. To override it explicitly — for
example, to build a debug-mode image for troubleshooting a league mate's bug
report:

```bash
docker build --build-arg VITE_UI_MODE=debug -t fantasy-draft-helper:debug .
```

Valid values: `debug`, `draft`. Any other value falls back to the automatic
`import.meta.env.DEV`-based default.

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

The multipart field is `file`. The response includes a `rankingId`, an
import summary, row-level validation errors (if any), and details on
unmatched and ambiguous players:

```json
{
  "rankingId": "string",
  "summary": {
    "imported": 250,
    "matched": 247,
    "unmatched": 2,
    "ambiguous": 1,
    "errors": 0
  },
  "validationErrors": [{ "row": 12, "message": "string" }],
  "unmatchedPlayers": [
    { "rank": 5, "name": "string", "team": "string", "position": "string" }
  ],
  "ambiguousPlayers": [
    {
      "rank": 8,
      "name": "string",
      "candidates": [{ "sleeperId": "string", "fullName": "string" }]
    }
  ]
}
```

### Rankings status

```text
GET /rankings/status
```

Returns whether any ranking has been imported, plus the total and matched
player counts for the currently stored ranking(s).

### Authentication

```text
POST /auth/register
POST /auth/login
POST /auth/logout
GET  /auth/me
```

`register` and `login` accept JSON `{ "username": "string", "password": "string" }`
and set an `httpOnly` session cookie on success. `register` only succeeds for
usernames on the server's allowlist (see "Authentication Setup" below).
`logout` clears the session. `GET /auth/me` returns the current user, or
`401` if not logged in.

All other API routes (`/rankings`, `/drafts`, `/players`) require a valid
session cookie; `/health` and `/auth/*` remain open.

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

Each recommendation includes an optional `adp` field when Average Draft
Position data is available for that player:

```json
{
  "rank": 3,
  "tier": "A",
  "player": {
    "sleeperId": "9221",
    "fullName": "Jahmyr Gibbs",
    "team": "DET",
    "position": "RB"
  },
  "adp": { "value": 3.7, "diff": -0.7 }
}
```

`adp.diff` is `your rank − ADP value`: negative means you have the player
ranked earlier than the field's consensus (a reach relative to ADP);
positive means the field values them higher than you do. The `adp` field is
omitted entirely (not `null`) for players not covered by the ADP source.

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

## ADP Data Source

Average Draft Position (ADP) data comes from Sleeper's own publicly-shared
ADP spreadsheet (linked from the official [@SleeperHQ](https://x.com/SleeperHQ)
account), not Sleeper's REST API — the public API doesn't expose ADP.
The sheet is keyed by real Sleeper player IDs, so no name/team matching is
needed to join it against rankings or recommendations.

This is a **soft dependency**, not a formal API contract:

- Fetched and cached server-side; refreshed at most once every 24 hours
  (Sleeper updates the sheet roughly every 1–2 weeks, so this is comfortably
  fresh without over-polling a source with no rate-limit guarantees).
- If a fetch fails, the app keeps serving the last-known snapshot rather
  than erroring.
- If the sheet's format changes in a way the parser can't handle, ADP data
  is silently omitted from recommendations rather than breaking them —
  recommendations always work with or without ADP.
- Currently reads the "Redraft SF ADP" column, matching this league's
  Superflex scoring format. Change `ADP_COLUMN` in `adp.service.ts` if your
  league uses a different format (e.g. `"Redraft PPR ADP"`,
  `"Dynasty PPR ADP"`).

## Player Cache Refresh Cooldown

`POST /players/refresh` is rate-limited to once per 24 hours, regardless of
which authenticated user calls it. This follows Sleeper's own API guidance:
["You do not need to call this endpoint more than once per
day."](https://docs.sleeper.com/) — the full player dataset is several
megabytes, and Sleeper explicitly asks integrators not to poll it more
often than that.

A refresh attempted before the cooldown elapses returns `429 Too Many
Requests` with a `retryAfterMs` field indicating how long to wait. The
cooldown applies globally to the shared player cache, not per-user — since
player data is objectively the same for everyone, there's no reason for
each person to have their own cooldown window.

## Authentication Setup

Access is restricted to a hardcoded allowlist of usernames — proportionate
for a small, known league rather than open signup. Configure it via an
environment variable before starting the API:

```bash
ALLOWED_USERNAMES=andrej,mike,sarah pnpm --filter @fantasy-draft-helper/api dev
```

Usernames are matched case-insensitively. Only usernames on this list can
successfully call `POST /auth/register`; anyone else gets a `403`.

Passwords are hashed with Node's built-in `scrypt` (no external hashing
dependency) and never stored in plaintext. Sessions are opaque tokens
stored server-side, carried via an `httpOnly` cookie, valid for 30 days.

The default database is `data/fantasy-draft-helper.db` (same file as
rankings, per `RANKINGS_DATABASE_PATH`). Set `AUTH_DATABASE_PATH` to use a
different file for users/sessions specifically.

## Local Development Scripts

One-time setup after cloning:

```bash
chmod +x scripts/*.sh
```

### Verification

```bash
pnpm test          # all workspace tests
pnpm build         # all workspace builds
pnpm lint          # web app lint
pnpm format        # apply Prettier formatting
pnpm format:check  # verify formatting without writing (useful in CI)
pnpm verify        # test + build + lint, in that order
```

`pnpm verify` is the same check required before any change is considered
complete (see `docs/CODING_AGENT_GUIDE.md`) — run it before opening a PR or
handing work off.

### Docker smoke testing

```bash
pnpm smoke         # build the production image, run it at localhost:3000
pnpm smoke:debug   # same, but with the debug UI mode forced on
pnpm smoke:stop    # stop and remove the smoke-test container
```

`pnpm smoke`/`pnpm smoke:debug` build and start the container in one step;
re-running either is safe even if a previous smoke container is still up.

### Releasing

```bash
pnpm release vX.Y.Z
```

See [`RELEASING.md`](RELEASING.md) for what this does and the versioning
scheme.

## Manual QA Chaecklist

For an automated Docker build-and-run check, see `pnpm smoke` under
[Local Development Scripts](#local-development-scripts). This checklist
covers functional correctness in more depth.

1. Run `pnpm dev`.
2. Open [http://localhost:5173](http://localhost:5173).
3. Set `ALLOWED_USERNAMES` (e.g. `ALLOWED_USERNAMES=smoketest pnpm --filter @fantasy-draft-helper/api dev`),
   register that username, and log in.
4. Upload [test-data/example-rankings.csv](test-data/example-rankings.csv).
5. Confirm the import summary and matched count.
6. Enter a valid Sleeper draft ID and start monitoring.
7. Confirm draft status, pick progress, freshness time, and recommendations appear.
8. During an active draft, confirm a reported pick removes that player after the next refresh.
9. Confirm a completed draft displays the completed state and stops polling.
10. Try an invalid draft ID and confirm the error is shown without an endless polling loop.
11. Try an invalid CSV and confirm row-level errors and re-import guidance are shown.

Sleeper may delay exposing picks through its API. Recommendations represent the latest state returned by Sleeper and may briefly be stale during that delay.

## Project Structure

```text
apps/api/       Fastify API, Sleeper client, domain services, SQLite repository
apps/web/       React and Vite dashboard
scripts/        Release and Docker smoke-test scripts
docs/           Agent guide, MVP completion plan, and known issues
test-data/      Sample ranking CSV
```

The authoritative engineering rules are in [docs/CODING_AGENT_GUIDE.md](docs/CODING_AGENT_GUIDE.md), and the acceptance checklist is in [docs/MVP_COMPLETION_PLAN.md](docs/MVP_COMPLETION_PLAN.md).

## MVP Scope

The original MVP intentionally did not include authentication, payments,
collaboration, WebSockets, automated drafting, machine learning, positional
scarcity, roster optimization, or advanced draft strategy. The MVP is now
complete (see `docs/MVP_COMPLETION_PLAN.md`); authentication, hosting, and
multi-user collaboration are planned as later phases — see
[`DEVELOPMENT_PLAN.md`](DEVELOPMENT_PLAN.md) for current scope and status.
Payments, WebSockets, machine learning, and automated drafting remain out of
scope entirely.

## Shared Raspberry Pi Deployment

The league shared instance runs on a Raspberry Pi 4 and is exposed via
Tailscale Funnel. Its Compose file binds the app to loopback only and keeps
the SQLite data in a named Docker volume. Follow the reproducible setup,
update, recovery, and access-control instructions in deploy/pi/deploy-pi-README.md.
Copy deploy/pi/.env.example to deploy/pi/.env and set the real
ALLOWED_USERNAMES value before starting it; do not commit that file or the
Funnel URL.
