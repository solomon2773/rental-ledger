import type { Config } from "../config.js";
import type { Repo, UserRow } from "../db/repo.js";
import { SecretBox } from "../lib/crypto.js";
import { HttpError } from "../lib/errors.js";
import { clientForRefreshToken } from "../auth/google.js";
import { SheetsService } from "./sheets.js";
import { DriveService } from "./drive.js";

export interface GoogleServices {
  sheets: SheetsService;
  drive: DriveService;
}

export class GoogleFactory {
  private box: SecretBox;
  constructor(
    private config: Config,
    private repo: Repo,
  ) {
    this.box = new SecretBox(config.APP_SECRET);
  }

  sealRefreshToken(token: string): string {
    return this.box.seal(token);
  }

  forUser(user: UserRow): GoogleServices {
    if (!user.refresh_token_enc) {
      throw new HttpError(428, "Google access not granted. Please sign in again to connect Google Drive & Sheets.", { code: "google_reauth_required" });
    }
    const auth = clientForRefreshToken(this.config, this.box.open(user.refresh_token_enc));
    return { sheets: new SheetsService(auth), drive: new DriveService(auth) };
  }
}

interface GaxiosLikeError {
  code?: number | string;
  status?: number;
  message?: string;
  response?: { status?: number; data?: { error?: { message?: string; status?: string } | string; error_description?: string } };
}

/**
 * Translate Google API failures into actionable HTTP errors for the app.
 * `invalid_grant` means the refresh token was revoked -> user must sign in again.
 */
export function translateGoogleError(err: unknown, repo?: Repo, userId?: string): HttpError {
  if (err instanceof HttpError) return err; // already translated (e.g. nested service call)
  const e = err as GaxiosLikeError;
  const status = Number(e.response?.status ?? e.status ?? e.code ?? 0);
  const dataErr = e.response?.data?.error;
  const msg = typeof dataErr === "string" ? dataErr : dataErr?.message ?? e.message ?? "Google API error";
  const description = e.response?.data?.error_description ?? "";

  if (msg.includes("invalid_grant") || description.includes("invalid_grant")) {
    if (repo && userId) repo.clearRefreshToken(userId);
    return new HttpError(428, "Google sign-in expired or was revoked. Please sign in again.", { code: "google_reauth_required" });
  }
  if (status === 401) return new HttpError(428, "Google rejected our credentials. Please sign in again.", { code: "google_reauth_required" });
  if (status === 403) return new HttpError(403, `Google denied access: ${msg}. If this is a spreadsheet you made by hand, make sure this Google account can edit it.`);
  if (status === 404) return new HttpError(404, "Spreadsheet or Drive folder not found. It may have been deleted or moved.");
  if (status === 429) return new HttpError(429, "Google API rate limit hit. Try again in a moment.");
  return new HttpError(502, `Google API error: ${msg}`);
}
