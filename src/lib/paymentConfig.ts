// Client-side validation helpers for the payment configuration workspace.
// Nothing here persists credentials; secure storage requires the backend.

export const isValidShortcode = (v: string) => /^\d{5,7}$/.test(v.trim());

/** Account-reference prefix: uppercase letters/digits, 2–6 chars. */
export const isValidPrefix = (v: string) => /^[A-Z0-9]{2,6}$/.test(v);

/** Callback token: at least 32 URL-safe chars. */
export const isValidCallbackToken = (v: string) => /^[A-Za-z0-9_-]{32,}$/.test(v);

export const normalizeKenyanPhone = (raw: string): string | null => {
  const d = raw.replace(/\D/g, "");
  if (/^254[17]\d{8}$/.test(d)) return d;
  if (/^0[17]\d{8}$/.test(d)) return "254" + d.slice(1);
  if (/^[17]\d{8}$/.test(d)) return "254" + d;
  return null;
};

/** M-Pesa AccountReference max length is 12 characters. */
export const MPESA_REF_MAX = 12;

export function buildReference(parts: { prefix: string; student: string; invoice: string; year: string }) {
  const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const ref = [clean(parts.prefix), clean(parts.student), clean(parts.invoice), clean(parts.year)]
    .filter(Boolean)
    .join("-");
  return { ref, length: ref.length, fitsMpesa: ref.length <= MPESA_REF_MAX };
}

export const maskSecret = (v: string) => (v.length <= 4 ? "••••" : `••••••${v.slice(-4)}`);

/** Prevent spreadsheet formula injection in CSV cells. */
export const csvSafe = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

export const RECON_COLUMNS = ["date", "provider", "reference", "amount_kes", "payer_name", "invoice_reference"] as const;

export function validateReconCsv(text: string): { ok: boolean; errors: string[]; rows: number } {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const errors: string[] = [];
  if (!lines.length) return { ok: false, errors: ["File is empty"], rows: 0 };
  const header = lines[0].split(",").map(h => h.trim().toLowerCase());
  RECON_COLUMNS.forEach(c => { if (!header.includes(c)) errors.push(`Missing column: ${c}`); });
  const amtIdx = header.indexOf("amount_kes");
  lines.slice(1).forEach((l, i) => {
    const cells = l.split(",");
    if (/^[=+\-@]/.test(cells.find(c => /^[=+\-@]/.test(c.trim())) ?? "")) errors.push(`Row ${i + 2}: formula-like value blocked`);
    if (amtIdx >= 0 && !(Number(cells[amtIdx]) > 0)) errors.push(`Row ${i + 2}: amount must be a positive number`);
  });
  return { ok: errors.length === 0, errors: errors.slice(0, 20), rows: lines.length - 1 };
}
