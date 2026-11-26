import { describe, expect, it } from "vitest";
import { PixelBuffer } from "@/core/document/PixelBuffer";
import { packRGBA, rgbToHsv, unpackRGBA } from "@/core/image-processing/color";
import { DEFAULT_SMART_FILL_CONFIG, type SmartFillConfig } from "@/types/smartFill";
import { computeSmartFill } from "@/modules/smart-fill/smartFillEngine";
import { analyzeFillRegion } from "@/modules/smart-fill/regionAnalyzer";

function drawClosedBox(
  buf: PixelBuffer,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  packedColor: number,
): void {
  for (let x = minX; x <= maxX; x++) {
    buf.setPacked(x, minY, packedColor);
    buf.setPacked(x, maxY, packedColor);
  }
  for (let y = minY; y <= maxY; y++) {
    buf.setPacked(minX, y, packedColor);
    buf.setPacked(maxX, y, packedColor);
  }
}

describe("Intelligent Color Fill engine", () => {
  const baseBrown = { r: 124, g: 75, b: 48, a: 255 }; // Wood tabletop brown

  it("is 100% deterministic for identical seed and changes output when seed changes", () => {
    const buf = new PixelBuffer(20, 20);
    const outline = packRGBA(20, 20, 24, 255);
    drawClosedBox(buf, 2, 2, 17, 17, outline);
    const snapshot = new Uint8ClampedArray(buf.data);

    const cfg: SmartFillConfig = {
      ...DEFAULT_SMART_FILL_CONFIG,
      mode: "smart",
      distribution: "grain-linear",
      seed: 4242,
    };

    const run1 = computeSmartFill(buf, 10, 10, baseBrown, cfg);
    const run2 = computeSmartFill(buf, 10, 10, baseBrown, cfg);
    const runDiffSeed = computeSmartFill(buf, 10, 10, baseBrown, { ...cfg, seed: 9999 });

    expect(run1.changed).toBe(true);
    expect(run1.previewBuffer).not.toBeNull();
    expect(Array.from(run1.previewBuffer!.data)).toEqual(Array.from(run2.previewBuffer!.data));
    expect(Array.from(run1.previewBuffer!.data)).not.toEqual(
      Array.from(runDiffSeed.previewBuffer!.data),
    );

    // Source buffer is never mutated
    expect(Array.from(buf.data)).toEqual(Array.from(snapshot));
  });

  it("generates controlled multi-tone variations close to base color without leaking past outlines", () => {
    const buf = new PixelBuffer(24, 24);
    const outline = packRGBA(15, 15, 20, 255);
    drawClosedBox(buf, 3, 3, 20, 20, outline);

    const res = computeSmartFill(buf, 10, 10, baseBrown, {
      ...DEFAULT_SMART_FILL_CONFIG,
      mode: "smart",
      distribution: "grain-linear",
      colorVariation: 0.3,
      brightnessVariation: 0.35,
      textureIntensity: 0.6,
      seed: 1337,
    });

    expect(res.changed).toBe(true);
    expect(res.dirtyRect).toEqual({ minX: 4, minY: 4, maxX: 19, maxY: 19 });
    const preview = res.previewBuffer!;

    // Exterior & outline positions stay empty in preview region buffer
    expect(preview.getPacked(3, 3)).toBe(0);
    expect(preview.getPacked(0, 0)).toBe(0);

    const uniqueColors = new Set<number>();
    const baseHue = rgbToHsv(baseBrown.r, baseBrown.g, baseBrown.b).h;

    for (let y = 4; y <= 19; y++) {
      for (let x = 4; x <= 19; x++) {
        const packed = preview.getPacked(x, y);
        expect(packed).not.toBe(0);
        uniqueColors.add(packed);
        const rgba = unpackRGBA(packed);
        expect(rgba.a).toBe(255);
        const hsv = rgbToHsv(rgba.r, rgba.g, rgba.b);
        const hueDist = Math.min(
          Math.abs(hsv.h - baseHue),
          360 - Math.abs(hsv.h - baseHue),
        );
        expect(hueDist).toBeLessThanOrEqual(45);
      }
    }

    // Richer than solid 1-color fill (at least 3 controlled shades)
    expect(uniqueColors.size).toBeGreaterThanOrEqual(3);
  });

  it("preserves transparency and original semi-transparent alpha when filling opaque shapes", () => {
    const buf = new PixelBuffer(12, 12);
    // Paint an opaque + semi-transparent shape in center surrounded by transparent pixels
    for (let y = 3; y <= 8; y++) {
      for (let x = 3; x <= 8; x++) {
        const alpha = x === 3 ? 160 : 255;
        buf.setPacked(x, y, packRGBA(100, 140, 90, alpha));
      }
    }

    const res = computeSmartFill(buf, 5, 5, { r: 80, g: 160, b: 85, a: 255 }, {
      ...DEFAULT_SMART_FILL_CONFIG,
      mode: "material",
      materialId: "foliage",
      distribution: "organic-cluster",
      tolerance: 100, // high tolerance should still never bleed into alpha=0
      preserveTransparency: true,
    });

    expect(res.changed).toBe(true);
    const preview = res.previewBuffer!;
    // Background transparent pixels remain untouched
    expect(preview.getPixel(0, 0).a).toBe(0);
    expect(preview.getPixel(2, 5).a).toBe(0);
    // Interior opaque pixels filled
    expect(preview.getPixel(5, 5).a).toBe(255);
  });

  it("computes accurate interior edge distance transform for region analysis", () => {
    const buf = new PixelBuffer(10, 10);
    const border = packRGBA(255, 255, 255, 255);
    drawClosedBox(buf, 1, 1, 8, 8, border); // interior is 6x6: [2..7, 2..7]

    const region = analyzeFillRegion(buf, 4, 4);
    expect(region).not.toBeNull();
    expect(region!.pixelCount).toBe(36);
    expect(region!.maxEdgeDistance).toBe(3); // center of 6x6 is 3 steps from border
  });
});
