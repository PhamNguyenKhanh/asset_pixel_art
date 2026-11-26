import { describe, expect, it } from "vitest";
import {
  getEllipsePoints,
  getLinePoints,
  getRectanglePoints,
} from "@/core/image-processing/shapes";
import {
  compositeLayers,
  cropBuffer,
  findContentBounds,
  flipBufferHorizontal,
  flipBufferVertical,
  resizeBufferCanvas,
  rotateBuffer90CCW,
  rotateBuffer90CW,
  scaleBufferNearestNeighbor,
  translateBuffer,
} from "@/core/image-processing/transforms";
import { PixelBuffer } from "@/core/document/PixelBuffer";
import { Layer } from "@/core/document/Layer";
import { packRGBA } from "@/core/image-processing/color";

describe("Shape algorithms", () => {
  it("constrains line angles when Shift is active", () => {
    const horizontal = getLinePoints(2, 5, 10, 6, true);
    expect(horizontal.every((p) => p.y === 5)).toBe(true);
    expect(horizontal[horizontal.length - 1]).toEqual({ x: 10, y: 5 });

    const diag = getLinePoints(0, 0, 5, 4, true);
    expect(diag[diag.length - 1]).toEqual({ x: 5, y: 5 });
  });

  it("generates outline and filled rectangles cleanly", () => {
    const outline = getRectanglePoints(1, 1, 4, 4, false);
    expect(outline.length).toBe(12); // 4x4 perimeter = 12 pixels
    expect(outline.some((p) => p.x === 2 && p.y === 2)).toBe(false);

    const filled = getRectanglePoints(1, 1, 4, 4, true);
    expect(filled.length).toBe(16);
    expect(filled.some((p) => p.x === 2 && p.y === 2)).toBe(true);
  });

  it("generates symmetric ellipses both outlined and filled", () => {
    const outline = getEllipsePoints(2, 2, 10, 8, false);
    expect(outline.length).toBeGreaterThan(12);
    // Center should be empty on outline
    expect(outline.some((p) => p.x === 6 && p.y === 5)).toBe(false);

    const filled = getEllipsePoints(2, 2, 10, 8, true);
    expect(filled.some((p) => p.x === 6 && p.y === 5)).toBe(true);
    expect(filled.length).toBeGreaterThan(outline.length);
  });
});

describe("PixelBuffer transforms & compositing", () => {
  it("flips horizontal and vertical both globally and inside a selection", () => {
    const buf = new PixelBuffer(4, 4);
    const red = packRGBA(255, 0, 0, 255);
    const blue = packRGBA(0, 0, 255, 255);
    buf.setPacked(0, 0, red);
    buf.setPacked(1, 1, blue);

    const flippedH = flipBufferHorizontal(buf);
    expect(flippedH.getPacked(3, 0)).toBe(red);
    expect(flippedH.getPacked(2, 1)).toBe(blue);

    const flippedV = flipBufferVertical(buf);
    expect(flippedV.getPacked(0, 3)).toBe(red);

    // Flip only top-left 2x2 selection
    const partialFlip = flipBufferHorizontal(buf, { x: 0, y: 0, width: 2, height: 2 });
    expect(partialFlip.getPacked(1, 0)).toBe(red);
    expect(partialFlip.getPacked(0, 1)).toBe(blue);
  });

  it("rotates non-square buffers 90 degrees CW and CCW accurately", () => {
    const buf = new PixelBuffer(3, 2);
    const marker = packRGBA(245, 166, 35, 255);
    buf.setPacked(0, 0, marker); // top-left

    const cw = rotateBuffer90CW(buf);
    expect(cw.width).toBe(2);
    expect(cw.height).toBe(3);
    expect(cw.getPacked(1, 0)).toBe(marker); // top-right

    const back = rotateBuffer90CCW(cw);
    expect(back.width).toBe(3);
    expect(back.height).toBe(2);
    expect(back.getPacked(0, 0)).toBe(marker);
  });

  it("translates, resizes with anchor, scales nearest-neighbor, crops, and finds bounds", () => {
    const buf = new PixelBuffer(4, 4);
    const white = packRGBA(255, 255, 255, 255);
    buf.setPacked(1, 1, white);

    const moved = translateBuffer(buf, 2, 1);
    expect(moved.getPacked(3, 2)).toBe(white);
    expect(moved.getPacked(1, 1)).toBe(0);

    const expanded = resizeBufferCanvas(buf, 8, 8, "center");
    expect(expanded.getPacked(3, 3)).toBe(white);

    const scaled = scaleBufferNearestNeighbor(buf, 8, 8);
    expect(scaled.getPacked(2, 2)).toBe(white);
    expect(scaled.getPacked(3, 3)).toBe(white);

    const bounds = findContentBounds(scaled);
    expect(bounds).toEqual({ x: 2, y: 2, width: 2, height: 2 });

    const cropped = cropBuffer(scaled, bounds!);
    expect(cropped.width).toBe(2);
    expect(cropped.height).toBe(2);
    expect(cropped.getPacked(0, 0)).toBe(white);
  });

  it("composites multiple layers honoring visibility and opacity", () => {
    const bottom = new Layer(2, 2, { name: "Bottom", opacity: 1 });
    bottom.buffer.setPixel(0, 0, { r: 0, g: 0, b: 255, a: 255 });

    const top = new Layer(2, 2, { name: "Top", opacity: 0.5 });
    top.buffer.setPixel(0, 0, { r: 255, g: 0, b: 0, a: 255 });

    const hidden = new Layer(2, 2, { name: "Hidden", visible: false, opacity: 1 });
    hidden.buffer.setPixel(0, 0, { r: 0, g: 255, b: 0, a: 255 });

    const result = compositeLayers([bottom, top, hidden], 2, 2);
    const px = result.getPixel(0, 0);
    expect(px.r).toBeGreaterThanOrEqual(127);
    expect(px.b).toBeGreaterThanOrEqual(127);
    expect(px.g).toBe(0);
    expect(px.a).toBe(255);
  });
});
