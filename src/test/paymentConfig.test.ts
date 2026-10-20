import { describe, it, expect } from "vitest";
import { buildReference, isValidShortcode, normalizeKenyanPhone, validateReconCsv, csvSafe } from "@/lib/paymentConfig";

describe("paymentConfig", () => {
  it("M-Pesa references over 12 chars are flagged", () => {
    expect(buildReference({ prefix: "SCH", student: "001", invoice: "INV", year: "2026" }).fitsMpesa).toBe(false);
    expect(buildReference({ prefix: "SCH", student: "01", invoice: "", year: "26" }).fitsMpesa).toBe(true);
  });
  it("shortcode must be 5-7 digits", () => {
    expect(isValidShortcode("174379")).toBe(true);
    expect(isValidShortcode("12ab")).toBe(false);
  });
  it("normalizes Kenyan phones", () => {
    expect(normalizeKenyanPhone("0712345678")).toBe("254712345678");
    expect(normalizeKenyanPhone("12345")).toBeNull();
  });
  it("blocks formula injection", () => {
    expect(csvSafe("=SUM(A1)")).toBe("'=SUM(A1)");
    const r = validateReconCsv("date,provider,reference,amount_kes,payer_name,invoice_reference\n2026-01-01,mpesa,=HACK,100,Jane,INV1");
    expect(r.ok).toBe(false);
  });
});
