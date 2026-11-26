import type { RGBA } from "@/types/editor";

export type LightingPreviewMode = "lit" | "normals" | "height" | "shadows";

export type LightingBakeScope = "current-layer" | "current-frame" | "all-frames";

export type SurfaceMaskPaintMode = "none" | "raise" | "lower" | "occlude" | "erase-mask";

export interface LightingConfig {
  enabled: boolean;
  /** Light position X relative to canvas center in normalized canvas units (-1.5..1.5) */
  lightX: number;
  /** Light position Y relative to canvas center in normalized canvas units (-1.5..1.5) */
  lightY: number;
  /** Light Z elevation above sprite plane (0.15 = low dramatic angle, 1.0 = overhead) */
  lightElevation: number;
  /** Directional light intensity (0..1.8) */
  intensity: number;
  /** Light color tint */
  lightColor: RGBA;
  /** Ambient fill light level (0..1) */
  ambientLight: number;
  /** Shadow darkening strength (0..1) */
  shadowIntensity: number;
  /** Pixel-art Bayer dithered shadow edge softness (0..1) */
  shadowSoftness: number;
  /** Cast shadow ray reach (0..1) */
  shadowLength: number;
  /** Stepped pixel-art shading bands (2..6, or 0 for continuous) */
  shadingSteps: number;
  /** Classic pixel-art warm highlight / cool shadow hue shift (0..1) */
  hueShiftStrength: number;
  /** Display interactive light source handle on viewport overlay */
  showLightGizmo: boolean;
  /** Diagnostic inspection view mode */
  previewMode: LightingPreviewMode;
}

export const DEFAULT_LIGHTING_CONFIG: LightingConfig = {
  enabled: false,
  lightX: -0.75,
  lightY: -0.75,
  lightElevation: 0.55,
  intensity: 1.05,
  lightColor: { r: 255, g: 244, b: 214, a: 255 },
  ambientLight: 0.35,
  shadowIntensity: 0.52,
  shadowSoftness: 0.35,
  shadowLength: 0.55,
  shadingSteps: 4,
  hueShiftStrength: 0.4,
  showLightGizmo: true,
  previewMode: "lit",
};

export function createDefaultLightingConfig(): LightingConfig {
  return {
    ...DEFAULT_LIGHTING_CONFIG,
    lightColor: { ...DEFAULT_LIGHTING_CONFIG.lightColor },
  };
}
