# Changelog

User-facing changes per release. `pnpm release` turns the `Unreleased`
section into the new version's entry and the release workflow publishes it
as the GitHub Release notes — add to it in the same commit as the change.
See `RELEASING.md`.

## Unreleased

## v2.2.0 — 2026-10-10

### Added

- Password fields on the login, registration and Account pages have an eye
  button to show or hide what you typed. Submitting the form hides the
  password again.
- Registration asks for the password twice and doesn't go ahead when the
  two don't match.
- Change your password on the Account page (click your username in the
  header): enter the current password and the new one twice. Changing it
  logs you out on all other devices.
- Operators who back up the database can set `BACKUP_RETENTION_DAYS`; the
  privacy notice then says how long deleted data can remain in backups.
  See "Privacy Notice" in `README.md`.

### Changed

- Wrong passwords now lock a username out only for the network they came
  from (5 failures per IP in 15 minutes), so someone who knows a username
  can no longer lock its owner out. Across all networks, 50 failures still
  lock the username for 15 minutes. Behind a reverse proxy this needs
  `TRUST_PROXY`.
- The shared-instance guide now shows how to back up the database safely
  while the app is running, with SQLite's online backup, and how to check
  the copy. See "Operational notes" in `deploy/server/README.md`.

## v2.1.0 — 2026-10-08

### Added

- Announcements: operators can show a message, e.g. planned downtime, in a
  banner on every page by writing it to `announcement.txt` in the data
  volume, without a restart. Users can dismiss it until the message
  changes. See "Planned maintenance" in `deploy/server/README.md`.
- "Report a bug" and "Request a feature" links in the footer of every page,
  the login screen included, open the matching GitHub issue form (needs a
  GitHub account). Bug reports come with the app version filled in.

### Changed

- The "Support me" link moved from the header to the footer, and the login
  screen's privacy link is now in the footer too.

## v2.0.0 — 2026-10-01

### Upgrading

- **This release changes the database schema, so existing data can't be
  kept.** Before updating, ask everyone to download each ranking they want
  to keep with "Export CSV". Then run `docker compose down -v` and
  `docker compose up -d`. Everyone registers again and re-imports their
  CSV files.

### Added

- Delete your account: the new Account page (click your username in the
  header) deletes your account and all of your rankings after you enter
  your password.
- Accounts not used for two years are deleted automatically with all of
  their rankings. Instances can change the period with
  `ACCOUNT_RETENTION_DAYS`, or turn it off with `0`.
- A privacy notice, linked from the login screen and the footer, explains
  what is stored, for how long, and who runs the instance. Operators set
  their details with `OPERATOR_NAME`, `OPERATOR_CONTACT` and
  `OPERATOR_ADDRESS`.
- Public instances can allow anyone to register with
  `OPEN_REGISTRATION=true`. Each network address can create at most 5
  accounts per hour. Behind a reverse proxy, set `TRUST_PROXY` so that
  limit applies to the visitor's address instead of the proxy's.

### Changed

- Fonts are now served by the app itself instead of Google Fonts, so your
  browser no longer contacts Google.
- The server setup keeps at most 30 MB of request logs, which contain
  visitors' IP addresses.
- New usernames must be 3–32 letters, digits, `_`, `.` or `-`, and new
  passwords at most 128 characters. Existing accounts log in as before.
- Passwords are hashed with a stronger setting. Existing passwords keep
  working and are upgraded on the next login. Logging in and registering
  take a fraction of a second longer.
- Staying logged in: a session now lasts 30 days from its last use instead
  of 30 days from login, up to 90 days in total.
- ADP now matches the draft's league format. 1QB drafts show 1QB ADP
  instead of Superflex ADP, and dynasty drafts show dynasty ADP. The
  recommendations legend and the draft recap name the format used, e.g.
  "1QB PPR" or "SF".

## v1.4.1 — 2026-09-30

### Added

- The draft status bar shows when injury statuses were last updated, e.g.
  "Injuries as of Sep 30, 9:14 AM".

### Fixed

- Quick moves in the ranking editor no longer briefly show a player's
  earlier position, and are saved in the order they were made.
- Injury statuses stay current on a long-running instance: the player data
  now refreshes once a day instead of only when the API restarts.
- Team defenses listed by a short name, e.g. "Chiefs D/ST", now match
  Sleeper when the ranking row has a `DEF`/`DST` position and a team.

## v1.4.0 — 2026-09-30

### Added

- Phone layout for the ranking editor: switch between the tiers and the
  unranked players, and tap a player to move them to the end of a tier or
  remove them from the ranking.
- The ranking editor works with the keyboard: arrow keys move between
  players, Enter moves a player to a tier or out of the ranking, and
  Alt+↑/↓ moves them one place (Alt+Home/End to the top or bottom of the
  tier). Moves are announced to screen readers.
- "You pick in N" follows traded picks: picks your team traded away are
  skipped, and a pick it acquired is marked, e.g. "You pick in 4 (2.03,
  traded)". Players drafted with a traded pick also count toward My team
  when you chose your slot by hand.
- Auction drafts show your budget in My team instead of a next pick, e.g.
  "$142 of $200 left · max bid $130" (the max bid keeps $1 for every
  other open roster spot).
- After a ranking import, the players that couldn't be matched to a
  Sleeper player are listed (with rank and why), with a link to fix them
  in the ranking editor; a saved ranking with unmatched players links
  there too.
- The ranking editor has a "Not matched" section: pick one of the
  possible players for an ambiguous row, search for the right player, or
  remove the row. A fixed row keeps its place in the ranking.

### Fixed

- On phones, the ⓘ and watch/avoid buttons no longer stay highlighted
  after tapping them off.
- The ranking editor works on touch screens: swipe a player list to scroll
  it, and press and hold a player to drag them.
- The app no longer fails to load when the browser blocks site data
  (storage); the theme and remembered choices just aren't kept.
- When Sleeper can't be reached, the draft view says so instead of "An
  unexpected error occurred", and a Sleeper rate limit is retried like
  other temporary Sleeper failures.
- The ranking editor says when a change couldn't be saved, instead of
  silently undoing it (e.g. a lost connection, or a 27th tier).
- Error messages look the same everywhere and are announced by screen
  readers, including on the login and CSV import forms.
- Importing a CSV with no valid rows (e.g. missing the rank or player
  column) no longer saves an empty ranking; the errors are listed instead.
- After an import with some invalid rows, the message now says to delete
  the incomplete ranking once the corrected file is re-imported, since a
  re-import adds a new ranking.
- In a ranking with players the import couldn't match, moving a player in
  the ranking editor could put them one place off, sometimes inside the
  next tier.
- Cancelling a drag in the ranking editor (Escape, resizing the window, or
  switching tabs) no longer stops the editor from picking up saved
  changes until the next drag.

## v1.3.0 — 2026-09-29

### Changed

- Wide-screen draft layout: on screens at least 1200px wide, My team and
  your top-tier counts sit to the left of the recommendations and recent
  picks to the right, both staying in view while you scroll the list.
- Phone layout for the draft page: My team collapses to your next pick
  (tap to expand) so the top recommendation shows without scrolling,
  recommendations take two lines instead of overflowing the screen,
  watch/avoid buttons are bigger, the header wraps, and the draft recap
  table scrolls on its own.
- Tap ⓘ to read what the tier counts, the ADP arrows, watch/avoid,
  injury letters, and the recap columns mean. These explanations were
  hover-only before, so they didn't show on phones.

## v1.2.0 — 2026-09-29

### Upgrading

- No database reset needed: the table for watch/avoid flags is added to
  an existing database on startup, and existing accounts and rankings are
  kept.

### Added

- The monitored draft is remembered across page reloads; "Stop monitoring"
  in Draft setup forgets it.
- Find your draft by Sleeper username and season instead of pasting its
  ID. Mock drafts aren't listed by Sleeper, so for those paste the draft's
  link (or ID): the ID is taken from the link.
- "My team" panel: when you pick next ("You pick in 4 (2.03)"), your
  drafted players by position, and how they fill your league's lineup
  slots. Your slot comes from Sleeper's draft order when the draft was
  found by username; otherwise pick it by hand.
- Recent picks, each with your rank for the player (reaches and steals
  highlighted), and the positional run of the last 8 picks.
- Players left in the best remaining tiers of your ranking, per position.
- Draft recap once the draft completes: your picks against your ranking
  and ADP, downloadable as a CSV.
- Keep several saved rankings (up to 20, e.g. one per league) and pick the
  one to use in Draft setup or the ranking editor; rename or delete them
  there. The choice is remembered per browser.
- Watch (★) or avoid (⊘) players, per ranking, from the recommendations or
  the ranking editor. Watched players are highlighted; avoided ones are
  hidden from the recommendations until "Show hidden players" is ticked.
- Search available players by name or team on the draft page, and search
  ranked players in the ranking editor (the unranked panel keeps its own
  search).
- Injury status badges (Q, D, O, IR, …) next to players in the
  recommendations and the ranking editor.
- Ranking CSV import accepts FantasyPros-style exports: `RK`,
  `PLAYER NAME`, `POS`, and `TIERS` headers, positional ranks like `RB12`,
  and `DST`/`D/ST` for defenses.

### Fixed

- The ranking editor no longer shows an empty ranking when you return to
  it from the Draft tab without reloading the page.

### Changed

- Importing a ranking CSV or starting a new ranking now adds a saved
  ranking (named after the file) instead of replacing your existing one.
- Player positions now have their own color-coded column in the draft
  recommendations and the ranking editor, instead of being part of the
  right-aligned "position · team" text.

## v1.1.0 — 2026-09-28

### Upgrading

- **Shared-instance deployments only:** `deploy/pi/` moved to
  `deploy/server/`, and its data volume now has a fixed name,
  `fantasy-draft-helper-data`, instead of one derived from the directory.
  Before `git pull`, stop the app from `deploy/pi` (`docker compose down`).
  After pulling, move `deploy/pi/.env` to `deploy/server/.env`, then copy
  the old volume into the new one from `deploy/server`:
  `docker compose run --rm --user root -v pi_draft-helper-data:/old draft-helper cp -a /old/. /app/data/`
  and start it with `docker compose up -d`. The root `docker-compose.yml`
  is unaffected.

### Changed

- Hosting documentation is now generic: local, self-hosted, and online
  hosting, with no specific hardware or provider.

## v1.0.0 — 2026-09-28

### Upgrading

- **One-time step for existing Docker deployments:** the container now runs
  as the unprivileged `node` user instead of root, so the existing data
  volume (created by root) must be handed over once, or the app exits on
  startup. With the app stopped, from the directory with your
  `docker-compose.yml`:
  `docker compose run --rm --user root draft-helper chown -R node:node /app/data`.
  Not needed for a fresh volume.
- No database schema change — existing accounts and rankings are kept.

### Added

- Export your ranking as a CSV ("Export CSV" in the ranking editor,
  `GET /rankings/export`). The file re-imports as-is, with players matched
  by Sleeper ID, so it doubles as a backup.
- Startup check that refuses to run against a database created with a
  different schema, with a message explaining the fix, instead of a
  `no such column` crash loop.
- Docker `HEALTHCHECK` against `/health`.
- "Support me" (Ko-fi) link in the header.

### Security

- Logins for a username are locked for 15 minutes after 5 failed attempts.
- Password hashing no longer blocks the server while it runs.
- Expired sessions are purged at startup and on login; the session cookie
  now expires together with the session (30 days) instead of on browser
  close.
- Container runs as a non-root user.

### Changed

- Smaller Docker image: the runtime contains only the API's production
  dependencies and the built apps.

## v0.8.5 — 2026-09-27

- The tier-removal prompt names the correct merge target.

## v0.8.4 — 2026-09-27

- Draft setup collapses when monitoring with a saved ranking.
- Consistent `{ error, message }` error responses from every API route.

## v0.8.3 — 2026-09-27

- Maintenance release (tooling and dependencies).

## v0.8.2 — 2026-09-27

- Player pool limited to QB/RB/WR/TE/K/DEF.
- React Router upgrade to clear moderate security advisories.

## v0.8.1 — 2026-09-27

- Ranking editor: build a ranking from scratch without an import, name
  search for unranked players, global position filter, true global rank
  per player.
- Many drag-and-drop fixes (autoscroll, duplicate players, long names).
- Reloading `/rankings/edit` serves the app instead of an API error.

## v0.8.0 — 2026-09-24

- Drag-and-drop ranking editor: reorder players, move them between tiers,
  add/remove tiers, letter or number tier labels.
- Tiers from any CSV are normalized to one internal representation.
- App version shown in the UI and in `/health`.

## v0.7.2 — 2026-09-18

- 32 team-inspired color schemes.

## v0.7.1 — 2026-09-17

- Maintenance release.

## v0.7.0 — 2026-09-17

- Multi-user support: rankings are scoped per user.
- Logged-in username shown in the header; expired sessions return to the
  login screen with a clear message.
- 24-hour cooldown on refreshing the Sleeper player list.

## v0.6.3 — 2026-09-15

- Raspberry Pi self-hosting setup (Tailscale Funnel).

## v0.6.2 — 2026-09-13

- Container build fixes.

## v0.6.1 — 2026-09-13

- Username/password authentication with a league allowlist.

## v0.6.0 — 2026-09-13

- Switchable color themes.

## v0.5.0 — 2026-09-12

- ADP vs. personal ranking diff on recommendations.

## v0.4.0 — 2026-09-11

- Redesigned draft-day view.

## v0.3.0 — 2026-09-09

- Separate debug and draft-day UI modes.

## v0.2.0 — 2026-09-08

- Position filter for recommendations.

## v0.1.0 — 2026-09-06

- First release: CSV ranking import with Sleeper player matching, live
  draft monitoring, and top available players by your ranking.
