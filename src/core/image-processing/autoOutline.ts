import type { AutoOutlineOptions, RGBA } from "@/types/editor";
import { PixelBuffer } from "@/core/document/PixelBuffer";
import {
  clampByte,
  hsvToRgb,
  packColor,
  rgbToHsv,
  TRANSPARENT_PACKED,
  unpackRGBA,
} from "@/core/image-processing/color";

const NEIGHBORS_4: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

const NEIGHBORS_8: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

export interface AutoOutlineResult {
  outlineOnly: PixelBuffer;
  merged: PixelBuffer;
  pixelCount: number;
}

/**
 * Computes a Sel-Out (Selective Outline) pixel color derived from the average color
 * of adjacent opaque sprite pixels: darkened value, boosted saturation, and subtle
 * cool hue shift toward indigo/violet (240 deg) for authentic pixel-art outlines.
 */
export function computeSelOutColor(
  avgR: number,
  avgG: number,
  avgB: number,
  darkenAmount: number,
  hueShift: number,
): RGBA {
  const hsv = rgbToHsv(clampByte(avgR), clampByte(avgG), clampByte(avgB));
  const clampedDarken = Math.max(0.15, Math.min(0.9, darkenAmount));
  const clampedHueShift = Math.max(0, Math.min(1, hueShift));

  const nextV = Math.max(6, Math.round(hsv.v * (1 - clampedDarken)));
  const nextS = hsv.s > 3 ? Math.min(100, Math.round(hsv.s + 12 * clampedDarken)) : hsv.s;

  // Shortest angular step toward cool shadow hue (240°)
  let nextH = hsv.h;
  if (hsv.s > 5 && clampedHueShift > 0) {
    let diff = 240 - hsv.h;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    nextH = ((Math.round(hsv.h + diff * 0.25 * clampedHueShift) % 360) + 360) % 360;
  }

  const rgb = hsvToRgb(nextH, nextS, nextV);
  return { r: rgb.r, g: rgb.g, b: rgb.b, a: 255 };
}

/**
 * Generates a 1px exterior outline around opaque pixels in `source`.
 * Supports classic solid-color outlines (black or custom) and Selective Outlines (Sel-Out),
 * with 4-way or 8-way connectivity.
 */
export function computeAutoOutlineBuffer(
  source: PixelBuffer,
  options: Pick<AutoOutlineOptions, "mode" | "color" | "darkenAmount" | "hueShift" | "connectivity">,
): AutoOutlineResult {
  const { width, height } = source;
  const outlineOnly = new PixelBuffer(width, height);
  const merged = source.clone();
  const neighbors = options.connectivity === 8 ? NEIGHBORS_8 : NEIGHBORS_4;
  const solidPacked = packColor({ ...options.color, a: options.color.a || 255 });

  let pixelCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const currentPacked = source.getPacked(x, y);
      if (currentPacked !== TRANSPARENT_PACKED && unpackRGBA(currentPacked).a > 0) {
        continue;
      }

      let hitCount = 0;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;

      for (let i = 0; i < neighbors.length; i++) {
        const nx = x + neighbors[i]![0];
        const ny = y + neighbors[i]![1];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nPacked = source.getPacked(nx, ny);
        if (nPacked === TRANSPARENT_PACKED) continue;
        const nRgba = unpackRGBA(nPacked);
        if (nRgba.a === 0) continue;

        hitCount++;
        sumR += nRgba.r;
        sumG += nRgba.g;
        sumB += nRgba.b;
      }

      if (hitCount === 0) continue;

      const outPacked =
        options.mode === "solid"
          ? solidPacked
          : packColor(
              computeSelOutColor(
                sumR / hitCount,
                sumG / hitCount,
                sumB / hitCount,
                options.darkenAmount,
                options.hueShift,
              ),
            );

      outlineOnly.setPacked(x, y, outPacked);
      merged.setPacked(x, y, outPacked);
      pixelCount++;
    }
  }

  return { outlineOnly, merged, pixelCount };
}
