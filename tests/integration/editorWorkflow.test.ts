import { describe, expect, it } from "vitest";
import { EditorApplicationService } from "@/services/EditorApplicationService";
import type { PointerInputEvent } from "@/core/contracts";

function makePointer(
  x: number,
  y: number,
  prevX: number | null = null,
  prevY: number | null = null,
  button = 0,
): PointerInputEvent {
  return {
    pixelX: x,
    pixelY: y,
    prevPixelX: prevX,
    prevPixelY: prevY,
    button,
    buttons: button === 2 ? 2 : 1,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  };
}

describe("EditorApplicationService integration workflow", () => {
  it("supports pencil stroke, eraser, bucket fill, eyedropper, and multi-step undo/redo", () => {
    const service = new EditorApplicationService({}, 16, 16);
    const orange = { r: 245, g: 166, b: 35, a: 255 };
    const cyan = { r: 78, g: 168, b: 222, a: 255 };
    const layer = () => service.document.getActiveLayer();

    service.setPrimaryColor(orange);
    service.setSecondaryColor(cyan);

    // 1. Draw diagonal line from (1,1) to (5,5) in one stroke -> single undo entry
    service.setTool("pencil");
    service.dispatchToolPointer("down", makePointer(1, 1));
    service.dispatchToolPointer("move", makePointer(5, 5, 1, 1));
    service.dispatchToolPointer("up", makePointer(5, 5, 5, 5));

    expect(service.history.undoCount).toBe(1);
    expect(layer().buffer.getPixel(1, 1)).toEqual(orange);
    expect(layer().buffer.getPixel(3, 3)).toEqual(orange);
    expect(layer().buffer.getPixel(5, 5)).toEqual(orange);

    // 2. Right-click pencil draws secondary color
    service.dispatchToolPointer("down", makePointer(10, 10, null, null, 2));
    service.dispatchToolPointer("up", makePointer(10, 10, 10, 10, 2));
    expect(layer().buffer.getPixel(10, 10)).toEqual(cyan);
    expect(service.history.undoCount).toBe(2);

    // 3. Eyedropper picks cyan into primary color
    service.setTool("eyedropper");
    service.dispatchToolPointer("down", makePointer(10, 10));
    service.dispatchToolPointer("up", makePointer(10, 10));
    expect(service.getPrimaryColor()).toEqual(cyan);

    // 4. Bucket fill empty background with cyan
    service.setTool("bucket");
    service.dispatchToolPointer("down", makePointer(0, 0));
    service.dispatchToolPointer("up", makePointer(0, 0));
    expect(layer().buffer.getPixel(0, 0)).toEqual(cyan);
    expect(layer().buffer.getPixel(3, 3)).toEqual(orange); // diagonal untouched
    expect(service.history.undoCount).toBe(3);

    // 5. Undo bucket fill restores transparency accurately while keeping diagonal
    expect(service.undo()).toBe(true);
    expect(layer().buffer.getPixel(0, 0).a).toBe(0);
    expect(layer().buffer.getPixel(3, 3)).toEqual(orange);

    // 6. Eraser removes (3,3) and can be undone
    service.setTool("eraser");
    service.dispatchToolPointer("down", makePointer(3, 3));
    service.dispatchToolPointer("up", makePointer(3, 3));
    expect(layer().buffer.getPixel(3, 3).a).toBe(0);

    service.undo();
    expect(layer().buffer.getPixel(3, 3)).toEqual(orange);

    // 7. Creating new canvas resets dimensions and clears history
    service.createNewCanvas(64, 48, "Hero Walk");
    expect(service.document.width).toBe(64);
    expect(service.document.height).toBe(48);
    expect(service.document.name).toBe("Hero Walk");
    expect(service.history.canUndo).toBe(false);
    expect(service.history.canRedo).toBe(false);

    service.dispose();
  });
});
