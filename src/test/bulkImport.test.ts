import { describe, it, expect } from "vitest";
import { validateRows, normalizeKenyanPhone, templateCsv, credentialsCsv } from "@/lib/bulkImport";

const H = "First Name,Last Name,Admission Number,Email,Parent Phone,Cohort/Stream\n";

describe("bulk import validation", () => {
  it("accepts the template sample row", () => {
    const { rows } = validateRows(templateCsv());
    expect(rows).toHaveLength(1);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].parentPhone).toBe("254712345678");
  });
  it("normalises Kenyan phone formats and rejects others", () => {
    expect(normalizeKenyanPhone("+254 712 345 678")).toBe("254712345678");
    expect(normalizeKenyanPhone("0112345678")).toBe("254112345678");
    expect(normalizeKenyanPhone("12345")).toBeNull();
  });
  it("flags missing fields", () => {
    const { rows } = validateRows(H + ",Otieno,,a@b.co,0712345678,\n");
    expect(rows[0].errors).toEqual(expect.arrayContaining(["First name is missing", "Admission number is missing", "Cohort/Stream is missing"]));
  });
  it("flags duplicate emails case-insensitively", () => {
    const { rows } = validateRows(H + "A,B,1,x@y.co,0712345678,G7\nC,D,2,X@Y.co,0712345678,G7\n");
    expect(rows[0].errors).toEqual([]);
    expect(rows[1].errors[0]).toMatch(/Duplicate email/);
  });
  it("reports missing header columns", () => {
    expect(validateRows("First Name,Email\nA,b@c.co\n").headerError).toMatch(/Last Name/);
  });
  it("guards credential export against formulas", () => {
    expect(credentialsCsv([{ name: "=HACK()", admissionNumber: "1", email: "a@b.co", tempPassword: "p", cohort: "G7" }])).toContain("'=HACK()");
  });
});
