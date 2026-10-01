# Hosting a Shared Instance

Run one always-on instance for a whole league, with logins restricted to
an allowlist of usernames. This works the same whether the machine sits at
home (self-hosting) or is a rented server (online hosting); only the way
it is exposed to the internet differs.

For running the app just for yourself on draft day, use the root
`docker-compose.yml` instead — see the root [`README.md`](../../README.md#installation).

## Requirements

- Any always-on machine with Docker Engine and the Docker Compose plugin.
- A 64-bit OS: images are published for `linux/amd64` and `linux/arm64`
  only (check with `uname -m`: `x86_64` or `aarch64`).
- A way to serve it over **HTTPS**. In production the session cookie is
  `Secure`, so browsers only send it over HTTPS — logins silently fail
  over plain HTTP on anything but `localhost`.

## Setup

```bash
git clone https://github.com/crimsonDaMi/fantasy-draft-helper.git
cd fantasy-draft-helper/deploy/server
cp .env.example .env   # set ALLOWED_USERNAMES — never commit .env
docker compose up -d
```

`.env` holds the comma-separated usernames allowed to register (matched
case-insensitively):

```
ALLOWED_USERNAMES=alice,bob,carol
```

For a public instance that anyone can sign up to, use this instead:

```
OPEN_REGISTRATION=true
TRUST_PROXY=loopback,uniquelocal
```

`TRUST_PROXY` lets the per-IP signup limit (5 accounts per hour) see each
visitor's address rather than your reverse proxy's. Docker forwards
`127.0.0.1:3000` into the container from a private bridge address, which
`uniquelocal` covers. That is safe here because only the machine itself can
reach that port.

Accounts unused for two years are deleted automatically, together with
their rankings. Change this with `ACCOUNT_RETENTION_DAYS` (in days; `0`
keeps accounts until their owners delete them). See "Authentication Setup" in the root
[`README.md`](../../README.md#authentication-setup).

The app now listens on `127.0.0.1:3000` only — reachable from the machine
itself, not the network. `docker compose ps` shows `healthy` once it is up.

## Exposing it

Put something in front of `127.0.0.1:3000` that terminates HTTPS:

- **Self-hosting at home.** Either a reverse proxy with automatic TLS
  certificates plus port forwarding on your router and a dynamic DNS name
  (home IPs change), or — if you can't forward ports, e.g. behind
  carrier-grade NAT — a tunnel service that makes an outbound connection
  and gives you a public HTTPS URL. A tunnel needs no router
  configuration or domain.
- **Online hosting** (a VPS or cloud VM). Point a domain at the server's
  public IP, run a reverse proxy with automatic TLS certificates, and
  allow only ports 80 and 443 through the firewall.

Either way the app itself needs no configuration for this. Keep the public
URL out of the repository; share it with your league directly.

## Updating

`pnpm release` pins each new version in this directory's
`docker-compose.yml`, so updating the checkout selects it. Read the
release's notes first — an "Upgrading" section lists any manual step.

```bash
git pull
cd deploy/server
docker compose pull
docker compose up -d
```

**Upgrading from v0.x to v1.0.0:** the container now runs as the
unprivileged `node` user, and the existing volume was written by root.
Hand it over once, after `git pull` but before starting the new version,
or the app exits on startup:

```bash
docker compose down
docker compose run --rm --user root draft-helper chown -R node:node /app/data
docker compose up -d
```

## Operational notes

- **Restarts**: the container uses `restart: unless-stopped`, so it comes
  back whenever Docker does. Make sure Docker (and your proxy or tunnel)
  start on boot.
- **Data**: the SQLite database lives in the `fantasy-draft-helper-data`
  Docker volume. There is no automated backup — copy the volume's contents
  elsewhere periodically if losing it would hurt. Each user can also
  download their ranking via "Export CSV" in the ranking editor and
  re-import it later. Backups contain usernames and password hashes, so
  keep them somewhere private.
- **Schema changes require a volume drop.** No migration system exists (a
  deliberate choice), so a schema change is a major version bump (see
  [`RELEASING.md`](../../RELEASING.md)), and its release notes say so. If a
  schema-changing version starts against an existing volume anyway, it
  refuses to start and logs `Database schema does not match this version
of the app` with the changed tables (a crash loop under
  `restart: unless-stopped`). Fix: ask league mates to export their
  rankings first ("Export CSV" works on the old version), then
  `docker compose down -v` (not just `down`) and `docker compose up -d` —
  this discards all existing rankings/users/sessions, so everyone
  re-registers and re-imports their exported CSV afterward.
