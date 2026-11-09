import { describe, expect, it } from "vitest";
import { isAllowedRedirect } from "../src/routes/auth.js";

const ALLOWED = ["rentalledger://", "http://localhost:8081", "exp://", "https://rental-ledger.solomontsao.com"];

describe("isAllowedRedirect", () => {
  it("accepts exact https origin", () => {
    expect(isAllowedRedirect("https://rental-ledger.solomontsao.com/auth/callback", ALLOWED)).toBe(true);
  });
  it("rejects look-alike hosts and other ports/schemes", () => {
    expect(isAllowedRedirect("https://rental-ledger.solomontsao.com.evil.test/auth/callback", ALLOWED)).toBe(false);
    expect(isAllowedRedirect("http://rental-ledger.solomontsao.com/auth/callback", ALLOWED)).toBe(false);
    expect(isAllowedRedirect("http://localhost:8082/auth/callback", ALLOWED)).toBe(false);
    expect(isAllowedRedirect("https://evil.test/?x=http://localhost:8081", ALLOWED)).toBe(false);
  });
  it("accepts localhost dev origin and custom schemes", () => {
    expect(isAllowedRedirect("http://localhost:8081/auth/callback", ALLOWED)).toBe(true);
    expect(isAllowedRedirect("rentalledger://auth/callback", ALLOWED)).toBe(true);
    expect(isAllowedRedirect("exp://192.168.1.20:8081/--/auth/callback", ALLOWED)).toBe(true);
  });
  it("rejects garbage", () => {
    expect(isAllowedRedirect("not a url", ALLOWED)).toBe(false);
    expect(isAllowedRedirect("", ALLOWED)).toBe(false);
  });
});
