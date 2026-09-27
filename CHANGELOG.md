# Changelog

User-facing changes per release. `pnpm release` turns the `Unreleased`
section into the new version's entry and the release workflow publishes it
as the GitHub Release notes — add to it in the same commit as the change.
See `RELEASING.md`.

## Unreleased

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
