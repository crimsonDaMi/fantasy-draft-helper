# Development

Working on the code. Versioning and releases are covered in
[`RELEASING.md`](../RELEASING.md).

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

There is no migration system (see [`RELEASING.md`](../RELEASING.md#telling-league-mates-about-an-update)).
If the API refuses to start with `Database schema does not match`, delete
the local database file and restart — a fresh one is created automatically,
and you'll need to re-register and re-import your rankings.

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

See [`RELEASING.md`](../RELEASING.md) for what this does and the versioning
scheme.

## Manual QA Checklist

For an automated Docker build-and-run check, see `pnpm smoke` under
[Local Development Scripts](#local-development-scripts). This checklist
covers functional correctness in more depth.

1. Run `pnpm dev`.
2. Open [http://localhost:5173](http://localhost:5173).
3. Set `ALLOWED_USERNAMES` (e.g. `ALLOWED_USERNAMES=smoketest pnpm --filter @fantasy-draft-helper/api dev`),
   register that username, and log in.
4. Upload [test-data/example-rankings.csv](../test-data/example-rankings.csv).
5. Confirm the import summary and matched count.
6. Enter a valid Sleeper draft ID and start monitoring.
7. Confirm draft status, pick progress, freshness time, and recommendations appear.
8. During an active draft, confirm a reported pick removes that player after the next refresh.
9. Confirm a completed draft displays the completed state and stops polling.
10. Try an invalid draft ID and confirm the error is shown without an endless polling loop.
11. Try an invalid CSV and confirm row-level errors and re-import guidance are shown.

Sleeper may delay exposing picks through its API. Recommendations represent the latest state returned by Sleeper and may briefly be stale during that delay.

## Project Structure

Requests flow one way; the web app never calls Sleeper directly:

```text
React web app -> Fastify API -> Sleeper API
```

```text
apps/api/       Fastify API, Sleeper client, domain services, SQLite repository
apps/web/       React and Vite dashboard
scripts/        Release and Docker smoke-test scripts
docs/           Coding agent guide, ranking editor docs, known issues
test-data/      Sample ranking CSV
```

The authoritative engineering rules are in [`CODING_AGENT_GUIDE.md`](CODING_AGENT_GUIDE.md).
