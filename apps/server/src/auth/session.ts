import { sign, verify } from "hono/jwt";
import type { Context, MiddlewareHandler } from "hono";
import type { Config } from "../config.js";
import type { Repo, UserRow } from "../db/repo.js";
import { unauthorized } from "../lib/errors.js";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days

export async function issueSessionToken(config: Config, userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign({ sub: userId, iat: now, exp: now + SESSION_TTL_SECONDS }, config.APP_SECRET, "HS256");
}

export type AppEnv = {
  Variables: {
    user: UserRow;
  };
};

export function requireUser(config: Config, repo: Repo): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : c.req.query("token");
    if (!token) throw unauthorized("Missing bearer token");
    let payload: { sub?: string };
    try {
      payload = (await verify(token, config.APP_SECRET, "HS256")) as { sub?: string };
    } catch {
      throw unauthorized("Invalid or expired session");
    }
    const user = payload.sub ? repo.getUser(payload.sub) : undefined;
    if (!user) throw unauthorized("Unknown user");
    c.set("user", user);
    await next();
  };
}

export const currentUser = (c: Context<AppEnv>): UserRow => c.get("user");
