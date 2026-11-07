import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import {
  DEFAULT_REGULAR_CATEGORIES,
  EXPENSE_CATEGORIES,
  INCOME_SOURCES,
  LEDGER_LABELS,
  PROPERTY_TYPE_LABELS,
} from "@rental-ledger/shared";
import type { Config } from "./config.js";
import { openDatabase } from "./db/index.js";
import { Repo } from "./db/repo.js";
import { GoogleFactory } from "./google/client.js";
import { HttpError } from "./lib/errors.js";
import { ReceiptExtractor } from "./receipts/extract.js";
import { UploadStore } from "./receipts/storage.js";
import { PropertyService } from "./services/properties.js";
import { EntryService } from "./services/entries.js";
import { authRoutes } from "./routes/auth.js";
import { propertyRoutes } from "./routes/properties.js";
import { scanRoutes } from "./routes/scans.js";
import { entryRoutes } from "./routes/entries.js";
import type { Deps } from "./deps.js";

export async function buildApp(config: Config): Promise<{ app: Hono; deps: Deps }> {
  const db = openDatabase(config.dbPath);
  const repo = new Repo(db);
  const google = new GoogleFactory(config, repo);
  const uploads = new UploadStore(config.uploadsDir);
  await uploads.init();
  const extractor = new ReceiptExtractor(config);
  const properties = new PropertyService(config, repo, google);
  const entries = new EntryService(repo, google, properties, uploads);
  const deps: Deps = { config, repo, google, uploads, extractor, properties, entries };

  const app = new Hono();
  app.use("*", logger());
  app.use("*", cors({ origin: (o) => o ?? "*", allowHeaders: ["Authorization", "Content-Type"], allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] }));

  app.get("/health", (c) => c.json({ ok: true, model: config.ANTHROPIC_MODEL }));

  /** Static vocabulary for pickers (the app also ships it via @rental-ledger/shared). */
  app.get("/meta", (c) =>
    c.json({
      expenseCategories: EXPENSE_CATEGORIES,
      defaultRegularCategories: DEFAULT_REGULAR_CATEGORIES,
      incomeSources: INCOME_SOURCES,
      ledgerLabels: LEDGER_LABELS,
      propertyTypes: PROPERTY_TYPE_LABELS,
    }),
  );

  app.route("/", authRoutes(deps));
  app.route("/", propertyRoutes(deps));
  app.route("/", scanRoutes(deps));
  app.route("/", entryRoutes(deps));

  app.notFound((c) => c.json({ error: "Not found" }, 404));
  app.onError((err, c) => {
    if (err instanceof HttpError) {
      return c.json({ error: err.message, details: err.details ?? null }, err.status as 400);
    }
    console.error(err);
    const message = config.NODE_ENV === "production" ? "Internal error" : err.message;
    return c.json({ error: message }, 500);
  });

  return { app, deps };
}
