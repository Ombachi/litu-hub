/**
 * Convert a color string (hex like "#1f5132", "hsl(152, 45%, 22%)", or "152 45% 22%")
 * into the Tailwind-friendly "H S% L%" triplet used by our design tokens.
 * Returns null on unparseable input.
 */
export function colorToHslTriplet(input: string | null | undefined): string | null {
  if (!input) return null;
  const v = input.trim();

  // Already a bare triplet "152 45% 22%"
  const tripletMatch = v.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (tripletMatch) return `${Math.round(+tripletMatch[1])} ${Math.round(+tripletMatch[2])}% ${Math.round(+tripletMatch[3])}%`;

  // hsl(h, s%, l%) or hsl(h s% l%)
  const hslMatch = v.match(/^hsla?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)%\s*[, ]\s*(\d+(?:\.\d+)?)%/i);
  if (hslMatch) return `${Math.round(+hslMatch[1])} ${Math.round(+hslMatch[2])}% ${Math.round(+hslMatch[3])}%`;

  // Hex #rgb or #rrggbb
  const hex = v.replace("#", "");
  if (/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) {
    const full = hex.length === 3 ? hex.split("").map(c => c + c).join("") : hex;
    const r = parseInt(full.slice(0, 2), 16) / 255;
    const g = parseInt(full.slice(2, 4), 16) / 255;
    const b = parseInt(full.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  }
  return null;
}

/** Adjust lightness by delta percent (e.g. +10 to lighten). Returns triplet. */
export function adjustLightness(triplet: string, delta: number): string {
  const m = triplet.match(/^(\d+)\s+(\d+)%\s+(\d+)%$/);
  if (!m) return triplet;
  const l = Math.min(95, Math.max(5, +m[3] + delta));
  return `${m[1]} ${m[2]}% ${l}%`;
}
