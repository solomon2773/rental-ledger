import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_LEDGERS,
  LEDGER_DESCRIPTIONS,
  PROPERTY_TYPE_LABELS,
  ReceiptExtraction,
  type Property,
} from "@rental-ledger/shared";
import type { Config } from "../config.js";
import type { SupportedImageType } from "./storage.js";
import { HttpError } from "../lib/errors.js";

/**
 * Schema handed to the model. Kept free of defaults/regex so it converts
 * cleanly to the structured-output JSON schema; the shared ReceiptExtraction
 * schema re-validates the result afterwards.
 */
const ModelOutput = z.object({
  vendor: z.string().nullable().describe("Store / company name as printed, cleaned of addresses and slogans."),
  date: z.string().nullable().describe("Transaction date in YYYY-MM-DD. null if not visible."),
  total: z.number().nullable().describe("Final amount paid including tax and tip."),
  subtotal: z.number().nullable(),
  tax: z.number().nullable(),
  currency: z.string().describe("ISO 4217 code, e.g. USD."),
  paymentMethod: z.object({
    brand: z.string().nullable().describe("Visa, Mastercard, Amex, Discover, Debit, Cash, Check, ACH, or null."),
    last4: z.string().nullable().describe("Last four digits of the card, if printed."),
    raw: z.string().nullable().describe("The tender line exactly as printed."),
  }),
  lineItems: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().nullable(),
      amount: z.number().nullable(),
    }),
  ),
  suggestedLedger: z.enum(EXPENSE_LEDGERS),
  suggestedCategory: z.string(),
  detailsSummary: z.string().describe("Short comma-separated list of what was bought, ≤ 120 chars."),
  confidence: z.enum(["high", "medium", "low"]),
  warnings: z.array(z.string()),
});

const SYSTEM_PROMPT = `You read photos of receipts, invoices, statements and utility bills for a rental-property bookkeeping app and return structured data.

How the bookkeeper files things (three expense ledgers):
- regular: ${LEDGER_DESCRIPTIONS.regular} Choose this for anything that recurs monthly or yearly for the property itself. suggestedCategory MUST be one of the property's regular bill categories listed in the request.
- setup: ${LEDGER_DESCRIPTIONS.setup} Choose this for furniture, mattresses, appliances, décor, smart locks, inspections, appraisals and similar one-time "get it guest-ready" purchases.
- supply: ${LEDGER_DESCRIPTIONS.supply} Choose this for consumables (toilet paper, coffee pods, soap), cleaning, repairs, small replacements and day-to-day operating purchases.
For setup and supply, suggestedCategory MUST be one of: ${EXPENSE_CATEGORIES.join(", ")}.

Rules:
- Dates: output YYYY-MM-DD. If the year is missing, infer the most plausible recent year from the request's "today" date. Never invent a date you cannot see; use null and add a warning.
- total is the amount actually charged (after tax, tip, discounts, coupons). If a receipt shows several payments, total is the sum.
- Read the tender line for paymentMethod (e.g. "VISA ****8941" -> brand "Visa", last4 "8941").
- detailsSummary reads like a human's ledger note, e.g. "King Mattress, Hair Dryer, LED Light bulbs, K-cups coffee". Group obvious duplicates. Skip prices.
- Add a warning for anything blurry, cut off, hand-written, or when the vendor/total/date is a guess.
- Set confidence to low when total or date is uncertain.`;

export interface ExtractionContext {
  property: Property | null;
  todayIso: string;
}

export class ReceiptExtractor {
  private client: Anthropic;

  constructor(private config: Config) {
    // Reads ANTHROPIC_API_KEY (or an `ant auth login` profile) from the environment.
    this.client = new Anthropic(config.ANTHROPIC_API_KEY ? { apiKey: config.ANTHROPIC_API_KEY } : {});
  }

  async extract(image: Buffer, mimeType: SupportedImageType, ctx: ExtractionContext): Promise<ReceiptExtraction> {
    const property = ctx.property;
    const contextLines = [
      `Today: ${ctx.todayIso}.`,
      property
        ? `Property: "${property.name}" (${PROPERTY_TYPE_LABELS[property.type]}).`
        : "Property: not selected yet.",
      `Regular bill categories for this property: ${(property?.regularCategories ?? []).join(", ") || "(none configured)"}.`,
      property?.paymentMethods.length
        ? `Known payment methods (match by last 4 digits when possible): ${property.paymentMethods.join("; ")}.`
        : "",
      "Extract this receipt.",
    ].filter(Boolean);

    const response = await this.client.beta.messages.parse({
      model: this.config.ANTHROPIC_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      // Server-side refusal fallback: if a safety classifier declines, the API re-runs on a fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: this.config.ANTHROPIC_EFFORT,
        format: betaZodOutputFormat(ModelOutput),
      },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mimeType, data: image.toString("base64") } },
            { type: "text", text: contextLines.join("\n") },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      throw new HttpError(422, "The receipt image could not be processed. Please retake the photo.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new HttpError(502, "Receipt extraction was cut off. Please try again.");
    }
    const raw = response.parsed_output;
    if (!raw) throw new HttpError(502, "Receipt extraction returned no structured data. Please try again.");

    return this.normalize(raw, property);
  }

  /** Clean model output into the shared schema (valid dates, category guards, friendly pay-by label). */
  private normalize(raw: z.infer<typeof ModelOutput>, property: Property | null): ReceiptExtraction {
    const warnings = [...raw.warnings];

    let date: string | null = raw.date;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) {
        warnings.push(`Unrecognised date "${date}"; please enter it manually.`);
        date = null;
      } else {
        date = d.toISOString().slice(0, 10);
      }
    }

    let category = raw.suggestedCategory.trim();
    if (raw.suggestedLedger === "regular") {
      const cats = property?.regularCategories ?? [];
      const match = cats.find((c) => c.toLowerCase() === category.toLowerCase());
      if (match) category = match;
      else if (cats.length) {
        warnings.push(`"${category}" is not one of this property's regular bill categories.`);
        category = cats[0];
      }
    } else {
      const match = EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === category.toLowerCase());
      category = match ?? "Others";
    }

    const pm = raw.paymentMethod;
    if (pm.last4 && property?.paymentMethods.length) {
      const saved = property.paymentMethods.find((m) => m.replace(/\D/g, "").endsWith(pm.last4!));
      if (saved) pm.raw = saved;
    } else if (pm.brand && pm.last4 && !pm.raw?.includes(pm.last4)) {
      pm.raw = `${pm.brand} - ${pm.last4}`;
    }

    return ReceiptExtraction.parse({
      ...raw,
      date,
      currency: raw.currency || "USD",
      suggestedCategory: category,
      paymentMethod: pm,
      warnings,
    });
  }
}

/** Human-friendly "Pay by" label from an extraction, e.g. "Visa - 8941". */
export function payByLabel(extraction: ReceiptExtraction): string {
  const pm = extraction.paymentMethod;
  if (pm.raw && pm.last4 && /[A-Za-z]/.test(pm.raw) && pm.raw.includes(pm.last4) && pm.raw.length <= 40) return pm.raw;
  if (pm.brand && pm.last4) return `${pm.brand} - ${pm.last4}`;
  if (pm.brand) return pm.brand;
  return pm.raw ?? "";
}
