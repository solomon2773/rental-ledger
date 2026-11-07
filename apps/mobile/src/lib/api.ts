import type {
  Entry,
  ExpenseEntryCreate,
  IncomeEntryCreate,
  Property,
  PropertyCreate,
  PropertySummary,
  PropertyUpdate,
  Scan,
  Workbook,
  WorkbookLink,
} from "@rental-ledger/shared";
import { API_URL } from "./config";
import { sessionStore } from "./session";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
  /** Server says the Google refresh token is gone: the user has to sign in again. */
  get needsReauth() {
    return this.status === 428 || this.status === 401;
  }
}

export type PropertyWithWorkbooks = Property & { workbooks: Workbook[] };
export type Me = { id: string; email: string; name: string | null; picture: string | null; googleConnected: boolean };
export type ScanResponse = Scan & {
  prefill: null | { date: string; vendor: string; amount: number; ledger: ExpenseEntryCreate["ledger"]; category: string; details: string; payBy: string };
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await sessionStore.get();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch (e) {
    throw new ApiError(0, `Cannot reach the server at ${API_URL}. Is it running? (${e instanceof Error ? e.message : String(e)})`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    const body = (data ?? {}) as { error?: string; details?: { code?: string } | unknown };
    const code = body.details && typeof body.details === "object" && "code" in body.details ? String((body.details as { code?: string }).code) : undefined;
    throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`, body.details, code);
  }
  return data as T;
}

export const api = {
  me: () => request<Me>("/me"),
  disconnect: () => request<{ ok: true }>("/auth/disconnect", { method: "POST" }),

  properties: {
    list: () => request<PropertyWithWorkbooks[]>("/properties"),
    get: (id: string) => request<PropertyWithWorkbooks>(`/properties/${id}`),
    create: (input: PropertyCreate) => request<{ property: Property; workbook: Workbook | null }>("/properties", { method: "POST", body: JSON.stringify(input) }),
    update: (id: string, patch: PropertyUpdate) => request<Property>(`/properties/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    archive: (id: string) => request<{ ok: true }>(`/properties/${id}`, { method: "DELETE" }),
    summary: (id: string, year: number) => request<PropertySummary>(`/properties/${id}/summary?year=${year}`),
    ensureWorkbook: (id: string, year: number) => request<Workbook>(`/properties/${id}/workbooks`, { method: "POST", body: JSON.stringify({ year }) }),
    linkWorkbook: (id: string, input: WorkbookLink) => request<Workbook>(`/properties/${id}/workbooks/link`, { method: "POST", body: JSON.stringify(input) }),
    unlinkWorkbook: (id: string, wid: string) => request<{ ok: true }>(`/properties/${id}/workbooks/${wid}`, { method: "DELETE" }),
    rebuildSummary: (id: string, wid: string) => request<Workbook>(`/properties/${id}/workbooks/${wid}/rebuild-summary`, { method: "POST" }),
  },

  scans: {
    /** Upload a receipt image. `file` is a local URI (native) or a Blob/File (web). */
    create: async (image: { uri: string; mimeType: string; name: string } | Blob, propertyId?: string) => {
      const form = new FormData();
      if (image instanceof Blob) {
        form.append("image", image, "receipt.jpg");
      } else {
        // React Native's FormData accepts {uri, type, name}
        form.append("image", { uri: image.uri, type: image.mimeType, name: image.name } as unknown as Blob);
      }
      if (propertyId) form.append("propertyId", propertyId);
      return request<ScanResponse>("/scans", { method: "POST", body: form });
    },
    get: (id: string) => request<ScanResponse>(`/scans/${id}`),
    imageUrl: async (id: string) => `${API_URL}/scans/${id}/image?token=${encodeURIComponent((await sessionStore.get()) ?? "")}`,
  },

  entries: {
    list: (params: { propertyId?: string; ledger?: string; limit?: number } = {}) => {
      const qs = new URLSearchParams();
      if (params.propertyId) qs.set("propertyId", params.propertyId);
      if (params.ledger) qs.set("ledger", params.ledger);
      if (params.limit) qs.set("limit", String(params.limit));
      const q = qs.toString();
      return request<Entry[]>(`/entries${q ? `?${q}` : ""}`);
    },
    addExpense: (input: ExpenseEntryCreate) => request<Entry>("/entries/expense", { method: "POST", body: JSON.stringify(input) }),
    addIncome: (input: IncomeEntryCreate) => request<Entry>("/entries/income", { method: "POST", body: JSON.stringify(input) }),
    remove: (id: string) => request<{ ok: true }>(`/entries/${id}`, { method: "DELETE" }),
  },
};
