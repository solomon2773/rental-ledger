import { Hono } from "hono";
import { ExpenseEntryCreate, IncomeEntryCreate, LEDGERS, type LedgerKind } from "@rental-ledger/shared";
import type { Deps } from "../deps.js";
import { requireUser, currentUser, type AppEnv } from "../auth/session.js";
import { parseJson, parseQueryInt } from "../lib/validate.js";

export function entryRoutes(deps: Deps) {
  const { config, repo, entries } = deps;
  const app = new Hono<AppEnv>();
  app.use("/entries/*", requireUser(config, repo));
  app.use("/entries", requireUser(config, repo));

  app.get("/entries", (c) => {
    const user = currentUser(c);
    const ledger = c.req.query("ledger");
    return c.json(
      repo.listEntries(user.id, {
        propertyId: c.req.query("propertyId") || undefined,
        ledger: ledger && (LEDGERS as readonly string[]).includes(ledger) ? (ledger as LedgerKind) : undefined,
        limit: Math.min(parseQueryInt(c.req.query("limit"), 100), 500),
      }),
    );
  });

  app.post("/entries/expense", async (c) => {
    const user = currentUser(c);
    const input = await parseJson(c, ExpenseEntryCreate);
    return c.json(await entries.addExpense(user, input), 201);
  });

  app.post("/entries/income", async (c) => {
    const user = currentUser(c);
    const input = await parseJson(c, IncomeEntryCreate);
    return c.json(await entries.addIncome(user, input), 201);
  });

  app.delete("/entries/:id", async (c) => {
    const user = currentUser(c);
    await entries.remove(user, c.req.param("id"));
    return c.json({ ok: true });
  });

  return app;
}
