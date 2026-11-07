import { describe, expect, it } from "vitest";
import { parseSpreadsheetId, slugify, incomeBucketFor, ReceiptExtraction } from "../src/index.js";

describe("parseSpreadsheetId", () => {
  it("extracts from a full URL", () => {
    expect(
      parseSpreadsheetId(
        "https://docs.google.com/spreadsheets/d/1jYlNiWK-wPYfL_BIqh1pNVCRJxiEBIfCRyUZHaj0h5I/edit?gid=1127206021#gid=1127206021",
      ),
    ).toBe("1jYlNiWK-wPYfL_BIqh1pNVCRJxiEBIfCRyUZHaj0h5I");
  });
  it("accepts a bare id", () => {
    expect(parseSpreadsheetId("1jYlNiWK-wPYfL_BIqh1pNVCRJxiEBIfCRyUZHaj0h5I")).toBe(
      "1jYlNiWK-wPYfL_BIqh1pNVCRJxiEBIfCRyUZHaj0h5I",
    );
  });
  it("rejects junk", () => {
    expect(parseSpreadsheetId("hello")).toBeNull();
  });
});

describe("slugify", () => {
  it("makes drive-safe names", () => {
    expect(slugify("Trevor James Carr\n23x Appraisal Partners LLC", 60)).toBe(
      "trevor-james-carr-23x-appraisal-partners-llc",
    );
    expect(slugify("Costco Wholesale #1234").length).toBeLessThanOrEqual(40);
  });
});

describe("incomeBucketFor", () => {
  it("maps STR platforms to Airbnb Rent", () => {
    expect(incomeBucketFor("VRBO")).toBe("Airbnb Rent");
    expect(incomeBucketFor("Cash Rent")).toBe("Cash Rent");
  });
});

describe("ReceiptExtraction", () => {
  it("parses a model response", () => {
    const parsed = ReceiptExtraction.parse({
      vendor: "Costco",
      date: "2026-11-01",
      total: 795.58,
      subtotal: 735.0,
      tax: 60.58,
      currency: "USD",
      paymentMethod: { brand: "Visa", last4: "8941", raw: "VISA ****8941" },
      lineItems: [{ description: "Queen mattress", quantity: 1, amount: 499.99 }],
      suggestedLedger: "setup",
      suggestedCategory: "Furniture & Appliances",
      detailsSummary: "Queen mattress, cooking pot set, kitchen towels, coffee machine",
      confidence: "high",
      warnings: [],
    });
    expect(parsed.suggestedLedger).toBe("setup");
  });
});
