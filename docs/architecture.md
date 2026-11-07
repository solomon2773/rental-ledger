# Architecture

```
┌──────────────────────┐      HTTPS/JSON       ┌──────────────────────────┐
│  Expo app            │ ───────────────────▶  │  API server (Hono/Node)  │
│  iOS · Android · Web │  multipart image      │                          │
│  expo-router screens │ ◀───────────────────  │  ┌────────────────────┐  │
└──────────────────────┘  structured JSON      │  │ SQLite (node:sqlite)│  │  users, properties,
                                               │  │ metadata mirror     │  │  workbook ↔ year map,
                                               │  └────────────────────┘  │  scans, entry mirror
                                               │     │            │        │
                                               └─────┼────────────┼────────┘
                                                     │            │
                                   Anthropic Messages│            │ Google APIs (user's OAuth token)
                                   structured outputs│            │
                                                     ▼            ▼
                                          ┌──────────────┐  ┌───────────────────────────────┐
                                          │ Claude       │  │ Google Drive  (folders, images)│
                                          │ receipt →    │  │ Google Sheets (workbook/year) │
                                          │ JSON         │  └───────────────────────────────┘
                                          └──────────────┘
```

## Principles

1. **Google Sheets is the source of truth for the numbers.** The user asked for sheets because they are easy to share. The app never caches totals it would have to keep in sync; the dashboard reads the summary tab live. SQLite only stores *metadata* (which spreadsheet belongs to which property/year, what the app wrote and where) so the app can list, link and delete.
2. **Formulas, not computed values.** The app writes ledger rows; every total on the summary tab is a formula. Editing a row by hand in Sheets still recalculates everything.
3. **Credentials stay server-side.** The app never sees Google refresh tokens or the Anthropic key. The server holds the user's refresh token encrypted (AES-256-GCM, key derived from `APP_SECRET`) and mints a 90-day app session token (HS256 JWT).
4. **Least privilege on Google.** Scopes are `drive.file` (only files the app created) + `spreadsheets` (needed to append to a sheet the user made by hand and linked). Dropping the *link existing sheet* feature would let us drop the broader `spreadsheets` scope.
5. **Per user, per property, per year.** Everything scales along those three axes without schema changes.

## Request flows

### Sign-in
1. App opens `GET /auth/google/start?redirect_uri=<app url>` in a browser (`expo-web-browser` auth session on native; full-page redirect on web).
2. Server stores a random `state` → redirect pair and sends the browser to Google with `access_type=offline&prompt=consent` so a refresh token is issued.
3. Google calls `GET /auth/google/callback?code&state`. Server exchanges the code, verifies the `id_token`, upserts the user, encrypts the refresh token, issues a session JWT and redirects to `<app url>?token=…`.
4. App stores the token in SecureStore (Keychain/Keystore) or `localStorage` on web and sends it as `Authorization: Bearer`.

### Receipt → sheet
1. `pickReceipt()` on device: camera/library → resize to ≤ 1800 px → JPEG 0.82 (~300–600 KB).
2. `POST /scans` (multipart `image`, `propertyId`). Server stores the file under `DATA_DIR/uploads`, calls Claude with the image + property context (regular bill categories, saved cards, today's date) using **structured outputs** (`client.beta.messages.parse` + `zodOutputFormat`). Result is normalised (valid ISO date, category guard, "Pay by" label) and saved on the scan.
3. Review screen shows the image, warnings, confidence and a pre-filled form. The user edits/confirms.
4. `POST /entries/expense`:
   - `ensureWorkbook(property, year)` creates the Google Sheet + Drive folders for that year if missing.
   - Image → `Drive/Rental Ledger/<Property>/<Year>/Receipts/<date>_<vendor>_<id>.jpg`.
   - Row → first empty row of the ledger tab (`values.update`, `USER_ENTERED`), date as `=DATE(y,m,d)` (locale-proof), receipt as `=HYPERLINK(link,"Yes")`, Entry ID in the last column.
   - Local mirror row in SQLite; payment method remembered on the property.

### Delete
`DELETE /entries/:id` finds the sheet row by Entry ID, deletes the row (`deleteDimension`), trashes the Drive file, removes the mirror row.

## Code map

| Path | Role |
|---|---|
| `packages/shared/src/categories.ts` | Ledgers, categories, income sources → bucket mapping, property types |
| `packages/shared/src/schemas.ts` | Zod schemas for API payloads and the receipt extraction |
| `apps/server/src/google/workbook-template.ts` | Pure functions: tab names, headers, every formula, formatting requests (unit-tested) |
| `apps/server/src/google/sheets.ts` | Sheets API: create workbook, inspect/link, append rows, delete by Entry ID, read summary |
| `apps/server/src/google/drive.ts` | Drive API: folder paths, move spreadsheet, upload/trash images |
| `apps/server/src/receipts/extract.ts` | Claude call, prompt, normalisation |
| `apps/server/src/services/properties.ts` | Property + workbook lifecycle, summary parsing |
| `apps/server/src/services/entries.ts` | Expense/income commit, delete |
| `apps/server/src/routes/*` | HTTP surface |
| `apps/mobile/src/app/*` | Screens (expo-router) |
| `apps/mobile/src/lib/api.ts` | Typed client for the server |
| `apps/mobile/src/lib/images.ts` | Camera/library pick + downscale |

## Swapping pieces later

- **Database**: `Repo` is the only class that touches SQL. Moving to Postgres (e.g. for a hosted multi-user deployment) means re-implementing `Repo` and `openDatabase`.
- **OCR provider**: `ReceiptExtractor` is the single call site. Its output is validated against `ReceiptExtraction`, so any provider that can fill that schema is a drop-in.
- **Storage**: receipt originals are kept on the server only until committed; Drive is the long-term store. A cron that purges `uploads/` older than N days is a sensible addition.
