# Self-Hosting on a Raspberry Pi

The league's shared instance runs on a Raspberry Pi and is exposed to the
internet via Tailscale Funnel — no port forwarding, owned domain, or reverse
proxy needed. These are the steps to rebuild, update, or replicate it.

## Hardware / OS

- Raspberry Pi 4 Model B, 4GB RAM
- Raspberry Pi OS, **64-bit** (`aarch64`) — required, since the GHCR image
  is only published for `linux/amd64` and `linux/arm64`, not `armv7`. Check
  with `uname -m` before attempting this on different hardware.
- Coexists with Pi-hole on the same device: Pi-hole uses port 53 and its own
  web admin; this stack only binds `127.0.0.1:3000`.

## How it's exposed

`tailscaled` on the Pi makes an outbound-only connection to Tailscale, and
Funnel serves the app at a stable `https://<device>.<tailnet>.ts.net` URL.
TLS is handled entirely by Tailscale; no router configuration is needed.

## Prerequisites

Docker and Tailscale, both installed from their official apt repositories
(steps below) rather than curl-piped install scripts.

## Setup steps

### 1. Docker (via apt repository)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker $USER   # log out/in afterward
```

### 2. Tailscale (via apt repository)

```bash
curl -fsSL https://pkgs.tailscale.com/stable/raspbian/$(. /etc/os-release && echo "$VERSION_CODENAME").noarmor.gpg | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
curl -fsSL https://pkgs.tailscale.com/stable/raspbian/$(. /etc/os-release && echo "$VERSION_CODENAME").tailscale-keyring.list | sudo tee /etc/apt/sources.list.d/tailscale.list

sudo apt-get update
sudo apt-get install -y tailscale
sudo systemctl enable --now tailscaled
sudo tailscale up   # opens a login URL — sign in, approve the device
```

One-time step in the Tailscale admin console
(`https://login.tailscale.com/admin/dns`): enable **HTTPS Certificates**.
Funnel can't issue a certificate without it.

### 3. Enable Funnel

```bash
sudo tailscale funnel --bg 3000
```

Prints the public URL. Check it any time with `tailscale funnel status`.

### 4. Deploy the app

```bash
cd deploy/pi
cp .env.example .env   # then fill in real values — never commit .env
docker compose up -d
```

## `deploy/pi/.env` (not committed)

```
ALLOWED_USERNAMES=<comma-separated real usernames>
```

## Updating to a new released version

`pnpm release` pins each new version in this directory's
`docker-compose.yml`, so updating the repository checkout is enough to
select it. Read the release's notes in `CHANGELOG.md` (or on the GitHub
Release) first — an "Upgrading" section lists any manual step.

```bash
git pull
cd deploy/pi
docker compose pull
docker compose up -d
```

**Upgrading from v0.x to v1.0.0:** the container now runs as the
unprivileged `node` user, and the existing volume was written by root.
Hand it over once, after `git pull` but before starting the new version,
or the app exits on startup:

```bash
cd deploy/pi
docker compose down
docker compose run --rm --user root draft-helper chown -R node:node /app/data
docker compose up -d
```

## Operational notes

- **Reboot behavior**: Docker and `tailscaled` are both systemd services
  and start automatically on boot; containers with `restart: unless-stopped`
  come back once Docker starts. Funnel's own state should also persist
  across a `tailscaled` restart — verify this periodically
  (`tailscale funnel status` after a reboot), since it hasn't been
  stress-tested against a real power-loss event yet.
- **Health**: the image has a Docker `HEALTHCHECK` against `/health`;
  `docker compose ps` shows `healthy` once the app is up.
- **Backups**: no automated volume backup. The SQLite database lives in
  the `draft-helper-data` named Docker volume — a periodic `docker cp` or
  a cron job copying the volume's contents somewhere else would protect
  against Pi failure or SD card corruption. Each user can also download
  their own ranking via "Export CSV" in the ranking editor and re-import
  it later.
- **The real Tailscale Funnel URL is intentionally not written down in
  this repository** — share it directly with league mates instead.
  Documenting the exact public hostname in a searchable public repo would
  make the home server easier to find than necessary.
- **Schema changes require a volume drop.** No migration system exists (a
  deliberate choice), so a schema change is a major version bump (see
  RELEASING.md), and its release notes say so. If a schema-changing version starts against an existing
  `draft-helper-data` volume anyway, it refuses to start and logs
  `Database schema does not match this version of the app` with the
  changed tables (a crash loop under `restart: unless-stopped`). Fix: ask
  league mates to export their rankings first ("Export CSV" works on the
  old version), then `docker compose down -v` (not just `down`) and
  `docker compose up -d` — this discards all existing
  rankings/users/sessions, so everyone re-registers and re-imports their
  exported CSV afterward.
