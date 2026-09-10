#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"
IMAGE="ghcr.io/crimsondami/fantasy-draft-helper"

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

echo "==> Bumping root package.json version to ${VERSION#v}"
npm pkg set version="${VERSION#v}"
git add package.json
git commit -m "chore: bump version to $VERSION"
git push

echo "==> Tagging git $VERSION"
git tag "$VERSION"
git push --tags

echo "==> Building $IMAGE:$VERSION (and :latest)"
docker build -t "$IMAGE:$VERSION" -t "$IMAGE:latest" .

echo "==> Pushing $IMAGE:$VERSION"
docker push "$IMAGE:$VERSION"
echo "==> Pushing $IMAGE:latest"
docker push "$IMAGE:latest"

echo "==> Done. Released $VERSION."