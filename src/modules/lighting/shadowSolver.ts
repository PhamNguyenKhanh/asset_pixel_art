import type { EstimatedSurface } from "@/modules/lighting/surfaceEstimator";
import { bayerThreshold4x4 } from "@/core/image-processing/noise";

export interface ShadowSolveOptions {
  /** Normalized 3D vector pointing FROM pixel TOWARD the light source */
  lightDirX: number;
  lightDirY: number;
  lightDirZ: number;
  shadowLength: number; // 0..1
  shadowSoftness: number; // 0..1 (Pixel-art Bayer ordered dithering softness)
}

/**
 * Computes per-pixel shadow factor [0..1] (0 = fully lit, 1 = deep shadow) combining:
 * 1. 2D height-field short raymarching toward the directional light source (cast shadows)
 * 2. Simple 2D Ambient Occlusion (AO) in concave crevices & seams
 * 3. Optional user-painted Occlusion Mask
 * 4. Pixel-art-safe 4x4 Bayer ordered dithering for soft penumbra transitions (zero blur!)
 */
export function computeShadowMap(
  surface: EstimatedSurface,
  alphaData: Uint8ClampedArray,
  options: ShadowSolveOptions,
): Float32Array {
  const { width: w, height: h, heightMap, occlusionMap } = surface;
  const shadows = new Float32Array(w * h);

  // Horizontal 2D march vector pointing toward the light
  const horizLen = Math.hypot(options.lightDirX, options.lightDirY);
  const stepX = horizLen > 1e-4 ? options.lightDirX / horizLen : 0;
  const stepY = horizLen > 1e-4 ? options.lightDirY / horizLen : 0;

  // Vertical rise per horizontal pixel step (lower lightElevation => gentler slope => longer shadows)
  const zSlope = Math.max(0.035, (options.lightDirZ / Math.max(0.2, horizLen)) * 0.16);
  const maxDim = Math.max(w, h);
  const maxSteps = Math.max(
    2,
    Math.min(28, Math.round(options.shadowLength * Math.max(8, maxDim * 0.35))),
  );
  const softness = Math.max(0, Math.min(1, options.shadowSoftness));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (alphaData[idx * 4 + 3]! === 0) {
        shadows[idx] = 0;
        continue;
      }

      const h0 = heightMap[idx]!;

      // 1. Directional Height-Field Raymarching toward light
      let castShadow = 0;
      if (options.shadowLength > 0.02 && horizLen > 1e-4) {
        let rx = x + stepX;
        let ry = y + stepY;
        for (let s = 1; s <= maxSteps; s++) {
          const ix = Math.round(rx);
          const iy = Math.round(ry);
          if (ix < 0 || iy < 0 || ix >= w || iy >= h) break;

          const sampleIdx = iy * w + ix;
          const rayH = h0 + s * zSlope;
          const sampleH = heightMap[sampleIdx]!;
          const sampleOcc = occlusionMap[sampleIdx]!;

          // Either taller geometry or explicit user occluder casts a shadow onto (x, y)
          const occluderHeight = sampleH + sampleOcc * 0.45;
          if (occluderHeight > rayH + 0.03) {
            const excess = Math.min(1, (occluderHeight - rayH) * 2.8);
            const distFalloff = 1 - (s / (maxSteps + 1)) * 0.45;
            castShadow = Math.max(castShadow, excess * distFalloff);
            if (castShadow >= 0.95) break;
          }

          rx += stepX;
          ry += stepY;
        }
      }

      // 2. Simple 2D Ambient Occlusion (concavity check against 8 neighbors)
      let tallerSum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const nh = heightMap[ny * w + nx]!;
          if (nh > h0 + 0.04) {
            tallerSum += nh - h0;
          }
        }
      }
      const ao = Math.min(0.42, tallerSum * 0.35);

      // Combine cast shadow, AO, and direct user shadow mask
      const rawShadow = Math.min(1, Math.max(castShadow, occlusionMap[idx]! * 0.85) + ao * 0.65);

      // 3. Pixel-Art Ordered Dithering for Shadow Softness
      if (softness > 0.05 && rawShadow > 0.05 && rawShadow < 0.92) {
        const bayer = bayerThreshold4x4(x, y);
        // Quantize penumbra crisply using ordered Bayer pattern blended by softness
        const dithered = rawShadow > bayer ? Math.min(1, rawShadow + 0.2) : rawShadow * 0.35;
        shadows[idx] = rawShadow * (1 - softness) + dithered * softness;
      } else {
        shadows[idx] = rawShadow;
      }
    }
  }

  return shadows;
}
