import { describe, expect, it } from "vitest";
import { PixelBuffer } from "@/core/document/PixelBuffer";
import { packRGBA } from "@/core/image-processing/color";
import { createDefaultLightingConfig } from "@/types/lighting";
import { applyDynamicLightingToBuffer } from "@/modules/lighting/lightingPipeline";
import { estimateSurfaceData } from "@/modules/lighting/surfaceEstimator";
import { computeShadowMap } from "@/modules/lighting/shadowSolver";

function avgLuminanceInBox(
  buf: PixelBuffer,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): number {
  let sum = 0;
  let count = 0;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = buf.getPixel(x, y);
      if (px.a === 0) continue;
      sum += 0.299 * px.r + 0.587 * px.g + 0.114 * px.b;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

describe("Dynamic Lighting & Shadow Engine", () => {
  const buildWoodenTabletop = () => {
    const buf = new PixelBuffer(24, 24);
    const wood = packRGBA(140, 88, 52, 255);
    for (let y = 4; y <= 19; y++) {
      for (let x = 4; x <= 19; x++) {
        buf.setPacked(x, y, wood);
      }
    }
    return buf;
  };

  it("shifts illuminated and shadowed sides cleanly when light moves from left to right without mutating source", () => {
    const source = buildWoodenTabletop();
    const originalBytes = new Uint8ClampedArray(source.data);

    const litLeft = new PixelBuffer(24, 24);
    const cfgLeft = {
      ...createDefaultLightingConfig(),
      enabled: true,
      lightX: -1.1,
      lightY: -0.4,
      intensity: 1.2,
      ambientLight: 0.28,
      shadowIntensity: 0.6,
    };
    applyDynamicLightingToBuffer(source, litLeft, cfgLeft);

    const leftLumWhenLeftLit = avgLuminanceInBox(litLeft, 4, 4, 9, 19);
    const rightLumWhenLeftLit = avgLuminanceInBox(litLeft, 14, 4, 19, 19);
    expect(leftLumWhenLeftLit).toBeGreaterThan(rightLumWhenLeftLit + 12);

    // Move light to right side -> bright & dark regions reverse accordingly
    const litRight = new PixelBuffer(24, 24);
    applyDynamicLightingToBuffer(source, litRight, {
      ...cfgLeft,
      lightX: 1.1,
      lightY: -0.4,
    });

    const leftLumWhenRightLit = avgLuminanceInBox(litRight, 4, 4, 9, 19);
    const rightLumWhenRightLit = avgLuminanceInBox(litRight, 14, 4, 19, 19);
    expect(rightLumWhenRightLit).toBeGreaterThan(leftLumWhenRightLit + 12);

    // Transparent pixels remain untouched & source buffer is 100% immutable
    expect(litLeft.getPixel(0, 0).a).toBe(0);
    expect(litRight.getPixel(23, 23).a).toBe(0);
    expect(Array.from(source.data)).toEqual(Array.from(originalBytes));
  });

  it("casts directional shadows behind raised height peaks and occlusion masks", () => {
    const source = buildWoodenTabletop();
    const heightMap = new Uint8Array(24 * 24).fill(128);
    // Raise a vertical pillar along x = 11..12
    for (let y = 6; y <= 17; y++) {
      heightMap[y * 24 + 11] = 255;
      heightMap[y * 24 + 12] = 255;
    }

    const surface = estimateSurfaceData(source, "planar-architectural", { heightMap });
    // Light from left (-1, 0, 0.35): right side of pillar (x=14) should cast shadow, left side (x=9) lit
    const shadowFromLeft = computeShadowMap(surface, source.data, {
      lightDirX: -0.94,
      lightDirY: 0,
      lightDirZ: 0.34,
      shadowLength: 0.8,
      shadowSoftness: 0.2,
    });

    expect(shadowFromLeft[12 * 24 + 14]!).toBeGreaterThan(shadowFromLeft[12 * 24 + 9]!);
  });

  it("copies source unchanged when disabled and supports normals/height/shadows preview modes", () => {
    const source = buildWoodenTabletop();
    const out = new PixelBuffer(24, 24);

    applyDynamicLightingToBuffer(source, out, {
      ...createDefaultLightingConfig(),
      enabled: false,
    });
    expect(Array.from(out.data)).toEqual(Array.from(source.data));

    for (const previewMode of ["normals", "height", "shadows"] as const) {
      applyDynamicLightingToBuffer(source, out, {
        ...createDefaultLightingConfig(),
        enabled: true,
        previewMode,
      });
      // Center opaque pixel is visible; corner transparent pixel remains transparent
      expect(out.getPixel(12, 12).a).toBe(255);
      expect(out.getPixel(0, 0).a).toBe(0);
    }
  });
});
