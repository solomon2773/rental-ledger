import type { Context } from "hono";
import type { z } from "zod";
import { badRequest } from "./errors.js";

export async function parseJson<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw badRequest("Body must be JSON");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw badRequest("Validation failed", result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  return result.data;
}

export function parseQueryInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}
