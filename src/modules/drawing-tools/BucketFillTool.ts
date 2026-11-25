import type { ITool, IToolContext, PointerInputEvent } from "@/core/contracts";
import { getDirtyRectSize } from "@/core/canvas/dirtyRect";
import { packColor, unpackRGBA } from "@/core/image-processing/color";
import { scanlineFloodFill } from "@/core/image-processing/floodFill";
import { PixelPatchCommand } from "@/core/history/PixelPatchCommand";

export class BucketFillTool implements ITool {
  readonly id = "bucket" as const;
  readonly label = "Bucket Fill";
  readonly shortcut = "B";
  readonly cursor = "crosshair";

  onPointerDown(event: PointerInputEvent, ctx: IToolContext): void {
    const layer = ctx.document.getActiveLayer();
    if (layer.locked || !layer.visible) return;

    const frame = ctx.document.getActiveFrame();
    const color = event.button === 2 ? ctx.getSecondaryColor() : ctx.getPrimaryColor();
    const packed = packColor(color);

    const result = scanlineFloodFill(layer.buffer, event.pixelX, event.pixelY, packed);
    if (!result.changed || !result.dirtyRect) {
      return;
    }

    const rect = result.dirtyRect;
    const afterPixels = layer.buffer.extractRect(rect);
    const beforePixels = new Uint8ClampedArray(afterPixels.length);
    beforePixels.set(afterPixels);

    // Restore original targetColor only along filled spans inside the dirty patch
    const { width: patchW } = getDirtyRectSize(rect);
    const prevRgba = unpackRGBA(result.targetColor);

    for (let i = 0; i < result.spans.length; i++) {
      const span = result.spans[i]!;
      const localY = span.y - rect.minY;
      for (let x = span.left; x <= span.right; x++) {
        const localX = x - rect.minX;
        const offset = (localY * patchW + localX) * 4;
        beforePixels[offset] = prevRgba.r;
        beforePixels[offset + 1] = prevRgba.g;
        beforePixels[offset + 2] = prevRgba.b;
        beforePixels[offset + 3] = prevRgba.a;
      }
    }

    const command = new PixelPatchCommand({
      name: "Bucket Fill",
      document: ctx.document,
      frameId: frame.id,
      layerId: layer.id,
      rect,
      beforePixels,
      afterPixels,
      onApplied: (appliedRect) => {
        ctx.markDirty(appliedRect);
        ctx.notifyDocumentChanged();
      },
    });

    ctx.history.pushExecuted(command);
    if (color.a > 0) {
      ctx.recordRecentColor(color);
    }
    ctx.markDirty(rect);
    ctx.notifyDocumentChanged();
  }

  onPointerMove(_event: PointerInputEvent, _ctx: IToolContext): void {
    // Bucket fill executes on pointer down
  }

  onPointerUp(_event: PointerInputEvent, _ctx: IToolContext): void {
    // No-op
  }
}
