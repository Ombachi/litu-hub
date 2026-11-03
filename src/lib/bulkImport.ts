// Client-side parsing and validation for bulk student onboarding CSVs.

export const TEMPLATE_HEADERS = [
  "First Name", "Last Name", "Admission Number", "Email", "Parent Phone", "Cohort/Stream",
] as const;

export interface ImportRow {
  line: number;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  email: string;
  parentPhone: string; // normalised 2547XXXXXXXX / 2541XXXXXXXX
  cohort: string;
  errors: string[];
}

export function templateCsv(): string {
  return [
    TEMPLATE_HEADERS.join(","),
    "Amani,Otieno,ADM001,amani.otieno@example.com,0712345678,Grade 7 - North",
  ].join("\n") + "\n";
}

/** Minimal RFC4180 CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", q = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ""));
}

/** Accepts 07XXXXXXXX, 01XXXXXXXX, +2547/2541XXXXXXXX. Returns 254XXXXXXXXX or null. */
export function normalizeKenyanPhone(raw: string): string | null {
  const d = raw.replace(/[\s()-]/g, "").replace(/^\+/, "");
  if (/^0[17]\d{8}$/.test(d)) return "254" + d.slice(1);
  if (/^254[17]\d{8}$/.test(d)) return d;
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const norm = (h: string) => h.toLowerCase().replace(/[^a-z]/g, "");

export function validateRows(text: string, knownCohorts?: string[]): { rows: ImportRow[]; headerError?: string } {
  const table = parseCsv(text);
  if (!table.length) return { rows: [], headerError: "The file is empty." };
  const header = table[0].map(norm);
  const idx = TEMPLATE_HEADERS.map(h => header.indexOf(norm(h)));
  const missing = TEMPLATE_HEADERS.filter((_, i) => idx[i] < 0);
  if (missing.length) return { rows: [], headerError: `Missing columns: ${missing.join(", ")}` };

  const cohortSet = knownCohorts ? new Set(knownCohorts.map(c => c.trim().toLowerCase())) : null;
  const seenEmail = new Map<string, number>();
  const seenAdm = new Map<string, number>();
  const rows: ImportRow[] = table.slice(1).map((cells, i) => {
    const get = (k: number) => (cells[idx[k]] ?? "").trim();
    const errors: string[] = [];
    const [firstName, lastName, admissionNumber, emailRaw, phoneRaw, cohort] = [0, 1, 2, 3, 4, 5].map(get);
    const email = emailRaw.toLowerCase();
    if (!firstName) errors.push("First name is missing");
    if (!lastName) errors.push("Last name is missing");
    if (!admissionNumber) errors.push("Admission number is missing");
    if (!email) errors.push("Email is missing");
    else if (!EMAIL_RE.test(email) || email.length > 255) errors.push("Email is not valid");
    if (!cohort) errors.push("Cohort/Stream is missing");
    else if (cohortSet && !cohortSet.has(cohort.toLowerCase())) errors.push(`Unknown stream "${cohort}"`);
    let parentPhone = "";
    if (!phoneRaw) errors.push("Parent phone is missing");
    else {
      const p = normalizeKenyanPhone(phoneRaw);
      if (!p) errors.push("Parent phone must look like 0712345678 or +254712345678");
      else parentPhone = p;
    }
    [firstName, lastName, admissionNumber, cohort].forEach(v => {
      if (v.length > 100) errors.push("A value is longer than 100 characters");
    });
    const line = i + 2;
    if (email) {
      if (seenEmail.has(email)) errors.push(`Duplicate email (also on row ${seenEmail.get(email)})`);
      else seenEmail.set(email, line);
    }
    if (admissionNumber) {
      const a = admissionNumber.toLowerCase();
      if (seenAdm.has(a)) errors.push(`Duplicate admission number (also on row ${seenAdm.get(a)})`);
      else seenAdm.set(a, line);
    }
    return { line, firstName, lastName, admissionNumber, email, parentPhone, cohort, errors };
  });
  return { rows };
}

const csvCell = (v: string) => {
  let s = v;
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // formula-injection guard
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function credentialsCsv(creds: { name: string; admissionNumber: string; email: string; tempPassword: string; cohort: string }[]): string {
  const lines = [["Name", "Admission Number", "Email", "Temporary Password", "Cohort/Stream"].join(",")];
  creds.forEach(c => lines.push([c.name, c.admissionNumber, c.email, c.tempPassword, c.cohort].map(csvCell).join(",")));
  return lines.join("\n") + "\n";
}
