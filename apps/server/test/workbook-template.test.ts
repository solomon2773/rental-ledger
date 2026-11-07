import { describe, expect, it } from "vitest";
import {
  classifyTabTitle,
  colLetter,
  createSpreadsheetBody,
  dateFormula,
  formattingRequests,
  hyperlinkFormula,
  summaryLayout,
  summaryRows,
  SUMMARY_ROW,
} from "../src/google/workbook-template.js";
import { parseSummaryGrid } from "../src/services/properties.js";
import { DEFAULT_REGULAR_CATEGORIES } from "@rental-ledger/shared";

const CATS = ["Mortgage", "City Water", "Electricity", "Internet", "Home Insurance", "Property Tax"];

describe("colLetter", () => {
  it("handles A..Z and AA", () => {
    expect(colLetter(0)).toBe("A");
    expect(colLetter(25)).toBe("Z");
    expect(colLetter(26)).toBe("AA");
  });
});

describe("summaryLayout", () => {
  it("places derived columns after the categories", () => {
    const L = summaryLayout(CATS);
    expect(L.catCols).toEqual([1, 2, 3, 4, 5, 6]);
    expect(L.totalCol).toBe(7); // H, same as the original sheet
    expect(L.airbnbCol).toBe(8); // I
    expect(L.cashCol).toBe(9); // J
    expect(L.profitCol).toBe(10); // K
    expect(L.mortgageCol).toBe(1);
    expect(L.headers[0]).toBe("");
    expect(L.headers[7]).toBe("Monthly Total Regular Expense");
    expect(L.headers[8]).toBe("Airbnb Rent");
    expect(L.headers[9]).toBe("Cash Rent");
    expect(L.headers[10]).toBe("profit/lost");
    expect(L.headers[11]).toBe(0.75);
  });
});

describe("summaryRows", () => {
  const rows = summaryRows(2026, CATS);

  it("has 12 month rows starting at row 2 with DATE() formulas", () => {
    expect(rows[1][0]).toBe("=DATE(2026,1,1)");
    expect(rows[12][0]).toBe("=DATE(2026,12,1)");
  });

  it("feeds monthly category cells from the Regular Bills ledger by header + month window", () => {
    const jan = rows[1];
    expect(jan[1]).toBe(
      `=SUMIFS('Regular Bills'!$E:$E,'Regular Bills'!$C:$C,B$1,'Regular Bills'!$A:$A,">="&$A2,'Regular Bills'!$A:$A,"<"&EDATE($A2,1))`,
    );
    expect(jan[7]).toBe("=SUM(B2:G2)");
    expect(jan[8]).toContain("'Income'!$C:$C,I$1");
    expect(jan[10]).toBe("=I2+J2-H2");
    expect(jan[11]).toBe("=(I2+J2)*L$1");
    expect(jan[12]).toBe("=L2-B2");
  });

  it("places yearly totals and P&L in the rows the original sheet used", () => {
    expect(rows[SUMMARY_ROW.yearlyTotal - 1][0]).toBe("Yearly Total");
    expect(rows[SUMMARY_ROW.yearlyTotal - 1][7]).toBe("=SUM(H2:H13)");
    expect(rows[SUMMARY_ROW.utilityCost - 1][10]).toBe("=C16+D16+E16");
    expect(rows[SUMMARY_ROW.supplyExpenses - 1][10]).toBe("=SUM('Room Supply Expenses'!$E:$E)");
    expect(rows[SUMMARY_ROW.setupExpenses - 1][10]).toBe("=SUM('Initial Room Setup Expenses'!$E:$E)");
    expect(rows[SUMMARY_ROW.netOperating - 1][10]).toBe("=I16+J16-H16-K18");
    expect(rows[SUMMARY_ROW.netIncludingSetup - 1][10]).toBe("=K20-K19");
  });

  it("works with the default category list (incl. Gas + HOA)", () => {
    const r = summaryRows(2026, [...DEFAULT_REGULAR_CATEGORIES]);
    expect(r[0].length).toBe(DEFAULT_REGULAR_CATEGORIES.length + 7);
  });
});

describe("createSpreadsheetBody / formattingRequests", () => {
  it("creates five tabs with the summary first", () => {
    const body = createSpreadsheetBody("2529 Persimmon Dr", 2026, CATS);
    expect(body.properties?.title).toBe("2529 Persimmon Dr - Balance Sheets - 2026");
    expect(body.sheets?.map((s) => s.properties?.title)).toEqual([
      "Regular Expense",
      "Regular Bills",
      "Room Supply Expenses",
      "Initial Room Setup Expenses",
      "Income",
    ]);
  });
  it("produces only well-formed requests", () => {
    for (const r of formattingRequests(CATS)) {
      expect(Object.keys(r)).toHaveLength(1);
    }
  });
});

describe("cell helpers", () => {
  it("dateFormula is locale independent", () => {
    expect(dateFormula("2026-11-03")).toBe("=DATE(2026,11,3)");
  });
  it("hyperlinkFormula escapes quotes", () => {
    expect(hyperlinkFormula('https://x.y/a"b', "Yes")).toBe('=HYPERLINK("https://x.y/a""b","Yes")');
  });
  it("classifies the original tab names", () => {
    expect(classifyTabTitle("AirBnb Regular Expense")).toBe("summary");
    expect(classifyTabTitle("AirBnb Room Supply Expenses")).toBe("supply");
    expect(classifyTabTitle("Initial Room Setup Expenses")).toBe("setup");
    expect(classifyTabTitle("Regular Bills")).toBe("regular");
    expect(classifyTabTitle("Income")).toBe("income");
    expect(classifyTabTitle("Notes")).toBeNull();
  });
});

describe("parseSummaryGrid", () => {
  it("reads totals from the original hand-made layout", () => {
    const grid: (string | number | null)[][] = [
      ["", "Mortgage ", "City Water", "Electricity", "Internet", "Home Insurance", "Property Tax", "Monthly Total Regular Expense", "Airbnb Rent", "Cash Rent", "profit/lost", 0.75, "lander looking at $$"],
      ...Array.from({ length: 12 }, (_, i) => [44927 + i * 30, 1500, 50, 120, 70, 0, 0, 1740, 2500, 0, 760]),
      [],
      ["Average"],
      ["Yearly Total", 18000, 600, 1440, 840, 0, 0, 20880, 30000, 0, 9120],
      ["Yearly Utility Cost"],
      ["Supply Expenses", "", "", "", "", "", "", "", "", "", 532],
      ["Whole Year Net P&L", "", "", "", "", "", "", "", "", "", 8588],
    ];
    const s = parseSummaryGrid(grid, {
      propertyId: "p",
      year: 2026,
      spreadsheetUrl: null,
      totals: { regularExpenses: 0, supplyExpenses: 0, setupExpenses: 0, airbnbRent: 0, cashRent: 0, netOperating: 0, netIncludingSetup: 0 },
      monthly: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, regularExpenses: 0, income: 0, profit: 0 })),
    });
    expect(s.totals.regularExpenses).toBe(20880);
    expect(s.totals.airbnbRent).toBe(30000);
    expect(s.totals.supplyExpenses).toBe(532);
    expect(s.totals.netOperating).toBe(8588);
    expect(s.totals.setupExpenses).toBe(0);
    expect(s.monthly[0]).toEqual({ month: 1, regularExpenses: 1740, income: 2500, profit: 760 });
  });
});
