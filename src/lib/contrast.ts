/** WCAG contrast utilities for institution branding. */

function hexToRgb(hex: string): [number, number, number] | null {
  const v = hex.replace("#", "").trim();
  const full = v.length === 3 ? v.split("").map(c => c + c).join("") : v;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function hslStringToRgb(s: string): [number, number, number] | null {
  const m = s.match(/(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)%\s*[, ]\s*(\d+(?:\.\d+)?)%/);
  if (!m) return null;
  const h = +m[1] / 360, sat = +m[2] / 100, l = +m[3] / 100;
  if (sat === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(hue2rgb(h + 1 / 3) * 255), Math.round(hue2rgb(h) * 255), Math.round(hue2rgb(h - 1 / 3) * 255)];
}

export function toRgb(color: string): [number, number, number] | null {
  const v = color.trim();
  if (v.startsWith("#")) return hexToRgb(v);
  if (v.startsWith("hsl")) return hslStringToRgb(v);
  return hexToRgb(v); // try as bare hex
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const ch = [r, g, b].map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrastRatio(a: string, b: string): number | null {
  const ra = toRgb(a), rb = toRgb(b);
  if (!ra || !rb) return null;
  const la = relativeLuminance(ra), lb = relativeLuminance(rb);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type ContrastGrade = "AAA" | "AA" | "AA Large" | "Fail";

/** WCAG 2.1: 4.5 AA normal, 3.0 AA large, 7.0 AAA normal. */
export function gradeContrast(ratio: number | null): ContrastGrade {
  if (ratio == null) return "Fail";
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA Large";
  return "Fail";
}
