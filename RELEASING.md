# Releasing

This project ships as a single Docker image on GitHub Container Registry:
`ghcr.io/crimsondami/fantasy-draft-helper`.

## Versioning

Semantic versioning (`vMAJOR.MINOR.PATCH`), kept loose since this is an MVP feedback round:

- **patch** (`v0.1.1`) — bug fixes, no behavior change
- **minor** (`v0.2.0`) — new feature or noticeable change
- **major** (`v1.0.0`) — reserved for leaving MVP/feedback phase

## Releasing a new version

Standard path — from the repository root:

```bash
pnpm release vX.Y.Z
```

For example: `pnpm release v0.4.0`.

This runs `scripts/release.sh`, which:

1. Refuses to run with uncommitted changes in the working tree.
2. Validates the version matches `vMAJOR.MINOR.PATCH`.
3. Refuses to reuse a version whose git tag already exists.
4. Bumps the root `package.json`'s `version` to match (without the leading
   `v`), commits, and pushes that commit.
5. Tags the resulting commit and pushes the tag.

Pushing the tag is where the script's job ends. From there, the
**`.github/workflows/release.yml`** GitHub Actions workflow takes over:

6. Triggers automatically on the pushed `vX.Y.Z` tag.
7. Builds the Docker image tagged both `vX.Y.Z` and `latest`.
8. Pushes both tags to GHCR using the repo's built-in `GITHUB_TOKEN`
   (no PAT or manually-managed secret needed).

You do not need Docker installed or authenticated locally to cut a release —
only steps 1–5 run on your machine. Check the **Actions** tab on GitHub to
confirm the build succeeded before telling the league an update is out (see
"Telling league mates about an update" below).

Note: `apps/api/package.json` and `apps/web/package.json` are private,
never-published workspace packages — their `version` fields are frozen
(`0.0.0`) and intentionally **not** touched by the release script. Only the
root `package.json`'s version tracks releases.

### What the script does, spelled out manually

Useful if you need to release by hand (script unavailable, or a step needs
manual intervention). Steps 1–2 replace what `scripts/release.sh` does;
after pushing the tag, the GitHub Actions workflow still handles the build
and push automatically — you shouldn't need step 3 unless Actions itself is
unavailable.

```bash
# 1. Tag the source
git tag v0.1.0
git push --tags

# 2. Wait for .github/workflows/release.yml to build and push the image,
#    or check the Actions tab if it doesn't appear to have triggered.

# 3. Only if Actions is unavailable — build and push the image yourself:
docker build \
  -t ghcr.io/crimsondami/fantasy-draft-helper:v0.1.0 \
  -t ghcr.io/crimsondami/fantasy-draft-helper:latest .

docker push ghcr.io/crimsondami/fantasy-draft-helper:v0.1.0
docker push ghcr.io/crimsondami/fantasy-draft-helper:latest
```

Never reuse a version number for a different build — if you need to fix
something, bump the patch version instead.

## Telling league mates about an update

Deployed instances pin an explicit version tag in `docker-compose.yml` (not `latest`),
so updates are deliberate rather than automatic:

```yaml
services:
  draft-helper:
    image: ghcr.io/crimsondami/fantasy-draft-helper:v0.1.0
```

When a new version is ready:

1. Confirm the release workflow finished successfully (Actions tab) so the
   image tag actually exists in GHCR before telling anyone to pull it.
2. Post in the league chat what changed (e.g. "v0.2.0 is up — fixes the CSV import bug").
3. Each person updates the version in their `docker-compose.yml` and runs:
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
