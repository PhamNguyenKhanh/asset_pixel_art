import type { DirtyRect, Point, RGBA } from "@/types/editor";
import type { ITool, IToolContext, PointerInputEvent } from "@/core/contracts";
import { PixelBuffer } from "@/core/document/PixelBuffer";
import {
  clampDirtyRect,
  createEmptyDirtyRect,
  expandDirtyRect,
} from "@/core/canvas/dirtyRect";
import { packColor } from "@/core/image-processing/color";
import { getSquareBrushOffsets } from "@/core/image-processing/bresenham";
import { PixelPatchCommand } from "@/core/history/PixelPatchCommand";

/**
 * Base class for drag-to-preview shape tools (Line, Rectangle, Ellipse).
 * Draws into a transient preview buffer during pointer drag and commits a single
 * minimal DirtyRect PixelPatchCommand on pointer up.
 */
export abstract class ShapeToolBase implements ITool {
  abstract readonly id: ITool["id"];
  abstract readonly label: string;
  abstract readonly shortcut: string;
  readonly cursor = "crosshair";

  private active = false;
  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private currentY = 0;
  private shiftHeld = false;
  private activeColor: RGBA = { r: 0, g: 0, b: 0, a: 255 };
  private activePacked = 0;
  private previewBuffer: PixelBuffer | null = null;

  protected abstract computeShapePoints(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    filled: boolean,
    constrain: boolean,
  ): Point[];

  protected abstract getCommandName(): string;

  protected supportsFillMode(): boolean {
    return true;
  }

  onPointerDown(event: PointerInputEvent, ctx: IToolContext): void {
    const layer = ctx.document.getActiveLayer();
    if (layer.locked || !layer.visible) return;

    this.active = true;
    this.startX = event.pixelX;
    this.startY = event.pixelY;
    this.currentX = event.pixelX;
    this.currentY = event.pixelY;
    this.shiftHeld = event.shiftKey;
    this.activeColor =
      event.button === 2 ? ctx.getSecondaryColor() : ctx.getPrimaryColor();
    this.activePacked = packColor(this.activeColor);
    this.previewBuffer = new PixelBuffer(ctx.document.width, ctx.document.height);

    this.renderPreview(ctx);
  }

  onPointerMove(event: PointerInputEvent, ctx: IToolContext): void {
    if (!this.active) return;
    this.currentX = event.pixelX;
    this.currentY = event.pixelY;
    this.shiftHeld = event.shiftKey;
    this.renderPreview(ctx);
  }

  onPointerUp(event: PointerInputEvent, ctx: IToolContext): void {
    if (!this.active) return;
    this.currentX = event.pixelX;
    this.currentY = event.pixelY;
    this.shiftHeld = event.shiftKey;

    const frame = ctx.document.getActiveFrame();
    const layer = ctx.document.getActiveLayer();
    const filled = this.supportsFillMode() && ctx.getShapeFillMode() === "filled";
    const points = this.computeShapePoints(
      this.startX,
      this.startY,
      this.currentX,
      this.currentY,
      filled,
      this.shiftHeld,
    );

    const offsets = filled ? [{ x: 0, y: 0 }] : getSquareBrushOffsets(ctx.getBrushSize());
    const dirty: DirtyRect = createEmptyDirtyRect();

    // Compute exact bounding dirty rect first
    for (let i = 0; i < points.length; i++) {
      const pt = points[i]!;
      for (let j = 0; j < offsets.length; j++) {
        const px = pt.x + offsets[j]!.x;
        const py = pt.y + offsets[j]!.y;
        if (layer.buffer.isInBounds(px, py)) {
          expandDirtyRect(dirty, px, py);
        }
      }
    }

    ctx.setPreviewBuffer(null);
    const clamped = clampDirtyRect(dirty, layer.buffer.width, layer.buffer.height);

    if (clamped) {
      const beforePixels = layer.buffer.extractRect(clamped);
      let mutated = false;
      for (let i = 0; i < points.length; i++) {
        const pt = points[i]!;
        for (let j = 0; j < offsets.length; j++) {
          const px = pt.x + offsets[j]!.x;
          const py = pt.y + offsets[j]!.y;
          if (layer.buffer.setPacked(px, py, this.activePacked)) {
            mutated = true;
          }
        }
      }

      if (mutated) {
        const afterPixels = layer.buffer.extractRect(clamped);
        ctx.history.pushExecuted(
          new PixelPatchCommand({
            name: this.getCommandName(),
            document: ctx.document,
            frameId: frame.id,
            layerId: layer.id,
            rect: clamped,
            beforePixels,
            afterPixels,
            onApplied: (rect) => {
              ctx.markDirty(rect);
              ctx.notifyDocumentChanged();
            },
          }),
        );
        if (this.activeColor.a > 0) {
          ctx.recordRecentColor(this.activeColor);
        }
        ctx.markDirty(clamped);
        ctx.notifyDocumentChanged();
      }
    }

    this.reset();
  }

  onCancel(ctx: IToolContext): void {
    if (!this.active) return;
    ctx.setPreviewBuffer(null);
    this.reset();
  }

  private renderPreview(ctx: IToolContext): void {
    if (!this.previewBuffer) return;
    this.previewBuffer.clear();

    const filled = this.supportsFillMode() && ctx.getShapeFillMode() === "filled";
    const points = this.computeShapePoints(
      this.startX,
      this.startY,
      this.currentX,
      this.currentY,
      filled,
      this.shiftHeld,
    );
    const brushSize = filled ? 1 : ctx.getBrushSize();

    for (let i = 0; i < points.length; i++) {
      const pt = points[i]!;
      this.previewBuffer.stampSquareBrush(pt.x, pt.y, brushSize, this.activePacked);
    }

    ctx.setPreviewBuffer(this.previewBuffer, false);
  }

  private reset(): void {
    this.active = false;
    this.previewBuffer = null;
  }
}
