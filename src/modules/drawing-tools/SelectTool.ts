import type { SelectionRect } from "@/types/editor";
import type { ITool, IToolContext, PointerInputEvent } from "@/core/contracts";
import { PixelBuffer } from "@/core/document/PixelBuffer";
import { TRANSPARENT_PACKED } from "@/core/image-processing/color";
import { clampSelectionRect } from "@/core/image-processing/transforms";
import { PixelPatchCommand } from "@/core/history/PixelPatchCommand";

function isPointInsideSelection(x: number, y: number, rect: SelectionRect): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
}

/**
 * Rectangular Selection Tool.
 * - Drag outside selection to draw a new rectangular selection.
 * - Drag inside an existing selection to lift and move selected pixels with live preview.
 * - Click without dragging outside selection clears the selection.
 */
export class SelectTool implements ITool {
  readonly id = "select" as const;
  readonly label = "Select";
  readonly shortcut = "M";
  readonly cursor = "crosshair";

  private mode: "idle" | "selecting" | "moving" = "idle";
  private startX = 0;
  private startY = 0;
  private didDrag = false;

  // State when moving selected pixels
  private initialSelection: SelectionRect | null = null;
  private floatingPixels: PixelBuffer | null = null;
  private baseWithoutSelection: PixelBuffer | null = null;
  private previewBuffer: PixelBuffer | null = null;

  onPointerDown(event: PointerInputEvent, ctx: IToolContext): void {
    const existing = ctx.getSelection();
    const layer = ctx.document.getActiveLayer();

    if (
      existing &&
      !layer.locked &&
      layer.visible &&
      isPointInsideSelection(event.pixelX, event.pixelY, existing)
    ) {
      // Lift selection for live drag move
      const clamped = clampSelectionRect(existing, ctx.document.width, ctx.document.height);
      if (clamped) {
        this.mode = "moving";
        this.startX = event.pixelX;
        this.startY = event.pixelY;
        this.didDrag = false;
        this.initialSelection = clamped;

        const floating = new PixelBuffer(clamped.width, clamped.height);
        const base = layer.buffer.clone();
        for (let row = 0; row < clamped.height; row++) {
          for (let col = 0; col < clamped.width; col++) {
            const sx = clamped.x + col;
            const sy = clamped.y + row;
            floating.setPacked(col, row, layer.buffer.getPacked(sx, sy));
            base.setPacked(sx, sy, TRANSPARENT_PACKED);
          }
        }
        this.floatingPixels = floating;
        this.baseWithoutSelection = base;
        this.previewBuffer = layer.buffer.clone();
        return;
      }
    }

    this.mode = "selecting";
    this.startX = event.pixelX;
    this.startY = event.pixelY;
    this.didDrag = false;
  }

  onPointerMove(event: PointerInputEvent, ctx: IToolContext): void {
    if (this.mode === "idle") return;

    const dx = event.pixelX - this.startX;
    const dy = event.pixelY - this.startY;
    if (dx !== 0 || dy !== 0) {
      this.didDrag = true;
    }

    if (this.mode === "selecting") {
      const minX = Math.min(this.startX, event.pixelX);
      const minY = Math.min(this.startY, event.pixelY);
      const maxX = Math.max(this.startX, event.pixelX);
      const maxY = Math.max(this.startY, event.pixelY);
      const clamped = clampSelectionRect(
        { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
        ctx.document.width,
        ctx.document.height,
      );
      ctx.setSelection(clamped);
      return;
    }

    if (
      this.mode === "moving" &&
      this.initialSelection &&
      this.floatingPixels &&
      this.baseWithoutSelection &&
      this.previewBuffer
    ) {
      this.composeMovePreview(dx, dy);
      ctx.setPreviewBuffer(this.previewBuffer, true);
      ctx.setSelection({
        x: this.initialSelection.x + dx,
        y: this.initialSelection.y + dy,
        width: this.initialSelection.width,
        height: this.initialSelection.height,
      });
    }
  }

  onPointerUp(event: PointerInputEvent, ctx: IToolContext): void {
    if (this.mode === "selecting") {
      if (!this.didDrag) {
        ctx.setSelection(null);
      }
      this.reset();
      return;
    }

    if (
      this.mode === "moving" &&
      this.initialSelection &&
      this.floatingPixels &&
      this.baseWithoutSelection &&
      this.previewBuffer
    ) {
      const dx = event.pixelX - this.startX;
      const dy = event.pixelY - this.startY;
      ctx.setPreviewBuffer(null);

      if (dx !== 0 || dy !== 0) {
        this.composeMovePreview(dx, dy);
        const frame = ctx.document.getActiveFrame();
        const layer = ctx.document.getActiveLayer();
        const diffRect = layer.buffer.computeDiffRect(this.previewBuffer);

        if (diffRect) {
          const beforePixels = layer.buffer.extractRect(diffRect);
          const afterPixels = this.previewBuffer.extractRect(diffRect);
          layer.buffer.writeRect(diffRect, afterPixels);

          ctx.history.pushExecuted(
            new PixelPatchCommand({
              name: "Move Selection",
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

        const nextSel = clampSelectionRect(
          {
            x: this.initialSelection.x + dx,
            y: this.initialSelection.y + dy,
            width: this.initialSelection.width,
            height: this.initialSelection.height,
          },
          ctx.document.width,
          ctx.document.height,
        );
        ctx.setSelection(nextSel);
      }
    }

    this.reset();
  }

  onCancel(ctx: IToolContext): void {
    if (this.mode === "moving" && this.initialSelection) {
      ctx.setPreviewBuffer(null);
      ctx.setSelection(this.initialSelection);
    }
    this.reset();
  }

  private composeMovePreview(dx: number, dy: number): void {
    if (!this.initialSelection || !this.floatingPixels || !this.baseWithoutSelection || !this.previewBuffer) {
      return;
    }
    this.previewBuffer.data.set(this.baseWithoutSelection.data);
    const destX = this.initialSelection.x + dx;
    const destY = this.initialSelection.y + dy;

    for (let row = 0; row < this.floatingPixels.height; row++) {
      for (let col = 0; col < this.floatingPixels.width; col++) {
        const packed = this.floatingPixels.getPacked(col, row);
        if (packed !== TRANSPARENT_PACKED) {
          this.previewBuffer.setPacked(destX + col, destY + row, packed);
        }
      }
    }
  }

  private reset(): void {
    this.mode = "idle";
    this.didDrag = false;
    this.initialSelection = null;
    this.floatingPixels = null;
    this.baseWithoutSelection = null;
    this.previewBuffer = null;
  }
}
