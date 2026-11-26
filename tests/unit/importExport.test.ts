import { describe, expect, it } from "vitest";
import { PixelDocument } from "@/core/document/PixelDocument";
import * as FrameService from "@/modules/animation/FrameService";
import * as LayerService from "@/modules/layers/LayerService";
import { buildSpriteSheet } from "@/modules/import-export/spriteSheet";
import { decodeGif, encodeGif } from "@/modules/import-export/gifCodec";
import {
  deserializeProject,
  serializeProject,
} from "@/modules/import-export/projectCodec";

describe("Import/Export codecs", () => {
  it("builds horizontal, vertical, and grid sprite sheets with accurate JSON metadata", () => {
    const doc = new PixelDocument(4, 4, "Hero Run");
    doc.frames[0]!.layers[0]!.buffer.setPixel(0, 0, { r: 255, g: 0, b: 0, a: 255 });
    FrameService.addFrame(doc);
    doc.frames[1]!.layers[0]!.buffer.setPixel(1, 1, { r: 0, g: 255, b: 0, a: 255 });
    FrameService.addFrame(doc);
    doc.frames[2]!.layers[0]!.buffer.setPixel(2, 2, { r: 0, g: 0, b: 255, a: 255 });

    const horizontal = buildSpriteSheet(doc, {
      layout: "horizontal",
      padding: 2,
      scale: 2,
    });
    // 3 frames * 8px + 2 * 2px padding = 28px wide, 8px tall
    expect(horizontal.buffer.width).toBe(28);
    expect(horizontal.buffer.height).toBe(8);
    expect(horizontal.metadata.frames).toHaveLength(3);
    expect(horizontal.metadata.frames[1]!.frame).toEqual({ x: 10, y: 0, w: 8, h: 8 });
    // Frame 1 pixel (1,1) scaled 2x -> (10+2, 2)
    expect(horizontal.buffer.getPixel(12, 2)).toEqual({ r: 0, g: 255, b: 0, a: 255 });

    const grid = buildSpriteSheet(doc, { layout: "grid", columns: 2, padding: 0, scale: 1 });
    expect(grid.buffer.width).toBe(8);
    expect(grid.buffer.height).toBe(8);
    expect(grid.metadata.frames[2]!.frame).toEqual({ x: 0, y: 4, w: 4, h: 4 });
  });

  it("round-trips animated GIF encoding and decoding with transparency intact", () => {
    const doc = new PixelDocument(8, 8, "Blink");
    doc.frames[0]!.durationMs = 100;
    doc.frames[0]!.layers[0]!.buffer.setPixel(1, 1, { r: 245, g: 166, b: 35, a: 255 });

    FrameService.addFrame(doc);
    doc.frames[1]!.durationMs = 200;
    doc.frames[1]!.layers[0]!.buffer.setPixel(5, 5, { r: 78, g: 168, b: 222, a: 255 });

    const gifBytes = encodeGif(doc, { scale: 1, repeat: 0 });
    expect(gifBytes.length).toBeGreaterThan(20);
    // GIF89a header signature
    expect(String.fromCharCode(...gifBytes.subarray(0, 6))).toBe("GIF89a");

    const decoded = decodeGif(gifBytes);
    expect(decoded.width).toBe(8);
    expect(decoded.height).toBe(8);
    expect(decoded.frames).toHaveLength(2);
    expect(decoded.frames[0]!.durationMs).toBe(100);
    expect(decoded.frames[1]!.durationMs).toBe(200);
    expect(decoded.frames[0]!.buffer.getPixel(1, 1)).toEqual({ r: 245, g: 166, b: 35, a: 255 });
    expect(decoded.frames[0]!.buffer.getPixel(0, 0).a).toBe(0);
    expect(decoded.frames[1]!.buffer.getPixel(5, 5)).toEqual({ r: 78, g: 168, b: 222, a: 255 });
    expect(decoded.frames[1]!.buffer.getPixel(1, 1).a).toBe(0);
  });

  it("serializes and deserializes full multi-layer/multi-frame .pxs.json projects losslessly", () => {
    const doc = new PixelDocument(6, 6, "Knight");
    doc.setFps(12);
    LayerService.addLayer(doc, "Armor");
    FrameService.addFrame(doc);
    doc.frames[0]!.layers[0]!.buffer.setPixel(2, 3, { r: 10, g: 20, b: 30, a: 255 });
    doc.frames[1]!.layers[1]!.buffer.setPixel(4, 5, { r: 200, g: 150, b: 50, a: 180 });

    const serialized = serializeProject(doc, [
      { id: "p1", name: "Metals", colors: [{ r: 200, g: 200, b: 210, a: 255 }] },
    ]);
    const jsonRoundTrip = JSON.parse(JSON.stringify(serialized));
    const { document: restored, customPalettes } = deserializeProject(jsonRoundTrip);

    expect(restored.name).toBe("Knight");
    expect(restored.width).toBe(6);
    expect(restored.height).toBe(6);
    expect(restored.fps).toBe(12);
    expect(restored.frames).toHaveLength(2);
    expect(restored.frames[0]!.layers).toHaveLength(2);
    expect(restored.frames[0]!.layers[1]!.name).toBe("Armor");
    expect(restored.frames[0]!.layers[0]!.buffer.getPixel(2, 3)).toEqual({
      r: 10,
      g: 20,
      b: 30,
      a: 255,
    });
    expect(restored.frames[1]!.layers[1]!.buffer.getPixel(4, 5)).toEqual({
      r: 200,
      g: 150,
      b: 50,
      a: 180,
    });
    expect(customPalettes?.[0]?.name).toBe("Metals");
  });
});
