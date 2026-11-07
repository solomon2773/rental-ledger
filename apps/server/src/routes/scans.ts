import { Hono } from "hono";
import { todayIso } from "@rental-ledger/shared";
import type { Deps } from "../deps.js";
import { requireUser, currentUser, type AppEnv } from "../auth/session.js";
import { badRequest, notFound } from "../lib/errors.js";
import { MAX_IMAGE_BYTES, normalizeMime } from "../receipts/storage.js";
import { payByLabel } from "../receipts/extract.js";
import { newId } from "../lib/ids.js";

export function scanRoutes(deps: Deps) {
  const { config, repo, uploads, extractor } = deps;
  const app = new Hono<AppEnv>();
  app.use("/scans/*", requireUser(config, repo));
  app.use("/scans", requireUser(config, repo));

  /**
   * multipart/form-data: image=<file>, propertyId=<optional>
   * Stores the image, runs receipt recognition, returns the Scan with its extraction
   * plus a `prefill` object shaped like the expense form.
   */
  app.post("/scans", async (c) => {
    const user = currentUser(c);
    const body = await c.req.parseBody();
    const file = body["image"];
    if (!(file instanceof File)) throw badRequest("Send the receipt as multipart field `image`.");
    const mime = normalizeMime(file.type, file.name);
    if (!mime) throw badRequest(`Unsupported image type "${file.type}". Use JPEG, PNG or WebP.`);
    if (file.size > MAX_IMAGE_BYTES) throw badRequest(`Image is ${(file.size / 1024 / 1024).toFixed(1)} MB; max is 5 MB. Please retake or downscale.`);

    const propertyId = typeof body["propertyId"] === "string" && body["propertyId"] ? body["propertyId"] : null;
    const property = propertyId ? repo.getProperty(user.id, propertyId) : null;
    if (propertyId && !property) throw notFound("Property not found");

    const data = Buffer.from(await file.arrayBuffer());
    const id = newId();
    const filePath = await uploads.save(id, mime, data);
    const scan = repo.createScan({ userId: user.id, propertyId, filePath, mimeType: mime });

    try {
      const extraction = await extractor.extract(data, mime, { property: property ?? null, todayIso: todayIso() });
      repo.setScanExtraction(scan.id, extraction);
    } catch (e) {
      repo.setScanFailed(scan.id, e instanceof Error ? e.message : String(e));
      throw e;
    }
    return c.json(present(repo.getScan(scan.id)!), 201);
  });

  app.get("/scans/:id", (c) => {
    const user = currentUser(c);
    const scan = repo.getScan(c.req.param("id"));
    if (!scan || scan.userId !== user.id) throw notFound("Scan not found");
    return c.json(present(scan));
  });

  /** The stored image, for the review screen preview. Accepts ?token= for <Image> tags. */
  app.get("/scans/:id/image", async (c) => {
    const user = currentUser(c);
    const scan = repo.getScan(c.req.param("id"));
    if (!scan || scan.userId !== user.id) throw notFound("Scan not found");
    const data = await uploads.read(scan.filePath);
    return c.body(new Uint8Array(data), 200, { "content-type": scan.mimeType, "cache-control": "private, max-age=3600" });
  });

  app.delete("/scans/:id", async (c) => {
    const user = currentUser(c);
    const scan = repo.getScan(c.req.param("id"));
    if (!scan || scan.userId !== user.id) throw notFound("Scan not found");
    await uploads.remove(scan.filePath);
    repo.setScanFailed(scan.id, "deleted");
    return c.json({ ok: true });
  });

  return app;
}

function present(scan: NonNullable<ReturnType<Deps["repo"]["getScan"]>>) {
  const { filePath: _fp, userId: _uid, ...rest } = scan;
  const x = scan.extraction;
  return {
    ...rest,
    prefill: x
      ? {
          date: x.date ?? todayIso(),
          vendor: x.vendor ?? "",
          amount: x.total ?? 0,
          ledger: x.suggestedLedger,
          category: x.suggestedCategory,
          details: x.detailsSummary,
          payBy: payByLabel(x),
        }
      : null,
  };
}
