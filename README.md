# Fantasy Draft Helper

Fantasy Draft Helper is a deterministic NFL fantasy draft assistant. It imports a player ranking CSV, matches players to Sleeper IDs, monitors a Sleeper draft, and displays the highest-ranked available players.

The application keeps the required flow:

```text
React web app -> Fastify API -> Sleeper API
```

## Features

- Import a player ranking CSV, matched to Sleeper player IDs at import time,
  with a report of matched, unmatched, and ambiguous players.
- Monitor a Sleeper draft with status-aware polling and see the top available
  players in your ranking order, drafted players excluded.
- Filter recommendations by position and search them by name or team.
- Injury status badges (Q, D, O, IR, …) next to players.
- Find a draft by Sleeper username instead of pasting its ID (mock drafts,
  which Sleeper doesn't list, take a pasted draft link or ID); the
  monitored draft is remembered across page reloads.
- "My team" panel: when you pick next, your drafted players, and how they
  fill your league's lineup slots (e.g. `QB 1/1 · SF 0/1`).
- Recent picks, each with where you ranked the player (reaches and steals
  highlighted), and the positional run of the last 8 picks.
- Players left in the best remaining tiers of your ranking, per position.
- A draft recap once the draft completes: your picks against your ranking
  and ADP, downloadable as a CSV.
- ADP vs. personal ranking diff, sourced from Sleeper's publicly-shared ADP
  sheet in the draft's league format (1QB or Superflex, redraft or
  dynasty). See "ADP Data Source" below.
- Drag-and-drop ranking editor at `/rankings/edit`: reorder players, move
  them between tiers, add/remove tiers, search, build a ranking from
  scratch, and export it as a CSV.
- Several saved rankings (e.g. one per league), selectable on both tabs,
  with rename and delete.
- Watch (★) or avoid (⊘) players per ranking: watched players are
  highlighted, avoided ones hidden from recommendations until shown again.
- Username/password authentication with a username allowlist or open
  registration; rankings are scoped per user.
- Draft-day vs. debug UI mode (`VITE_UI_MODE`) — see "UI Modes" below.
- Switchable team-inspired color themes.

Out of scope: payments, WebSockets, machine learning, automated drafting,
and pick suggestions based on scarcity or roster optimization (the tier
counts and roster slots above are informational only).

## Installation

The app ships as a Docker image (`ghcr.io/crimsondami/fantasy-draft-helper`,
for `linux/amd64` and `linux/arm64`). Every option needs Docker with the
Compose plugin; pick the one that fits how your league drafts.

### Local — just for you

Run it on your own computer for the duration of your draft. Copy the root
[`docker-compose.yml`](docker-compose.yml) (or clone the repository), put
your own username in its `ALLOWED_USERNAMES` line, then:

```bash
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000), register the username
you allowed, and log in.

### Self-hosting — an always-on machine you own

One instance shared by the whole league, running on any always-on machine
at home (a spare PC, home server, NAS, or single-board computer), exposed
over HTTPS via a reverse proxy or a tunnel service.

### Online hosting — a rented server

The same shared setup on a VPS or cloud VM, with a domain and a reverse
proxy providing HTTPS.

Both shared options use [`deploy/server/`](deploy/server/README.md), which
covers setup, exposing the app over HTTPS, updating, and backups.

## Development Setup

Prerequisites:

- Node.js 24 or newer. The API uses Node's built-in `node:sqlite` module.
- pnpm 11 or newer.

Install dependencies and start the API and web app together:

```bash
pnpm install
pnpm dev
```

Open the web app at [http://localhost:5173](http://localhost:5173).

The API listens on port `3000`. Its health endpoint is available at [http://localhost:3000/health](http://localhost:3000/health).

The default SQLite database is `data/fantasy-draft-helper.db`, relative to
the API's working directory (`apps/api/data/` under `pnpm dev`). Set
`RANKINGS_DATABASE_PATH` to use a different database file:

```bash
RANKINGS_DATABASE_PATH=/path/to/rankings.db pnpm --filter @fantasy-draft-helper/api dev
```

There is no migration system (see [`RELEASING.md`](RELEASING.md#telling-league-mates-about-an-update)).
If the API refuses to start with `Database schema does not match`, delete
the local database file and restart — a fresh one is created automatically,
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

Exports from other sites import as-is: headers are case-insensitive, and
`RK`, `PLAYER NAME`, `POS`, and `TIERS` (as in a FantasyPros rankings
export) are recognized. Positions may carry a positional rank (`RB12` is
read as `RB`), and `DST`/`D/ST` are read as `DEF`. Other columns are
ignored.

Team defenses match by full team name ("Kansas City Chiefs") or, when the
row has a `DEF` position and a team, by team abbreviation — so short names
like "Chiefs D/ST" match too.

The sample file is [test-data/example-rankings.csv](test-data/example-rankings.csv).

## API

Every error response is `{ "error": "CODE", "message": "string" }`. When
Sleeper fails, draft routes answer `502` — `SLEEPER_API_ERROR` for an error
response, `SLEEPER_UNAVAILABLE` when Sleeper can't be reached — except that
a Sleeper `404` (e.g. an unknown draft ID) stays `404`.

### Health

```text
GET /health
```

### Instance info

```text
GET /instance
```

Public, so the privacy notice can show it before login:
`{ "operator"?: { "name", "contact", "address"? }, "accountRetentionDays" }`.
`operator` is left out unless `OPERATOR_NAME` and `OPERATOR_CONTACT` are both
set (see "Privacy Notice" below).

### Import rankings

```text
POST /rankings
Content-Type: multipart/form-data
```

The multipart field is `file`; an optional `name` field, sent before the
file, names the ranking (default: the file name without its extension).
Each import adds a new saved ranking, unless the file has no valid ranking
row: then nothing is saved and the answer is `422 NO_VALID_ROWS` with the row
errors in `details`. The response includes a `rankingId`, an
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
player counts for the newest ranking.

### Saved rankings

```text
GET    /rankings                 the user's rankings, newest first
PATCH  /rankings/:rankingId      rename: { "name": "string" }
DELETE /rankings/:rankingId      delete a ranking (204)
```

Each ranking in the list has `id`, `name`, `createdAt`, `playerCount`, and
`matchedCount`. A user can keep up to 20 rankings; importing or creating
another returns `409 RANKING_LIMIT_REACHED`.

### Authentication

```text
POST /auth/register
POST /auth/login
POST /auth/logout
GET  /auth/me
DELETE /auth/account
```

`register` and `login` accept JSON `{ "username": "string", "password": "string" }`
and set an `httpOnly` session cookie on success. `register` only succeeds for
usernames on the server's allowlist unless open registration is enabled,
and limits how many accounts one client IP can create (see "Authentication
Setup" below).
`logout` clears the session. `GET /auth/me` returns the current user, or
`401` if not logged in. `DELETE /auth/account` takes `{ "password": "string" }`
and permanently deletes the logged-in user with all of their rankings
(`403` for a wrong password, which counts toward the login lockout).

All other API routes (`/rankings`, `/drafts`, `/players`) require a valid
session cookie; `/health` and `/auth/*` remain open.

### Find drafts by Sleeper username

```text
GET /drafts?username=<sleeper username>&season=2026
```

Returns `{ sleeperUserId, drafts: [...] }` — the user's NFL drafts for the
season (default: the current year), newest first. `404` with
`SLEEPER_USER_NOT_FOUND` for an unknown username.

### Get a draft

```text
GET /drafts/:draftId
```

Returns normalized draft metadata, including `PRE_DRAFT`, `DRAFTING`, `COMPLETE`, or `UNKNOWN` status.

### Get recommendations

```text
GET /drafts/:draftId/recommendations?rankingId=<rankingId>&limit=20&positions=QB,RB&q=<search>
```

`positions` and `q` (a case-insensitive name/team search) are optional and
are applied before `limit`.

Besides the recommendations, the response carries what the draft-day
panels need: `draft` (type, teams, rounds, reversal round, draft order,
and lineup slots), `picks` (every pick made, each with the player's rank,
tier, and ADP when available), `adpFormat` (the ADP format used for the
draft, e.g. `1QB PPR` or `SF` — see "ADP Data Source"), and `tierCounts`
(players left in the best two remaining tiers of your ranking, per
position — unaffected by `positions`, `q`, and `limit`).

The response includes draft status, total picks, drafted-player count, last pick when available, freshness timestamps, and recommendations. `playersUpdatedAt` is when the player data — and so the injury statuses — was last loaded from Sleeper.

The frontend communicates only with this API. It does not call Sleeper directly.

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

### Ranking editor and export

```text
POST   /rankings/new                              create an empty ranking
GET    /rankings/export?rankingId=<id>            a ranking as CSV (default: newest)
GET    /rankings/:rankingId                       players and tiers
PATCH  /rankings/:rankingId/players/:sleeperId    move or add a player
DELETE /rankings/:rankingId/players/:sleeperId    remove a player
POST   /rankings/:rankingId/tiers                 insert an empty tier
DELETE /rankings/:rankingId/tiers/:position       remove a tier, merging its players
GET    /rankings/:rankingId/unranked-players      fantasy-relevant players not ranked
PATCH  /rankings/:rankingId/players/:sleeperId/flag   { "flag": "watch" | "avoid" | null }
PATCH  /rankings/:rankingId/unmatched/:rank       { "playerName", "sleeperId" }: resolve a row
DELETE /rankings/:rankingId/unmatched/:rank?playerName=<name>   delete an unmatched row
```

Rows the import couldn't match (or matched ambiguously) stay in the ranking
without a player: `GET /rankings/:rankingId` returns them with `player`
unset, and ambiguous ones with their `candidates`. They are never
recommended. The `unmatched/:rank` routes resolve such a row to a chosen
player at the same position (`method: "MANUAL"`) or delete it; `:rank`
counts every row, and `playerName` must still match the row (`409
ROW_CHANGED` otherwise). The `rank` in `PATCH .../players/:sleeperId`
counts matched players only, as the editor shows them, so unmatched rows
keep their place.

`GET /rankings/:rankingId` also returns `flags` (Sleeper ID → flag).
Recommendations leave out `avoid`-flagged players unless
`showAvoided=true`, report how many were hidden as `avoidedCount`, and
carry each player's `flag`.

Details in [`docs/ranking-editor-requirements.md`](docs/ranking-editor-requirements.md).

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
- The column matches each draft's league format. A lineup with a
  `SUPER_FLEX` slot or two QB slots reads Superflex ADP; any other lineup
  reads 1QB ADP for the draft's scoring (PPR or half PPR). The sheet has no
  standard-scoring column, so standard-scoring drafts use PPR ADP. Dynasty
  drafts read the sheet's dynasty columns. The app labels ADP with the
  format it uses, e.g. "1QB PPR" or "Dynasty SF".

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

The API also refreshes the cache on its own: the first request after the
data turns 24 hours old starts a background refresh and is answered from the
current data meanwhile. If that refresh fails, the current data stays and the
next attempt waits an hour.

## Authentication Setup

Access is restricted to a hardcoded allowlist of usernames — proportionate
for a small, known league rather than open signup. Configure it via an
environment variable before starting the API:

```bash
ALLOWED_USERNAMES=alice,bob pnpm --filter @fantasy-draft-helper/api dev
```

Usernames are matched case-insensitively. Only usernames on this list can
successfully call `POST /auth/register`; anyone else gets a `403`.

For a public instance, set `OPEN_REGISTRATION=true` instead. Anyone can then
register and `ALLOWED_USERNAMES` is ignored. Either way, one client IP can
create at most 5 accounts per hour (`429` after that). New usernames must
be 3–32 letters, digits, `_`, `.` or `-`, and passwords 8–128 characters.
Login still accepts usernames created before these limits existed.

Behind a reverse proxy, every request comes from the proxy's address, so
the per-IP limit would apply to all visitors together. Set `TRUST_PROXY` to
the proxy's address so the API reads the client IP from `X-Forwarded-For`.
It takes a comma-separated list of IPs, CIDRs, or the named ranges
`loopback` and `uniquelocal`, or `true` to trust any sender. Only list
addresses that nothing but your proxy can connect from: a trusted sender
can claim any client IP. Hop counts like `1` have no effect.

Passwords are hashed with Node's built-in `scrypt` (no external hashing
dependency) at OWASP's minimum cost (N=2^17, r=8, p=1, 128 MiB per hash),
with a random salt per user. The cost is stored with each hash, so older,
cheaper hashes keep working and are upgraded on the user's next login.
Sessions are opaque random tokens carried via an `httpOnly` cookie. The
server only stores a SHA-256 of each token, so a leaked database or backup
contains no usable sessions. A session expires after 30 days without use and
at most 90 days after login; using it moves its expiry forward (at most once
a day) and renews the cookie.

Accounts are deleted together with everything tied to them: their
sessions, rankings, tiers, players, and watch/avoid flags. Users delete
their own account from the Account page (click your username in the
header), after entering their password again. Accounts not used for
`ACCOUNT_RETENTION_DAYS` days are deleted the same way. The default is 730,
about two seasons, so skipping one season doesn't cost anyone their
rankings. The check runs at startup and once a day. Registering, logging
in, and using the app all count as use; ongoing use is recorded at most
once a day. Set `ACCOUNT_RETENTION_DAYS=0` to keep accounts until their
owner deletes them, e.g. on a private league instance. Any value other
than a whole number of days stops the API from starting.

The database file itself isn't encrypted. Its key would have to sit on the
same machine, so it would add little; encrypting the disk is left to the
host, and most cloud providers do this by default.

## Privacy Notice

The app has a privacy notice at `/privacy`, linked from the login screen
and the footer, and readable without an account. It lists what is stored
and why, the server logs, browser storage, what goes to Sleeper, the
retention period from `ACCOUNT_RETENTION_DAYS`, and users' rights. Visitors'
browsers load nothing from other sites: the fonts are bundled with the app.

The operator's identity is configuration, never part of the repository:

```bash
OPERATOR_NAME="Your Name"
OPERATOR_CONTACT=privacy@example.com   # email address or https:// URL
OPERATOR_ADDRESS="1 Example Street, 12345 Example City"   # optional
```

Without a name and contact, the notice says the operator hasn't provided
their details. The wording is a starting point, not legal advice: whoever
runs a public instance is responsible for checking it, and for anything
else their country requires, e.g. a separate imprint (Impressum).

Users and sessions live in the same database file as rankings by default. Set `AUTH_DATABASE_PATH` to use a
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
pnpm lint          # web + api lint
pnpm format        # apply Prettier formatting
pnpm format:check  # verify formatting without writing (useful in CI)
pnpm verify        # test + build + lint + format:check
pnpm run audit     # dependency audit, fails on moderate+ (same check as CI)
```

`pnpm verify` must pass before any change is considered complete; CI runs
the same gate on every PR.

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

## Manual QA Checklist

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
docs/           Coding agent guide, ranking editor docs, known issues
test-data/      Sample ranking CSV
```

The authoritative engineering rules are in [docs/CODING_AGENT_GUIDE.md](docs/CODING_AGENT_GUIDE.md).

## Issues

Bug reports and feature requests go to
[GitHub issues](https://github.com/crimsonDaMi/fantasy-draft-helper/issues/new/choose),
using the bug report or feature request form.

## Support

If the app helps your drafts, you can support its development via
[GitHub Sponsors](https://github.com/sponsors/crimsonDaMi) or
[Ko-fi](https://ko-fi.com/crimsonDaMi).

## Disclaimer

Fantasy Draft Helper is an independent project. It is not affiliated with,
endorsed by, or sponsored by Sleeper. "Sleeper" is a trademark of its
respective owner; the app only uses Sleeper's public API.

## License

[MIT](LICENSE) © 2026 Andrej Lohn
