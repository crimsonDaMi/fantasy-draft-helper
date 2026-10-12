# Configuration and Behavior

Environment variables, authentication, the privacy notice, and how the app
fetches data from Sleeper. Setting up a shared instance is covered in
[`deploy/server/README.md`](../deploy/server/README.md).

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

Wrong passwords lock a username out for 15 minutes (`429`), counted per
client IP: after 5 failures from one IP, that IP can't log in to that
username, while the owner can still log in from elsewhere. Across all IPs
together, 50 failures lock the username out everywhere, which slows down
guessing from many addresses. A successful login clears the count for its
IP only. Re-entering the password to change it or to delete the account
counts the same way. The counts are kept in memory, so a restart clears
them.

Behind a reverse proxy, every request comes from the proxy's address, so
the per-IP limits would apply to all visitors together. Set `TRUST_PROXY` to
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

Users change their password on the Account page by entering the current
one and the new one twice. That logs them out on all other devices. There's
no reset for a forgotten password, since accounts have no email address.

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

The app has a privacy notice at `/privacy`, linked from the footer on
every page, the login screen included, and readable without an account. It lists what is stored
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
their details.

If you back up the database, set `BACKUP_RETENTION_DAYS` to the longest
time, in days, that any backup is kept. The notice then says that deleted
data disappears from backups within that time. Unset, it doesn't mention
backups. It only describes what you do; the app makes no backups itself.
Like `ACCOUNT_RETENTION_DAYS`, anything other than a whole number of days
(at least 1) stops the API from starting. The wording is a starting point, not legal advice: whoever
runs a public instance is responsible for checking it, and for anything
else their country requires, e.g. a separate imprint (Impressum).

Users and sessions live in the same database file as rankings by default. Set `AUTH_DATABASE_PATH` to use a
different file for users/sessions specifically.

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
  than erroring. Starting a ranking from ADP is the one feature that needs
  the data: with no snapshot loaded yet, it shows an error and saves
  nothing.
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
