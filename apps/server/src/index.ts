import { serve } from "@hono/node-server";
import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";

const config = loadConfig();
const { app } = await buildApp(config);

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`rental-ledger api listening on http://localhost:${info.port}`);
  console.log(`Google OAuth redirect URI: ${config.googleRedirectUri}`);
  if (!config.ANTHROPIC_API_KEY) console.log("ANTHROPIC_API_KEY not set - relying on an `ant auth login` profile.");
});
