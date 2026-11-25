import type { DirtyRect, RGBA } from "@/types/editor";
import type { ITool, IToolContext, PointerInputEvent } from "@/core/contracts";
import {
  clampDirtyRect,
  createEmptyDirtyRect,
  expandDirtyRect,
  getDirtyRectSize,
  isValidDirtyRect,
} from "@/core/canvas/dirtyRect";
import { bresenhamLine, getSquareBrushOffsets } from "@/core/image-processing/bresenham";
import { PixelPatchCommand } from "@/core/history/PixelPatchCommand";
import { unpackRGBA } from "@/core/image-processing/color";

/**
 * Shared stroke lifecycle for brush-based tools (Pencil, Eraser).
 * Tracks original pixels in a sparse Map during a stroke so committing a
 * minimal DirtyRect PixelPatchCommand never requires cloning the full canvas.
 */
export abstract class StrokeToolBase implements ITool {
  abstract readonly id: ITool["id"];
  abstract readonly label: string;
  abstract readonly shortcut: string;
  abstract readonly cursor: string;

  private active = false;
  private activeFrameId: string | null = null;
  private activeLayerId: string | null = null;
  private activePackedColor = 0;
  private activeColorRgba: RGBA | null = null;
  private beforeMap = new Map<number, number>();
  private dirtyRect: DirtyRect = createEmptyDirtyRect();

  protected abstract resolveStrokeColor(
    event: PointerInputEvent,
    ctx: IToolContext,
  ): { packed: number; rgba: RGBA | null };

  protected abstract getCommandName(): string;

  onPointerDown(event: PointerInputEvent, ctx: IToolContext): void {
    const layer = ctx.document.getActiveLayer();
    if (layer.locked || !layer.visible) return;

    const frame = ctx.document.getActiveFrame();
    const resolved = this.resolveStrokeColor(event, ctx);

    this.active = true;
    this.activeFrameId = frame.id;
    this.activeLayerId = layer.id;
    this.activePackedColor = resolved.packed >>> 0;
    this.activeColorRgba = resolved.rgba;
    this.beforeMap.clear();
    this.dirtyRect = createEmptyDirtyRect();

    this.stampAt(event.pixelX, event.pixelY, ctx);
  }

  onPointerMove(event: PointerInputEvent, ctx: IToolContext): void {
    if (!this.active) return;

    const startX = event.prevPixelX ?? event.pixelX;
    const startY = event.prevPixelY ?? event.pixelY;
    const points = bresenhamLine(startX, startY, event.pixelX, event.pixelY);

    let mutated = false;
    for (let i = 0; i < points.length; i++) {
      const pt = points[i]!;
      if (this.stampAt(pt.x, pt.y, ctx, false)) {
        mutated = true;
      }
    }

    if (mutated && isValidDirtyRect(this.dirtyRect)) {
      ctx.markDirty(this.dirtyRect);
    }
  }

  onPointerUp(_event: PointerInputEvent, ctx: IToolContext): void {
    if (!this.active) return;
    this.commitStroke(ctx);
  }

  onCancel(ctx: IToolContext): void {
    if (!this.active) return;
    // Revert any transient stroke pixels on cancel
    if (this.activeFrameId && this.activeLayerId && this.beforeMap.size > 0) {
      const layer = ctx.document.getLayer(this.activeFrameId, this.activeLayerId);
      if (layer) {
        for (const [idx, prevPacked] of this.beforeMap.entries()) {
          layer.buffer.view32[idx] = prevPacked;
        }
        ctx.markDirty(isValidDirtyRect(this.dirtyRect) ? this.dirtyRect : undefined);
      }
    }
    this.resetState();
  }

  private stampAt(cx: number, cy: number, ctx: IToolContext, notifyImmediately = true): boolean {
    if (!this.activeFrameId || !this.activeLayerId) return false;
    const layer = ctx.document.getLayer(this.activeFrameId, this.activeLayerId);
    if (!layer) return false;

    const buffer = layer.buffer;
    const offsets = getSquareBrushOffsets(ctx.getBrushSize());
    let mutated = false;

    for (let i = 0; i < offsets.length; i++) {
      const off = offsets[i]!;
      const px = cx + off.x;
      const py = cy + off.y;
      if (!buffer.isInBounds(px, py)) continue;

      const idx = py * buffer.width + px;
      const current = buffer.view32[idx]!;
      if (current === this.activePackedColor) continue;

      if (!this.beforeMap.has(idx)) {
        this.beforeMap.set(idx, current);
      }
      buffer.view32[idx] = this.activePackedColor;
      expandDirtyRect(this.dirtyRect, px, py);
      mutated = true;
    }

    if (mutated && notifyImmediately) {
      ctx.markDirty(this.dirtyRect);
    }
    return mutated;
  }

  private commitStroke(ctx: IToolContext): void {
    if (!this.activeFrameId || !this.activeLayerId || this.beforeMap.size === 0) {
      this.resetState();
      return;
    }

    const layer = ctx.document.getLayer(this.activeFrameId, this.activeLayerId);
    const clampedRect = layer
      ? clampDirtyRect(this.dirtyRect, layer.buffer.width, layer.buffer.height)
      : null;

    if (!layer || !clampedRect) {
      this.resetState();
      return;
    }

    const afterPixels = layer.buffer.extractRect(clampedRect);
    const beforePixels = new Uint8ClampedArray(afterPixels.length);
    beforePixels.set(afterPixels);

    const { width: patchW } = getDirtyRectSize(clampedRect);
    const bufW = layer.buffer.width;

    for (const [idx, prevPacked] of this.beforeMap.entries()) {
      const x = idx % bufW;
      const y = (idx - x) / bufW;
      const localX = x - clampedRect.minX;
      const localY = y - clampedRect.minY;
      const patchOffset = (localY * patchW + localX) * 4;
      const prevRgba = unpackRGBA(prevPacked);
      beforePixels[patchOffset] = prevRgba.r;
      beforePixels[patchOffset + 1] = prevRgba.g;
      beforePixels[patchOffset + 2] = prevRgba.b;
      beforePixels[patchOffset + 3] = prevRgba.a;
    }

    const command = new PixelPatchCommand({
      name: this.getCommandName(),
      document: ctx.document,
      frameId: this.activeFrameId,
      layerId: this.activeLayerId,
      rect: clampedRect,
      beforePixels,
      afterPixels,
      onApplied: (rect) => {
        ctx.markDirty(rect);
        ctx.notifyDocumentChanged();
      },
    });

    ctx.history.pushExecuted(command);
    if (this.activeColorRgba && this.activeColorRgba.a > 0) {
      ctx.recordRecentColor(this.activeColorRgba);
    }
    ctx.notifyDocumentChanged();
    this.resetState();
  }

  private resetState(): void {
    this.active = false;
    this.activeFrameId = null;
    this.activeLayerId = null;
    this.activePackedColor = 0;
    this.activeColorRgba = null;
    this.beforeMap.clear();
    this.dirtyRect = createEmptyDirtyRect();
  }
}
