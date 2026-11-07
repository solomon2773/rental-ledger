import { INCOME_SOURCE_BUCKET, type IncomeSource, type IncomeBucket } from "./categories.js";

export function incomeBucketFor(source: IncomeSource): IncomeBucket {
  return INCOME_SOURCE_BUCKET[source];
}

/** Extract a spreadsheet ID from a full Google Sheets URL or return the input if it already is one. */
export function parseSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  const m = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export function spreadsheetUrl(spreadsheetId: string, gid?: number): string {
  const base = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  return gid === undefined ? base : `${base}#gid=${gid}`;
}

export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export function yearOf(isoDate: string): number {
  return Number(isoDate.slice(0, 4));
}

export function todayIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatMoney(n: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

/** Slug safe for Drive file names. */
export function slugify(s: string, max = 40): string {
  return s
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .toLowerCase()
    .slice(0, max) || "receipt";
}
