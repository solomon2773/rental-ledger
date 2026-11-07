# Google Cloud setup (one time, ~10 minutes)

1. Go to https://console.cloud.google.com/ and create a project (e.g. `rental-ledger`).
2. **APIs & Services → Library**: enable **Google Sheets API** and **Google Drive API**.
3. **APIs & Services → OAuth consent screen**
   - User type: *External* (or *Internal* if you have a Workspace org and only you/your team will use it).
   - App name "Rental Ledger", your support email, developer email.
   - **Scopes**: add
     - `openid`, `email`, `profile`
     - `https://www.googleapis.com/auth/drive.file`
     - `https://www.googleapis.com/auth/spreadsheets`
   - **Test users**: add the Google accounts that will sign in. While the app is in *Testing* you can have up to 100 test users and refresh tokens expire after 7 days (Google's rule for test mode). Publish the app to lift that; the `spreadsheets` scope is *sensitive* and triggers Google's verification review when publishing. If you only ever use app-created sheets you can remove it from `googleScopes` in `apps/server/src/config.ts` and skip verification.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application** (yes, even for the mobile app: the server does the exchange).
   - Authorized redirect URIs: `http://localhost:8787/auth/google/callback` for local dev; add your deployed server URL + `/auth/google/callback` later.
   - Copy the Client ID and Client secret into `apps/server/.env`.
5. Start the server; the console prints the exact redirect URI it expects.

## Anthropic

Create an API key at https://platform.claude.com/ and set `ANTHROPIC_API_KEY` in `apps/server/.env`, or run `ant auth login` on the machine that runs the server. The server defaults to `claude-opus-5-5`; receipts are small images so a scan costs a fraction of a cent.

## Running on a phone

The phone must reach the server. Options:

- Same Wi-Fi: set `EXPO_PUBLIC_API_URL=http://<your-laptop-LAN-IP>:8787` in `apps/mobile/.env`. Also set `SERVER_PUBLIC_URL` to the same host so the OAuth redirect URI matches, and add that URI to the Google OAuth client.
- Tunnel (ngrok, Cloudflare Tunnel) or a small VPS: use the public HTTPS URL for both variables.

Expo Go deep links look like `exp://192.168.1.20:8081/--/auth/callback`; `exp://` is in `ALLOWED_APP_REDIRECTS` by default. A standalone/dev build uses `rentalledger://auth/callback`.
