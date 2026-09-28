# Releasing

This project ships as a single Docker image on GitHub Container Registry:
`ghcr.io/crimsondami/fantasy-draft-helper`.

## Versioning

Semantic versioning (`vMAJOR.MINOR.PATCH`). Since v1.0.0 the promise to
anyone running an instance is: **updating within a major version never
requires a manual step and never loses data.**

- **patch** (`v1.0.1`) — bug fixes, no behavior change
- **minor** (`v1.1.0`) — new feature or noticeable change
- **major** (`v2.0.0`) — anything that breaks that promise. In particular,
  **any SQLite schema change** (a new/altered column, table, or foreign
  key in a repository's `CREATE TABLE`) is a major bump, since without a
  migration system it means wiping the database (see "Telling league
  mates about an update" below). So is a manual deployment step such as
  a changed volume path or environment variable.

Every release's user-facing changes go in `CHANGELOG.md` under
`## Unreleased`, in the same commit as the change itself.

## Releasing a new version

Standard path — from the repository root:

```bash
pnpm release vX.Y.Z
```

For example: `pnpm release v1.1.0`.

This runs `scripts/release.sh`, which:

1. Refuses to run with uncommitted changes in the working tree.
2. Validates the version matches `vMAJOR.MINOR.PATCH`.
3. Refuses to reuse a version whose git tag already exists.
4. Refuses to run if `CHANGELOG.md`'s `## Unreleased` section is empty.
5. Runs `pnpm audit --audit-level=high`, refusing to release if any
   high/critical vulnerabilities are found (override with `SKIP_AUDIT=1`
   if you've reviewed an unfixable advisory and accept the risk).
6. Bumps the root `package.json`'s `version` to match (without the leading
   `v`), pins the new image tag in both `docker-compose.yml` and
   `deploy/server/docker-compose.yml`, renames `## Unreleased` in
   `CHANGELOG.md` to `## vX.Y.Z — <date>` (with a fresh, empty
   `## Unreleased` above it), commits all of that, and pushes the commit.
7. Tags the resulting commit and pushes the tag.

Pushing the tag is where the script's job ends. From there, the
**`.github/workflows/release.yml`** GitHub Actions workflow takes over:

8. Triggers automatically on the pushed `vX.Y.Z` tag.
9. Builds the Docker image tagged both `vX.Y.Z` and `latest`.
10. Pushes both tags to GHCR using the repo's built-in `GITHUB_TOKEN`
    (no PAT or manually-managed secret needed).
11. Creates a GitHub Release for the tag, using that version's
    `CHANGELOG.md` section as its notes (the step fails if the section is
    missing).

You do not need Docker installed or authenticated locally to cut a release —
only steps 1–7 run on your machine. Check the **Actions** tab on GitHub to
confirm the build succeeded before telling the league an update is out (see
"Telling league mates about an update" below).

Note: `apps/api/package.json` and `apps/web/package.json` are private,
never-published workspace packages — their `version` fields are frozen
(`0.0.0`) and intentionally **not** touched by the release script. Only the
root `package.json`'s version tracks releases.

### Multi-architecture images

Released images are built for both `linux/amd64` and `linux/arm64` (via
QEMU emulation in the GitHub Actions workflow), published under a single
multi-arch manifest per tag, so the same tag runs on x86 hosts and ARM
boards. The emulated `arm64` build makes releases noticeably slower than a
single-arch build.

### Releasing by hand

If the script is unavailable: do step 6 above by hand (root `package.json`
version, both compose pins, the `CHANGELOG.md` heading), commit and push
it, then tag and push the tag. The release workflow builds and publishes
from there. Only if GitHub Actions itself is unavailable, build and push
the image locally:

```bash
git tag v1.1.0
git push --tags

# Only if Actions is unavailable:
docker build \
  -t ghcr.io/crimsondami/fantasy-draft-helper:v1.1.0 \
  -t ghcr.io/crimsondami/fantasy-draft-helper:latest .
docker push ghcr.io/crimsondami/fantasy-draft-helper:v1.1.0
docker push ghcr.io/crimsondami/fantasy-draft-helper:latest
```

Never reuse a version number for a different build — if you need to fix
something, bump the patch version instead.

## Dependency maintenance

Two GitHub-side checks run between releases:

- **`.github/workflows/audit.yml`** runs `pnpm run audit` (fails on
  **moderate** and above) every Monday at 06:00 UTC, on demand from the
  Actions tab ("Run workflow"), and on any PR that changes
  `pnpm-lock.yaml`. When a scheduled or manual run fails, it opens a
  GitHub issue labelled `dependency-audit`, or comments on the one that's
  already open. Close the issue once the audit passes again.
- **`.github/dependabot.yml`** opens weekly update PRs (Mondays) for npm
  packages and GitHub Actions. Minor and patch updates are grouped into
  one PR per ecosystem; npm major updates arrive as separate PRs, since
  they usually need code changes. The exception is `@types/node`: its
  major updates are ignored, because it must match the Node major the app
  runs on, and Dependabot would propose each new major on release,
  months before it becomes LTS.
- **`.github/workflows/node-lts.yml`** checks every Monday (or on demand)
  whether a newer Node LTS line exists than the Dockerfile's
  `node:<major>-slim` image, and opens a GitHub issue labelled `node-lts`
  once per new LTS major. Upgrade in a single commit: both of the
  Dockerfile's `FROM node:` lines, `node-version` in `audit.yml` and
  `verify.yml`, and `@types/node` in both workspaces. Then run the full
  verification gate plus `pnpm smoke`, and close the issue.

**`.github/workflows/verify.yml`** runs the full verification gate
(`pnpm verify`: test, build, lint, format check) on every PR and on every
push to `main`, so a Dependabot PR shows whether it passes. Wait for it
before merging. It doesn't replace running the gate locally before
committing your own changes, and it doesn't run `pnpm smoke` — do that
yourself for anything touching Docker or the production build.

The scheduled audit is deliberately stricter than the release gate: the
release script (step 5 above) only blocks on **high**/critical, so a
moderate advisory with no available fix never blocks an urgent release.
Dependabot alerts and security-update PRs are repository settings
(Settings → Code security), not configured from files in this repo.

## Telling league mates about an update

Deployed instances — whether self-run per person or a shared hosted instance
(see [`deploy/server/README.md`](deploy/server/README.md)) — pin an explicit version tag in `docker-compose.yml` (not `latest`),
so updates are deliberate rather than automatic. The release script keeps
the repository's two compose files pinned to the latest release, so a
deployment running from a repository checkout updates with `git pull`:

```yaml
services:
  draft-helper:
    image: ghcr.io/crimsondami/fantasy-draft-helper:v1.0.0
```

**Schema changes.** There's no migration system, so a release that
changes the SQLite schema (a new/altered column, table, or foreign key in
any `repositories/*.ts` file's schema) can't reuse an existing database.
Such a release must be a major version (see "Versioning" above), and its
`CHANGELOG.md` entry must say so under "Upgrading". The app enforces this
at startup: `applySchema` (`apps/api/src/repositories/database.ts`)
compares every existing table against the schema the code expects and
refuses to start with a `Database schema does not match` message naming
the changed tables, rather than crashing later with `no such column`.
When announcing such a release, ask everyone to use "Export CSV" in the
ranking editor **before** the update, since the volume must be dropped
(`docker compose down -v`, not just `down`) and everyone has to
re-register and re-import (see `deploy/server/README.md`'s Operational notes).

When a new version is ready:

1. Confirm the release workflow finished successfully (Actions tab) so the
   image tag actually exists in GHCR before telling anyone to pull it.
2. Post in the league chat what changed (the GitHub Release notes), e.g.
   "v1.1.0 is up — fixes the CSV import bug".
3. Each person updates the version in their `docker-compose.yml` (or runs
   `git pull` in their checkout), follows any "Upgrading" steps from the
   release notes, and runs:
   ```bash
   docker compose pull
   docker compose up -d
   ```

This way, any bug report can be tied to a specific version, and nobody gets
surprise-updated mid-draft.

## Building a debug image for troubleshooting

If a league mate reports a bug and you need more visibility than the
production UI shows, build a one-off debug image (see README.md's
"UI Modes" section) rather than a versioned release:

```bash
docker build --build-arg VITE_UI_MODE=debug \
  -t ghcr.io/crimsondami/fantasy-draft-helper:debug .
docker push ghcr.io/crimsondami/fantasy-draft-helper:debug
```

Use the `debug` tag, not a version tag, for these — it's a diagnostic build,
not a release, so it's exempt from the version-tag-sync rule above, and it's
intentionally **not** wired into the tag-triggered GitHub Actions workflow
(that workflow only reacts to `vX.Y.Z` tags).
