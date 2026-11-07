import { Hono } from "hono";
import type { Deps } from "../deps.js";
import { buildAuthUrl, exchangeCode } from "../auth/google.js";
import { issueSessionToken, requireUser, currentUser, type AppEnv } from "../auth/session.js";
import { newToken } from "../lib/ids.js";
import { badRequest } from "../lib/errors.js";

export function authRoutes(deps: Deps) {
  const { config, repo, google } = deps;
  const app = new Hono<AppEnv>();

  /**
   * Step 1: the app opens this URL in a browser. `redirect_uri` is where we send the
   * user (with a session token) once Google has authenticated them. Only prefixes in
   * ALLOWED_APP_REDIRECTS are accepted, e.g. rentalledger://auth, http://localhost:8081/auth/callback
   */
  app.get("/auth/google/start", (c) => {
    const redirect = c.req.query("redirect_uri") ?? "";
    if (!config.ALLOWED_APP_REDIRECTS.some((p) => redirect.startsWith(p))) {
      throw badRequest(`redirect_uri must start with one of: ${config.ALLOWED_APP_REDIRECTS.join(", ")}`);
    }
    const state = newToken();
    repo.saveOauthState(state, redirect);
    return c.redirect(buildAuthUrl(config, state));
  });

  /** Step 2: Google sends the user back here; we mint a session and bounce to the app. */
  app.get("/auth/google/callback", async (c) => {
    const error = c.req.query("error");
    const code = c.req.query("code");
    const state = c.req.query("state") ?? "";
    const redirect = repo.consumeOauthState(state);
    if (!redirect) throw badRequest("Login session expired. Please try again.");
    if (error || !code) return c.redirect(appendParams(redirect, { error: error ?? "missing_code" }));

    const identity = await exchangeCode(config, code);
    const user = repo.upsertUser({
      googleSub: identity.sub,
      email: identity.email,
      name: identity.name,
      picture: identity.picture,
      refreshTokenEnc: identity.refreshToken ? google.sealRefreshToken(identity.refreshToken) : null,
    });
    const token = await issueSessionToken(config, user.id);
    return c.redirect(appendParams(redirect, { token }));
  });

  app.get("/me", requireUser(config, repo), (c) => {
    const u = currentUser(c);
    return c.json({
      id: u.id,
      email: u.email,
      name: u.name,
      picture: u.picture,
      googleConnected: Boolean(u.refresh_token_enc),
    });
  });

  /** Forget the stored Google refresh token (the app also drops its session token). */
  app.post("/auth/disconnect", requireUser(config, repo), (c) => {
    repo.clearRefreshToken(currentUser(c).id);
    return c.json({ ok: true });
  });

  return app;
}

/** Append query params, using the fragment for custom-scheme deep links so tokens never hit server logs. */
function appendParams(base: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  const isCustomScheme = !/^https?:\/\//i.test(base);
  const sep = isCustomScheme ? (base.includes("?") ? "&" : "?") : base.includes("?") ? "&" : "?";
  return `${base}${sep}${qs}`;
}
