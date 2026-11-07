import { z } from "zod";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_LEDGERS,
  INCOME_SOURCES,
  LEDGERS,
  PROPERTY_TYPES,
} from "./categories.js";

/** ISO date string, YYYY-MM-DD. */
export const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const Money = z.number().finite().nonnegative();

// ---------------------------------------------------------------------------
// Receipt extraction (what Claude returns from a receipt image)
// ---------------------------------------------------------------------------

export const ReceiptLineItem = z.object({
  description: z.string(),
  quantity: z.number().nullable(),
  amount: z.number().nullable(),
});

export const PaymentMethodGuess = z.object({
  /** e.g. "Visa", "Amex", "Mastercard", "Cash", "Check", "Debit" */
  brand: z.string().nullable(),
  /** Last four digits as printed on the receipt, if any. */
  last4: z.string().nullable(),
  /** Free-form text exactly as printed, e.g. "VISA ****8941". */
  raw: z.string().nullable(),
});

export const ReceiptExtraction = z.object({
  vendor: z.string().nullable(),
  date: IsoDate.nullable(),
  total: z.number().nullable(),
  subtotal: z.number().nullable(),
  tax: z.number().nullable(),
  currency: z.string().default("USD"),
  paymentMethod: PaymentMethodGuess,
  lineItems: z.array(ReceiptLineItem),
  /** Which ledger tab this most likely belongs to. */
  suggestedLedger: z.enum(EXPENSE_LEDGERS),
  /** For supply/setup: one of EXPENSE_CATEGORIES. For regular: one of the property's bill categories. */
  suggestedCategory: z.string(),
  /** One-line summary of what was bought, in the style of the sheet's "Details" column. */
  detailsSummary: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  /** Anything the reviewer should double check (blurry total, missing date, ...). */
  warnings: z.array(z.string()),
});
export type ReceiptExtraction = z.infer<typeof ReceiptExtraction>;

// ---------------------------------------------------------------------------
// Properties & workbooks
// ---------------------------------------------------------------------------

export const PropertyCreate = z.object({
  name: z.string().min(1).max(80),
  address: z.string().max(200).optional().default(""),
  type: z.enum(PROPERTY_TYPES).default("short_term"),
  /** Column headers for the Regular Expense summary tab. */
  regularCategories: z.array(z.string().min(1).max(40)).min(1).max(20).optional(),
  /** Saved "Pay by" options, e.g. "Visa - 8941". */
  paymentMethods: z.array(z.string().min(1).max(60)).max(30).optional().default([]),
  /** Year for the first workbook. Defaults to the current year. */
  year: z.number().int().min(2000).max(2100).optional(),
  /** When false, no Google Sheet is created up front (it will be on first entry). */
  createWorkbook: z.boolean().optional().default(true),
});
export type PropertyCreate = z.infer<typeof PropertyCreate>;

export const PropertyUpdate = PropertyCreate.partial().omit({ year: true, createWorkbook: true });
export type PropertyUpdate = z.infer<typeof PropertyUpdate>;

export const Property = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  type: z.enum(PROPERTY_TYPES),
  regularCategories: z.array(z.string()),
  paymentMethods: z.array(z.string()),
  driveFolderId: z.string().nullable(),
  driveFolderUrl: z.string().nullable(),
  createdAt: z.string(),
  archivedAt: z.string().nullable(),
});
export type Property = z.infer<typeof Property>;

export const Workbook = z.object({
  id: z.string(),
  propertyId: z.string(),
  year: z.number().int(),
  spreadsheetId: z.string(),
  spreadsheetUrl: z.string(),
  source: z.enum(["created", "linked"]),
  /** Ledger kind (or "summary") -> sheet tab title inside the spreadsheet. */
  tabMap: z.partialRecord(z.enum([...LEDGERS, "summary"]), z.string()),
  receiptsFolderId: z.string().nullable(),
  createdAt: z.string(),
});
export type Workbook = z.infer<typeof Workbook>;

export const WorkbookLink = z.object({
  /** Full URL or bare spreadsheet ID. */
  spreadsheet: z.string().min(10),
  year: z.number().int().min(2000).max(2100),
});
export type WorkbookLink = z.infer<typeof WorkbookLink>;

// ---------------------------------------------------------------------------
// Entries (expense + income rows)
// ---------------------------------------------------------------------------

export const ExpenseEntryCreate = z.object({
  propertyId: z.string(),
  ledger: z.enum(EXPENSE_LEDGERS),
  date: IsoDate,
  vendor: z.string().min(1).max(120),
  /** supply/setup: EXPENSE_CATEGORIES. regular: one of property.regularCategories. */
  category: z.string().min(1).max(60),
  details: z.string().max(500).default(""),
  amount: Money,
  payBy: z.string().max(60).default(""),
  notes: z.string().max(500).default(""),
  /** Scan to attach (uploads the image to Drive and links it in the sheet). */
  scanId: z.string().optional(),
});
export type ExpenseEntryCreate = z.infer<typeof ExpenseEntryCreate>;

export const IncomeEntryCreate = z.object({
  propertyId: z.string(),
  date: IsoDate,
  source: z.enum(INCOME_SOURCES),
  /** Guest name, tenant, confirmation code… */
  payer: z.string().max(120).default(""),
  amount: Money,
  notes: z.string().max(500).default(""),
});
export type IncomeEntryCreate = z.infer<typeof IncomeEntryCreate>;

export const Entry = z.object({
  id: z.string(),
  propertyId: z.string(),
  workbookId: z.string(),
  ledger: z.enum(LEDGERS),
  date: IsoDate,
  vendor: z.string(),
  category: z.string(),
  details: z.string(),
  amount: z.number(),
  payBy: z.string(),
  notes: z.string(),
  driveFileId: z.string().nullable(),
  driveLink: z.string().nullable(),
  sheetRow: z.number().int().nullable(),
  scanId: z.string().nullable(),
  createdAt: z.string(),
});
export type Entry = z.infer<typeof Entry>;

export const Scan = z.object({
  id: z.string(),
  propertyId: z.string().nullable(),
  mimeType: z.string(),
  status: z.enum(["pending", "extracted", "failed", "committed"]),
  extraction: ReceiptExtraction.nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
});
export type Scan = z.infer<typeof Scan>;

export const PropertySummary = z.object({
  propertyId: z.string(),
  year: z.number().int(),
  spreadsheetUrl: z.string().nullable(),
  totals: z.object({
    regularExpenses: z.number(),
    supplyExpenses: z.number(),
    setupExpenses: z.number(),
    airbnbRent: z.number(),
    cashRent: z.number(),
    netOperating: z.number(),
    netIncludingSetup: z.number(),
  }),
  /** 12 entries, Jan..Dec. */
  monthly: z.array(
    z.object({
      month: z.number().int().min(1).max(12),
      regularExpenses: z.number(),
      income: z.number(),
      profit: z.number(),
    }),
  ),
});
export type PropertySummary = z.infer<typeof PropertySummary>;

export const User = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  picture: z.string().nullable(),
});
export type User = z.infer<typeof User>;

export const ExpenseCategorySchema = z.enum(EXPENSE_CATEGORIES);
