import { describe, expect, it } from "vitest";
import { ViewportTransform } from "@/core/canvas/ViewportTransform";
import { bresenhamLine } from "@/core/image-processing/bresenham";
import { PixelBuffer } from "@/core/document/PixelBuffer";
import { packRGBA } from "@/core/image-processing/color";
import { scanlineFloodFill } from "@/core/image-processing/floodFill";

describe("ViewportTransform", () => {
  it("maps screen and pixel coordinates consistently and preserves anchor on zoom", () => {
    const vp = new ViewportTransform();
    vp.fitToViewport(32, 32, 800, 600);

    const anchorScreenX = 420;
    const anchorScreenY = 310;
    const pixelBefore = vp.screenToPixel(anchorScreenX, anchorScreenY);

    vp.zoomByFactor(2, anchorScreenX, anchorScreenY);
    const pixelAfter = vp.screenToPixel(anchorScreenX, anchorScreenY);

    expect(pixelAfter).toEqual(pixelBefore);
  });

  it("applies pan offsets cleanly", () => {
    const vp = new ViewportTransform();
    vp.zoom = 10;
    vp.panX = 100;
    vp.panY = 50;
    expect(vp.screenToPixel(125, 85)).toEqual({ x: 2, y: 3 });

    vp.panBy(20, -10);
    expect(vp.pixelToScreen(0, 0)).toEqual({ x: 120, y: 40 });
  });
});

describe("bresenhamLine", () => {
  it("generates gap-free integer lines in any direction", () => {
    const diag = bresenhamLine(0, 0, 4, 4);
    expect(diag).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 4 },
    ]);

    const steep = bresenhamLine(5, 8, 2, 1);
    expect(steep[0]).toEqual({ x: 5, y: 8 });
    expect(steep[steep.length - 1]).toEqual({ x: 2, y: 1 });
    for (let i = 1; i < steep.length; i++) {
      const dx = Math.abs(steep[i]!.x - steep[i - 1]!.x);
      const dy = Math.abs(steep[i]!.y - steep[i - 1]!.y);
      expect(dx).toBeLessThanOrEqual(1);
      expect(dy).toBeLessThanOrEqual(1);
    }
  });
});

describe("scanlineFloodFill", () => {
  it("fills only the interior of an enclosed border without leaking", () => {
    const buf = new PixelBuffer(10, 10);
    const border = packRGBA(255, 255, 255, 255);
    const fill = packRGBA(245, 166, 35, 255);

    // Draw closed 6x6 box from (2,2) to (7,7)
    for (let i = 2; i <= 7; i++) {
      buf.setPacked(i, 2, border);
      buf.setPacked(i, 7, border);
      buf.setPacked(2, i, border);
      buf.setPacked(7, i, border);
    }

    const res = scanlineFloodFill(buf, 4, 4, fill);
    expect(res.changed).toBe(true);
    expect(res.filledCount).toBe(16); // 4x4 interior
    expect(res.dirtyRect).toEqual({ minX: 3, minY: 3, maxX: 6, maxY: 6 });

    // Border and exterior remain untouched
    expect(buf.getPacked(2, 2)).toBe(border);
    expect(buf.getPacked(0, 0)).toBe(0);
    expect(buf.getPacked(5, 5)).toBe(fill);
  });

  it("handles large 256x256 fill iteratively without stack overflow", () => {
    const buf = new PixelBuffer(256, 256);
    const fill = packRGBA(64, 180, 240, 255);
    const res = scanlineFloodFill(buf, 128, 128, fill);
    expect(res.changed).toBe(true);
    expect(res.filledCount).toBe(256 * 256);
    expect(buf.getPacked(0, 0)).toBe(fill);
    expect(buf.getPacked(255, 255)).toBe(fill);

    // Filling same color again is a no-op
    const repeat = scanlineFloodFill(buf, 128, 128, fill);
    expect(repeat.changed).toBe(false);
  });
});
