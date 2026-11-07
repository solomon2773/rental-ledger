import {
  EXPENSE_CATEGORIES,
  incomeBucketFor,
  slugify,
  yearOf,
  type Entry,
  type ExpenseEntryCreate,
  type IncomeEntryCreate,
} from "@rental-ledger/shared";
import type { Repo, UserRow } from "../db/repo.js";
import { GoogleFactory, translateGoogleError } from "../google/client.js";
import { EXPENSE_COL, INCOME_COL } from "../google/workbook-template.js";
import { badRequest, notFound } from "../lib/errors.js";
import { newId } from "../lib/ids.js";
import type { UploadStore, SupportedImageType } from "../receipts/storage.js";
import type { PropertyService } from "./properties.js";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

export class EntryService {
  constructor(
    private repo: Repo,
    private google: GoogleFactory,
    private properties: PropertyService,
    private uploads: UploadStore,
  ) {}

  async addExpense(user: UserRow, input: ExpenseEntryCreate): Promise<Entry> {
    const property = this.repo.getProperty(user.id, input.propertyId);
    if (!property) throw notFound("Property not found");

    if (input.ledger === "regular") {
      if (!property.regularCategories.includes(input.category)) {
        throw badRequest(`"${input.category}" is not a regular bill category for this property. Add it in property settings first.`, {
          allowed: property.regularCategories,
        });
      }
    } else if (!(EXPENSE_CATEGORIES as readonly string[]).includes(input.category)) {
      throw badRequest(`Unknown category "${input.category}".`, { allowed: EXPENSE_CATEGORIES });
    }

    const workbook = await this.properties.ensureWorkbook(user, property, yearOf(input.date));
    const tab = workbook.tabMap[input.ledger];
    if (!tab) throw badRequest(`This workbook has no "${input.ledger}" tab. Re-link it to add the missing tabs.`);

    const entryId = newId();
    const g = this.google.forUser(user);

    let driveFileId: string | null = null;
    let driveLink: string | null = null;
    const scan = input.scanId ? this.repo.getScan(input.scanId) : undefined;
    if (input.scanId && (!scan || scan.userId !== user.id)) throw notFound("Scan not found");

    try {
      if (scan) {
        let folder = workbook.receiptsFolderId;
        if (!folder) {
          folder = await g.drive.ensurePath([String(workbook.year), "Receipts"], property.driveFolderId);
          this.repo.setWorkbookReceiptsFolder(workbook.id, folder);
        }
        const data = await this.uploads.read(scan.filePath);
        const ext = EXT[scan.mimeType] ?? "jpg";
        const name = `${input.date}_${slugify(input.vendor)}_${entryId.slice(0, 8)}.${ext}`;
        const uploaded = await g.drive.uploadFile({ name, mimeType: scan.mimeType as SupportedImageType, data, parentId: folder });
        driveFileId = uploaded.id;
        driveLink = uploaded.webViewLink;
      }

      const sheetRow = await g.sheets.appendExpenseRow(workbook.spreadsheetId, tab, {
        entryId,
        date: input.date,
        vendor: input.vendor,
        category: input.category,
        details: input.details,
        amount: input.amount,
        payBy: input.payBy,
        notes: input.notes,
        receiptUrl: driveLink,
      });

      const entry = this.repo.createEntryWithId(entryId, {
        propertyId: property.id,
        workbookId: workbook.id,
        ledger: input.ledger,
        date: input.date,
        vendor: input.vendor,
        category: input.category,
        details: input.details,
        amount: input.amount,
        payBy: input.payBy,
        notes: input.notes,
        driveFileId,
        driveLink,
        sheetRow,
        scanId: scan?.id ?? null,
      });
      if (scan) this.repo.setScanCommitted(scan.id);
      if (input.payBy) this.repo.addPaymentMethod(user.id, property.id, input.payBy);
      return entry;
    } catch (e) {
      if (e instanceof Error && "status" in e) throw e;
      throw translateGoogleError(e, this.repo, user.id);
    }
  }

  async addIncome(user: UserRow, input: IncomeEntryCreate): Promise<Entry> {
    const property = this.repo.getProperty(user.id, input.propertyId);
    if (!property) throw notFound("Property not found");
    const workbook = await this.properties.ensureWorkbook(user, property, yearOf(input.date));
    const tab = workbook.tabMap.income;
    if (!tab) throw badRequest("This workbook has no Income tab. Re-link it to add the missing tabs.");

    const entryId = newId();
    const bucket = incomeBucketFor(input.source);
    const g = this.google.forUser(user);
    try {
      const sheetRow = await g.sheets.appendIncomeRow(workbook.spreadsheetId, tab, {
        entryId,
        date: input.date,
        source: input.source,
        bucket,
        payer: input.payer,
        amount: input.amount,
        notes: input.notes,
      });
      return this.repo.createEntryWithId(entryId, {
        propertyId: property.id,
        workbookId: workbook.id,
        ledger: "income",
        date: input.date,
        vendor: input.payer,
        category: input.source,
        details: bucket,
        amount: input.amount,
        payBy: "",
        notes: input.notes,
        driveFileId: null,
        driveLink: null,
        sheetRow,
        scanId: null,
      });
    } catch (e) {
      throw translateGoogleError(e, this.repo, user.id);
    }
  }

  /** Remove an entry everywhere: sheet row (by Entry ID), Drive image, local mirror. */
  async remove(user: UserRow, entryId: string): Promise<void> {
    const entry = this.repo.getEntry(entryId);
    if (!entry) throw notFound("Entry not found");
    const property = this.repo.getProperty(user.id, entry.propertyId);
    if (!property) throw notFound("Entry not found");
    const workbook = this.repo.getWorkbook(entry.workbookId);
    const g = this.google.forUser(user);
    try {
      if (workbook) {
        const tab = workbook.tabMap[entry.ledger];
        const idCol = entry.ledger === "income" ? INCOME_COL.entryId : EXPENSE_COL.entryId;
        if (tab) await g.sheets.deleteRowByEntryId(workbook.spreadsheetId, tab, idCol, entry.id);
      }
      if (entry.driveFileId) await g.drive.trashFile(entry.driveFileId);
    } catch (e) {
      throw translateGoogleError(e, this.repo, user.id);
    }
    this.repo.deleteEntry(entry.id);
  }
}
