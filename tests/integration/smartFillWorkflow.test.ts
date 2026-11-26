import { describe, expect, it } from "vitest";
import { EditorApplicationService } from "@/services/EditorApplicationService";
import type { PointerInputEvent } from "@/core/contracts";

function ptr(x: number, y: number): PointerInputEvent {
  return {
    pixelX: x,
    pixelY: y,
    prevPixelX: null,
    prevPixelY: null,
    button: 0,
    buttons: 1,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  };
}

describe("Smart Color Fill & Material Fill workflow integration", () => {
  it("previews non-destructively, supports live tuning, cancels cleanly, applies with Undo/Redo, and syncs with Asset Context", () => {
    const service = new EditorApplicationService({}, 20, 20);
    const outlineColor = { r: 18, g: 20, b: 26, a: 255 };
    const woodBrown = { r: 132, g: 82, b: 48, a: 255 };

    // Draw closed outline box [2..17, 2..17]
    service.setPrimaryColor(outlineColor);
    service.setTool("rectangle");
    service.setShapeFillMode("outline");
    service.dispatchToolPointer("down", ptr(2, 2));
    service.dispatchToolPointer("move", ptr(17, 17));
    service.dispatchToolPointer("up", ptr(17, 17));

    const layer = service.document.getActiveLayer();
    const beforeFillSnapshot = new Uint8ClampedArray(layer.buffer.data);
    const undoCountBefore = service.history.undoCount;

    // Switch Asset Context to Tree and sync Smart Fill hints
    service.setAssetType("tree");
    service.syncSmartFillFromAssetContext();
    expect(service.getSmartFillConfig().distribution).toBe("organic-cluster");
    expect(service.getSmartFillConfig().materialId).toBe("foliage");

    // Now test Material Fill (Wood) on the tabletop box
    service.applyMaterialPresetToSmartFill("wood");
    service.setPrimaryColor(woodBrown);
    service.setTool("bucket");

    // Click inside box -> starts non-destructive preview
    service.dispatchToolPointer("down", ptr(9, 9));
    service.dispatchToolPointer("up", ptr(9, 9));

    expect(service.getSmartFillPreviewSummary().active).toBe(true);
    expect(service.getSmartFillPreviewSummary().pixelCount).toBe(14 * 14);
    // Original layer buffer MUST remain 100% unchanged during live preview
    expect(Array.from(layer.buffer.data)).toEqual(Array.from(beforeFillSnapshot));
    expect(service.history.undoCount).toBe(undoCountBefore);

    // Tune seed and variation live during preview
    const prevSeed = service.getSmartFillConfig().seed;
    const nextSeed = service.randomizeSmartFillSeed();
    expect(nextSeed).not.toBe(prevSeed);
    service.setSmartFillConfig({ textureIntensity: 0.7 });
    expect(Array.from(layer.buffer.data)).toEqual(Array.from(beforeFillSnapshot));

    // Cancel leaves pixels untouched
    service.cancelSmartFillPreview();
    expect(service.getSmartFillPreviewSummary().active).toBe(false);
    expect(Array.from(layer.buffer.data)).toEqual(Array.from(beforeFillSnapshot));

    // Start preview again and Apply
    service.dispatchToolPointer("down", ptr(9, 9));
    expect(service.applySmartFillPreview()).toBe(true);
    expect(service.getSmartFillPreviewSummary().active).toBe(false);
    expect(service.history.undoCount).toBe(undoCountBefore + 1);

    // Outline pixels remain untouched, interior is richly filled with > 2 shades
    expect(layer.buffer.getPixel(2, 2)).toEqual(outlineColor);
    expect(layer.buffer.getPixel(0, 0).a).toBe(0);
    const interiorShades = new Set<number>();
    for (let y = 3; y <= 16; y++) {
      for (let x = 3; x <= 16; x++) {
        const packed = layer.buffer.getPacked(x, y);
        expect(packed).not.toBe(0);
        interiorShades.add(packed);
      }
    }
    expect(interiorShades.size).toBeGreaterThanOrEqual(3);

    // Undo restores exact pre-fill buffer bit-for-bit
    expect(service.undo()).toBe(true);
    expect(Array.from(layer.buffer.data)).toEqual(Array.from(beforeFillSnapshot));

    // Redo re-applies the fill cleanly
    expect(service.redo()).toBe(true);
    expect(layer.buffer.getPacked(9, 9)).not.toBe(0);

    service.dispose();
  });
});
