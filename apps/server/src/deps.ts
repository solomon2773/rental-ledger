import type { Config } from "./config.js";
import type { Repo } from "./db/repo.js";
import type { GoogleFactory } from "./google/client.js";
import type { ReceiptExtractor } from "./receipts/extract.js";
import type { UploadStore } from "./receipts/storage.js";
import type { PropertyService } from "./services/properties.js";
import type { EntryService } from "./services/entries.js";

/** Everything the route modules need, wired once in app.ts. */
export interface Deps {
  config: Config;
  repo: Repo;
  google: GoogleFactory;
  uploads: UploadStore;
  extractor: ReceiptExtractor;
  properties: PropertyService;
  entries: EntryService;
}
