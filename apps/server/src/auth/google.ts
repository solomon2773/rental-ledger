import { OAuth2Client, type TokenPayload } from "google-auth-library";
import type { Config } from "../config.js";

export function makeOAuthClient(config: Config): OAuth2Client {
  return new OAuth2Client({
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    redirectUri: config.googleRedirectUri,
  });
}

export function buildAuthUrl(config: Config, state: string): string {
  const client = makeOAuthClient(config);
  return client.generateAuthUrl({
    access_type: "offline", // we need a refresh token to write sheets later without the user present
    prompt: "consent", // force refresh_token issuance even on re-login
    scope: config.googleScopes,
    state,
    include_granted_scopes: true,
  });
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
  refreshToken: string | null;
}

export async function exchangeCode(config: Config, code: string): Promise<GoogleIdentity> {
  const client = makeOAuthClient(config);
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) throw new Error("Google did not return an id_token");
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.GOOGLE_CLIENT_ID });
  const payload: TokenPayload | undefined = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw new Error("Google id_token missing sub/email");
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
    refreshToken: tokens.refresh_token ?? null,
  };
}

/** An OAuth client that will mint access tokens from a stored refresh token on demand. */
export function clientForRefreshToken(config: Config, refreshToken: string): OAuth2Client {
  const client = makeOAuthClient(config);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}
