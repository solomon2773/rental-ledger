import { randomUUID, randomBytes } from "node:crypto";

export const newId = (): string => randomUUID();
export const newToken = (bytes = 24): string => randomBytes(bytes).toString("base64url");
export const nowIso = (): string => new Date().toISOString();
