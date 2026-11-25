import type { DirtyRect, Point, RGBA } from "@/types/editor";
import type { PixelDocument } from "@/core/document/PixelDocument";
import type { ViewportTransform } from "@/core/canvas/ViewportTransform";
import { clampDirtyRect, getDirtyRectSize, mergeDirtyRects } from "@/core/canvas/dirtyRect";
import { getSquareBrushOffsets } from "@/core/image-processing/bresenham";
import { rgbaToCss } from "@/core/image-processing/color";

export interface CursorOverlayState {
  pixel: Point | null;
  brushSize: number;
  color: RGBA | null;
  isEraser: boolean;
}

const GRID_MIN_ZOOM = 4;
const CHECKER_TILE_PX = 8;

/**
 * HTML5 Canvas 2D Rendering Engine.
 * - Offscreen canvas composites pixel art at native 1:1 resolution.
 * - Display canvas draws with imageSmoothingEnabled = false (crisp nearest-neighbor).
 * - Overlay canvas renders pixel grid & brush cursor without touching pixel data.
 * - Driven by dirty flags + requestAnimationFrame (0% idle CPU usage).
 */
export class RenderingEngine {
  private document: PixelDocument;
  private viewport: ViewportTransform;

  private displayCanvas: HTMLCanvasElement | null = null;
  private displayCtx: CanvasRenderingContext2D | null = null;
  private overlayCanvas: HTMLCanvasElement | null = null;
  private overlayCtx: CanvasRenderingContext2D | null = null;

  private compositeCanvas: HTMLCanvasElement | null = null;
  private compositeCtx: CanvasRenderingContext2D | null = null;
  private compositeImageData: ImageData | null = null;

  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;

  private showGrid = true;
  private cursorOverlay: CursorOverlayState = {
    pixel: null,
    brushSize: 1,
    color: null,
    isEraser: false,
  };

  private compositeDirty = true;
  private fullCompositeDirty = true;
  private pendingDirtyRect: DirtyRect | null = null;
  private viewportDirty = true;
  private overlayDirty = true;
  private rafId: number | null = null;

  constructor(document: PixelDocument, viewport: ViewportTransform) {
    this.document = document;
    this.viewport = viewport;
  }

  attach(displayCanvas: HTMLCanvasElement, overlayCanvas: HTMLCanvasElement): void {
    this.displayCanvas = displayCanvas;
    this.displayCtx = displayCanvas.getContext("2d", { alpha: true });
    this.overlayCanvas = overlayCanvas;
    this.overlayCtx = overlayCanvas.getContext("2d", { alpha: true });

    if (typeof window !== "undefined") {
      this.compositeCanvas = window.document.createElement("canvas");
      this.compositeCtx = this.compositeCanvas.getContext("2d");
      this.syncCompositeSurfaceSize();
    }

    this.markAllDirty();
  }

  detach(): void {
    if (this.rafId !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.displayCanvas = null;
    this.displayCtx = null;
    this.overlayCanvas = null;
    this.overlayCtx = null;
    this.compositeCanvas = null;
    this.compositeCtx = null;
    this.compositeImageData = null;
  }

  setDocument(document: PixelDocument): void {
    this.document = document;
    this.syncCompositeSurfaceSize();
    this.markAllDirty();
  }

  resizeViewport(cssWidth: number, cssHeight: number, dpr = 1): void {
    const nextW = Math.max(1, Math.floor(cssWidth));
    const nextH = Math.max(1, Math.floor(cssHeight));
    const nextDpr = Math.max(1, dpr);

    if (nextW === this.cssWidth && nextH === this.cssHeight && nextDpr === this.dpr) {
      return;
    }

    this.cssWidth = nextW;
    this.cssHeight = nextH;
    this.dpr = nextDpr;

    const physW = Math.round(nextW * nextDpr);
    const physH = Math.round(nextH * nextDpr);

    if (this.displayCanvas) {
      this.displayCanvas.width = physW;
      this.displayCanvas.height = physH;
    }
    if (this.overlayCanvas) {
      this.overlayCanvas.width = physW;
      this.overlayCanvas.height = physH;
    }

    this.markViewportDirty();
    this.markOverlayDirty();
  }

  setShowGrid(show: boolean): void {
    if (this.showGrid === show) return;
    this.showGrid = show;
    this.markOverlayDirty();
  }

  setCursorOverlay(state: CursorOverlayState): void {
    this.cursorOverlay = state;
    this.markOverlayDirty();
  }

  markPixelsDirty(rect?: DirtyRect): void {
    this.compositeDirty = true;
    this.viewportDirty = true;
    if (rect && !this.fullCompositeDirty) {
      this.pendingDirtyRect = mergeDirtyRects(this.pendingDirtyRect, rect);
    } else {
      this.fullCompositeDirty = true;
      this.pendingDirtyRect = null;
    }
    this.scheduleRender();
  }

  markViewportDirty(): void {
    this.viewportDirty = true;
    this.overlayDirty = true;
    this.scheduleRender();
  }

  markOverlayDirty(): void {
    this.overlayDirty = true;
    this.scheduleRender();
  }

  markAllDirty(): void {
    this.compositeDirty = true;
    this.fullCompositeDirty = true;
    this.pendingDirtyRect = null;
    this.viewportDirty = true;
    this.overlayDirty = true;
    this.scheduleRender();
  }

  renderNow(): void {
    if (this.rafId !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.flush();
  }

  private scheduleRender(): void {
    if (this.rafId !== null || typeof window === "undefined") return;
    this.rafId = window.requestAnimationFrame(() => {
      this.rafId = null;
      this.flush();
    });
  }

  private syncCompositeSurfaceSize(): void {
    if (!this.compositeCanvas || !this.compositeCtx) return;
    if (
      this.compositeCanvas.width !== this.document.width ||
      this.compositeCanvas.height !== this.document.height
    ) {
      this.compositeCanvas.width = this.document.width;
      this.compositeCanvas.height = this.document.height;
      this.compositeImageData = this.compositeCtx.createImageData(
        this.document.width,
        this.document.height,
      );
    } else if (!this.compositeImageData) {
      this.compositeImageData = this.compositeCtx.createImageData(
        this.document.width,
        this.document.height,
      );
    }
  }

  private flush(): void {
    if (!this.displayCtx || !this.overlayCtx) return;

    if (this.compositeDirty) {
      this.updateCompositeSurface();
      this.compositeDirty = false;
      this.fullCompositeDirty = false;
      this.pendingDirtyRect = null;
    }

    if (this.viewportDirty) {
      this.renderDisplayCanvas();
      this.viewportDirty = false;
    }

    if (this.overlayDirty) {
      this.renderOverlayCanvas();
      this.overlayDirty = false;
    }
  }

  private updateCompositeSurface(): void {
    this.syncCompositeSurfaceSize();
    if (!this.compositeCtx || !this.compositeImageData) return;

    const frame = this.document.getActiveFrame();
    const out = this.compositeImageData.data;
    const pixelCount = this.document.width * this.document.height;

    // Fast path: single visible full-opacity layer (standard Phase 1 case)
    const visibleLayers = frame.layers.filter((l) => l.visible && l.opacity > 0);
    if (visibleLayers.length === 0) {
      out.fill(0);
      this.compositeCtx.putImageData(this.compositeImageData, 0, 0);
      return;
    }

    if (visibleLayers.length === 1 && visibleLayers[0]!.opacity >= 1) {
      const src = visibleLayers[0]!.buffer.data;
      const dirty =
        !this.fullCompositeDirty && this.pendingDirtyRect
          ? clampDirtyRect(this.pendingDirtyRect, this.document.width, this.document.height)
          : null;

      if (dirty) {
        const { width: rw, height: rh } = getDirtyRectSize(dirty);
        const rowBytes = rw * 4;
        for (let row = 0; row < rh; row++) {
          const offset = ((dirty.minY + row) * this.document.width + dirty.minX) * 4;
          out.set(src.subarray(offset, offset + rowBytes), offset);
        }
        this.compositeCtx.putImageData(
          this.compositeImageData,
          0,
          0,
          dirty.minX,
          dirty.minY,
          rw,
          rh,
        );
      } else {
        out.set(src);
        this.compositeCtx.putImageData(this.compositeImageData, 0, 0);
      }
      return;
    }

    // General Porter-Duff source-over compositing for multi-layer readiness
    out.fill(0);
    for (let li = 0; li < visibleLayers.length; li++) {
      const layer = visibleLayers[li]!;
      const src = layer.buffer.data;
      const layerOpacity = layer.opacity;
      for (let i = 0; i < pixelCount; i++) {
        const off = i * 4;
        const sa = (src[off + 3]! / 255) * layerOpacity;
        if (sa <= 0) continue;

        const da = out[off + 3]! / 255;
        const outA = sa + da * (1 - sa);
        if (outA <= 0) continue;

        out[off] = Math.round((src[off]! * sa + out[off]! * da * (1 - sa)) / outA);
        out[off + 1] = Math.round((src[off + 1]! * sa + out[off + 1]! * da * (1 - sa)) / outA);
        out[off + 2] = Math.round((src[off + 2]! * sa + out[off + 2]! * da * (1 - sa)) / outA);
        out[off + 3] = Math.round(outA * 255);
      }
    }

    this.compositeCtx.putImageData(this.compositeImageData, 0, 0);
  }

  private renderDisplayCanvas(): void {
    const ctx = this.displayCtx;
    if (!ctx || !this.compositeCanvas) return;

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);

    const rect = this.viewport.getCanvasScreenRect(this.document.width, this.document.height);
    const rx = Math.round(rect.x);
    const ry = Math.round(rect.y);
    const rw = Math.round(rect.width);
    const rh = Math.round(rect.height);

    // Subtle elevation shadow behind the sprite canvas
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = "#1b1d24";
    ctx.fillRect(rx, ry, rw, rh);
    ctx.restore();

    // Clip to sprite canvas bounds and render crisp dark checkerboard transparency
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.clip();

    const startX = Math.max(rx, 0);
    const startY = Math.max(ry, 0);
    const endX = Math.min(rx + rw, this.cssWidth);
    const endY = Math.min(ry + rh, this.cssHeight);

    ctx.fillStyle = "#22252e";
    ctx.fillRect(startX, startY, Math.max(0, endX - startX), Math.max(0, endY - startY));

    ctx.fillStyle = "#2c303b";
    const firstCol = Math.floor((startX - rx) / CHECKER_TILE_PX);
    const lastCol = Math.ceil((endX - rx) / CHECKER_TILE_PX);
    const firstRow = Math.floor((startY - ry) / CHECKER_TILE_PX);
    const lastRow = Math.ceil((endY - ry) / CHECKER_TILE_PX);

    for (let row = firstRow; row < lastRow; row++) {
      for (let col = firstCol; col < lastCol; col++) {
        if ((row + col) % 2 === 0) {
          ctx.fillRect(
            rx + col * CHECKER_TILE_PX,
            ry + row * CHECKER_TILE_PX,
            CHECKER_TILE_PX,
            CHECKER_TILE_PX,
          );
        }
      }
    }

    // Crisp nearest-neighbor scaling of pixel art buffer
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.compositeCanvas,
      0,
      0,
      this.document.width,
      this.document.height,
      rx,
      ry,
      rw,
      rh,
    );
    ctx.restore();

    // Crisp outer canvas frame border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
    ctx.lineWidth = 1;
    ctx.strokeRect(rx - 0.5, ry - 0.5, rw + 1, rh + 1);

    ctx.restore();
  }

  private renderOverlayCanvas(): void {
    const ctx = this.overlayCtx;
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);

    const rect = this.viewport.getCanvasScreenRect(this.document.width, this.document.height);
    const zoom = this.viewport.zoom;

    // 1. Pixel Grid (auto-hidden below zoom threshold for visual clarity)
    if (this.showGrid && zoom >= GRID_MIN_ZOOM) {
      const minVisCol = Math.max(0, Math.floor(-rect.x / zoom));
      const maxVisCol = Math.min(this.document.width, Math.ceil((this.cssWidth - rect.x) / zoom));
      const minVisRow = Math.max(0, Math.floor(-rect.y / zoom));
      const maxVisRow = Math.min(this.document.height, Math.ceil((this.cssHeight - rect.y) / zoom));

      const gridTop = Math.max(0, rect.y);
      const gridBottom = Math.min(this.cssHeight, rect.y + rect.height);
      const gridLeft = Math.max(0, rect.x);
      const gridRight = Math.min(this.cssWidth, rect.x + rect.width);

      ctx.beginPath();
      for (let x = minVisCol; x <= maxVisCol; x++) {
        const sx = Math.round(rect.x + x * zoom) + 0.5;
        ctx.moveTo(sx, gridTop);
        ctx.lineTo(sx, gridBottom);
      }
      for (let y = minVisRow; y <= maxVisRow; y++) {
        const sy = Math.round(rect.y + y * zoom) + 0.5;
        ctx.moveTo(gridLeft, sy);
        ctx.lineTo(gridRight, sy);
      }
      ctx.strokeStyle = zoom >= 10 ? "rgba(255, 255, 255, 0.11)" : "rgba(255, 255, 255, 0.07)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 2. Pixel-aligned Brush Cursor Preview
    const { pixel, brushSize, color, isEraser } = this.cursorOverlay;
    if (
      pixel &&
      pixel.x >= 0 &&
      pixel.y >= 0 &&
      pixel.x < this.document.width &&
      pixel.y < this.document.height
    ) {
      const offsets = getSquareBrushOffsets(brushSize);
      const first = offsets[0]!;
      const last = offsets[offsets.length - 1]!;

      const minPx = Math.max(0, pixel.x + first.x);
      const minPy = Math.max(0, pixel.y + first.y);
      const maxPx = Math.min(this.document.width - 1, pixel.x + last.x);
      const maxPy = Math.min(this.document.height - 1, pixel.y + last.y);

      if (minPx <= maxPx && minPy <= maxPy) {
        const sx = Math.round(rect.x + minPx * zoom);
        const sy = Math.round(rect.y + minPy * zoom);
        const sw = Math.max(1, Math.round((maxPx - minPx + 1) * zoom));
        const sh = Math.max(1, Math.round((maxPy - minPy + 1) * zoom));

        if (!isEraser && color && color.a > 0) {
          ctx.fillStyle = rgbaToCss({ ...color, a: Math.round(color.a * 0.45) });
          ctx.fillRect(sx, sy, sw, sh);
        }

        // High-contrast dual outline (dark outer + bright inner) visible on any background
        ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);

        ctx.strokeStyle = isEraser ? "#fb7185" : "#fbbf24";
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
      }
    }

    ctx.restore();
  }
}
