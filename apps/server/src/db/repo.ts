import type { Db } from "./index.js";
import type {
  Entry,
  LedgerKind,
  Property,
  PropertyType,
  ReceiptExtraction,
  Scan,
  Workbook,
} from "@rental-ledger/shared";
import { driveFolderUrl } from "@rental-ledger/shared";
import { newId, nowIso } from "../lib/ids.js";

// ---------------------------------------------------------------------------
// Row types (snake_case as stored) and mappers
// ---------------------------------------------------------------------------

export interface UserRow {
  id: string;
  google_sub: string;
  email: string;
  name: string | null;
  picture: string | null;
  refresh_token_enc: string | null;
  created_at: string;
  updated_at: string;
}

interface PropertyRow {
  id: string;
  user_id: string;
  name: string;
  address: string;
  type: PropertyType;
  regular_categories: string;
  payment_methods: string;
  drive_folder_id: string | null;
  created_at: string;
  archived_at: string | null;
}

interface WorkbookRow {
  id: string;
  property_id: string;
  year: number;
  spreadsheet_id: string;
  spreadsheet_url: string;
  source: "created" | "linked";
  tab_map: string;
  receipts_folder_id: string | null;
  created_at: string;
}

interface ScanRow {
  id: string;
  user_id: string;
  property_id: string | null;
  file_path: string;
  mime_type: string;
  status: Scan["status"];
  extraction: string | null;
  error: string | null;
  created_at: string;
}

interface EntryRow {
  id: string;
  property_id: string;
  workbook_id: string;
  ledger: LedgerKind;
  date: string;
  vendor: string;
  category: string;
  details: string;
  amount: number;
  pay_by: string;
  notes: string;
  drive_file_id: string | null;
  drive_link: string | null;
  sheet_row: number | null;
  scan_id: string | null;
  created_at: string;
}

export type WorkbookTabMap = Partial<Record<LedgerKind | "summary", string>>;

const toProperty = (r: PropertyRow): Property => ({
  id: r.id,
  name: r.name,
  address: r.address,
  type: r.type,
  regularCategories: JSON.parse(r.regular_categories),
  paymentMethods: JSON.parse(r.payment_methods),
  driveFolderId: r.drive_folder_id,
  driveFolderUrl: r.drive_folder_id ? driveFolderUrl(r.drive_folder_id) : null,
  createdAt: r.created_at,
  archivedAt: r.archived_at,
});

export interface WorkbookRecord extends Workbook {
  tabMap: WorkbookTabMap;
}

const toWorkbook = (r: WorkbookRow): WorkbookRecord => ({
  id: r.id,
  propertyId: r.property_id,
  year: r.year,
  spreadsheetId: r.spreadsheet_id,
  spreadsheetUrl: r.spreadsheet_url,
  source: r.source,
  tabMap: JSON.parse(r.tab_map),
  receiptsFolderId: r.receipts_folder_id,
  createdAt: r.created_at,
});

export interface ScanRecord extends Scan {
  userId: string;
  filePath: string;
}

const toScan = (r: ScanRow): ScanRecord => ({
  id: r.id,
  userId: r.user_id,
  propertyId: r.property_id,
  filePath: r.file_path,
  mimeType: r.mime_type,
  status: r.status,
  extraction: r.extraction ? (JSON.parse(r.extraction) as ReceiptExtraction) : null,
  error: r.error,
  createdAt: r.created_at,
});

const toEntry = (r: EntryRow): Entry => ({
  id: r.id,
  propertyId: r.property_id,
  workbookId: r.workbook_id,
  ledger: r.ledger,
  date: r.date,
  vendor: r.vendor,
  category: r.category,
  details: r.details,
  amount: r.amount,
  payBy: r.pay_by,
  notes: r.notes,
  driveFileId: r.drive_file_id,
  driveLink: r.drive_link,
  sheetRow: r.sheet_row,
  scanId: r.scan_id,
  createdAt: r.created_at,
});

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class Repo {
  constructor(private db: Db) {}

  // ---- users ----
  upsertUser(input: { googleSub: string; email: string; name: string | null; picture: string | null; refreshTokenEnc: string | null }): UserRow {
    const existing = this.db.prepare("SELECT * FROM users WHERE google_sub = ?").get(input.googleSub) as UserRow | undefined;
    const now = nowIso();
    if (existing) {
      this.db
        .prepare(
          `UPDATE users SET email = ?, name = ?, picture = ?, refresh_token_enc = COALESCE(?, refresh_token_enc), updated_at = ? WHERE id = ?`,
        )
        .run(input.email, input.name, input.picture, input.refreshTokenEnc, now, existing.id);
      return this.getUser(existing.id)!;
    }
    const id = newId();
    this.db
      .prepare(
        `INSERT INTO users (id, google_sub, email, name, picture, refresh_token_enc, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`,
      )
      .run(id, input.googleSub, input.email, input.name, input.picture, input.refreshTokenEnc, now, now);
    return this.getUser(id)!;
  }

  getUser(id: string): UserRow | undefined {
    return this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  }

  clearRefreshToken(userId: string) {
    this.db.prepare("UPDATE users SET refresh_token_enc = NULL, updated_at = ? WHERE id = ?").run(nowIso(), userId);
  }

  // ---- oauth state ----
  saveOauthState(state: string, redirectUri: string) {
    this.db.prepare("INSERT INTO oauth_states (state, redirect_uri, created_at) VALUES (?,?,?)").run(state, redirectUri, nowIso());
  }

  consumeOauthState(state: string): string | undefined {
    const row = this.db.prepare("SELECT redirect_uri, created_at FROM oauth_states WHERE state = ?").get(state) as
      | { redirect_uri: string; created_at: string }
      | undefined;
    if (!row) return undefined;
    this.db.prepare("DELETE FROM oauth_states WHERE state = ?").run(state);
    // 10 minute validity
    if (Date.now() - Date.parse(row.created_at) > 10 * 60_000) return undefined;
    return row.redirect_uri;
  }

  // ---- properties ----
  createProperty(input: {
    userId: string;
    name: string;
    address: string;
    type: PropertyType;
    regularCategories: string[];
    paymentMethods: string[];
  }): Property {
    const id = newId();
    this.db
      .prepare(
        `INSERT INTO properties (id, user_id, name, address, type, regular_categories, payment_methods, drive_folder_id, created_at, archived_at)
         VALUES (?,?,?,?,?,?,?,NULL,?,NULL)`,
      )
      .run(id, input.userId, input.name, input.address, input.type, JSON.stringify(input.regularCategories), JSON.stringify(input.paymentMethods), nowIso());
    return this.getProperty(input.userId, id)!;
  }

  updateProperty(userId: string, id: string, patch: Partial<Pick<Property, "name" | "address" | "type" | "regularCategories" | "paymentMethods">>): Property | undefined {
    const cur = this.getProperty(userId, id);
    if (!cur) return undefined;
    const next = { ...cur, ...patch };
    this.db
      .prepare(`UPDATE properties SET name = ?, address = ?, type = ?, regular_categories = ?, payment_methods = ? WHERE id = ? AND user_id = ?`)
      .run(next.name, next.address, next.type, JSON.stringify(next.regularCategories), JSON.stringify(next.paymentMethods), id, userId);
    return this.getProperty(userId, id);
  }

  setPropertyDriveFolder(id: string, folderId: string) {
    this.db.prepare("UPDATE properties SET drive_folder_id = ? WHERE id = ?").run(folderId, id);
  }

  archiveProperty(userId: string, id: string) {
    this.db.prepare("UPDATE properties SET archived_at = ? WHERE id = ? AND user_id = ?").run(nowIso(), id, userId);
  }

  addPaymentMethod(userId: string, id: string, method: string) {
    const p = this.getProperty(userId, id);
    if (!p || !method || p.paymentMethods.includes(method)) return;
    this.updateProperty(userId, id, { paymentMethods: [...p.paymentMethods, method] });
  }

  listProperties(userId: string, includeArchived = false): Property[] {
    const rows = this.db
      .prepare(`SELECT * FROM properties WHERE user_id = ? ${includeArchived ? "" : "AND archived_at IS NULL"} ORDER BY created_at ASC`)
      .all(userId) as unknown as PropertyRow[];
    return rows.map(toProperty);
  }

  getProperty(userId: string, id: string): Property | undefined {
    const row = this.db.prepare("SELECT * FROM properties WHERE id = ? AND user_id = ?").get(id, userId) as PropertyRow | undefined;
    return row ? toProperty(row) : undefined;
  }

  // ---- workbooks ----
  createWorkbook(input: {
    propertyId: string;
    year: number;
    spreadsheetId: string;
    spreadsheetUrl: string;
    source: "created" | "linked";
    tabMap: WorkbookTabMap;
    receiptsFolderId: string | null;
  }): WorkbookRecord {
    const id = newId();
    this.db
      .prepare(
        `INSERT INTO workbooks (id, property_id, year, spreadsheet_id, spreadsheet_url, source, tab_map, receipts_folder_id, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .run(id, input.propertyId, input.year, input.spreadsheetId, input.spreadsheetUrl, input.source, JSON.stringify(input.tabMap), input.receiptsFolderId, nowIso());
    return this.getWorkbook(id)!;
  }

  updateWorkbookTabMap(id: string, tabMap: WorkbookTabMap) {
    this.db.prepare("UPDATE workbooks SET tab_map = ? WHERE id = ?").run(JSON.stringify(tabMap), id);
  }

  setWorkbookReceiptsFolder(id: string, folderId: string) {
    this.db.prepare("UPDATE workbooks SET receipts_folder_id = ? WHERE id = ?").run(folderId, id);
  }

  getWorkbook(id: string): WorkbookRecord | undefined {
    const row = this.db.prepare("SELECT * FROM workbooks WHERE id = ?").get(id) as WorkbookRow | undefined;
    return row ? toWorkbook(row) : undefined;
  }

  getWorkbookForYear(propertyId: string, year: number): WorkbookRecord | undefined {
    const row = this.db.prepare("SELECT * FROM workbooks WHERE property_id = ? AND year = ?").get(propertyId, year) as WorkbookRow | undefined;
    return row ? toWorkbook(row) : undefined;
  }

  listWorkbooks(propertyId: string): WorkbookRecord[] {
    const rows = this.db.prepare("SELECT * FROM workbooks WHERE property_id = ? ORDER BY year DESC").all(propertyId) as unknown as WorkbookRow[];
    return rows.map(toWorkbook);
  }

  deleteWorkbook(id: string) {
    this.db.prepare("DELETE FROM workbooks WHERE id = ?").run(id);
  }

  // ---- scans ----
  createScan(input: { userId: string; propertyId: string | null; filePath: string; mimeType: string }): ScanRecord {
    const id = newId();
    this.db
      .prepare(`INSERT INTO scans (id, user_id, property_id, file_path, mime_type, status, extraction, error, created_at) VALUES (?,?,?,?,?,'pending',NULL,NULL,?)`)
      .run(id, input.userId, input.propertyId, input.filePath, input.mimeType, nowIso());
    return this.getScan(id)!;
  }

  setScanExtraction(id: string, extraction: ReceiptExtraction) {
    this.db.prepare("UPDATE scans SET status = 'extracted', extraction = ?, error = NULL WHERE id = ?").run(JSON.stringify(extraction), id);
  }

  setScanFailed(id: string, error: string) {
    this.db.prepare("UPDATE scans SET status = 'failed', error = ? WHERE id = ?").run(error, id);
  }

  setScanCommitted(id: string) {
    this.db.prepare("UPDATE scans SET status = 'committed' WHERE id = ?").run(id);
  }

  getScan(id: string): ScanRecord | undefined {
    const row = this.db.prepare("SELECT * FROM scans WHERE id = ?").get(id) as ScanRow | undefined;
    return row ? toScan(row) : undefined;
  }

  // ---- entries ----
  createEntry(input: Omit<Entry, "id" | "createdAt">): Entry {
    return this.createEntryWithId(newId(), input);
  }

  createEntryWithId(id: string, input: Omit<Entry, "id" | "createdAt">): Entry {
    this.db
      .prepare(
        `INSERT INTO entries (id, property_id, workbook_id, ledger, date, vendor, category, details, amount, pay_by, notes, drive_file_id, drive_link, sheet_row, scan_id, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id, input.propertyId, input.workbookId, input.ledger, input.date, input.vendor, input.category, input.details,
        input.amount, input.payBy, input.notes, input.driveFileId, input.driveLink, input.sheetRow, input.scanId, nowIso(),
      );
    return this.getEntry(id)!;
  }

  getEntry(id: string): Entry | undefined {
    const row = this.db.prepare("SELECT * FROM entries WHERE id = ?").get(id) as EntryRow | undefined;
    return row ? toEntry(row) : undefined;
  }

  listEntries(userId: string, opts: { propertyId?: string; ledger?: LedgerKind; limit?: number } = {}): Entry[] {
    const where = ["p.user_id = ?"];
    const params: (string | number)[] = [userId];
    if (opts.propertyId) {
      where.push("e.property_id = ?");
      params.push(opts.propertyId);
    }
    if (opts.ledger) {
      where.push("e.ledger = ?");
      params.push(opts.ledger);
    }
    params.push(opts.limit ?? 100);
    const rows = this.db
      .prepare(
        `SELECT e.* FROM entries e JOIN properties p ON p.id = e.property_id
         WHERE ${where.join(" AND ")} ORDER BY e.date DESC, e.created_at DESC LIMIT ?`,
      )
      .all(...params) as unknown as EntryRow[];
    return rows.map(toEntry);
  }

  deleteEntry(id: string) {
    this.db.prepare("DELETE FROM entries WHERE id = ?").run(id);
  }
}
