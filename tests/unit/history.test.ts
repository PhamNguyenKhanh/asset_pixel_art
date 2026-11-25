import { describe, expect, it } from "vitest";
import { PixelDocument } from "@/core/document/PixelDocument";
import { HistoryManager } from "@/core/history/HistoryManager";
import { PixelPatchCommand } from "@/core/history/PixelPatchCommand";
import { packRGBA } from "@/core/image-processing/color";

describe("HistoryManager & PixelPatchCommand", () => {
  it("executes, undoes, and redoes minimal pixel patches accurately", () => {
    const doc = new PixelDocument(16, 16);
    const history = new HistoryManager();
    const frame = doc.getActiveFrame();
    const layer = doc.getActiveLayer();

    const rect = { minX: 2, minY: 2, maxX: 3, maxY: 3 };
    const before = layer.buffer.extractRect(rect);

    layer.buffer.setPacked(2, 2, packRGBA(255, 0, 0, 255));
    layer.buffer.setPacked(3, 3, packRGBA(0, 255, 0, 255));
    const after = layer.buffer.extractRect(rect);

    history.pushExecuted(
      new PixelPatchCommand({
        name: "Test Patch",
        document: doc,
        frameId: frame.id,
        layerId: layer.id,
        rect,
        beforePixels: before,
        afterPixels: after,
      }),
    );

    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);

    history.undo();
    expect(layer.buffer.getPixel(2, 2).a).toBe(0);
    expect(layer.buffer.getPixel(3, 3).a).toBe(0);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);

    history.redo();
    expect(layer.buffer.getPixel(2, 2)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    expect(layer.buffer.getPixel(3, 3)).toEqual({ r: 0, g: 255, b: 0, a: 255 });
  });

  it("evicts oldest entries when exceeding maxEntries or memory budget", () => {
    const history = new HistoryManager({ maxEntries: 3, maxMemoryBytes: 1024 });
    let value = 0;

    for (let i = 1; i <= 5; i++) {
      const prev = value;
      const next = i;
      history.execute({
        name: `cmd-${i}`,
        byteSize: 200,
        execute: () => {
          value = next;
        },
        undo: () => {
          value = prev;
        },
      });
    }

    expect(history.undoCount).toBe(3);
    expect(value).toBe(5);

    // Pushing after undo clears redo stack
    history.undo();
    expect(history.canRedo).toBe(true);
    history.execute({
      name: "branch",
      byteSize: 100,
      execute: () => {
        value = 99;
      },
      undo: () => {
        value = 4;
      },
    });
    expect(history.canRedo).toBe(false);
  });
});
