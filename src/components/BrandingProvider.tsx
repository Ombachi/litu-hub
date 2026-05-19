import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMyInstitution } from "@/hooks/useInstitution";
import { colorToHslTriplet, adjustLightness } from "@/lib/colorToHsl";

export type BrandingOverride = {
  primary_color?: string | null;
  secondary_color?: string | null;
  logo_url?: string | null;
  name?: string | null;
} | null;

interface BrandingCtx {
  setPreview: (b: BrandingOverride) => void;
  preview: BrandingOverride;
}

const Ctx = createContext<BrandingCtx>({ setPreview: () => {}, preview: null });
export const useBrandingPreview = () => useContext(Ctx);

/**
 * Apply a school's primary + accent colors to the live CSS design tokens so
 * sidebar, buttons, rings, accents, and gradients all reflect their identity
 * across every page. Preview overrides take precedence over the saved values.
 */
const BrandingProvider = ({ children }: { children: ReactNode }) => {
  const { data: inst } = useMyInstitution();
  const [preview, setPreview] = useState<BrandingOverride>(null);

  const effective = useMemo(() => ({
    primary: preview?.primary_color ?? inst?.primary_color ?? null,
    secondary: preview?.secondary_color ?? inst?.secondary_color ?? null,
  }), [preview, inst]);

  useEffect(() => {
    const root = document.documentElement;
    const KEYS = ["--primary", "--ring", "--sidebar-primary", "--sidebar-ring", "--accent", "--sidebar-background", "--sidebar-accent"];

    const primary = colorToHslTriplet(effective.primary);
    const accent = colorToHslTriplet(effective.secondary);

    if (primary) {
      root.style.setProperty("--primary", primary);
      root.style.setProperty("--ring", primary);
      // Sidebar derives from primary: dark variant for bg, slightly lighter for accent.
      const m = primary.match(/^(\d+)\s+(\d+)%\s+(\d+)%$/);
      if (m) {
        const dark = `${m[1]} ${Math.min(40, +m[2])}% 15%`;
        const darkAccent = `${m[1]} ${Math.min(35, +m[2])}% 22%`;
        root.style.setProperty("--sidebar-background", dark);
        root.style.setProperty("--sidebar-accent", darkAccent);
      }
    }
    if (accent) {
      root.style.setProperty("--accent", accent);
      root.style.setProperty("--sidebar-primary", accent);
      root.style.setProperty("--sidebar-ring", accent);
    }
    // Update hero gradient using both
    if (primary && accent) {
      const lighter = adjustLightness(primary, 8);
      root.style.setProperty(
        "--gradient-hero",
        `linear-gradient(135deg, hsl(${primary}) 0%, hsl(${lighter}) 50%, hsl(${accent}) 100%)`
      );
      root.style.setProperty("--gradient-accent", `linear-gradient(135deg, hsl(${accent}) 0%, hsl(${adjustLightness(accent, -5)}) 100%)`);
    }

    return () => {
      // On unmount or institution change, reset overrides (preview switching).
      if (!preview && !inst) {
        KEYS.forEach(k => root.style.removeProperty(k));
        root.style.removeProperty("--gradient-hero");
        root.style.removeProperty("--gradient-accent");
      }
    };
  }, [effective.primary, effective.secondary, preview, inst]);

  return <Ctx.Provider value={{ preview, setPreview }}>{children}</Ctx.Provider>;
};

export default BrandingProvider;
