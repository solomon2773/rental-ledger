import fs from "node:fs/promises";
import path from "node:path";

export const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

/** Anthropic's per-image limit is 5 MB; the mobile app downsizes before upload, this is a backstop. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const EXT: Record<SupportedImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function normalizeMime(mime: string | undefined, filename?: string): SupportedImageType | null {
  const m = (mime ?? "").toLowerCase().split(";")[0].trim();
  if (m === "image/jpg" || m === "image/pjpeg") return "image/jpeg";
  if ((SUPPORTED_IMAGE_TYPES as readonly string[]).includes(m)) return m as SupportedImageType;
  // Fall back to extension when the client sent application/octet-stream.
  const ext = (filename ?? "").toLowerCase().split(".").pop();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return null;
}

export class UploadStore {
  constructor(private dir: string) {}

  async init() {
    await fs.mkdir(this.dir, { recursive: true });
  }

  pathFor(id: string, mime: SupportedImageType): string {
    return path.join(this.dir, `${id}.${EXT[mime]}`);
  }

  async save(id: string, mime: SupportedImageType, data: Buffer): Promise<string> {
    const p = this.pathFor(id, mime);
    await fs.writeFile(p, data);
    return p;
  }

  async read(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath);
  }

  async remove(filePath: string): Promise<void> {
    await fs.rm(filePath, { force: true });
  }
}
