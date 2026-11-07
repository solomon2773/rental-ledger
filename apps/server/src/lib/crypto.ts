import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption for secrets at rest (Google refresh tokens).
 * Key is derived from APP_SECRET; output is base64url(iv | tag | ciphertext).
 */
export class SecretBox {
  private key: Buffer;
  constructor(secret: string) {
    this.key = createHash("sha256").update(secret).digest();
  }
  seal(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString("base64url");
  }
  open(sealed: string): string {
    const buf = Buffer.from(sealed, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  }
}
