import { createDefaultAppearance, type Appearance, type ThemeMode } from "@/types";

export const THEME_STORAGE_KEY = "gpa_tracker_appearance";
/** Pre-redesign key; still read once so returning users keep their light/dark choice. */
export const LEGACY_THEME_KEY = "gpa_tracker_theme";

export interface PrimarySwatch {
  id: string;
  label: string;
  /** Raw brand hue. Light mode darkens it automatically for contrast. */
  value: string;
  preview: string;
}

export interface SurfaceSwatch {
  id: string;
  label: string;
  preview: string;
  dark: Record<string, string>;
  light: Record<string, string>;
}

export const PRIMARY_SWATCHES: PrimarySwatch[] = [
  { id: "gold", label: "שמפניה", value: "oklch(0.78 0.11 85)", preview: "#d3b26a" },
  { id: "emerald", label: "אמרלד", value: "oklch(0.75 0.16 158)", preview: "#2fbf85" },
  { id: "coral", label: "אלמוג", value: "oklch(0.72 0.17 25)", preview: "#f0704f" },
  { id: "violet", label: "סחלב", value: "oklch(0.7 0.16 305)", preview: "#c07ae8" },
  { id: "cyan", label: "לגונה", value: "oklch(0.78 0.12 210)", preview: "#4fc4d8" },
  { id: "mono", label: "ניגוד חד", value: "oklch(0.97 0 0)", preview: "#f5f5f4" }
];

export const SURFACE_SWATCHES: SurfaceSwatch[] = [
  {
    id: "slate",
    label: "פחם",
    preview: "#1c1d22",
    dark: {
      "--app-bg": "oklch(0.16 0.008 260)",
      "--app-bg-veil": "oklch(0.16 0.008 260 / 0.72)",
      "--app-surface": "oklch(0.2 0.009 260)",
      "--app-raised": "oklch(0.24 0.01 260)",
      "--app-sunken": "oklch(0.13 0.008 260)"
    },
    light: {
      "--app-bg": "oklch(0.975 0.004 95)",
      "--app-bg-veil": "oklch(0.975 0.004 95 / 0.72)",
      "--app-surface": "oklch(1 0 0)",
      "--app-raised": "oklch(0.985 0.003 95)",
      "--app-sunken": "oklch(0.955 0.005 95)"
    }
  },
  {
    id: "oled",
    label: "שחור עמוק",
    preview: "#050505",
    dark: {
      "--app-bg": "oklch(0.09 0.002 260)",
      "--app-bg-veil": "oklch(0.09 0.002 260 / 0.76)",
      "--app-surface": "oklch(0.14 0.003 260)",
      "--app-raised": "oklch(0.18 0.004 260)",
      "--app-sunken": "oklch(0.06 0.002 260)"
    },
    light: {
      "--app-bg": "oklch(0.99 0 0)",
      "--app-bg-veil": "oklch(0.99 0 0 / 0.74)",
      "--app-surface": "oklch(1 0 0)",
      "--app-raised": "oklch(0.985 0 0)",
      "--app-sunken": "oklch(0.96 0 0)"
    }
  },
  {
    id: "sand",
    label: "חול חם",
    preview: "#242019",
    dark: {
      "--app-bg": "oklch(0.17 0.011 70)",
      "--app-bg-veil": "oklch(0.17 0.011 70 / 0.72)",
      "--app-surface": "oklch(0.21 0.013 70)",
      "--app-raised": "oklch(0.25 0.014 70)",
      "--app-sunken": "oklch(0.14 0.01 70)"
    },
    light: {
      "--app-bg": "oklch(0.965 0.012 85)",
      "--app-bg-veil": "oklch(0.965 0.012 85 / 0.72)",
      "--app-surface": "oklch(0.995 0.006 85)",
      "--app-raised": "oklch(0.98 0.008 85)",
      "--app-sunken": "oklch(0.94 0.014 85)"
    }
  },
  {
    id: "forest",
    label: "יער",
    preview: "#141d1a",
    dark: {
      "--app-bg": "oklch(0.16 0.014 165)",
      "--app-bg-veil": "oklch(0.16 0.014 165 / 0.72)",
      "--app-surface": "oklch(0.2 0.016 165)",
      "--app-raised": "oklch(0.24 0.017 165)",
      "--app-sunken": "oklch(0.13 0.012 165)"
    },
    light: {
      "--app-bg": "oklch(0.97 0.012 165)",
      "--app-bg-veil": "oklch(0.97 0.012 165 / 0.72)",
      "--app-surface": "oklch(1 0 0)",
      "--app-raised": "oklch(0.985 0.008 165)",
      "--app-sunken": "oklch(0.945 0.014 165)"
    }
  }
];

export function resolveMode(mode: ThemeMode): "dark" | "light" {
  if (mode !== "system") {
    return mode;
  }

  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function normalizeAppearance(input: unknown): Appearance {
  const fallback = createDefaultAppearance();
  if (!input || typeof input !== "object") {
    return fallback;
  }

  const source = input as Partial<Appearance>;
  const mode: ThemeMode =
    source.mode === "dark" || source.mode === "light" || source.mode === "system" ? source.mode : fallback.mode;

  return {
    mode,
    primaryId: PRIMARY_SWATCHES.some((swatch) => swatch.id === source.primaryId)
      ? (source.primaryId as string)
      : fallback.primaryId,
    surfaceId: SURFACE_SWATCHES.some((swatch) => swatch.id === source.surfaceId)
      ? (source.surfaceId as string)
      : fallback.surfaceId
  };
}

export function applyAppearance(appearance: Appearance): "dark" | "light" {
  const resolved = resolveMode(appearance.mode);
  const root = document.documentElement;
  const primary = PRIMARY_SWATCHES.find((swatch) => swatch.id === appearance.primaryId) ?? PRIMARY_SWATCHES[0];
  const surface = SURFACE_SWATCHES.find((swatch) => swatch.id === appearance.surfaceId) ?? SURFACE_SWATCHES[0];

  root.setAttribute("data-theme", resolved);
  root.style.setProperty("--app-primary-raw", primary.value);

  // The stark-mono swatch inverts: a near-white chip needs dark ink on top of it.
  root.style.setProperty("--app-primary-ink", resolved === "dark" ? "oklch(0.16 0.01 265)" : "oklch(0.99 0 0)");

  const tokens = resolved === "dark" ? surface.dark : surface.light;
  for (const [name, value] of Object.entries(tokens)) {
    root.style.setProperty(name, value);
  }

  const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.content = resolved === "dark" ? "#111114" : "#fafaf9";
  }

  return resolved;
}

export function readStoredAppearance(): Appearance {
  if (typeof localStorage === "undefined") {
    return createDefaultAppearance();
  }

  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw) {
      return normalizeAppearance(JSON.parse(raw));
    }

    const legacy = localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy === "light" || legacy === "dark") {
      return { ...createDefaultAppearance(), mode: legacy };
    }
  } catch {
    // Corrupt or blocked storage falls through to the shipped defaults.
  }

  return createDefaultAppearance();
}

export function storeAppearance(appearance: Appearance): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(appearance));
  } catch {
    // Private-mode storage failures must not break theming.
  }
}
