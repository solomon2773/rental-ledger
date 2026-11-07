import { sheets as sheetsApi, type sheets_v4 } from "@googleapis/sheets";
import type { OAuth2Client } from "google-auth-library";
import type { LedgerKind } from "@rental-ledger/shared";
import {
  EXPENSE_COL,
  EXPENSE_LEDGER_HEADERS,
  INCOME_COL,
  INCOME_LEDGER_HEADERS,
  TAB_TITLES,
  classifyTabTitle,
  createSpreadsheetBody,
  dateFormula,
  formattingRequests,
  hyperlinkFormula,
  initialValueRanges,
  summaryRows,
  SUMMARY_TAB,
} from "./workbook-template.js";
import type { WorkbookTabMap } from "../db/repo.js";

const q = (tab: string) => `'${tab.replace(/'/g, "''")}'`;

export interface TabInfo {
  title: string;
  sheetId: number;
  index: number;
}

export interface ExpenseRowInput {
  entryId: string;
  date: string; // ISO
  vendor: string;
  category: string;
  details: string;
  amount: number;
  payBy: string;
  notes: string;
  receiptUrl: string | null;
}

export interface IncomeRowInput {
  entryId: string;
  date: string;
  source: string;
  bucket: string;
  payer: string;
  amount: number;
  notes: string;
}

export class SheetsService {
  private api: sheets_v4.Sheets;

  constructor(auth: OAuth2Client) {
    // The googleapis clients accept an OAuth2Client; the cast smooths over duplicate google-auth-library copies.
    this.api = sheetsApi({ version: "v4", auth: auth as unknown as string });
  }

  /** Create a complete yearly workbook (5 tabs, formulas, formatting). */
  async createWorkbook(propertyName: string, year: number, regularCategories: string[]) {
    const created = await this.api.spreadsheets.create({
      requestBody: createSpreadsheetBody(propertyName, year, regularCategories),
      fields: "spreadsheetId,spreadsheetUrl",
    });
    const spreadsheetId = created.data.spreadsheetId!;
    const spreadsheetUrl = created.data.spreadsheetUrl!;

    await this.api.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data: initialValueRanges(year, regularCategories) },
    });
    await this.api.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: formattingRequests(regularCategories) },
    });

    const tabMap: WorkbookTabMap = { summary: SUMMARY_TAB, ...TAB_TITLES };
    return { spreadsheetId, spreadsheetUrl, tabMap };
  }

  async inspect(spreadsheetId: string): Promise<{ title: string; url: string; tabs: TabInfo[] }> {
    const res = await this.api.spreadsheets.get({
      spreadsheetId,
      fields: "properties.title,spreadsheetUrl,sheets.properties(sheetId,title,index)",
    });
    return {
      title: res.data.properties?.title ?? "",
      url: res.data.spreadsheetUrl ?? "",
      tabs: (res.data.sheets ?? []).map((s) => ({
        title: s.properties?.title ?? "",
        sheetId: s.properties?.sheetId ?? 0,
        index: s.properties?.index ?? 0,
      })),
    };
  }

  /** Map an existing (hand-made) workbook's tabs to ledgers by title. */
  async detectTabMap(spreadsheetId: string): Promise<WorkbookTabMap> {
    const { tabs } = await this.inspect(spreadsheetId);
    const map: WorkbookTabMap = {};
    for (const t of tabs) {
      const kind = classifyTabTitle(t.title);
      if (kind && !map[kind]) map[kind] = t.title;
    }
    return map;
  }

  /** Add any ledger tabs that a linked workbook is missing (never touches existing tabs). */
  async ensureLedgerTabs(spreadsheetId: string, tabMap: WorkbookTabMap): Promise<WorkbookTabMap> {
    const next: WorkbookTabMap = { ...tabMap };
    const requests: sheets_v4.Schema$Request[] = [];
    const headerWrites: sheets_v4.Schema$ValueRange[] = [];
    for (const kind of ["regular", "supply", "setup", "income"] as LedgerKind[]) {
      if (next[kind]) continue;
      const title = TAB_TITLES[kind];
      next[kind] = title;
      requests.push({ addSheet: { properties: { title, gridProperties: { rowCount: 1000, columnCount: 12, frozenRowCount: 1 } } } });
      headerWrites.push({
        range: `${q(title)}!A1`,
        values: [kind === "income" ? [...INCOME_LEDGER_HEADERS] : [...EXPENSE_LEDGER_HEADERS]],
      });
    }
    if (requests.length) {
      await this.api.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
      await this.api.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: "USER_ENTERED", data: headerWrites },
      });
    }
    return next;
  }

  /**
   * (Re)write the summary tab formulas so they read from the ledger tabs.
   * Destructive for anything typed by hand into the summary tab, so only call on explicit request.
   */
  async rebuildSummary(spreadsheetId: string, tabMap: WorkbookTabMap, year: number, regularCategories: string[]): Promise<string> {
    let summaryTab = tabMap.summary;
    if (!summaryTab) {
      summaryTab = SUMMARY_TAB;
      await this.api.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: summaryTab, index: 0, gridProperties: { rowCount: 40, columnCount: 26, frozenRowCount: 1 } } } }] },
      });
    }
    const tabs = {
      regular: tabMap.regular ?? TAB_TITLES.regular,
      supply: tabMap.supply ?? TAB_TITLES.supply,
      setup: tabMap.setup ?? TAB_TITLES.setup,
      income: tabMap.income ?? TAB_TITLES.income,
    };
    await this.api.spreadsheets.values.clear({ spreadsheetId, range: `${q(summaryTab)}!A1:Z40` });
    await this.api.spreadsheets.values.update({
      spreadsheetId,
      range: `${q(summaryTab)}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: summaryRows(year, regularCategories, tabs) },
    });
    return summaryTab;
  }

  /** First row (1-based) whose column A is empty, scanning from row 2. */
  async nextEmptyRow(spreadsheetId: string, tab: string): Promise<number> {
    const res = await this.api.spreadsheets.values.get({ spreadsheetId, range: `${q(tab)}!A2:A` });
    const col = res.data.values ?? [];
    for (let i = 0; i < col.length; i++) {
      const v = col[i]?.[0];
      if (v === undefined || v === null || String(v).trim() === "") return i + 2;
    }
    return col.length + 2;
  }

  private async writeRow(spreadsheetId: string, tab: string, row: number, values: (string | number)[]) {
    await this.api.spreadsheets.values.update({
      spreadsheetId,
      range: `${q(tab)}!A${row}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] },
    });
  }

  async appendExpenseRow(spreadsheetId: string, tab: string, input: ExpenseRowInput): Promise<number> {
    const row = await this.nextEmptyRow(spreadsheetId, tab);
    const values: (string | number)[] = new Array(EXPENSE_LEDGER_HEADERS.length).fill("");
    values[EXPENSE_COL.date] = dateFormula(input.date);
    values[EXPENSE_COL.from] = input.vendor;
    values[EXPENSE_COL.category] = input.category;
    values[EXPENSE_COL.details] = input.details;
    values[EXPENSE_COL.amount] = input.amount;
    values[EXPENSE_COL.payBy] = input.payBy;
    values[EXPENSE_COL.notes] = input.notes;
    values[EXPENSE_COL.receipt] = input.receiptUrl ? hyperlinkFormula(input.receiptUrl, "Yes") : "No";
    values[EXPENSE_COL.entryId] = input.entryId;
    await this.writeRow(spreadsheetId, tab, row, values);
    return row;
  }

  async appendIncomeRow(spreadsheetId: string, tab: string, input: IncomeRowInput): Promise<number> {
    const row = await this.nextEmptyRow(spreadsheetId, tab);
    const values: (string | number)[] = new Array(INCOME_LEDGER_HEADERS.length).fill("");
    values[INCOME_COL.date] = dateFormula(input.date);
    values[INCOME_COL.source] = input.source;
    values[INCOME_COL.bucket] = input.bucket;
    values[INCOME_COL.payer] = input.payer;
    values[INCOME_COL.amount] = input.amount;
    values[INCOME_COL.notes] = input.notes;
    values[INCOME_COL.entryId] = input.entryId;
    await this.writeRow(spreadsheetId, tab, row, values);
    return row;
  }

  /** Locate a row by its Entry ID column and delete it. Returns true when a row was removed. */
  async deleteRowByEntryId(spreadsheetId: string, tab: string, entryIdCol: number, entryId: string): Promise<boolean> {
    const { tabs } = await this.inspect(spreadsheetId);
    const sheet = tabs.find((t) => t.title === tab);
    if (!sheet) return false;
    const colA1 = String.fromCharCode(65 + entryIdCol);
    const res = await this.api.spreadsheets.values.get({ spreadsheetId, range: `${q(tab)}!${colA1}2:${colA1}` });
    const col = res.data.values ?? [];
    const idx = col.findIndex((r) => r?.[0] === entryId);
    if (idx < 0) return false;
    const rowIndex0 = idx + 1; // +1 for header
    await this.api.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ deleteDimension: { range: { sheetId: sheet.sheetId, dimension: "ROWS", startIndex: rowIndex0, endIndex: rowIndex0 + 1 } } }],
      },
    });
    return true;
  }

  /** Raw summary grid (unformatted values) for the dashboard. */
  async readSummaryGrid(spreadsheetId: string, summaryTab: string): Promise<(string | number | null)[][]> {
    const res = await this.api.spreadsheets.values.get({
      spreadsheetId,
      range: `${q(summaryTab)}!A1:Z21`,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER",
    });
    return (res.data.values ?? []) as (string | number | null)[][];
  }
}
