#!/usr/bin/env bash
set -euo pipefail

TAG="test"
BUILD_ARGS=()
if [[ "${1:-}" == "--debug" ]]; then
  TAG="debug"
  BUILD_ARGS=(--build-arg VITE_UI_MODE=debug)
fi

IMAGE="fantasy-draft-helper:$TAG"
CONTAINER="fantasy-draft-helper-smoke"

echo "==> Building $IMAGE"
docker build "${BUILD_ARGS[@]}" -t "$IMAGE" .

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

echo "==> Starting $CONTAINER"
docker run --env-file .env -d --name "$CONTAINER" -p 3000:3000 \
  -e ALLOWED_USERNAMES=smoketest \
  "$IMAGE" >/dev/null

echo "==> Running at http://localhost:3000"
echo "==> Register with username 'smoketest' to log in"
echo "==> Stop it with: pnpm smoke:stop"