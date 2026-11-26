import type { SelectionRect } from "@/types/editor";
import type { ITool, IToolContext, PointerInputEvent } from "@/core/contracts";
import { PixelBuffer } from "@/core/document/PixelBuffer";
import { TRANSPARENT_PACKED } from "@/core/image-processing/color";
import { clampSelectionRect, translateBuffer } from "@/core/image-processing/transforms";
import { PixelPatchCommand } from "@/core/history/PixelPatchCommand";

/**
 * Move Tool: drags either the active Selection region or the entire active Layer
 * with live non-destructive preview and a minimal DirtyRect Undo command on release.
 */
export class MoveTool implements ITool {
  readonly id = "move" as const;
  readonly label = "Move";
  readonly shortcut = "V";
  readonly cursor = "move";

  private active = false;
  private startX = 0;
  private startY = 0;
  private originalBuffer: PixelBuffer | null = null;
  private selectionRect: SelectionRect | null = null;
  private floatingSelection: PixelBuffer | null = null;
  private baseWithoutSelection: PixelBuffer | null = null;
  private previewBuffer: PixelBuffer | null = null;

  onPointerDown(event: PointerInputEvent, ctx: IToolContext): void {
    const layer = ctx.document.getActiveLayer();
    if (layer.locked || !layer.visible) return;

    this.active = true;
    this.startX = event.pixelX;
    this.startY = event.pixelY;
    this.originalBuffer = layer.buffer.clone();

    const sel = ctx.getSelection();
    const clampedSel = sel
      ? clampSelectionRect(sel, ctx.document.width, ctx.document.height)
      : null;

    if (clampedSel) {
      this.selectionRect = clampedSel;
      const floating = new PixelBuffer(clampedSel.width, clampedSel.height);
      const base = layer.buffer.clone();
      for (let row = 0; row < clampedSel.height; row++) {
        for (let col = 0; col < clampedSel.width; col++) {
          const sx = clampedSel.x + col;
          const sy = clampedSel.y + row;
          floating.setPacked(col, row, layer.buffer.getPacked(sx, sy));
          base.setPacked(sx, sy, TRANSPARENT_PACKED);
        }
      }
      this.floatingSelection = floating;
      this.baseWithoutSelection = base;
    } else {
      this.selectionRect = null;
      this.floatingSelection = null;
      this.baseWithoutSelection = null;
    }
    this.previewBuffer = layer.buffer.clone();
  }

  onPointerMove(event: PointerInputEvent, ctx: IToolContext): void {
    if (!this.active) return;
    const dx = event.pixelX - this.startX;
    const dy = event.pixelY - this.startY;
    this.buildPreview(dx, dy);
    if (this.previewBuffer) {
      ctx.setPreviewBuffer(this.previewBuffer, true);
    }
    if (this.selectionRect) {
      ctx.setSelection({
        x: this.selectionRect.x + dx,
        y: this.selectionRect.y + dy,
        width: this.selectionRect.width,
        height: this.selectionRect.height,
      });
    }
  }

  onPointerUp(event: PointerInputEvent, ctx: IToolContext): void {
    if (!this.active) return;
    const dx = event.pixelX - this.startX;
    const dy = event.pixelY - this.startY;

    ctx.setPreviewBuffer(null);

    if ((dx !== 0 || dy !== 0) && this.originalBuffer) {
      this.buildPreview(dx, dy);
      if (this.previewBuffer) {
        const frame = ctx.document.getActiveFrame();
        const layer = ctx.document.getActiveLayer();
        const diffRect = layer.buffer.computeDiffRect(this.previewBuffer);

        if (diffRect) {
          const beforePixels = layer.buffer.extractRect(diffRect);
          const afterPixels = this.previewBuffer.extractRect(diffRect);
          layer.buffer.writeRect(diffRect, afterPixels);

          ctx.history.pushExecuted(
            new PixelPatchCommand({
              name: this.selectionRect ? "Move Selection" : "Move Layer",
              document: ctx.document,
              frameId: frame.id,
              layerId: layer.id,
              rect: diffRect,
              beforePixels,
              afterPixels,
              onApplied: (rect) => {
                ctx.markDirty(rect);
                ctx.notifyDocumentChanged();
              },
            }),
          );
          ctx.markDirty(diffRect);
          ctx.notifyDocumentChanged();
        }
      }

      if (this.selectionRect) {
        ctx.setSelection(
          clampSelectionRect(
            {
              x: this.selectionRect.x + dx,
              y: this.selectionRect.y + dy,
              width: this.selectionRect.width,
              height: this.selectionRect.height,
            },
            ctx.document.width,
            ctx.document.height,
          ),
        );
      }
    }

    this.reset();
  }

  onCancel(ctx: IToolContext): void {
    if (!this.active) return;
    ctx.setPreviewBuffer(null);
    if (this.selectionRect) {
      ctx.setSelection(this.selectionRect);
    }
    this.reset();
  }

  private buildPreview(dx: number, dy: number): void {
    if (!this.originalBuffer) return;

    if (this.selectionRect && this.floatingSelection && this.baseWithoutSelection) {
      const next = this.baseWithoutSelection.clone();
      const destX = this.selectionRect.x + dx;
      const destY = this.selectionRect.y + dy;
      for (let row = 0; row < this.floatingSelection.height; row++) {
        for (let col = 0; col < this.floatingSelection.width; col++) {
          const packed = this.floatingSelection.getPacked(col, row);
          if (packed !== TRANSPARENT_PACKED) {
            next.setPacked(destX + col, destY + row, packed);
          }
        }
      }
      this.previewBuffer = next;
    } else {
      this.previewBuffer = translateBuffer(this.originalBuffer, dx, dy);
    }
  }

  private reset(): void {
    this.active = false;
    this.originalBuffer = null;
    this.selectionRect = null;
    this.floatingSelection = null;
    this.baseWithoutSelection = null;
    this.previewBuffer = null;
  }
}
