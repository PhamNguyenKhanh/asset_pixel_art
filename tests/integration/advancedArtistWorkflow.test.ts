import { describe, expect, it } from "vitest";
import { EditorApplicationService } from "@/services/EditorApplicationService";
import { packColor } from "@/core/image-processing/color";

function pointerEvent(
  pixelX: number,
  pixelY: number,
  prevPixelX: number | null = null,
  prevPixelY: number | null = null,
) {
  return {
    pixelX,
    pixelY,
    prevPixelX,
    prevPixelY,
    button: 0,
    buttons: 1,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  };
}

describe("Advanced Artist Tools Integration Workflow", () => {
  it("paints symmetrically across X and Y axes and undoes cleanly", () => {
    const service = new EditorApplicationService({}, 16, 16);
    const gold = { r: 245, g: 166, b: 35, a: 255 };
    const goldPacked = packColor(gold);
    service.setPrimaryColor(gold);
    service.setTool("pencil");
    service.setSymmetry({ x: true, y: true });

    service.dispatchToolPointer("down", pointerEvent(2, 3));
    service.dispatchToolPointer("up", pointerEvent(2, 3, 2, 3));

    const buf = service.document.getActiveLayer().buffer;
    expect(buf.getPacked(2, 3)).toBe(goldPacked);
    expect(buf.getPacked(13, 3)).toBe(goldPacked);
    expect(buf.getPacked(2, 12)).toBe(goldPacked);
    expect(buf.getPacked(13, 12)).toBe(goldPacked);

    expect(service.undo()).toBe(true);
    expect(buf.getPacked(2, 3)).toBe(0);
    expect(buf.getPacked(13, 12)).toBe(0);
    service.dispose();
  });

  it("removes L-corner pixels live during Pixel-Perfect 1px pencil stroke", () => {
    const service = new EditorApplicationService({}, 16, 16);
    const red = { r: 230, g: 60, b: 60, a: 255 };
    const redPacked = packColor(red);
    service.setPrimaryColor(red);
    service.setTool("pencil");
    service.setBrushSize(1);
    service.setPixelPerfect(true);

    service.dispatchToolPointer("down", pointerEvent(2, 2));
    service.dispatchToolPointer("move", pointerEvent(3, 2, 2, 2)); // potential L-corner
    service.dispatchToolPointer("move", pointerEvent(3, 3, 3, 2)); // confirms L-corner at (3,2)
    service.dispatchToolPointer("up", pointerEvent(3, 3, 3, 3));

    const buf = service.document.getActiveLayer().buffer;
    expect(buf.getPacked(2, 2)).toBe(redPacked);
    expect(buf.getPacked(3, 2)).toBe(0); // L-corner removed!
    expect(buf.getPacked(3, 3)).toBe(redPacked);
    service.dispose();
  });

  it("wraps strokes around edges in Seamless Tile Mode", () => {
    const service = new EditorApplicationService({}, 8, 8);
    const green = { r: 60, g: 200, b: 90, a: 255 };
    const greenPacked = packColor(green);
    service.setPrimaryColor(green);
    service.setTool("pencil");
    service.setTileMode(true);

    // Paint across right edge from x=7 to x=9 (wraps to x=0, x=1)
    service.dispatchToolPointer("down", pointerEvent(7, 4));
    service.dispatchToolPointer("move", pointerEvent(9, 4, 7, 4));
    service.dispatchToolPointer("up", pointerEvent(9, 4, 9, 4));

    const buf = service.document.getActiveLayer().buffer;
    expect(buf.getPacked(7, 4)).toBe(greenPacked);
    expect(buf.getPacked(0, 4)).toBe(greenPacked);
    expect(buf.getPacked(1, 4)).toBe(greenPacked);
    service.dispose();
  });

  it("applies Auto-Outline / Sel-Out onto a separate Outline layer across all frames with Undo", () => {
    const service = new EditorApplicationService({}, 12, 12);
    const blue = { r: 80, g: 150, b: 240, a: 255 };
    service.document.getActiveLayer().buffer.setPacked(5, 5, packColor(blue));
    service.addFrame();
    service.document.getActiveLayer().buffer.setPacked(6, 6, packColor(blue));

    const applied = service.applyAutoOutline({
      mode: "sel-out",
      color: { r: 20, g: 22, b: 29, a: 255 },
      darkenAmount: 0.55,
      hueShift: 0.5,
      connectivity: 4,
      scope: "all-frames",
      createSeparateLayer: true,
    });

    expect(applied).toBe(true);
    expect(service.document.frames[0]!.layers.length).toBe(2);
    const outlineLayerF0 = service.document.frames[0]!.layers.find((l) => l.name === "Outline")!;
    const outlineLayerF1 = service.document.frames[1]!.layers.find((l) => l.name === "Outline")!;
    expect(outlineLayerF0.buffer.getPacked(5, 4)).not.toBe(0);
    expect(outlineLayerF1.buffer.getPacked(6, 5)).not.toBe(0);

    // Single Undo removes the Outline layer across all frames
    expect(service.undo()).toBe(true);
    expect(service.document.frames[0]!.layers.length).toBe(1);
    service.dispose();
  });

  it("replaces colors across all frames with full Undo/Redo support", () => {
    const service = new EditorApplicationService({}, 8, 8);
    const red = { r: 220, g: 50, b: 50, a: 255 };
    const purple = { r: 150, g: 60, b: 220, a: 255 };
    const redPacked = packColor(red);
    const purplePacked = packColor(purple);

    service.document.getActiveLayer().buffer.setPacked(2, 2, redPacked);
    service.addFrame();
    service.document.getActiveLayer().buffer.setPacked(3, 3, redPacked);

    expect(service.countColorMatches(red, 0, "all-frames")).toBe(2);

    const replaced = service.replaceColor({
      sourceColor: red,
      targetColor: purple,
      tolerance: 0,
      scope: "all-frames",
    });
    expect(replaced).toBe(2);
    expect(service.document.frames[0]!.layers[0]!.buffer.getPacked(2, 2)).toBe(purplePacked);
    expect(service.document.frames[1]!.layers[0]!.buffer.getPacked(3, 3)).toBe(purplePacked);

    expect(service.undo()).toBe(true);
    expect(service.document.frames[0]!.layers[0]!.buffer.getPacked(2, 2)).toBe(redPacked);
    expect(service.document.frames[1]!.layers[0]!.buffer.getPacked(3, 3)).toBe(redPacked);
    service.dispose();
  });
});
