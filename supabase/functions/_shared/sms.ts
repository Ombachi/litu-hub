// Pure SMS helpers shared by the send-sms Edge Function and the browser (no Deno APIs).

const GSM7 = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXT = "^{}\\[~]|€";
const REPLACE: Record<string, string> = {
  "\u2018": "'", "\u2019": "'", "\u201C": '"', "\u201D": '"', "\u2013": "-", "\u2014": "-",
  "\u2026": "...", "\u00A0": " ", "\t": " ",
};

/** Replaces smart punctuation and drops characters outside the GSM-7 SMS alphabet (emoji, symbols). */
export function sanitizeSmsText(input: string): string {
  let out = "";
  for (const ch of input.normalize("NFC")) {
    const c = REPLACE[ch] ?? ch;
    for (const k of c) if (GSM7.includes(k) || GSM7_EXT.includes(k)) out += k;
  }
  return out.replace(/[ ]{2,}/g, " ").replace(/\r/g, "").trim();
}

/** SMS segments for GSM-7 text: 160 chars single, 153 per part when concatenated. Extension chars count as 2. */
export function smsSegments(text: string): number {
  let len = 0;
  for (const ch of text) len += GSM7_EXT.includes(ch) ? 2 : 1;
  if (len === 0) return 0;
  return len <= 160 ? 1 : Math.ceil(len / 153);
}

/** Normalizes a Kenyan number to E.164 (+2547XXXXXXXX / +2541XXXXXXXX); returns null when invalid. */
export function toE164Kenya(raw: string): string | null {
  const digits = (raw ?? "").replace(/[^\d+]/g, "");
  let n = digits;
  if (n.startsWith("+")) n = n.slice(1);
  if (n.startsWith("00")) n = n.slice(2);
  if (/^0[17]\d{8}$/.test(n)) n = "254" + n.slice(1);
  else if (/^[17]\d{8}$/.test(n)) n = "254" + n;
  return /^254[17]\d{8}$/.test(n) ? "+" + n : null;
}

export function isE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

/** Validates and de-duplicates a recipient list; returns valid E.164 numbers and the rejected inputs. */
export function prepareRecipients(raw: string[]): { valid: string[]; invalid: string[] } {
  const valid = new Set<string>();
  const invalid: string[] = [];
  for (const r of raw) {
    const p = toE164Kenya(r);
    if (p) valid.add(p); else invalid.push(r);
  }
  return { valid: [...valid], invalid };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const SMS_MAX_CHARS = 459; // 3 segments
export const SMS_BATCH_SIZE = 100;

export type SmsAudience = "all_parents" | "cohort_parents" | "defaulters";
export type SmsEvent = "invoice_issued" | "payment_confirmed" | "absence_flagged" | "broadcast";

export function eventTemplate(event: Exclude<SmsEvent, "broadcast">, v: Record<string, string>): string {
  switch (event) {
    case "invoice_issued":
      return `${v.school}: Invoice ${v.reference} of KES ${v.amount} for ${v.student} has been issued. Due ${v.due}.`;
    case "payment_confirmed":
      return `${v.school}: Payment of KES ${v.amount} received for ${v.student} (M-Pesa ${v.receipt}). Balance KES ${v.balance}. Thank you.`;
    case "absence_flagged":
      return `${v.school}: ${v.student} was marked absent at morning roll call on ${v.date}. Please contact the school.`;
  }
}
