import type { CustomPalette, RGBA } from "@/types/editor";
import { colorsEqual } from "@/core/image-processing/color";

const STORAGE_KEY = "pixel-art-studio:custom-palettes:v1";

let paletteCounter = 1;

export function createCustomPalette(name: string, colors: RGBA[] = []): CustomPalette {
  return {
    id: `palette-${Date.now()}-${paletteCounter++}`,
    name: name.trim() || "Custom Palette",
    colors: colors.map((c) => ({ ...c })),
  };
}

export function addColorToPalette(palette: CustomPalette, color: RGBA): CustomPalette {
  if (palette.colors.some((c) => colorsEqual(c, color))) {
    return palette;
  }
  return {
    ...palette,
    colors: [...palette.colors, { ...color }],
  };
}

export function removeColorFromPalette(palette: CustomPalette, index: number): CustomPalette {
  if (index < 0 || index >= palette.colors.length) return palette;
  return {
    ...palette,
    colors: palette.colors.filter((_, i) => i !== index),
  };
}

export function loadCustomPalettes(): CustomPalette[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is CustomPalette =>
        typeof p === "object" &&
        p !== null &&
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        Array.isArray(p.colors),
    );
  } catch {
    return [];
  }
}

export function saveCustomPalettes(palettes: CustomPalette[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(palettes));
  } catch {
    // Ignore storage quota errors cleanly
  }
}
