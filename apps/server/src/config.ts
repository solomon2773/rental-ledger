import { z } from "zod";
import path from "node:path";

const Env = z.object({
  PORT: z.coerce.number().int().default(8787),
  SERVER_PUBLIC_URL: z.string().url().default("http://localhost:8787"),
  APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),
  DATA_DIR: z.string().default("./data"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  ALLOWED_APP_REDIRECTS: z
    .string()
    .default("rentalledger://,http://localhost:8081,exp://")
    .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean)),
  DRIVE_ROOT_FOLDER_NAME: z.string().default("Rental Ledger"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-opus-5-5"),
  ANTHROPIC_EFFORT: z.enum(["low", "medium", "high"]).default("medium"),
  NODE_ENV: z.string().default("development"),
});

export type Config = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment:\n${issues}\n\nCopy apps/server/.env.example to apps/server/.env and fill it in.`);
  }
  const c = parsed.data;
  const dataDir = path.resolve(process.cwd(), c.DATA_DIR);
  return {
    ...c,
    dataDir,
    uploadsDir: path.join(dataDir, "uploads"),
    dbPath: path.join(dataDir, "rental-ledger.db"),
    googleRedirectUri: `${c.SERVER_PUBLIC_URL.replace(/\/$/, "")}/auth/google/callback`,
    /**
     * drive.file  -> create/read/write only files this app created (sheets, folders, receipt images).
     * spreadsheets -> needed to append to a spreadsheet the user created by hand and "links" in the app.
     */
    googleScopes: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  };
}
