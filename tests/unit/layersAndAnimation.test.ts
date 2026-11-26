import { describe, expect, it } from "vitest";
import { PixelDocument } from "@/core/document/PixelDocument";
import * as LayerService from "@/modules/layers/LayerService";
import * as FrameService from "@/modules/animation/FrameService";

describe("LayerService & FrameService", () => {
  it("keeps layer stacks synchronized across multiple animation frames", () => {
    const doc = new PixelDocument(8, 8);
    FrameService.addFrame(doc);
    expect(doc.frames.length).toBe(2);

    const added = LayerService.addLayer(doc, "Highlights");
    expect(doc.frames[0]!.layers.length).toBe(2);
    expect(doc.frames[1]!.layers.length).toBe(2);
    expect(doc.frames[0]!.layers[1]!.id).toBe(added.id);
    expect(doc.frames[1]!.layers[1]!.name).toBe("Highlights");

    LayerService.renameLayer(doc, added.id, "Lighting");
    expect(doc.frames[0]!.layers[1]!.name).toBe("Lighting");
    expect(doc.frames[1]!.layers[1]!.name).toBe("Lighting");

    LayerService.setLayerOpacity(doc, added.id, 0.5);
    expect(doc.frames[0]!.layers[1]!.opacity).toBe(0.5);

    // Reorder layers across all frames
    expect(LayerService.reorderLayer(doc, 1, 0)).toBe(true);
    expect(doc.frames[0]!.layers[0]!.id).toBe(added.id);
    expect(doc.frames[1]!.layers[0]!.id).toBe(added.id);

    // Merge down composites pixel data and drops upper layer
    doc.frames[0]!.layers[0]!.buffer.setPixel(0, 0, { r: 0, g: 0, b: 255, a: 255 });
    doc.frames[0]!.layers[1]!.buffer.setPixel(1, 1, { r: 255, g: 0, b: 0, a: 255 });
    const upperId = doc.frames[0]!.layers[1]!.id;
    expect(LayerService.mergeLayerDown(doc, upperId)).toBe(true);
    expect(doc.frames[0]!.layers.length).toBe(1);
    expect(doc.frames[1]!.layers.length).toBe(1);
    expect(doc.frames[0]!.layers[0]!.buffer.getPixel(1, 1)).toEqual({
      r: 255,
      g: 0,
      b: 0,
      a: 255,
    });

    // Cannot delete the final remaining layer
    expect(LayerService.deleteLayer(doc, doc.frames[0]!.layers[0]!.id)).toBe(false);
  });

  it("duplicates, reorders, updates duration, and deletes frames safely", () => {
    const doc = new PixelDocument(8, 8);
    doc.frames[0]!.layers[0]!.buffer.setPixel(2, 2, { r: 245, g: 166, b: 35, a: 255 });

    const dup = FrameService.duplicateFrame(doc, 0);
    expect(dup).not.toBeNull();
    expect(doc.frames.length).toBe(2);
    expect(doc.frames[1]!.layers[0]!.buffer.getPixel(2, 2)).toEqual({
      r: 245,
      g: 166,
      b: 35,
      a: 255,
    });

    // Mutating duplicated frame does not mutate original frame
    doc.frames[1]!.layers[0]!.buffer.setPixel(2, 2, { r: 0, g: 255, b: 0, a: 255 });
    expect(doc.frames[0]!.layers[0]!.buffer.getPixel(2, 2).r).toBe(245);

    FrameService.setFrameDuration(doc, 1, 250);
    expect(doc.frames[1]!.durationMs).toBe(250);

    expect(FrameService.reorderFrame(doc, 1, 0)).toBe(true);
    expect(doc.frames[0]!.durationMs).toBe(250);

    expect(FrameService.deleteFrame(doc, 0)).toBe(true);
    expect(doc.frames.length).toBe(1);
    // Cannot delete last frame
    expect(FrameService.deleteFrame(doc, 0)).toBe(false);
  });
});
