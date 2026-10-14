# API

HTTP API of the Fastify server. The web app talks only to this API; it
never calls Sleeper directly.

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
set (see [Privacy Notice](configuration.md#privacy-notice)).

### Announcement

```text
GET /announcement
```

Public, so the banner shows on the login screen too: `{ "message": string | null }`.
The message is the trimmed content of `data/announcement.txt` (relative to
the API's working directory; Docker: `/app/data/announcement.txt`), cut to
500 characters, or `null` when the file is missing or blank. The file is
read on every request, so changes need no restart. Set
`ANNOUNCEMENT_PATH` to use a different file.

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
    {
      "rank": 5,
      "name": "string",
      "team": "string",
      "position": "string",
      "duplicate": true
    }
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

A ranking holds each player once. `duplicate` marks an unmatched row
whose player an earlier row already holds; it's omitted otherwise. The
row stays in the ranking without a player, with that player as its only
candidate.

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
POST /auth/password
DELETE /auth/account
```

`register` and `login` accept JSON `{ "username": "string", "password": "string" }`
and set an `httpOnly` session cookie on success. `register` only succeeds for
usernames on the server's allowlist unless open registration is enabled,
and limits how many accounts one client IP can create (see
[Authentication Setup](configuration.md#authentication-setup)).
`logout` clears the session. `GET /auth/me` returns the current user, or
`401` if not logged in. `POST /auth/password` takes
`{ "currentPassword": "string", "newPassword": "string" }`, sets the new
password (same 8–128 character rule as `register`) and logs out every other
session of the user; the current one stays logged in (`403` for a wrong
current password, which counts toward the login lockout).
`DELETE /auth/account` takes `{ "password": "string" }`
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

Returns normalized draft metadata, including `PRE_DRAFT`, `DRAFTING`, `COMPLETE`, or `UNKNOWN` status, and `adpFormat`: the ADP the draft's recommendations use, as `{ "column": "Dynasty SF ADP", "label": "Dynasty SF" }` (see [ADP Data Source](configuration.md#adp-data-source)).

### Get recommendations

```text
GET /drafts/:draftId/recommendations?rankingId=<rankingId>&limit=20&positions=QB,RB&q=<search>&rookies=true
```

`positions`, `q` (a case-insensitive name/team search), and `rookies=true`
(only players Sleeper lists with no years of experience) are optional,
combine with each other, and are applied before `limit`.

Besides the recommendations, the response carries what the draft-day
panels need: `draft` (type, teams, rounds, reversal round, draft order,
and lineup slots), `picks` (every pick made, each with the player's rank,
`positionRank`, tier, bye week, and ADP with `adpPositionRank` when
available), `adpFormat` (the ADP format used for the
draft, e.g. `1QB PPR` or `SF` — see
[ADP Data Source](configuration.md#adp-data-source)), and `tierCounts`
(players left in the best two remaining tiers of your ranking, per
position — unaffected by `positions`, `q`, `rookies`, and `limit`).

The response includes draft status, total picks, drafted-player count, last pick when available, freshness timestamps, and recommendations. `playersUpdatedAt` is when the player data — and so the injury statuses — was last loaded from Sleeper.

Each recommendation includes an optional `adp` field when Average Draft
Position data is available for that player:

```json
{
  "rank": 3,
  "positionRank": 2,
  "tier": "A",
  "bye": 8,
  "note": "New OC, target share up",
  "player": {
    "sleeperId": "9221",
    "fullName": "Jahmyr Gibbs",
    "team": "DET",
    "position": "RB",
    "age": 22,
    "rookie": false
  },
  "adp": { "value": 3.7, "diff": -0.7, "positionRank": 2 }
}
```

`bye` is the player's bye week from the ranking CSV, omitted when the CSV
had none. `note` is the user's note on the player (from the CSV's `notes`
column or the ranking editor), omitted when there is none.

`player.age` and `player.rookie` come from Sleeper's player data (`age`,
and `years_exp` of 0 for a rookie); each is omitted when Sleeper has no
value for the player. The ranking editor routes return them on their
players too.

`player.depthChart` is the player's place on their NFL team's depth chart
from Sleeper (`depth_chart_position` and `depth_chart_order`), e.g.
`{ "position": "RB", "order": 2 }`, and omitted when Sleeper has none.
Each of `picks` carries it too, for the drafted player; the web app marks
the RB directly behind one the user drafted as a handcuff.

`positionRank` is the player's place among their position in your whole
ranking (2 for RB2), counting drafted and unmatched rows, so it doesn't
change as players are drafted or filtered out. `adp.positionRank` is the
same by ADP order.

`lastInTier` is `true` on the only undrafted player of their position left
in their tier (counted over every tier of the ranking, like `tierCounts`,
and unaffected by `positions`, `q`, `rookies`, and `limit`), and omitted
otherwise, including for rankings without tiers.

`adp.diff` is `your rank − ADP value`: negative means you have the player
ranked earlier than the field's consensus (a reach relative to ADP);
positive means the field values them higher than you do. The `adp` field is
omitted entirely (not `null`) for players not covered by the ADP source.

### Ranking editor and export

```text
POST   /rankings/new                              create an empty ranking
POST   /rankings/from-adp                         { "column": "<ADP column>" }: create a ranking in ADP order
GET    /rankings/export?rankingId=<id>            a ranking as CSV (default: newest)
GET    /rankings/:rankingId                       players and tiers
PATCH  /rankings/:rankingId/players/:sleeperId    move or add a player
DELETE /rankings/:rankingId/players/:sleeperId    remove a player
POST   /rankings/:rankingId/tiers                 insert an empty tier
DELETE /rankings/:rankingId/tiers/:position       remove a tier, merging its players
GET    /rankings/:rankingId/unranked-players      fantasy-relevant players not ranked
PATCH  /rankings/:rankingId/players/:sleeperId/flag   { "flag": "watch" | "avoid" | null }
PATCH  /rankings/:rankingId/players/:sleeperId/note   { "note": "<text>" | null }
PATCH  /rankings/:rankingId/unmatched/:rank       { "playerName", "sleeperId" }: resolve a row
DELETE /rankings/:rankingId/unmatched/:rank?playerName=<name>   delete an unmatched row
```

`POST /rankings/from-adp` saves a new ranking named "Sleeper ADP
(<format>)" that holds every player in the chosen column of Sleeper's ADP
sheet, in ADP order, split into tiers. The tiers are the natural breaks
(Jenks) in log(ADP + 12): at most 20 tiers, with the smallest total
variance within them, so boundaries fall on the widest ADP gaps relative
to draft position and players with the same ADP share a tier. Every row
is matched by Sleeper ID. A player whose Sleeper position isn't a fantasy
position (a two-way DB/WR, a fullback) is ranked at the first fantasy
position Sleeper lists for them. `column` is
one of `Redraft PPR ADP`, `Redraft Half PPR ADP`, `Redraft SF ADP`,
`Dynasty PPR ADP`, `Dynasty Half PPR ADP` or `Dynasty SF ADP` (see
[ADP Data Source](configuration.md#adp-data-source)). It returns
`{ "rankingId" }`, or `503 ADP_UNAVAILABLE` when the ADP sheet can't be
reached and no earlier copy is cached.

Rows the import couldn't match (or matched ambiguously) stay in the ranking
without a player: `GET /rankings/:rankingId` returns them with `player`
unset, and ambiguous ones with their `candidates`. They are never
recommended. The `unmatched/:rank` routes resolve such a row to a chosen
player at the same position (`method: "MANUAL"`) or delete it; `:rank`
counts every row, and `playerName` must still match the row (`409
ROW_CHANGED` otherwise). The `rank` in `PATCH .../players/:sleeperId`
counts matched players only, as the editor shows them, so unmatched rows
keep their place.

A note is at most 500 characters and trimmed; `null` or a blank note
clears it. The route returns `{ "note" }` as saved (`null` when cleared),
or `404 PLAYER_NOT_RANKED` for a player not in the ranking. Players carry
their note as `ranking.note` in `GET /rankings/:rankingId`, unmatched rows
included, and a resolved unmatched row keeps it. The CSV export writes
notes to its `notes` column.

`GET /rankings/:rankingId` also returns `flags` (Sleeper ID → flag).
Recommendations leave out `avoid`-flagged players unless
`showAvoided=true`, report how many were hidden as `avoidedCount`, and
carry each player's `flag`.

Details in [`docs/ranking-editor-requirements.md`](ranking-editor-requirements.md).
