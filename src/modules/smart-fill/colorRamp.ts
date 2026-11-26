import type { RGBA } from "@/types/editor";
import { clampByte, hexToRgba, hsvToRgb, rgbToHsv } from "@/core/image-processing/color";

export interface ColorRampOptions {
  baseColor: RGBA;
  colorVariation: number; // 0..1
  brightnessVariation: number; // 0..1
  saturationVariation: number; // 0..1
  contrast: number; // 0..1
  steps?: number;
}

function wrapHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

/**
 * Computes hue-shifted pixel art direction:
 * - Highlights drift slightly warmer (toward yellow ~60deg)
 * - Shadows drift slightly cooler (toward indigo/purple ~250deg)
 * Keeps colors rich and harmonious while staying tightly anchored to baseColor.
 */
function shiftHueToward(baseHue: number, targetHue: number, maxDeltaDeg: number): number {
  let diff = ((targetHue - baseHue + 540) % 360) - 180;
  if (Math.abs(diff) > maxDeltaDeg) {
    diff = Math.sign(diff) * maxDeltaDeg;
  }
  return wrapHue(baseHue + diff);
}

/**
 * Generates a cohesive, pixel-art-ready tonal ramp around baseColor.
 * Index 0 is darkest shadow, center index is baseColor, last index is brightest highlight.
 */
export function generateControlledColorRamp(options: ColorRampOptions): RGBA[] {
  const steps = Math.max(3, Math.min(9, Math.round(options.steps ?? 5)));
  const hsv = rgbToHsv(options.baseColor.r, options.baseColor.g, options.baseColor.b);
  const contrastCurve = 0.7 + options.contrast * 0.8;

  // Bounded max shifts guarantee variations never drift unrecognizably far from baseColor
  const maxHueShiftDeg = options.colorVariation * 24;
  const maxValDelta = options.brightnessVariation * 34 * contrastCurve;
  const maxSatDelta = options.saturationVariation * 24;

  const ramp: RGBA[] = [];
  const mid = (steps - 1) / 2;

  for (let i = 0; i < steps; i++) {
    // Normalized signed tonal position in [-1, 1]
    const t = mid > 0 ? (i - mid) / mid : 0;

    if (Math.abs(t) < 1e-6) {
      ramp.push({ ...options.baseColor });
      continue;
    }

    const strength = Math.abs(t);
    let nextH = hsv.h;
    if (hsv.s > 6 && maxHueShiftDeg > 0.1) {
      const targetHue = t > 0 ? 55 : 245; // Warm gold highlights, cool deep shadows
      nextH = shiftHueToward(hsv.h, targetHue, maxHueShiftDeg * strength);
    }

    // Shadows slightly deepen saturation; highlights slightly lift brightness & soften saturation
    const satOffset =
      t < 0
        ? maxSatDelta * strength * 0.7
        : -maxSatDelta * strength * 0.55;

    const nextS = Math.max(0, Math.min(100, hsv.s + satOffset));
    const nextV = Math.max(4, Math.min(100, hsv.v + t * maxValDelta));

    const rgb = hsvToRgb(nextH, nextS, nextV);
    ramp.push({
      r: clampByte(rgb.r),
      g: clampByte(rgb.g),
      b: clampByte(rgb.b),
      a: options.baseColor.a,
    });
  }

  return ramp;
}

/**
 * Builds a material-tinted ramp: either directly from the MaterialPreset's sample colors
 * or by harmonizing baseColor with the material's characteristic contrast/variation curve.
 */
export function buildMaterialRamp(
  sampleHexes: readonly string[],
  baseColor: RGBA,
  useMaterialBasePalette: boolean,
  options: Omit<ColorRampOptions, "baseColor">,
): RGBA[] {
  if (useMaterialBasePalette && sampleHexes.length >= 3) {
    const parsed = sampleHexes
      .map((hex) => hexToRgba(hex))
      .filter((c): c is RGBA => c !== null)
      .map((c) => ({ ...c, a: baseColor.a }));
    if (parsed.length >= 3) {
      return parsed;
    }
  }
  return generateControlledColorRamp({
    ...options,
    baseColor,
    steps: 5,
  });
}
