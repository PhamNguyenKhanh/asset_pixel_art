import { describe, expect, it } from "vitest";
import { EditorApplicationService } from "@/services/EditorApplicationService";
import type { PointerInputEvent } from "@/core/contracts";

function ptr(
  x: number,
  y: number,
  prevX: number | null = null,
  prevY: number | null = null,
  opts: { button?: number; shiftKey?: boolean } = {},
): PointerInputEvent {
  return {
    pixelX: x,
    pixelY: y,
    prevPixelX: prevX,
    prevPixelY: prevY,
    button: opts.button ?? 0,
    buttons: opts.button === 2 ? 2 : 1,
    shiftKey: opts.shiftKey ?? false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  };
}

describe("Phase 2 End-to-End Engine Integration", () => {
  it("supports shapes, selection move/copy/paste, transforms, layers, animation, and undo/redo", () => {
    const service = new EditorApplicationService({}, 16, 16);
    const gold = { r: 245, g: 166, b: 35, a: 255 };
    const red = { r: 220, g: 50, b: 60, a: 255 };
    service.setPrimaryColor(gold);

    // 1. Filled rectangle tool
    service.setTool("rectangle");
    service.setShapeFillMode("filled");
    service.dispatchToolPointer("down", ptr(2, 2));
    service.dispatchToolPointer("move", ptr(5, 5, 2, 2));
    service.dispatchToolPointer("up", ptr(5, 5, 5, 5));
    expect(service.document.getActiveLayer().buffer.getPixel(3, 3)).toEqual(gold);

    // 2. Select (2,2)-(5,5), drag-move by (+4, +2)
    service.setTool("select");
    service.dispatchToolPointer("down", ptr(2, 2));
    service.dispatchToolPointer("move", ptr(5, 5, 2, 2));
    service.dispatchToolPointer("up", ptr(5, 5, 5, 5));
    expect(service.getSelection()).toEqual({ x: 2, y: 2, width: 4, height: 4 });

    // Drag inside selection to move it
    service.dispatchToolPointer("down", ptr(3, 3));
    service.dispatchToolPointer("move", ptr(7, 5, 3, 3));
    service.dispatchToolPointer("up", ptr(7, 5, 7, 5));
    expect(service.document.getActiveLayer().buffer.getPixel(3, 3).a).toBe(0);
    expect(service.document.getActiveLayer().buffer.getPixel(7, 5)).toEqual(gold);

    // 3. Copy & Paste + Trim
    expect(service.copySelection()).toBe(true);
    service.clearSelection();
    expect(service.pasteClipboard()).toBe(true);
    expect(service.document.getActiveLayer().buffer.getPixel(0, 0)).toEqual(gold);

    // 4. Add Layer 2, draw red line, merge down, then Undo back to 2 layers
    service.addLayer("Overlay");
    expect(service.document.getActiveFrame().layers).toHaveLength(2);
    service.setPrimaryColor(red);
    service.setTool("line");
    service.dispatchToolPointer("down", ptr(0, 0));
    service.dispatchToolPointer("move", ptr(3, 0, 0, 0));
    service.dispatchToolPointer("up", ptr(3, 0, 3, 0));
    expect(service.document.getActiveLayer().buffer.getPixel(2, 0)).toEqual(red);

    const activeLayerId = service.document.activeLayerId;
    expect(service.mergeLayerDown(activeLayerId)).toBe(true);
    expect(service.document.getActiveFrame().layers).toHaveLength(1);
    expect(service.document.getActiveLayer().buffer.getPixel(2, 0)).toEqual(red);

    // Undo merge restores 2 separate layers cleanly
    expect(service.undo()).toBe(true);
    expect(service.document.getActiveFrame().layers).toHaveLength(2);

    // 5. Resize canvas & rotate 90 CW, then undo both
    expect(service.resizeCanvas(24, 16, "canvas", "top-left")).toBe(true);
    expect(service.document.width).toBe(24);
    expect(service.document.height).toBe(16);

    expect(service.rotate90("cw")).toBe(true);
    expect(service.document.width).toBe(16);
    expect(service.document.height).toBe(24);

    service.undo();
    expect(service.document.width).toBe(24);
    service.undo();
    expect(service.document.width).toBe(16);
    expect(service.document.height).toBe(16);

    // 6. Add & duplicate frames + Onion Skin
    service.addFrame();
    service.duplicateFrame(1);
    expect(service.document.frames).toHaveLength(3);
    service.setOnionSkin({ enabled: true });
    expect(service.document.onionSkin.enabled).toBe(true);

    service.dispose();
  });
});
