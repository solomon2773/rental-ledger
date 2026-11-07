import { Hono } from "hono";
import { PropertyCreate, PropertyUpdate, WorkbookLink } from "@rental-ledger/shared";
import { z } from "zod";
import type { Deps } from "../deps.js";
import { requireUser, currentUser, type AppEnv } from "../auth/session.js";
import { notFound } from "../lib/errors.js";
import { parseJson, parseQueryInt } from "../lib/validate.js";

export function propertyRoutes(deps: Deps) {
  const { config, repo, properties } = deps;
  const app = new Hono<AppEnv>();
  app.use("/properties/*", requireUser(config, repo));
  app.use("/properties", requireUser(config, repo));

  const load = (userId: string, id: string) => {
    const p = repo.getProperty(userId, id);
    if (!p) throw notFound("Property not found");
    return p;
  };

  app.get("/properties", (c) => {
    const user = currentUser(c);
    const list = repo.listProperties(user.id, c.req.query("archived") === "1");
    return c.json(list.map((p) => ({ ...p, workbooks: repo.listWorkbooks(p.id) })));
  });

  app.post("/properties", async (c) => {
    const user = currentUser(c);
    const input = await parseJson(c, PropertyCreate);
    const result = await properties.create(user, input);
    return c.json(result, 201);
  });

  app.get("/properties/:id", (c) => {
    const user = currentUser(c);
    const p = load(user.id, c.req.param("id"));
    return c.json({ ...p, workbooks: repo.listWorkbooks(p.id) });
  });

  app.patch("/properties/:id", async (c) => {
    const user = currentUser(c);
    load(user.id, c.req.param("id"));
    const patch = await parseJson(c, PropertyUpdate);
    const updated = repo.updateProperty(user.id, c.req.param("id"), {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.address !== undefined ? { address: patch.address.trim() } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.regularCategories !== undefined ? { regularCategories: patch.regularCategories } : {}),
      ...(patch.paymentMethods !== undefined ? { paymentMethods: patch.paymentMethods } : {}),
    });
    return c.json(updated);
  });

  app.delete("/properties/:id", (c) => {
    const user = currentUser(c);
    load(user.id, c.req.param("id"));
    repo.archiveProperty(user.id, c.req.param("id"));
    return c.json({ ok: true });
  });

  app.get("/properties/:id/summary", async (c) => {
    const user = currentUser(c);
    const p = load(user.id, c.req.param("id"));
    const year = parseQueryInt(c.req.query("year"), new Date().getFullYear());
    return c.json(await properties.summary(user, p, year));
  });

  app.get("/properties/:id/workbooks", (c) => {
    const user = currentUser(c);
    const p = load(user.id, c.req.param("id"));
    return c.json(repo.listWorkbooks(p.id));
  });

  /** Create (or return) the Google Sheet for a given year. */
  app.post("/properties/:id/workbooks", async (c) => {
    const user = currentUser(c);
    const p = load(user.id, c.req.param("id"));
    const { year } = await parseJson(c, z.object({ year: z.number().int().min(2000).max(2100) }));
    return c.json(await properties.ensureWorkbook(user, p, year), 201);
  });

  /** Link an existing spreadsheet (e.g. the original hand-made balance sheet). */
  app.post("/properties/:id/workbooks/link", async (c) => {
    const user = currentUser(c);
    const p = load(user.id, c.req.param("id"));
    const input = await parseJson(c, WorkbookLink);
    return c.json(await properties.linkWorkbook(user, p, input), 201);
  });

  app.delete("/properties/:id/workbooks/:wid", (c) => {
    const user = currentUser(c);
    const p = load(user.id, c.req.param("id"));
    properties.unlinkWorkbook(p, c.req.param("wid"));
    return c.json({ ok: true });
  });

  app.post("/properties/:id/workbooks/:wid/rebuild-summary", async (c) => {
    const user = currentUser(c);
    const p = load(user.id, c.req.param("id"));
    return c.json(await properties.rebuildSummary(user, p, c.req.param("wid")));
  });

  return app;
}
