import type { DirtyRect, Point, RGBA } from "@/types/editor";
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
import { expandSymmetryPoints, isPixelPerfectCorner } from "@/core/image-processing/symmetry";

/**
 * Shared stroke lifecycle for brush-based tools (Pencil, Eraser).
 * Supports Symmetry (X / Y), Seamless Tile Mode wrap-around, and Aseprite-style
 * live Pixel-Perfect Stroke (1px L-corner elimination) with minimal DirtyRect Undo commands.
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

  // Pixel-Perfect 1px stroke tracking
  private usePixelPerfect = false;
  private rawPath: Point[] = [];
  private strokeHitCounts = new Map<number, number>();

  protected abstract resolveStrokeColor(
    event: PointerInputEvent,
    ctx: IToolContext,
  ): { packed: number; rgba: RGBA | null };

  protected abstract getCommandName(): string;

  protected supportsPixelPerfect(): boolean {
    return false;
  }

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

    this.usePixelPerfect =
      this.supportsPixelPerfect() && ctx.getPixelPerfect() && ctx.getBrushSize() === 1;
    this.rawPath = [];
    this.strokeHitCounts.clear();

    if (this.usePixelPerfect) {
      this.appendPixelPerfectPoint(event.pixelX, event.pixelY, ctx, true);
    } else {
      this.stampAt(event.pixelX, event.pixelY, ctx);
    }
  }

  onPointerMove(event: PointerInputEvent, ctx: IToolContext): void {
    if (!this.active) return;

    const startX = event.prevPixelX ?? event.pixelX;
    const startY = event.prevPixelY ?? event.pixelY;
    const points = bresenhamLine(startX, startY, event.pixelX, event.pixelY);

    let mutated = false;
    for (let i = 0; i < points.length; i++) {
      const pt = points[i]!;
      const changed = this.usePixelPerfect
        ? this.appendPixelPerfectPoint(pt.x, pt.y, ctx, false)
        : this.stampAt(pt.x, pt.y, ctx, false);
      if (changed) {
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

  private appendPixelPerfectPoint(
    cx: number,
    cy: number,
    ctx: IToolContext,
    notifyImmediately: boolean,
  ): boolean {
    if (!this.activeFrameId || !this.activeLayerId) return false;
    const layer = ctx.document.getLayer(this.activeFrameId, this.activeLayerId);
    if (!layer) return false;

    const last = this.rawPath[this.rawPath.length - 1];
    if (last && last.x === cx && last.y === cy) {
      return false;
    }

    const buffer = layer.buffer;
    const symmetry = ctx.getSymmetry();
    const tileMode = ctx.getTileMode();
    let mutated = false;

    // Eliminate L-corner pixel b if (a, b, c) forms a 90-degree corner
    if (this.rawPath.length >= 2) {
      const a = this.rawPath[this.rawPath.length - 2]!;
      const b = this.rawPath[this.rawPath.length - 1]!;
      const c: Point = { x: cx, y: cy };
      if (isPixelPerfectCorner(a, b, c)) {
        this.rawPath.pop();
        if (tileMode || buffer.isInBounds(b.x, b.y)) {
          const bTargets = expandSymmetryPoints(
            b.x,
            b.y,
            buffer.width,
            buffer.height,
            symmetry,
            tileMode,
          );
          for (let i = 0; i < bTargets.length; i++) {
            const p = bTargets[i]!;
            if (!buffer.isInBounds(p.x, p.y)) continue;
            const idx = p.y * buffer.width + p.x;
            const nextCount = (this.strokeHitCounts.get(idx) ?? 1) - 1;
            if (nextCount <= 0) {
              this.strokeHitCounts.delete(idx);
              if (this.beforeMap.has(idx)) {
                buffer.view32[idx] = this.beforeMap.get(idx)!;
                expandDirtyRect(this.dirtyRect, p.x, p.y);
                mutated = true;
              }
            } else {
              this.strokeHitCounts.set(idx, nextCount);
            }
          }
        }
      }
    }

    this.rawPath.push({ x: cx, y: cy });

    if (tileMode || buffer.isInBounds(cx, cy)) {
      const targets = expandSymmetryPoints(
        cx,
        cy,
        buffer.width,
        buffer.height,
        symmetry,
        tileMode,
      );
      for (let i = 0; i < targets.length; i++) {
        const p = targets[i]!;
        if (!buffer.isInBounds(p.x, p.y)) continue;
        const idx = p.y * buffer.width + p.x;
        this.strokeHitCounts.set(idx, (this.strokeHitCounts.get(idx) ?? 0) + 1);
        const current = buffer.view32[idx]!;
        if (current !== this.activePackedColor) {
          if (!this.beforeMap.has(idx)) {
            this.beforeMap.set(idx, current);
          }
          buffer.view32[idx] = this.activePackedColor;
          expandDirtyRect(this.dirtyRect, p.x, p.y);
          mutated = true;
        }
      }
    }

    if (mutated && notifyImmediately && isValidDirtyRect(this.dirtyRect)) {
      ctx.markDirty(this.dirtyRect);
    }
    return mutated;
  }

  private stampAt(cx: number, cy: number, ctx: IToolContext, notifyImmediately = true): boolean {
    if (!this.activeFrameId || !this.activeLayerId) return false;
    const layer = ctx.document.getLayer(this.activeFrameId, this.activeLayerId);
    if (!layer) return false;

    const buffer = layer.buffer;
    const offsets = getSquareBrushOffsets(ctx.getBrushSize());
    const symmetry = ctx.getSymmetry();
    const tileMode = ctx.getTileMode();
    let mutated = false;

    for (let i = 0; i < offsets.length; i++) {
      const off = offsets[i]!;
      const px = cx + off.x;
      const py = cy + off.y;
      if (!tileMode && !buffer.isInBounds(px, py)) continue;

      const targets = expandSymmetryPoints(
        px,
        py,
        buffer.width,
        buffer.height,
        symmetry,
        tileMode,
      );

      for (let t = 0; t < targets.length; t++) {
        const pt = targets[t]!;
        if (!buffer.isInBounds(pt.x, pt.y)) continue;

        const idx = pt.y * buffer.width + pt.x;
        const current = buffer.view32[idx]!;
        if (current === this.activePackedColor) continue;

        if (!this.beforeMap.has(idx)) {
          this.beforeMap.set(idx, current);
        }
        buffer.view32[idx] = this.activePackedColor;
        expandDirtyRect(this.dirtyRect, pt.x, pt.y);
        mutated = true;
      }
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

    // Verify at least one pixel actually differs from its pre-stroke value
    let anyChanged = false;
    for (const [idx, prevPacked] of this.beforeMap.entries()) {
      if (layer.buffer.view32[idx] !== prevPacked) {
        anyChanged = true;
        break;
      }
    }
    if (!anyChanged) {
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
      if (
        x < clampedRect.minX ||
        x > clampedRect.maxX ||
        y < clampedRect.minY ||
        y > clampedRect.maxY
      ) {
        continue;
      }
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
    this.usePixelPerfect = false;
    this.rawPath = [];
    this.strokeHitCounts.clear();
  }
}
