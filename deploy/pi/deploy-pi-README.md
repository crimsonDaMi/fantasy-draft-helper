# Self-Hosting on a Raspberry Pi

This documents the actual deployment running the league's shared instance,
for future reference (by a human or a coding agent) if it ever needs to be
rebuilt, debugged, or replicated on a new device.

## Hardware / OS

- Raspberry Pi 4 Model B, 4GB RAM
- Raspberry Pi OS, **64-bit** (`aarch64`) — required, since the GHCR image
  is only published for `linux/amd64` and `linux/arm64`, not `armv7`. Check
  with `uname -m` before attempting this on different hardware.
- Runs alongside an existing Pi-hole install on the same device. No port or
  resource conflicts observed — Pi-hole uses port 53 (DNS) and its own web
  admin; this stack only touches `127.0.0.1:3000` locally.

## Why this setup, not the originally-planned one

The original plan was Oracle Cloud's Always Free tier. That was abandoned
when Oracle's signup rejected a debit card (a widely-reported issue with
their verification, not specific to one bank). Self-hosting on existing
Raspberry Pi hardware became the free alternative.

The first self-hosting attempt used DuckDNS (for a stable hostname despite
a dynamic home IP) plus Caddy as a reverse proxy terminating TLS via
Let's Encrypt (DNS-01 challenge, to avoid conflicting with Pi-hole's use of
port 80). That plan was abandoned when it turned out **port forwarding
isn't possible on this network** (router limitation or ISP-side CGNAT —
never fully diagnosed, since the fix is the same either way).

**Current approach: Tailscale Funnel.** It requires no port forwarding and
no owned domain — `tailscaled` on the Pi makes an outbound-only connection
to Tailscale's infrastructure, and Funnel exposes the app at a stable
`https://<device>.<tailnet>.ts.net` URL. TLS is handled entirely by
Tailscale; no Caddy, no DuckDNS, no router configuration at all.

## Prerequisites

- Docker: installed via Docker's official **apt repository** (not the
  `get.docker.com` curl-piped-to-shell script — an attempt to use that
  script on this exact device returned unexpected, non-standard script
  content instead of Docker's real installer; switched to the
  GPG-verified apt repo method out of caution and used it since).
- Tailscale: installed via Tailscale's official apt repository, for the
  same reason — avoiding any curl-piped-to-shell install pattern on this
  device going forward.

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

```bash
cd deploy/pi
# edit docker-compose.yml's image tag to the new vX.Y.Z
docker compose pull
docker compose up -d
```

## Operational notes

- **Reboot behavior**: Docker and `tailscaled` are both systemd services
  and start automatically on boot; containers with `restart: unless-stopped`
  come back once Docker starts. Funnel's own state should also persist
  across a `tailscaled` restart — verify this periodically
  (`tailscale funnel status` after a reboot), since it hasn't been
  stress-tested against a real power-loss event yet.
- **Backups**: not yet set up. The SQLite database lives in the
  `draft-helper-data` named Docker volume — a periodic `docker cp` or a
  cron job copying the volume's contents somewhere else would be a
  reasonable addition if the league's data becomes something worth
  protecting against Pi failure or SD card corruption.
- **The real Tailscale Funnel URL is intentionally not written down in
  this repository** — share it directly with league mates instead.
  Documenting the exact public hostname in a searchable public repo would
  make the home server easier to find than necessary.
