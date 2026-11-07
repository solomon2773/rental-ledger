import {
  DEFAULT_REGULAR_CATEGORIES,
  parseSpreadsheetId,
  type Property,
  type PropertyCreate,
  type PropertySummary,
  type WorkbookLink,
} from "@rental-ledger/shared";
import type { Config } from "../config.js";
import type { Repo, UserRow, WorkbookRecord } from "../db/repo.js";
import { GoogleFactory, translateGoogleError } from "../google/client.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";

export class PropertyService {
  constructor(
    private config: Config,
    private repo: Repo,
    private google: GoogleFactory,
  ) {}

  async create(user: UserRow, input: PropertyCreate): Promise<{ property: Property; workbook: WorkbookRecord | null }> {
    const property = this.repo.createProperty({
      userId: user.id,
      name: input.name.trim(),
      address: input.address?.trim() ?? "",
      type: input.type,
      regularCategories: (input.regularCategories ?? [...DEFAULT_REGULAR_CATEGORIES]).map((c) => c.trim()).filter(Boolean),
      paymentMethods: input.paymentMethods ?? [],
    });
    await this.ensureDriveFolder(user, property);
    let workbook: WorkbookRecord | null = null;
    if (input.createWorkbook) {
      workbook = await this.ensureWorkbook(user, property, input.year ?? new Date().getFullYear());
    }
    return { property: this.repo.getProperty(user.id, property.id)!, workbook };
  }

  private async ensureDriveFolder(user: UserRow, property: Property): Promise<string> {
    if (property.driveFolderId) return property.driveFolderId;
    const g = this.google.forUser(user);
    try {
      const folderId = await g.drive.ensurePath([this.config.DRIVE_ROOT_FOLDER_NAME, property.name]);
      this.repo.setPropertyDriveFolder(property.id, folderId);
      return folderId;
    } catch (e) {
      throw translateGoogleError(e, this.repo, user.id);
    }
  }

  /** Return the workbook for a year, creating the Google Sheet (and Drive folders) on first use. */
  async ensureWorkbook(user: UserRow, property: Property, year: number): Promise<WorkbookRecord> {
    const existing = this.repo.getWorkbookForYear(property.id, year);
    if (existing) return existing;

    const g = this.google.forUser(user);
    try {
      const propertyFolder = await this.ensureDriveFolder(user, property);
      const yearFolder = await g.drive.ensureFolder(String(year), propertyFolder);
      const receiptsFolder = await g.drive.ensureFolder("Receipts", yearFolder);
      const created = await g.sheets.createWorkbook(property.name, year, property.regularCategories);
      await g.drive.moveToFolder(created.spreadsheetId, yearFolder);
      return this.repo.createWorkbook({
        propertyId: property.id,
        year,
        spreadsheetId: created.spreadsheetId,
        spreadsheetUrl: created.spreadsheetUrl,
        source: "created",
        tabMap: created.tabMap,
        receiptsFolderId: receiptsFolder,
      });
    } catch (e) {
      throw translateGoogleError(e, this.repo, user.id);
    }
  }

  /** Attach a spreadsheet the user already has (like the original hand-made balance sheet). */
  async linkWorkbook(user: UserRow, property: Property, input: WorkbookLink): Promise<WorkbookRecord> {
    const spreadsheetId = parseSpreadsheetId(input.spreadsheet);
    if (!spreadsheetId) throw badRequest("Could not read a spreadsheet ID from that link.");
    if (this.repo.getWorkbookForYear(property.id, input.year)) {
      throw conflict(`This property already has a workbook for ${input.year}. Unlink it first.`);
    }
    const g = this.google.forUser(user);
    try {
      const info = await g.sheets.inspect(spreadsheetId);
      let tabMap = await g.sheets.detectTabMap(spreadsheetId);
      tabMap = await g.sheets.ensureLedgerTabs(spreadsheetId, tabMap);
      const propertyFolder = await this.ensureDriveFolder(user, property);
      const receiptsFolder = await g.drive.ensurePath([String(input.year), "Receipts"], propertyFolder);
      return this.repo.createWorkbook({
        propertyId: property.id,
        year: input.year,
        spreadsheetId,
        spreadsheetUrl: info.url || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        source: "linked",
        tabMap,
        receiptsFolderId: receiptsFolder,
      });
    } catch (e) {
      throw translateGoogleError(e, this.repo, user.id);
    }
  }

  unlinkWorkbook(property: Property, workbookId: string) {
    const wb = this.repo.getWorkbook(workbookId);
    if (!wb || wb.propertyId !== property.id) throw notFound("Workbook not found");
    this.repo.deleteWorkbook(workbookId);
  }

  /** Rewrite the summary tab so it is driven by the ledger tabs (explicit, destructive for hand-typed cells). */
  async rebuildSummary(user: UserRow, property: Property, workbookId: string): Promise<WorkbookRecord> {
    const wb = this.repo.getWorkbook(workbookId);
    if (!wb || wb.propertyId !== property.id) throw notFound("Workbook not found");
    const g = this.google.forUser(user);
    try {
      const summaryTab = await g.sheets.rebuildSummary(wb.spreadsheetId, wb.tabMap, wb.year, property.regularCategories);
      const tabMap = { ...wb.tabMap, summary: summaryTab };
      this.repo.updateWorkbookTabMap(wb.id, tabMap);
      return this.repo.getWorkbook(wb.id)!;
    } catch (e) {
      throw translateGoogleError(e, this.repo, user.id);
    }
  }

  /** Dashboard numbers, read live from the summary tab. */
  async summary(user: UserRow, property: Property, year: number): Promise<PropertySummary> {
    const wb = this.repo.getWorkbookForYear(property.id, year);
    const empty: PropertySummary = {
      propertyId: property.id,
      year,
      spreadsheetUrl: wb?.spreadsheetUrl ?? null,
      totals: { regularExpenses: 0, supplyExpenses: 0, setupExpenses: 0, airbnbRent: 0, cashRent: 0, netOperating: 0, netIncludingSetup: 0 },
      monthly: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, regularExpenses: 0, income: 0, profit: 0 })),
    };
    if (!wb || !wb.tabMap.summary) return empty;

    const g = this.google.forUser(user);
    let grid: (string | number | null)[][];
    try {
      grid = await g.sheets.readSummaryGrid(wb.spreadsheetId, wb.tabMap.summary);
    } catch (e) {
      throw translateGoogleError(e, this.repo, user.id);
    }
    return parseSummaryGrid(grid, empty);
  }
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

/** Pull totals out of the summary grid by header/label text so hand-made sheets with slightly different rows still work. */
export function parseSummaryGrid(grid: (string | number | null)[][], base: PropertySummary): PropertySummary {
  const headers = (grid[0] ?? []).map((h) => String(h ?? "").toLowerCase());
  const findCol = (re: RegExp) => headers.findIndex((h) => re.test(h));
  const totalCol = findCol(/monthly total/);
  const airbnbCol = findCol(/airbnb/);
  const cashCol = findCol(/cash rent/);
  const profitCol = findCol(/profit/);
  const findRow = (re: RegExp) => grid.findIndex((r) => re.test(String(r?.[0] ?? "").toLowerCase()));
  const yearlyRow = findRow(/yearly total/);
  const supplyRow = findRow(/supply expenses/);
  const setupRow = findRow(/setup expenses/);
  const netAllRow = findRow(/incl/);
  const netRow = findRow(/net p&l|whole year/);
  const cell = (r: number, c: number) => (r >= 0 && c >= 0 ? num(grid[r]?.[c]) : 0);

  const monthly = base.monthly.map((m, i) => {
    const r = 1 + i;
    const regularExpenses = cell(r, totalCol);
    const income = cell(r, airbnbCol) + cell(r, cashCol);
    return { month: m.month, regularExpenses, income, profit: profitCol >= 0 ? cell(r, profitCol) : income - regularExpenses };
  });

  const totals = {
    regularExpenses: cell(yearlyRow, totalCol),
    airbnbRent: cell(yearlyRow, airbnbCol),
    cashRent: cell(yearlyRow, cashCol),
    supplyExpenses: cell(supplyRow, profitCol),
    setupExpenses: cell(setupRow, profitCol),
    netOperating: cell(netRow, profitCol),
    netIncludingSetup: netAllRow >= 0 ? cell(netAllRow, profitCol) : cell(netRow, profitCol),
  };
  return { ...base, totals, monthly };
}
