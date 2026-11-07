import { drive as driveApi, type drive_v3 } from "@googleapis/drive";
import type { OAuth2Client } from "google-auth-library";
import { Readable } from "node:stream";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export class DriveService {
  private api: drive_v3.Drive;

  constructor(auth: OAuth2Client) {
    this.api = driveApi({ version: "v3", auth: auth as unknown as string });
  }

  async findFolder(name: string, parentId: string | null): Promise<string | null> {
    const parentClause = parentId ? ` and '${esc(parentId)}' in parents` : " and 'root' in parents";
    const res = await this.api.files.list({
      q: `name = '${esc(name)}' and mimeType = '${FOLDER_MIME}' and trashed = false${parentClause}`,
      fields: "files(id,name)",
      pageSize: 5,
      spaces: "drive",
    });
    return res.data.files?.[0]?.id ?? null;
  }

  async ensureFolder(name: string, parentId: string | null): Promise<string> {
    const existing = await this.findFolder(name, parentId);
    if (existing) return existing;
    const res = await this.api.files.create({
      requestBody: { name, mimeType: FOLDER_MIME, parents: parentId ? [parentId] : undefined },
      fields: "id",
    });
    return res.data.id!;
  }

  /** Ensure a nested folder path exists, e.g. ["Rental Ledger", "2529 Persimmon Dr", "2026", "Receipts"]. */
  async ensurePath(names: string[], startParent: string | null = null): Promise<string> {
    let parent = startParent;
    for (const n of names) parent = await this.ensureFolder(n, parent);
    if (!parent) throw new Error("ensurePath needs at least one folder name");
    return parent;
  }

  async moveToFolder(fileId: string, folderId: string): Promise<void> {
    const cur = await this.api.files.get({ fileId, fields: "parents" });
    const previous = (cur.data.parents ?? []).join(",");
    await this.api.files.update({ fileId, addParents: folderId, removeParents: previous || undefined, fields: "id,parents" });
  }

  async uploadFile(input: { name: string; mimeType: string; data: Buffer; parentId: string }): Promise<{ id: string; webViewLink: string }> {
    const res = await this.api.files.create({
      requestBody: { name: input.name, parents: [input.parentId] },
      media: { mimeType: input.mimeType, body: Readable.from(input.data) },
      fields: "id,webViewLink",
    });
    return { id: res.data.id!, webViewLink: res.data.webViewLink ?? `https://drive.google.com/file/d/${res.data.id}/view` };
  }

  async trashFile(fileId: string): Promise<void> {
    await this.api.files.update({ fileId, requestBody: { trashed: true } });
  }
}
