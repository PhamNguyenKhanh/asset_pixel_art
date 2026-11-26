import type { ITool, IToolContext, PointerInputEvent } from "@/core/contracts";
import { mergeDirtyRects } from "@/core/canvas/dirtyRect";
import { packColor } from "@/core/image-processing/color";
import { scanlineFloodFill } from "@/core/image-processing/floodFill";
import { expandSymmetryPoints, wrapCoord } from "@/core/image-processing/symmetry";
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

    const tileMode = ctx.getTileMode();
    const startX = tileMode ? wrapCoord(event.pixelX, layer.buffer.width) : event.pixelX;
    const startY = tileMode ? wrapCoord(event.pixelY, layer.buffer.height) : event.pixelY;
    if (!layer.buffer.isInBounds(startX, startY)) return;

    const color = event.button === 2 ? ctx.getSecondaryColor() : ctx.getPrimaryColor();
    const fillConfig = ctx.getSmartFillConfig();

    // Modes 2 & 3: Smart Color Fill / Material Fill -> Non-destructive Live Preview
    if (fillConfig.mode === "smart" || fillConfig.mode === "material") {
      ctx.startSmartFillPreview(startX, startY, color);
      return;
    }

    // Mode 1: Solid Fill -> Instant commit with Symmetry + Tile Wrap + minimal DirtyRect Undo
    const frame = ctx.document.getActiveFrame();
    const packed = packColor(color);
    const symmetry = ctx.getSymmetry();
    const seedPoints = expandSymmetryPoints(
      startX,
      startY,
      layer.buffer.width,
      layer.buffer.height,
      symmetry,
      tileMode,
    );

    const beforeClone = layer.buffer.clone();
    let mergedDirty: ReturnType<typeof mergeDirtyRects> | null = null;

    for (let i = 0; i < seedPoints.length; i++) {
      const seed = seedPoints[i]!;
      const result = scanlineFloodFill(layer.buffer, seed.x, seed.y, packed, tileMode);
      if (result.changed && result.dirtyRect) {
        mergedDirty = mergeDirtyRects(mergedDirty, result.dirtyRect);
      }
    }

    if (!mergedDirty) {
      return;
    }

    const beforePixels = beforeClone.extractRect(mergedDirty);
    const afterPixels = layer.buffer.extractRect(mergedDirty);

    const command = new PixelPatchCommand({
      name: "Bucket Fill",
      document: ctx.document,
      frameId: frame.id,
      layerId: layer.id,
      rect: mergedDirty,
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
    ctx.markDirty(mergedDirty);
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
