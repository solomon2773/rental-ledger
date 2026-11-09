# Deploying to rental-ledger.solomontsao.com

Target: a single Linux host at `75.10.217.13` (the DNS A record for `rental-ledger.solomontsao.com` already points there). Everything runs in Docker:

```
https://rental-ledger.solomontsao.com/        -> Caddy -> static Expo web build
https://rental-ledger.solomontsao.com/api/*   -> Caddy -> Node API (prefix stripped)
```

Caddy obtains and renews the Let's Encrypt certificate automatically. The API's SQLite database and pending receipt uploads live on a Docker volume; the ledger itself lives in your Google Sheets and Drive.

## 1. One-time host setup

```bash
# Docker (Ubuntu/Debian). Skip if already installed.
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
```

Open inbound TCP 80 and 443 (and UDP 443 for HTTP/3, optional) on the host firewall / router. Let's Encrypt needs port 80 reachable from the internet for the certificate challenge.

```bash
git clone https://github.com/solomon2773/rental-ledger.git
cd rental-ledger
cp deploy/.env.example deploy/.env
cp deploy/server.env.example deploy/server.env
```

Edit `deploy/server.env`:

- `APP_SECRET`: `openssl rand -base64 48`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: from the OAuth client (see step 2)
- `ANTHROPIC_API_KEY`

`deploy/.env` already has `SITE_DOMAIN=rental-ledger.solomontsao.com`.

## 2. Google OAuth client for the public URL

In Google Cloud Console → APIs & Services → Credentials → your OAuth client (Web application), add this **Authorized redirect URI**:

```
https://rental-ledger.solomontsao.com/api/auth/google/callback
```

Keep the `http://localhost:8787/auth/google/callback` entry too if you still develop locally. While the OAuth consent screen is in *Testing*, only listed test users can sign in and refresh tokens expire after 7 days; publish the app for permanent access (`docs/google-cloud-setup.md`).

## 3. Start

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

The first build takes a few minutes (installs Expo and bundles the web app). Then:

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env ps
docker compose -f deploy/docker-compose.yml --env-file deploy/.env logs -f web server
curl -s https://rental-ledger.solomontsao.com/api/health
```

Expected: `{"ok":true,"model":"claude-opus-5-5"}` and the sign-in page at https://rental-ledger.solomontsao.com/.

## 4. Updating

```bash
./deploy/update.sh
```

That pulls `main`, rebuilds the images and restarts only what changed. Data volumes are untouched.

## 5. Backups

```bash
./deploy/backup.sh      # writes backups/ledger-data-<timestamp>.tgz
```

## Phones

Point the native app at the same API:

```
# apps/mobile/.env
EXPO_PUBLIC_API_URL=https://rental-ledger.solomontsao.com/api
```

The server already allows `rentalledger://` (dev/production builds) and `exp://` (Expo Go) as login redirect targets. The web app at the domain works on a phone browser as well, including the camera via the file picker.

## If ports 80/443 are already in use on the host

Keep your existing reverse proxy and run Caddy on an internal port instead:

```bash
docker compose -f deploy/docker-compose.yml -f deploy/compose.behind-proxy.yml --env-file deploy/.env up -d --build
```

Then forward `rental-ledger.solomontsao.com` from your existing proxy to `http://127.0.0.1:8080` (it must pass the `Host` header through). Requires Docker Compose 2.24 or newer.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Browser shows a certificate error or Caddy logs `challenge failed` | Port 80 not reachable from the internet, or DNS not yet propagated. `dig +short rental-ledger.solomontsao.com` should print `75.10.217.13`. |
| Google says `redirect_uri_mismatch` | The redirect URI in step 2 is missing or differs (scheme, host or `/api` path). |
| Sign-in returns `redirect_uri must match one of` | `ALLOWED_APP_REDIRECTS` in `deploy/server.env` does not include `https://rental-ledger.solomontsao.com`. |
| `Cannot reach the server` banner in the web app | The web image was built with a different `SITE_DOMAIN`; rebuild with `--build`. |
| 428 errors / "sign in again" | Google refresh token expired (Testing-mode consent screen) or revoked. Sign in again. |
