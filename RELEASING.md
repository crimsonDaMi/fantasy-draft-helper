# Releasing

This project ships as a single Docker image on GitHub Container Registry:
`ghcr.io/crimsondami/fantasy-draft-helper`.

## Versioning

Semantic versioning (`vMAJOR.MINOR.PATCH`), kept loose since this is an MVP feedback round:

- **patch** (`v0.1.1`) — bug fixes, no behavior change
- **minor** (`v0.2.0`) — new feature or noticeable change
- **major** (`v1.0.0`) — reserved for leaving MVP/feedback phase

## Keep the git tag and Docker image tag in sync

Every release gets **the same version number** in both places, so anyone can trace a
running image back to the exact source that produced it:

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

Never reuse a version number for a different build — if you need to fix something,
bump the patch version instead.

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
