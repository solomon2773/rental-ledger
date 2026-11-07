/**
 * SQLite schema. The database holds *metadata only*: users, properties, which
 * Google Sheet belongs to which property/year, and a local mirror of entries
 * for fast lists in the app. The Google Sheet remains the source of truth for
 * the numbers so it can be shared and edited by hand.
 *
 * Migrations are applied in order and tracked in `schema_migrations`.
 */
export const MIGRATIONS: { id: number; sql: string }[] = [
  {
    id: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        google_sub TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        name TEXT,
        picture TEXT,
        refresh_token_enc TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS oauth_states (
        state TEXT PRIMARY KEY,
        redirect_uri TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        address TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL CHECK (type IN ('short_term','long_term','hybrid')),
        regular_categories TEXT NOT NULL,   -- JSON string[]
        payment_methods TEXT NOT NULL,      -- JSON string[]
        drive_folder_id TEXT,
        created_at TEXT NOT NULL,
        archived_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_properties_user ON properties(user_id);

      CREATE TABLE IF NOT EXISTS workbooks (
        id TEXT PRIMARY KEY,
        property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        spreadsheet_id TEXT NOT NULL,
        spreadsheet_url TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('created','linked')),
        tab_map TEXT NOT NULL,              -- JSON {ledger: tabTitle, summary?: tabTitle}
        receipts_folder_id TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(property_id, year)
      );

      CREATE TABLE IF NOT EXISTS scans (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        property_id TEXT,
        file_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending','extracted','failed','committed')),
        extraction TEXT,                    -- JSON ReceiptExtraction
        error TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        workbook_id TEXT NOT NULL REFERENCES workbooks(id) ON DELETE CASCADE,
        ledger TEXT NOT NULL CHECK (ledger IN ('supply','setup','regular','income')),
        date TEXT NOT NULL,
        vendor TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT '',
        details TEXT NOT NULL DEFAULT '',
        amount REAL NOT NULL,
        pay_by TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        drive_file_id TEXT,
        drive_link TEXT,
        sheet_row INTEGER,
        scan_id TEXT REFERENCES scans(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_entries_property ON entries(property_id, date DESC);
    `,
  },
];
