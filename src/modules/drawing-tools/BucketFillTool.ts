import type { ITool, IToolContext, PointerInputEvent } from "@/core/contracts";
import { getDirtyRectSize } from "@/core/canvas/dirtyRect";
import { packColor, unpackRGBA } from "@/core/image-processing/color";
import { scanlineFloodFill } from "@/core/image-processing/floodFill";
import { PixelPatchCommand } from "@/core/history/PixelPatchCommand";

/**
 * Unified Bucket Fill Tool supporting all 3 modes:
 * - Solid Fill: instant Piskel-style single-color flood fill.
 * - Smart Color Fill: controlled spatially coherent color variation with Live Preview / Apply.
 * - Material Fill: structured pixel-art material fills (Wood, Stone, Grass, Foliage, Metal, Fabric, Skin) with Live Preview / Apply.
 */
export class BucketFillTool implements ITool {
  readonly id = "bucket" as const;
  readonly label = "Bucket Fill";
  readonly shortcut = "B";
  readonly cursor = "crosshair";

  onPointerDown(event: PointerInputEvent, ctx: IToolContext): void {
    const layer = ctx.document.getActiveLayer();
    if (layer.locked || !layer.visible) return;
    if (!layer.buffer.isInBounds(event.pixelX, event.pixelY)) return;

    const color = event.button === 2 ? ctx.getSecondaryColor() : ctx.getPrimaryColor();
    const fillConfig = ctx.getSmartFillConfig();

    // Modes 2 & 3: Smart Color Fill / Material Fill -> Non-destructive Live Preview
    if (fillConfig.mode === "smart" || fillConfig.mode === "material") {
      ctx.startSmartFillPreview(event.pixelX, event.pixelY, color);
      return;
    }

    // Mode 1: Solid Fill -> Instant commit with minimal DirtyRect Undo command
    const frame = ctx.document.getActiveFrame();
    const packed = packColor(color);
    const result = scanlineFloodFill(layer.buffer, event.pixelX, event.pixelY, packed);
    if (!result.changed || !result.dirtyRect) {
      return;
    }

    const rect = result.dirtyRect;
    const afterPixels = layer.buffer.extractRect(rect);
    const beforePixels = new Uint8ClampedArray(afterPixels.length);
    beforePixels.set(afterPixels);

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
    // Fill executes or previews on pointer down
  }

  onPointerUp(_event: PointerInputEvent, _ctx: IToolContext): void {
    // No-op
  }

  onCancel(ctx: IToolContext): void {
    ctx.cancelSmartFillPreview();
  }
}
