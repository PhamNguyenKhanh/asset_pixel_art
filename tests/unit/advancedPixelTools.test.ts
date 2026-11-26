import { describe, expect, it } from "vitest";
import { PixelBuffer } from "@/core/document/PixelBuffer";
import { packRGBA, unpackRGBA } from "@/core/image-processing/color";
import {
  expandSymmetryPoints,
  filterPixelPerfectStroke,
  wrapCoord,
} from "@/core/image-processing/symmetry";
import { computeAutoOutlineBuffer } from "@/core/image-processing/autoOutline";
import {
  countMatchingPixels,
  extractPaletteColors,
  replaceColorInBuffer,
} from "@/core/image-processing/colorReplace";
import { translateBufferWrapped } from "@/core/image-processing/transforms";
import { scanlineFloodFill } from "@/core/image-processing/floodFill";

describe("Symmetry, Pixel-Perfect & Seamless Tile algorithms", () => {
  it("wraps negative and overflowing coordinates properly", () => {
    expect(wrapCoord(-1, 16)).toBe(15);
    expect(wrapCoord(16, 16)).toBe(0);
    expect(wrapCoord(33, 16)).toBe(1);
    expect(wrapCoord(-17, 16)).toBe(15);
  });

  it("expands points across X, Y, and X+Y symmetry with deduplication", () => {
    const pts = expandSymmetryPoints(2, 3, 16, 16, { x: true, y: true }, false);
    expect(pts).toEqual([
      { x: 2, y: 3 },
      { x: 13, y: 3 },
      { x: 2, y: 12 },
      { x: 13, y: 12 },
    ]);

    // Center pixel on odd canvas should not duplicate
    const center = expandSymmetryPoints(4, 4, 9, 9, { x: true, y: true }, false);
    expect(center).toEqual([{ x: 4, y: 4 }]);
  });

  it("removes redundant L-corners in Pixel-Perfect stroke filtering", () => {
    const raw = [
      { x: 0, y: 0 },
      { x: 1, y: 0 }, // L-corner between (0,0) and (1,1)
      { x: 1, y: 1 },
      { x: 2, y: 1 }, // L-corner between (1,1) and (2,2)
      { x: 2, y: 2 },
    ];
    const clean = filterPixelPerfectStroke(raw);
    expect(clean).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
  });

  it("wraps pixels seamlessly in translateBufferWrapped and wrapped flood fill", () => {
    const buf = new PixelBuffer(8, 8);
    const red = packRGBA(220, 40, 40, 255);
    buf.setPacked(7, 7, red);

    const shifted = translateBufferWrapped(buf, 1, 1);
    expect(shifted.getPacked(0, 0)).toBe(red);
    expect(shifted.getPacked(7, 7)).toBe(0);

    // Flood fill across vertical barrier at x=3 should wrap around x=0 <-> x=7
    const tile = new PixelBuffer(8, 8);
    const wall = packRGBA(10, 10, 10, 255);
    const blue = packRGBA(40, 120, 240, 255);
    for (let y = 0; y < 8; y++) {
      tile.setPacked(3, y, wall);
    }
    const res = scanlineFloodFill(tile, 1, 1, blue, true);
    expect(res.changed).toBe(true);
    expect(tile.getPacked(0, 1)).toBe(blue);
    expect(tile.getPacked(7, 1)).toBe(blue);
    expect(tile.getPacked(3, 1)).toBe(wall);
  });
});

describe("Auto-Outline & Selective Outline (Sel-Out)", () => {
  it("generates 4-way and 8-way solid outlines around a 2x2 square", () => {
    const src = new PixelBuffer(8, 8);
    const gold = packRGBA(240, 190, 50, 255);
    const black = { r: 20, g: 22, b: 29, a: 255 };
    src.setPacked(3, 3, gold);
    src.setPacked(4, 3, gold);
    src.setPacked(3, 4, gold);
    src.setPacked(4, 4, gold);

    const out4 = computeAutoOutlineBuffer(src, {
      mode: "solid",
      color: black,
      darkenAmount: 0.5,
      hueShift: 0.4,
      connectivity: 4,
    });
    expect(out4.pixelCount).toBe(8);
    expect(out4.outlineOnly.getPacked(2, 2)).toBe(0); // diagonal excluded in 4-way
    expect(out4.outlineOnly.getPacked(3, 2)).toBe(packRGBA(20, 22, 29, 255));

    const out8 = computeAutoOutlineBuffer(src, {
      mode: "solid",
      color: black,
      darkenAmount: 0.5,
      hueShift: 0.4,
      connectivity: 8,
    });
    expect(out8.pixelCount).toBe(12);
    expect(out8.outlineOnly.getPacked(2, 2)).toBe(packRGBA(20, 22, 29, 255));
  });

  it("computes Sel-Out pixels darker than their adjacent colored pixels", () => {
    const src = new PixelBuffer(8, 8);
    const brightGreen = packRGBA(90, 210, 100, 255);
    src.setPacked(4, 4, brightGreen);

    const res = computeAutoOutlineBuffer(src, {
      mode: "sel-out",
      color: { r: 0, g: 0, b: 0, a: 255 },
      darkenAmount: 0.55,
      hueShift: 0.5,
      connectivity: 4,
    });

    expect(res.pixelCount).toBe(4);
    const borderRgba = unpackRGBA(res.outlineOnly.getPacked(4, 3));
    expect(borderRgba.a).toBe(255);
    expect(borderRgba.g).toBeLessThan(210);
    expect(borderRgba.g).toBeGreaterThan(20);
  });
});

describe("Color Replace / Recolor Swap", () => {
  it("extracts palette colors sorted by frequency and replaces colors with tolerance", () => {
    const buf = new PixelBuffer(4, 4);
    const red = { r: 220, g: 50, b: 50, a: 255 };
    const nearRed = { r: 215, g: 55, b: 52, a: 255 };
    const blue = { r: 40, g: 120, b: 240, a: 255 };

    buf.setPacked(0, 0, packRGBA(red.r, red.g, red.b, red.a));
    buf.setPacked(1, 0, packRGBA(red.r, red.g, red.b, red.a));
    buf.setPacked(2, 0, packRGBA(nearRed.r, nearRed.g, nearRed.b, nearRed.a));

    const palette = extractPaletteColors([buf]);
    expect(palette.length).toBe(2);
    expect(palette[0]!.count).toBe(2);

    expect(countMatchingPixels([buf], red, 0)).toBe(2);
    expect(countMatchingPixels([buf], red, 10)).toBe(3);

    const replaced = replaceColorInBuffer(buf, red, blue, 10);
    expect(replaced.replacedCount).toBe(3);
    expect(replaced.nextBuffer.getPacked(0, 0)).toBe(packRGBA(40, 120, 240, 255));
    expect(replaced.nextBuffer.getPacked(2, 0)).toBe(packRGBA(40, 120, 240, 255));
  });
});
