#!/usr/bin/env bash
set -euo pipefail

# Ignore a stray "--" separator some pnpm versions forward literally.
if [[ "${1:-}" == "--" ]]; then
  shift
fi

VERSION="${1:-}"
IMAGE="ghcr.io/crimsondami/fantasy-draft-helper"
SKIP_AUDIT="${SKIP_AUDIT:-0}"
CHANGELOG="CHANGELOG.md"
# Compose files pinning the released image — bumped to the new version so
# a `git pull` on a deployment picks up exactly this release.
COMPOSE_FILES=(docker-compose.yml deploy/server/docker-compose.yml)

if [[ -z "$VERSION" ]]; then
  echo "Usage: pnpm release -- vX.Y.Z   (e.g. pnpm release -- v0.4.0)"
  exit 1
fi

if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Version must look like vMAJOR.MINOR.PATCH (e.g. v0.4.0)"
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree has uncommitted changes. Commit or stash first."
  exit 1
fi

if git rev-parse "$VERSION" >/dev/null 2>&1; then
  echo "Tag $VERSION already exists. Choose a new version."
  exit 1
fi

# Everything between "## Unreleased" and the next "## " heading.
UNRELEASED_NOTES="$(awk '/^## /{inside = ($0 == "## Unreleased"); next} inside' "$CHANGELOG" | grep -v '^[[:space:]]*$' || true)"

if [[ -z "$UNRELEASED_NOTES" ]]; then
  echo "$CHANGELOG has no entries under '## Unreleased'. Describe this"
  echo "release there first (it becomes the GitHub Release notes)."
  exit 1
fi

for file in "${COMPOSE_FILES[@]}"; do
  if ! grep -Eq "image: $IMAGE:v[0-9]+\.[0-9]+\.[0-9]+" "$file"; then
    echo "$file doesn't pin $IMAGE:vX.Y.Z — can't bump its version."
    exit 1
  fi
done

echo "==> Auditing dependencies (high/critical only)"
if [[ "$SKIP_AUDIT" != "1" ]] && ! pnpm audit --audit-level=high; then
  echo ""
  echo "Dependency audit found high/critical vulnerabilities. Review the"
  echo "output above. If a fix is available, run 'pnpm update' and re-run"
  echo "this script. If no fix exists yet and you've reviewed the risk,"
  echo "re-run with SKIP_AUDIT=1 to proceed anyway."
  exit 1
fi

echo "==> Bumping root package.json version to ${VERSION#v}"
npm pkg set version="${VERSION#v}"

echo "==> Pinning $IMAGE:$VERSION in ${COMPOSE_FILES[*]}"
for file in "${COMPOSE_FILES[@]}"; do
  sed -i.bak -E "s#(image: $IMAGE:)v[0-9]+\.[0-9]+\.[0-9]+#\1$VERSION#" "$file"
  rm "$file.bak"
done

echo "==> Moving '## Unreleased' in $CHANGELOG to '## $VERSION'"
awk -v heading="## $VERSION — $(date +%Y-%m-%d)" \
  '{ print } $0 == "## Unreleased" { print ""; print heading }' \
  "$CHANGELOG" >"$CHANGELOG.tmp"
mv "$CHANGELOG.tmp" "$CHANGELOG"

git add package.json "$CHANGELOG" "${COMPOSE_FILES[@]}"
git commit -m "chore: bump version to $VERSION"
git push

echo "==> Tagging git $VERSION"
git tag "$VERSION"
git push --tags

echo "==> Done. Released $VERSION."