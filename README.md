<p align="center"><img src="docs/assets/logo.svg" width="120" alt=""></p>

# Fantasy Draft Helper

Your own NFL rankings, live against your Sleeper draft. Import a ranking
CSV (or build one in the editor), point the app at a Sleeper draft, and it
shows the best players still available in your order, with each pick
crossed off as it happens. Works with 1QB and Superflex, redraft and
dynasty leagues.

**Try it at [draft-helper.duckdns.org](https://draft-helper.duckdns.org/)**:
a public instance run by the maintainer. Register with a username and
password; no email address needed.

Or host it yourself: one Docker container, run on your own computer for
draft day or shared with your whole league. Either way, it doesn't pick for
you: no auto-drafting and no machine learning, just your rankings and the
draft state.

## Features

**On draft day**

- The top available players in your ranking order, refreshed every few
  seconds while the draft runs, with filters by position and search by
  name or team.
- Positional ranks (e.g. `WR12`) from your ranking next to each player in
  the recommendations, recent picks and recap, plus the positional rank by
  ADP (e.g. `ADP WR15`) where ADP exists.
- Find your draft by Sleeper username, or paste a draft link for mock
  drafts.
- ADP next to each player, in your league's format (1QB or Superflex,
  PPR or half PPR, redraft or dynasty), so you can see where you're higher
  or lower than the field.
- Injury badges (Q, D, O, IR, …).
- Your team: when you pick next, your players so far, and how they fill
  your lineup slots.
- Recent picks with reaches and steals against your ranking, the
  positional run of the last 8 picks, and how many players are left in
  your best remaining tiers per position.
- A recap once the draft completes: your picks against your ranking and
  ADP, downloadable as a CSV.

**Before the draft**

- Import rankings from a CSV, including FantasyPros exports, matched to
  Sleeper players automatically, with a report of anything that didn't
  match.
- A drag-and-drop ranking editor: reorder players, move them between
  tiers, add and remove tiers, start from scratch, and export as a CSV.
- Several saved rankings, e.g. one per league.
- Watch (★) players to highlight them, or avoid (⊘) them to hide them from
  the board.

**For a shared instance**

- Accounts with username and password, limited to an allowlist of
  usernames or open to anyone. Each user has their own rankings.
- Announcement banner for planned downtime, a built-in privacy notice,
  and switchable team-inspired color themes.

## Quick start

You need Docker with the Compose plugin. The image
(`ghcr.io/crimsondami/fantasy-draft-helper`) runs on `linux/amd64` and
`linux/arm64`.

1. Download [`docker-compose.yml`](docker-compose.yml) and put your
   username in its `ALLOWED_USERNAMES` line.
2. Start it:

   ```bash
   docker compose up -d
   ```

3. Open [http://localhost:3000](http://localhost:3000), register the
   username you allowed, and log in.
4. Import a ranking (try
   [`test-data/example-rankings.csv`](test-data/example-rankings.csv)),
   then find your draft by Sleeper username.

### Sharing it with your league

To run one always-on instance for the whole league, on a machine at home
(a spare PC, home server, NAS, or single-board computer) or on a rented
server, use [`deploy/server/`](deploy/server/README.md). It covers setup,
HTTPS through a reverse proxy or a tunnel, updates, backups, and
announcing planned maintenance.

## Ranking CSV

```csv
rank,player,position,team,tier,notes
1,Ja'Marr Chase,WR,CIN,1,Target share leader
2,Bijan Robinson,RB,ATL,1,
```

Only `rank` (a positive integer) and `player` are required. `position`
(`QB`, `RB`, `WR`, `TE`, `K`, or `DEF`), `team`, `tier`, and `notes` are
optional, and other columns are ignored.

Exports from other sites usually import as they are. Headers are
case-insensitive, FantasyPros' `RK`, `PLAYER NAME`, `POS`, and `TIERS` are
recognized, and so are the legacy headers `Rank`, `Name`, `Position`,
`Team`, `Tier`, and `player_id`. A positional rank such as `RB12` is read
as `RB`, and `DST`/`D/ST` as `DEF`. Team defenses match by full team name
("Kansas City Chiefs") or, with a `DEF` position and a team, by
abbreviation, so short names like "Chiefs D/ST" match too.

## Configuration

The app is configured with environment variables, added under
`environment:` in `docker-compose.yml`:

| Variable                                                | Purpose                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------- |
| `ALLOWED_USERNAMES`                                     | Comma-separated usernames allowed to register                          |
| `OPEN_REGISTRATION`                                     | `true` lets anyone register; `ALLOWED_USERNAMES` is then ignored       |
| `TRUST_PROXY`                                           | Your reverse proxy's address, so per-IP limits see real clients        |
| `ACCOUNT_RETENTION_DAYS`                                | Delete accounts unused for this many days (default 730, `0` = never)   |
| `OPERATOR_NAME`, `OPERATOR_CONTACT`, `OPERATOR_ADDRESS` | Who runs the instance, shown in the privacy notice                     |
| `BACKUP_RETENTION_DAYS`                                 | How long backups are kept, stated in the privacy notice                |
| `RANKINGS_DATABASE_PATH`, `AUTH_DATABASE_PATH`          | Database file locations                                                |
| `ANNOUNCEMENT_PATH`                                     | File whose text is shown as a banner (default `data/announcement.txt`) |

Details, including the login lockout, password storage, sessions, the
privacy notice, and how ADP and player data are fetched from Sleeper, are
in [`docs/configuration.md`](docs/configuration.md).

## Documentation

- [`docs/configuration.md`](docs/configuration.md): configuration,
  authentication, privacy notice, and data sources
- [`deploy/server/README.md`](deploy/server/README.md): hosting a shared
  instance
- [`docs/api.md`](docs/api.md): HTTP API reference
- [`docs/development.md`](docs/development.md): development setup, scripts,
  and project structure
- [`docs/known-issues.md`](docs/known-issues.md): known limitations, such
  as Sleeper's delay in reporting picks
- [`CHANGELOG.md`](CHANGELOG.md) and [`RELEASING.md`](RELEASING.md):
  release notes and versioning

## Issues

Bug reports and feature requests go to
[GitHub issues](https://github.com/crimsonDaMi/fantasy-draft-helper/issues/new/choose),
using the bug report or feature request form. The app's footer links both
forms on every page and fills in the running version on bug reports;
filing an issue needs a GitHub account.

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

The licenses of the third-party packages bundled into the web app are
collected at build time into `THIRD-PARTY-NOTICES.txt`, served at
`/THIRD-PARTY-NOTICES.txt` by every running instance.
