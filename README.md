# Rental Ledger

Snap a receipt on your phone → it is recognised (vendor, date, total, items, card) → you confirm → a row lands in that property's **Google Sheet**, the photo is filed in **Google Drive**, and the summary tab recalculates monthly totals, yearly totals and net P&L.

Built for landlords running **short-term (Airbnb/VRBO) and long-term rentals** with one or many properties. Each property gets its own yearly workbook, laid out like the original "AirBnb Balance Sheets" spreadsheet.

```
apps/mobile    Expo (React Native) app – iOS, Android and web from one codebase
apps/server    Node 22 + Hono API – Google OAuth, Sheets/Drive writes, Claude receipt recognition, SQLite metadata
packages/shared  Types, Zod schemas and category vocabulary shared by both
docs/          Architecture, sheet layout, Google Cloud setup, roadmap
```

## Why Expo (React Native) and not plain React

The core action is *taking a photo of a receipt*, which is a phone job. Expo gives a native iOS + Android app **and** a web build from the same code, so you can also paste receipt PDFs/screenshots from a laptop. The API server is separate so the Google and Anthropic credentials never ship inside the app.

## What it does today

- **Google sign-in** (OAuth, offline refresh token) so sheets and folders are created in *your* Drive and can be shared like any other Google file.
- **Properties**: name, address, type (short-term / long-term / hybrid), the monthly-bill columns you want on the summary tab, saved payment methods ("Visa - 8941").
- **Automatic workbook per property per year** (`<Property> - Balance Sheets - <Year>`), moved into `Drive / Rental Ledger / <Property> / <Year> /`, with a `Receipts/` folder beside it. Created on demand the first time an entry for that year is saved.
- **Receipt capture**: camera or photo library → downsized on device → Claude reads it into structured JSON (structured outputs, so the shape is guaranteed) → review screen pre-filled with date, vendor, total, suggested ledger tab + category, "Pay by" matched to your saved cards, a one-line "Details" summary in the style of the original sheet, line items and warnings.
- **Save** appends a row to the right tab, uploads the image to Drive and writes `=HYPERLINK(<drive link>, "Yes")` into the sheet's *Receipt* column. Each row carries an *Entry ID* so the app can delete it later.
- **Income** entries (Airbnb, VRBO, direct booking, cash rent, …) feed the "Airbnb Rent" / "Cash Rent" columns automatically.
- **Summary tab** formulas: monthly bill columns via `SUMIFS` over the Regular Bills ledger, monthly total, profit/loss, 75 % lender view, averages, yearly totals, utility cost, supply total, setup total, net P&L (operating) and net incl. setup. See [docs/sheet-layout.md](docs/sheet-layout.md).
- **Link an existing sheet** (e.g. the original balance sheet): tabs are detected by name, missing ledger tabs are added, nothing existing is touched. "Rebuild summary formulas" is an explicit, confirmed action.
- **Ledger view** in the app (local mirror in SQLite) with delete (removes the sheet row and trashes the Drive image).

## Quick start

### 0. Prerequisites

- Node 22.13+ (uses the built-in `node:sqlite`)
- A Google Cloud project with the **Google Sheets API** and **Google Drive API** enabled and an OAuth client of type *Web application* → [docs/google-cloud-setup.md](docs/google-cloud-setup.md)
- An Anthropic API key (`ANTHROPIC_API_KEY`) or `ant auth login`

### 1. Install

```bash
npm install
npm run build:shared
```

### 2. Server

```bash
cp apps/server/.env.example apps/server/.env
# fill in APP_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ANTHROPIC_API_KEY
npm run dev:server         # http://localhost:8787
```

The OAuth client's *Authorized redirect URI* must be `http://localhost:8787/auth/google/callback` (or your public URL + `/auth/google/callback`).

### 3. App

```bash
cp apps/mobile/.env.example apps/mobile/.env   # set EXPO_PUBLIC_API_URL if the server is not on localhost
npm run dev:mobile          # Expo dev server; press w for web, i for iOS simulator, a for Android, or scan the QR with Expo Go
```

Sign in with Google, add a property, tap **Scan**.

> Expo Go works for development. Camera and secure storage are bundled modules, so no custom dev build is needed for the current feature set.

## Scripts

| Command | What |
|---|---|
| `npm run typecheck` | TypeScript across all workspaces |
| `npm test` | Unit tests (sheet template formulas, summary parsing, schemas) |
| `npm run dev:server` / `npm run dev:mobile` | Dev servers |
| `npm run build -w apps/server` | Compile the API to `apps/server/dist` |

## Configuration

See `apps/server/.env.example` and `apps/mobile/.env.example`. Notable knobs:

- `ANTHROPIC_MODEL` (default `claude-opus-5-5`) and `ANTHROPIC_EFFORT` (`low|medium|high`).
- `ALLOWED_APP_REDIRECTS`: which app URLs the login flow may bounce back to (`rentalledger://` for builds, `exp://` for Expo Go, `http://localhost:8081` for web).
- `DRIVE_ROOT_FOLDER_NAME`: top-level Drive folder (default `Rental Ledger`).

## Documentation

- [docs/architecture.md](docs/architecture.md) – components, data flow, why Google Sheets stays the source of truth
- [docs/sheet-layout.md](docs/sheet-layout.md) – every tab, column and formula the app writes
- [docs/google-cloud-setup.md](docs/google-cloud-setup.md) – OAuth consent screen, scopes, redirect URIs
- [docs/roadmap.md](docs/roadmap.md) – suggested features and the reasoning behind them

## Status

MVP scaffold: the server and app type-check and the formula/template layer is unit-tested. End-to-end against live Google + Anthropic APIs still needs to be exercised with real credentials (see *Next steps* in the roadmap).
