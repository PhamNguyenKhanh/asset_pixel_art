import { describe, expect, it } from "vitest";
import { PixelBuffer } from "@/core/document/PixelBuffer";
import { createEmptyDirtyRect } from "@/core/canvas/dirtyRect";
import { packRGBA, TRANSPARENT_PACKED } from "@/core/image-processing/color";

describe("PixelBuffer", () => {
  it("creates an initialized transparent buffer and handles pixel get/set", () => {
    const buf = new PixelBuffer(16, 16);
    expect(buf.width).toBe(16);
    expect(buf.height).toBe(16);
    expect(buf.getPacked(0, 0)).toBe(TRANSPARENT_PACKED);

    const changed = buf.setPixel(3, 4, { r: 255, g: 128, b: 64, a: 200 });
    expect(changed).toBe(true);
    expect(buf.getPixel(3, 4)).toEqual({ r: 255, g: 128, b: 64, a: 200 });

    // Setting same color returns false
    expect(buf.setPixel(3, 4, { r: 255, g: 128, b: 64, a: 200 })).toBe(false);

    // Out-of-bounds operations are safe no-ops
    expect(buf.setPixel(-1, 0, { r: 10, g: 20, b: 30, a: 255 })).toBe(false);
    expect(buf.setPixel(16, 16, { r: 10, g: 20, b: 30, a: 255 })).toBe(false);
    expect(buf.getPacked(99, 99)).toBe(TRANSPARENT_PACKED);
  });

  it("extracts and restores rectangular pixel patches accurately", () => {
    const buf = new PixelBuffer(8, 8);
    buf.setPixel(2, 2, { r: 255, g: 0, b: 0, a: 255 });
    buf.setPixel(4, 3, { r: 0, g: 255, b: 0, a: 180 });

    const rect = { minX: 2, minY: 2, maxX: 4, maxY: 3 };
    const snapshot = buf.extractRect(rect);
    expect(snapshot.length).toBe(3 * 2 * 4);

    buf.clear();
    expect(buf.getPixel(2, 2).a).toBe(0);

    buf.writeRect(rect, snapshot);
    expect(buf.getPixel(2, 2)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    expect(buf.getPixel(4, 3)).toEqual({ r: 0, g: 255, b: 0, a: 180 });
    expect(buf.getPixel(0, 0).a).toBe(0);
  });

  it("stamps square brush footprints and expands dirty rect accurately", () => {
    const buf = new PixelBuffer(10, 10);
    const dirty = createEmptyDirtyRect();
    const color = packRGBA(10, 200, 150, 255);

    const mutated = buf.stampSquareBrush(5, 5, 3, color, dirty);
    expect(mutated).toBe(true);
    expect(dirty).toEqual({ minX: 4, minY: 4, maxX: 6, maxY: 6 });

    for (let y = 4; y <= 6; y++) {
      for (let x = 4; x <= 6; x++) {
        expect(buf.getPacked(x, y)).toBe(color);
      }
    }
    expect(buf.getPacked(3, 5)).toBe(TRANSPARENT_PACKED);
  });

  it("computes minimal diff rects between cloned buffers", () => {
    const a = new PixelBuffer(12, 12);
    const b = a.clone();
    expect(a.computeDiffRect(b)).toBeNull();

    b.setPixel(2, 7, { r: 100, g: 100, b: 100, a: 255 });
    b.setPixel(9, 3, { r: 50, g: 60, b: 70, a: 255 });
    expect(a.computeDiffRect(b)).toEqual({ minX: 2, minY: 3, maxX: 9, maxY: 7 });
  });
});
