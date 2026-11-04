import { describe, it, expect } from "vitest";
import { toE164Kenya, prepareRecipients, sanitizeSmsText, smsSegments, chunk } from "./sms";

describe("sms helpers", () => {
  it("normalizes Kenyan numbers to +254 E.164", () => {
    expect(toE164Kenya("0712 345 678")).toBe("+254712345678");
    expect(toE164Kenya("+254-110-123456")).toBe("+254110123456");
    expect(toE164Kenya("712345678")).toBe("+254712345678");
  });
  it("rejects invalid numbers", () => {
    expect(toE164Kenya("0812345678")).toBeNull();
    expect(toE164Kenya("+25471234")).toBeNull();
  });
  it("dedupes recipients and reports invalid ones", () => {
    const r = prepareRecipients(["0712345678", "+254712345678", "abc"]);
    expect(r.valid).toEqual(["+254712345678"]);
    expect(r.invalid).toEqual(["abc"]);
  });
  it("strips non-GSM characters and smart quotes", () => {
    expect(sanitizeSmsText("Hello “Parent” 🎉 – fees")).toBe('Hello "Parent" - fees');
  });
  it("counts segments at 160/153", () => {
    expect(smsSegments("a".repeat(160))).toBe(1);
    expect(smsSegments("a".repeat(161))).toBe(2);
  });
  it("splits batches of 100", () => {
    expect(chunk(Array(250).fill(0), 100).map(c => c.length)).toEqual([100, 100, 50]);
  });
});
