/**
 * Domain vocabulary shared by the API server and the mobile/web app.
 *
 * Everything here is deliberately a plain constant so it can be rendered in
 * pickers, used in Zod enums, and written into Google Sheets data-validation
 * dropdowns from one source of truth.
 */

/** The ledger tabs inside a property's yearly workbook. */
export const LEDGERS = ["supply", "setup", "regular", "income"] as const;
export type LedgerKind = (typeof LEDGERS)[number];

export const EXPENSE_LEDGERS = ["supply", "setup", "regular"] as const;
export type ExpenseLedgerKind = (typeof EXPENSE_LEDGERS)[number];

export const LEDGER_LABELS: Record<LedgerKind, string> = {
  supply: "Room Supply Expenses",
  setup: "Initial Room Setup Expenses",
  regular: "Regular Bills",
  income: "Income",
};

export const LEDGER_DESCRIPTIONS: Record<LedgerKind, string> = {
  supply: "Day-to-day operating purchases: consumables, repairs, cleaning, small replacements.",
  setup: "One-time costs to get the unit guest-ready: furniture, appliances, inspection, appraisal.",
  regular: "Recurring monthly bills: mortgage, utilities, insurance, property tax, HOA.",
  income: "Payouts and rent received.",
};

/**
 * Categories for itemised expense ledgers (Supply + Initial Setup).
 * The first five mirror the user's original sheet; the rest were added for
 * clearer year-end tax grouping (Schedule E lines).
 */
export const EXPENSE_CATEGORIES = [
  "Supplies",
  "Repairs",
  "Cleaning",
  "Furniture & Appliances",
  "Taxes",
  "Fees & Services",
  "Meal",
  "Travel",
  "Others",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/**
 * Default recurring-bill categories. Each becomes a column in the
 * "Regular Expense" summary tab. Per-property overrides are allowed.
 */
export const DEFAULT_REGULAR_CATEGORIES = [
  "Mortgage",
  "City Water",
  "Electricity",
  "Gas",
  "Internet",
  "Home Insurance",
  "Property Tax",
  "HOA",
] as const;

/** Regular categories that count toward the "Yearly Utility Cost" row. */
export const UTILITY_CATEGORIES = [
  "City Water",
  "Electricity",
  "Gas",
  "Internet",
  "Trash",
  "Sewer",
] as const;

/** Where the money came from. Each maps to one of the two summary columns. */
export const INCOME_SOURCES = [
  "Airbnb",
  "VRBO",
  "Booking.com",
  "Direct Booking",
  "Cash Rent",
  "Bank Transfer Rent",
  "Security Deposit",
  "Other",
] as const;
export type IncomeSource = (typeof INCOME_SOURCES)[number];

/** Summary-tab columns that income rolls up into (labels match the user's sheet). */
export const INCOME_BUCKETS = ["Airbnb Rent", "Cash Rent"] as const;
export type IncomeBucket = (typeof INCOME_BUCKETS)[number];

export const INCOME_SOURCE_BUCKET: Record<IncomeSource, IncomeBucket> = {
  Airbnb: "Airbnb Rent",
  VRBO: "Airbnb Rent",
  "Booking.com": "Airbnb Rent",
  "Direct Booking": "Airbnb Rent",
  "Cash Rent": "Cash Rent",
  "Bank Transfer Rent": "Cash Rent",
  "Security Deposit": "Cash Rent",
  Other: "Cash Rent",
};

export const PROPERTY_TYPES = ["short_term", "long_term", "hybrid"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  short_term: "Short-term rental (Airbnb / VRBO)",
  long_term: "Long-term rental (lease)",
  hybrid: "Hybrid / mixed use",
};

/** Share of gross rent lenders typically count as income (DTI calculations). */
export const LENDER_RENT_FACTOR = 0.75;
