/**
 * Pure functions that describe a property's yearly workbook: tab names,
 * header rows, formulas and formatting. No network calls here, so the whole
 * layout is unit-testable.
 *
 * Layout mirrors the user's original "AirBnb Balance Sheets" workbook:
 *
 *   Regular Expense            <- monthly summary + yearly totals (formulas only)
 *   Regular Bills              <- NEW ledger feeding the summary's monthly cells
 *   Room Supply Expenses       <- itemised operating purchases (one row per receipt)
 *   Initial Room Setup Expenses<- itemised one-time setup purchases
 *   Income                     <- NEW ledger feeding "Airbnb Rent" / "Cash Rent"
 */
import type { sheets_v4 } from "@googleapis/sheets";
import {
  EXPENSE_CATEGORIES,
  INCOME_BUCKETS,
  INCOME_SOURCES,
  LENDER_RENT_FACTOR,
  UTILITY_CATEGORIES,
  type LedgerKind,
} from "@rental-ledger/shared";

export const SUMMARY_TAB = "Regular Expense";
export const TAB_TITLES: Record<LedgerKind, string> = {
  regular: "Regular Bills",
  supply: "Room Supply Expenses",
  setup: "Initial Room Setup Expenses",
  income: "Income",
};

/** Column layout of the three expense ledgers. Matches the original sheet (A..F, H) plus Notes + Entry ID. */
export const EXPENSE_LEDGER_HEADERS = ["Expense Date", "From", "Category", "Details", "Amount", "Pay by", "Notes", "Receipt", "Entry ID"] as const;
export const INCOME_LEDGER_HEADERS = ["Date", "Source", "Bucket", "Payer", "Amount", "Notes", "Entry ID"] as const;

export const EXPENSE_COL = { date: 0, from: 1, category: 2, details: 3, amount: 4, payBy: 5, notes: 6, receipt: 7, entryId: 8 } as const;
export const INCOME_COL = { date: 0, source: 1, bucket: 2, payer: 3, amount: 4, notes: 5, entryId: 6 } as const;

export const SUMMARY_FIRST_MONTH_ROW = 2;
export const SUMMARY_LAST_MONTH_ROW = 13;
export const SUMMARY_ROW = {
  average: 15,
  yearlyTotal: 16,
  utilityCost: 17,
  supplyExpenses: 18,
  setupExpenses: 19,
  netOperating: 20,
  netIncludingSetup: 21,
} as const;

export function colLetter(index0: number): string {
  let n = index0 + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const q = (tab: string) => `'${tab.replace(/'/g, "''")}'`;

export interface SummaryLayout {
  categories: string[];
  /** 0-based column indexes */
  catCols: number[];
  totalCol: number;
  airbnbCol: number;
  cashCol: number;
  profitCol: number;
  pctCol: number;
  lenderCol: number;
  mortgageCol: number | null;
  lastCol: number;
  headers: (string | number)[];
}

export function summaryLayout(regularCategories: string[]): SummaryLayout {
  const categories = regularCategories.map((c) => c.trim()).filter(Boolean);
  const catCols = categories.map((_, i) => 1 + i);
  const totalCol = 1 + categories.length;
  const airbnbCol = totalCol + 1;
  const cashCol = totalCol + 2;
  const profitCol = totalCol + 3;
  const pctCol = totalCol + 4;
  const lenderCol = totalCol + 5;
  const mortgageIdx = categories.findIndex((c) => /mortgage/i.test(c));
  const headers: (string | number)[] = [
    "",
    ...categories,
    "Monthly Total Regular Expense",
    INCOME_BUCKETS[0],
    INCOME_BUCKETS[1],
    "profit/lost",
    LENDER_RENT_FACTOR,
    "Lender $$ (75% rent − Mortgage)",
  ];
  return {
    categories,
    catCols,
    totalCol,
    airbnbCol,
    cashCol,
    profitCol,
    pctCol,
    lenderCol,
    mortgageCol: mortgageIdx >= 0 ? 1 + mortgageIdx : null,
    lastCol: lenderCol,
    headers,
  };
}

/** Builds the full cell grid (as USER_ENTERED strings/numbers) for the summary tab. */
export function summaryRows(year: number, regularCategories: string[], tabs = TAB_TITLES): (string | number)[][] {
  const L = summaryLayout(regularCategories);
  const rows: (string | number)[][] = [];
  rows.push(L.headers);

  const bills = q(tabs.regular);
  const income = q(tabs.income);
  const monthWindow = (r: number, sheet: string) => `${sheet}!$A:$A,">="&$A${r},${sheet}!$A:$A,"<"&EDATE($A${r},1)`;

  for (let m = 1; m <= 12; m++) {
    const r = SUMMARY_FIRST_MONTH_ROW + m - 1;
    const row: (string | number)[] = new Array(L.lastCol + 1).fill("");
    row[0] = `=DATE(${year},${m},1)`;
    for (const c of L.catCols) {
      row[c] = `=SUMIFS(${bills}!$E:$E,${bills}!$C:$C,${colLetter(c)}$1,${monthWindow(r, bills)})`;
    }
    row[L.totalCol] = `=SUM(${colLetter(L.catCols[0])}${r}:${colLetter(L.catCols[L.catCols.length - 1])}${r})`;
    row[L.airbnbCol] = `=SUMIFS(${income}!$E:$E,${income}!$C:$C,${colLetter(L.airbnbCol)}$1,${monthWindow(r, income)})`;
    row[L.cashCol] = `=SUMIFS(${income}!$E:$E,${income}!$C:$C,${colLetter(L.cashCol)}$1,${monthWindow(r, income)})`;
    row[L.profitCol] = `=${colLetter(L.airbnbCol)}${r}+${colLetter(L.cashCol)}${r}-${colLetter(L.totalCol)}${r}`;
    row[L.pctCol] = `=(${colLetter(L.airbnbCol)}${r}+${colLetter(L.cashCol)}${r})*${colLetter(L.pctCol)}$1`;
    row[L.lenderCol] = L.mortgageCol === null ? `=${colLetter(L.pctCol)}${r}` : `=${colLetter(L.pctCol)}${r}-${colLetter(L.mortgageCol)}${r}`;
    rows.push(row);
  }

  rows.push([]); // row 14 spacer

  const numericCols = [...L.catCols, L.totalCol, L.airbnbCol, L.cashCol, L.profitCol, L.pctCol, L.lenderCol];
  const avg: (string | number)[] = new Array(L.lastCol + 1).fill("");
  avg[0] = "Average";
  for (const c of numericCols) {
    const col = colLetter(c);
    avg[c] = `=IFERROR(AVERAGEIF(${col}${SUMMARY_FIRST_MONTH_ROW}:${col}${SUMMARY_LAST_MONTH_ROW},"<>0"),0)`;
  }
  rows.push(avg);

  const total: (string | number)[] = new Array(L.lastCol + 1).fill("");
  total[0] = "Yearly Total";
  for (const c of numericCols) {
    const col = colLetter(c);
    total[c] = `=SUM(${col}${SUMMARY_FIRST_MONTH_ROW}:${col}${SUMMARY_LAST_MONTH_ROW})`;
  }
  rows.push(total);

  const P = colLetter(L.profitCol);
  const T = SUMMARY_ROW.yearlyTotal;
  const utilityCols = L.catCols.filter((c) => (UTILITY_CATEGORIES as readonly string[]).some((u) => u.toLowerCase() === L.categories[c - 1].toLowerCase()));
  const utilityRow: (string | number)[] = new Array(L.lastCol + 1).fill("");
  utilityRow[0] = "Yearly Utility Cost";
  utilityRow[L.profitCol] = utilityCols.length ? `=${utilityCols.map((c) => `${colLetter(c)}${T}`).join("+")}` : 0;
  rows.push(utilityRow);

  const supplyRow: (string | number)[] = new Array(L.lastCol + 1).fill("");
  supplyRow[0] = "Supply Expenses";
  supplyRow[L.profitCol] = `=SUM(${q(tabs.supply)}!$E:$E)`;
  rows.push(supplyRow);

  const setupRow: (string | number)[] = new Array(L.lastCol + 1).fill("");
  setupRow[0] = "Initial Setup Expenses";
  setupRow[L.profitCol] = `=SUM(${q(tabs.setup)}!$E:$E)`;
  rows.push(setupRow);

  const netRow: (string | number)[] = new Array(L.lastCol + 1).fill("");
  netRow[0] = "Whole Year Net P&L (operating)";
  netRow[L.profitCol] = `=${colLetter(L.airbnbCol)}${T}+${colLetter(L.cashCol)}${T}-${colLetter(L.totalCol)}${T}-${P}${SUMMARY_ROW.supplyExpenses}`;
  rows.push(netRow);

  const netAllRow: (string | number)[] = new Array(L.lastCol + 1).fill("");
  netAllRow[0] = "Net P&L incl. Initial Setup";
  netAllRow[L.profitCol] = `=${P}${SUMMARY_ROW.netOperating}-${P}${SUMMARY_ROW.setupExpenses}`;
  rows.push(netAllRow);

  return rows;
}

export function workbookTitle(propertyName: string, year: number): string {
  return `${propertyName} - Balance Sheets - ${year}`;
}

/** Sheet definitions for spreadsheets.create. Sheet IDs are fixed so formatting requests can target them. */
export const SHEET_IDS = { summary: 0, regular: 1, supply: 2, setup: 3, income: 4 } as const;

export function createSpreadsheetBody(propertyName: string, year: number, regularCategories: string[]): sheets_v4.Schema$Spreadsheet {
  const L = summaryLayout(regularCategories);
  const mk = (sheetId: number, title: string, columnCount: number, frozen = 1): sheets_v4.Schema$Sheet => ({
    properties: {
      sheetId,
      title,
      gridProperties: { rowCount: sheetId === SHEET_IDS.summary ? 40 : 1000, columnCount, frozenRowCount: frozen },
    },
  });
  return {
    properties: { title: workbookTitle(propertyName, year), locale: "en_US", timeZone: "America/Chicago" },
    sheets: [
      mk(SHEET_IDS.summary, SUMMARY_TAB, L.lastCol + 2),
      mk(SHEET_IDS.regular, TAB_TITLES.regular, EXPENSE_LEDGER_HEADERS.length + 1),
      mk(SHEET_IDS.supply, TAB_TITLES.supply, EXPENSE_LEDGER_HEADERS.length + 1),
      mk(SHEET_IDS.setup, TAB_TITLES.setup, EXPENSE_LEDGER_HEADERS.length + 1),
      mk(SHEET_IDS.income, TAB_TITLES.income, INCOME_LEDGER_HEADERS.length + 1),
    ],
  };
}

/** Initial cell values to write with values.batchUpdate (USER_ENTERED). */
export function initialValueRanges(year: number, regularCategories: string[]): sheets_v4.Schema$ValueRange[] {
  return [
    { range: `${q(SUMMARY_TAB)}!A1`, values: summaryRows(year, regularCategories) },
    { range: `${q(TAB_TITLES.regular)}!A1`, values: [[...EXPENSE_LEDGER_HEADERS]] },
    { range: `${q(TAB_TITLES.supply)}!A1`, values: [[...EXPENSE_LEDGER_HEADERS]] },
    { range: `${q(TAB_TITLES.setup)}!A1`, values: [[...EXPENSE_LEDGER_HEADERS]] },
    { range: `${q(TAB_TITLES.income)}!A1`, values: [[...INCOME_LEDGER_HEADERS]] },
  ];
}

const CURRENCY = { type: "CURRENCY", pattern: '"$"#,##0.00' } as const;
const SHORT_DATE = { type: "DATE", pattern: "mm/dd/yy" } as const;
const MONTH_DATE = { type: "DATE", pattern: "mmm/yyyy" } as const;

function numberFormat(sheetId: number, range: Omit<sheets_v4.Schema$GridRange, "sheetId">, fmt: { type: string; pattern: string }): sheets_v4.Schema$Request {
  return {
    repeatCell: {
      range: { sheetId, ...range },
      cell: { userEnteredFormat: { numberFormat: fmt } },
      fields: "userEnteredFormat.numberFormat",
    },
  };
}

function boldHeader(sheetId: number): sheets_v4.Schema$Request {
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
      cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.93, green: 0.95, blue: 0.98 }, wrapStrategy: "WRAP" } },
      fields: "userEnteredFormat(textFormat,backgroundColor,wrapStrategy)",
    },
  };
}

function columnWidth(sheetId: number, col: number, pixels: number): sheets_v4.Schema$Request {
  return {
    updateDimensionProperties: {
      range: { sheetId, dimension: "COLUMNS", startIndex: col, endIndex: col + 1 },
      properties: { pixelSize: pixels },
      fields: "pixelSize",
    },
  };
}

function dropdown(sheetId: number, col: number, values: readonly string[]): sheets_v4.Schema$Request {
  return {
    setDataValidation: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: col, endColumnIndex: col + 1 },
      rule: {
        condition: { type: "ONE_OF_LIST", values: values.map((v) => ({ userEnteredValue: v })) },
        showCustomUi: true,
        strict: false,
      },
    },
  };
}

/** Formatting requests for a freshly created workbook. */
export function formattingRequests(regularCategories: string[]): sheets_v4.Schema$Request[] {
  const L = summaryLayout(regularCategories);
  const reqs: sheets_v4.Schema$Request[] = [];

  // ---- summary ----
  reqs.push(boldHeader(SHEET_IDS.summary));
  reqs.push(numberFormat(SHEET_IDS.summary, { startRowIndex: 1, endRowIndex: SUMMARY_LAST_MONTH_ROW, startColumnIndex: 0, endColumnIndex: 1 }, MONTH_DATE));
  reqs.push(numberFormat(SHEET_IDS.summary, { startRowIndex: 1, endRowIndex: SUMMARY_ROW.netIncludingSetup, startColumnIndex: 1, endColumnIndex: L.lastCol + 1 }, CURRENCY));
  reqs.push(numberFormat(SHEET_IDS.summary, { startRowIndex: 0, endRowIndex: 1, startColumnIndex: L.pctCol, endColumnIndex: L.pctCol + 1 }, { type: "PERCENT", pattern: "0%" }));
  reqs.push({
    repeatCell: {
      range: { sheetId: SHEET_IDS.summary, startRowIndex: SUMMARY_ROW.average - 1, endRowIndex: SUMMARY_ROW.netIncludingSetup, startColumnIndex: 0, endColumnIndex: 1 },
      cell: { userEnteredFormat: { textFormat: { bold: true } } },
      fields: "userEnteredFormat.textFormat",
    },
  });
  reqs.push(columnWidth(SHEET_IDS.summary, 0, 210));
  reqs.push(columnWidth(SHEET_IDS.summary, L.totalCol, 150));
  reqs.push(columnWidth(SHEET_IDS.summary, L.lenderCol, 170));

  // ---- expense ledgers ----
  for (const sheetId of [SHEET_IDS.regular, SHEET_IDS.supply, SHEET_IDS.setup]) {
    reqs.push(boldHeader(sheetId));
    reqs.push(numberFormat(sheetId, { startRowIndex: 1, startColumnIndex: EXPENSE_COL.date, endColumnIndex: EXPENSE_COL.date + 1 }, SHORT_DATE));
    reqs.push(numberFormat(sheetId, { startRowIndex: 1, startColumnIndex: EXPENSE_COL.amount, endColumnIndex: EXPENSE_COL.amount + 1 }, CURRENCY));
    reqs.push(columnWidth(sheetId, EXPENSE_COL.from, 180));
    reqs.push(columnWidth(sheetId, EXPENSE_COL.details, 360));
    reqs.push(columnWidth(sheetId, EXPENSE_COL.notes, 200));
    reqs.push(columnWidth(sheetId, EXPENSE_COL.entryId, 110));
    reqs.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: EXPENSE_COL.entryId, endColumnIndex: EXPENSE_COL.entryId + 1 },
        cell: { userEnteredFormat: { textFormat: { foregroundColor: { red: 0.6, green: 0.6, blue: 0.6 }, fontSize: 8 } } },
        fields: "userEnteredFormat.textFormat",
      },
    });
    const cats = sheetId === SHEET_IDS.regular ? L.categories : [...EXPENSE_CATEGORIES];
    reqs.push(dropdown(sheetId, EXPENSE_COL.category, cats));
  }

  // ---- income ledger ----
  reqs.push(boldHeader(SHEET_IDS.income));
  reqs.push(numberFormat(SHEET_IDS.income, { startRowIndex: 1, startColumnIndex: INCOME_COL.date, endColumnIndex: INCOME_COL.date + 1 }, SHORT_DATE));
  reqs.push(numberFormat(SHEET_IDS.income, { startRowIndex: 1, startColumnIndex: INCOME_COL.amount, endColumnIndex: INCOME_COL.amount + 1 }, CURRENCY));
  reqs.push(dropdown(SHEET_IDS.income, INCOME_COL.source, INCOME_SOURCES));
  reqs.push(dropdown(SHEET_IDS.income, INCOME_COL.bucket, INCOME_BUCKETS));
  reqs.push(columnWidth(SHEET_IDS.income, INCOME_COL.payer, 200));
  reqs.push(columnWidth(SHEET_IDS.income, INCOME_COL.notes, 240));

  return reqs;
}

/** Convert an ISO date to a locale-proof Sheets formula. */
export function dateFormula(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return `=DATE(${y},${m},${d})`;
}

export function hyperlinkFormula(url: string, label: string): string {
  const esc = (s: string) => s.replace(/"/g, '""');
  return `=HYPERLINK("${esc(url)}","${esc(label)}")`;
}

/** Guess which ledger a tab title belongs to (used when linking a hand-made workbook). */
export function classifyTabTitle(title: string): LedgerKind | "summary" | null {
  const t = title.toLowerCase();
  if (/regular\s*bill/.test(t)) return "regular";
  if (/supply|supplies/.test(t)) return "supply";
  if (/setup|set-up|set up/.test(t)) return "setup";
  if (/income|rent\s*received|payout/.test(t)) return "income";
  if (/regular\s*expense|summary|balance/.test(t)) return "summary";
  return null;
}
