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
6. Builds the Docker image tagged both `vX.Y.Z` and `latest`.
7. Pushes both tags to GHCR.

Note: `apps/api/package.json` and `apps/web/package.json` are private,
never-published workspace packages — their `version` fields are frozen
(`0.0.0`) and intentionally **not** touched by the release script. Only the
root `package.json`'s version tracks releases.

### What the script does, spelled out manually

Useful if you need to release by hand (script unavailable, or a step needs
manual intervention):

```bash
# 1. Tag the source
git tag v0.1.0
git push --tags

# 2. Build and push the matching image (also update :latest)
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

1. Post in the league chat what changed (e.g. "v0.2.0 is up — fixes the CSV import bug").
2. Each person updates the version in their `docker-compose.yml` and runs:
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
not a release, so it's exempt from the version-tag-sync rule above.
