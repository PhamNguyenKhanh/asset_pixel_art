import type { DirtyRect, Point, RGBA, SelectionRect } from "@/types/editor";
import type { ILightingPipeline } from "@/core/contracts";
import type { PixelDocument } from "@/core/document/PixelDocument";
import { PixelBuffer } from "@/core/document/PixelBuffer";
import type { ViewportTransform } from "@/core/canvas/ViewportTransform";
import { clampDirtyRect, getDirtyRectSize, mergeDirtyRects } from "@/core/canvas/dirtyRect";
import { getSquareBrushOffsets } from "@/core/image-processing/bresenham";
import { rgbaToCss } from "@/core/image-processing/color";
import { compositeLayers, compositeOverlayBuffer } from "@/core/image-processing/transforms";

export interface CursorOverlayState {
  pixel: Point | null;
  brushSize: number;
  color: RGBA | null;
  isEraser: boolean;
}

export interface LightGizmoOverlayState {
  visible: boolean;
  lightX: number;
  lightY: number;
  color: RGBA;
  intensity: number;
}

const GRID_MIN_ZOOM = 4;
const CHECKER_TILE_PX = 8;

/**
 * HTML5 Canvas 2D Rendering Engine.
 * - Offscreen canvas composites active frame layers, Onion Skin ghosts, and transient tool previews.
 * - Display canvas draws with imageSmoothingEnabled = false (crisp nearest-neighbor).
 * - Overlay canvas renders pixel grid, selection marching-ants box, and brush cursor preview.
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

  private previewBuffer: PixelBuffer | null = null;
  private previewReplacesActiveLayer = false;
  private lightingPipeline: ILightingPipeline | null = null;
  private lightSourceScratch: PixelBuffer | null = null;
  private lightOutputScratch: PixelBuffer | null = null;
  private lightGizmo: LightGizmoOverlayState | null = null;

  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;

  private showGrid = true;
  private selection: SelectionRect | null = null;
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
    this.selection = document.selection;
    this.syncCompositeSurfaceSize();
    this.markAllDirty();
  }

  setPreviewBuffer(buffer: PixelBuffer | null, replaceActiveLayer = false): void {
    this.previewBuffer = buffer;
    this.previewReplacesActiveLayer = replaceActiveLayer;
    this.fullCompositeDirty = true;
    this.pendingDirtyRect = null;
    this.compositeDirty = true;
    this.viewportDirty = true;
    this.scheduleRender();
  }

  setSelection(selection: SelectionRect | null): void {
    this.selection = selection;
    this.markOverlayDirty();
  }

  setLightingPipeline(pipeline: ILightingPipeline | null): void {
    this.lightingPipeline = pipeline;
    this.markAllDirty();
  }

  setLightGizmo(gizmo: LightGizmoOverlayState | null): void {
    this.lightGizmo = gizmo;
    this.markOverlayDirty();
  }

  getLightGizmoScreenPos(): Point | null {
    if (!this.lightGizmo || !this.lightGizmo.visible) return null;
    const rect = this.viewport.getCanvasScreenRect(this.document.width, this.document.height);
    const halfW = rect.width / 2;
    const halfH = rect.height / 2;
    return {
      x: rect.x + halfW + this.lightGizmo.lightX * halfW,
      y: rect.y + halfH + this.lightGizmo.lightY * halfH,
    };
  }

  screenToNormalizedLightPos(screenX: number, screenY: number): { lightX: number; lightY: number } {
    const rect = this.viewport.getCanvasScreenRect(this.document.width, this.document.height);
    const halfW = Math.max(1, rect.width / 2);
    const halfH = Math.max(1, rect.height / 2);
    const rawX = (screenX - (rect.x + halfW)) / halfW;
    const rawY = (screenY - (rect.y + halfH)) / halfH;
    return {
      lightX: Math.max(-1.6, Math.min(1.6, Math.round(rawX * 100) / 100)),
      lightY: Math.max(-1.6, Math.min(1.6, Math.round(rawY * 100) / 100)),
    };
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

  private blendTintedGhost(
    out: Uint8ClampedArray,
    ghostData: Uint8ClampedArray,
    tintR: number,
    tintG: number,
    tintB: number,
    opacity: number,
  ): void {
    const pixelCount = out.length / 4;
    for (let i = 0; i < pixelCount; i++) {
      const off = i * 4;
      const ga = (ghostData[off + 3]! / 255) * opacity;
      if (ga <= 0) continue;

      const sr = Math.round(ghostData[off]! * 0.4 + tintR * 0.6);
      const sg = Math.round(ghostData[off + 1]! * 0.4 + tintG * 0.6);
      const sb = Math.round(ghostData[off + 2]! * 0.4 + tintB * 0.6);

      const da = out[off + 3]! / 255;
      const outA = ga + da * (1 - ga);
      if (outA <= 0) continue;

      out[off] = Math.round((sr * ga + out[off]! * da * (1 - ga)) / outA);
      out[off + 1] = Math.round((sg * ga + out[off + 1]! * da * (1 - ga)) / outA);
      out[off + 2] = Math.round((sb * ga + out[off + 2]! * da * (1 - ga)) / outA);
      out[off + 3] = Math.round(outA * 255);
    }
  }

  private updateCompositeSurface(): void {
    this.syncCompositeSurfaceSize();
    if (!this.compositeCtx || !this.compositeImageData) return;

    const frame = this.document.getActiveFrame();
    const out = this.compositeImageData.data;
    const width = this.document.width;
    const height = this.document.height;
    const onionEnabled = this.document.onionSkin.enabled && this.document.frames.length > 1;
    const lightingEnabled = Boolean(this.lightingPipeline?.enabled);
    const visibleLayers = frame.layers.filter((l) => l.visible && l.opacity > 0);

    // Ultra-fast partial dirty-rect path when no onion skin, no preview overlay, no lighting, and 1 opaque layer
    if (
      !onionEnabled &&
      !lightingEnabled &&
      !this.previewBuffer &&
      visibleLayers.length === 1 &&
      visibleLayers[0]!.opacity >= 1
    ) {
      const src = visibleLayers[0]!.buffer.data;
      const dirty =
        !this.fullCompositeDirty && this.pendingDirtyRect
          ? clampDirtyRect(this.pendingDirtyRect, width, height)
          : null;

      if (dirty) {
        const { width: rw, height: rh } = getDirtyRectSize(dirty);
        const rowBytes = rw * 4;
        for (let row = 0; row < rh; row++) {
          const offset = ((dirty.minY + row) * width + dirty.minX) * 4;
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

    // General path: Onion Skin + Multi-Layer Compositing + Transient Preview Buffer
    out.fill(0);

    if (onionEnabled) {
      const activeIdx = this.document.activeFrameIndex;
      const baseOpacity = this.document.onionSkin.opacity;

      // Previous frames tinted rose/crimson
      for (let d = this.document.onionSkin.prevFrames; d >= 1; d--) {
        const prevFrame = this.document.frames[activeIdx - d];
        if (!prevFrame) continue;
        const ghost = compositeLayers(prevFrame.layers, width, height);
        this.blendTintedGhost(out, ghost.data, 244, 63, 94, baseOpacity / d);
      }

      // Next frames tinted sky cyan
      for (let d = this.document.onionSkin.nextFrames; d >= 1; d--) {
        const nextFrame = this.document.frames[activeIdx + d];
        if (!nextFrame) continue;
        const ghost = compositeLayers(nextFrame.layers, width, height);
        this.blendTintedGhost(out, ghost.data, 56, 189, 248, baseOpacity / d);
      }
    }

    const activeLayerId = this.document.activeLayerId;

    if (lightingEnabled && this.lightingPipeline) {
      if (
        !this.lightSourceScratch ||
        this.lightSourceScratch.width !== width ||
        this.lightSourceScratch.height !== height
      ) {
        this.lightSourceScratch = new PixelBuffer(width, height);
        this.lightOutputScratch = new PixelBuffer(width, height);
      }
      const rawBuf = this.lightSourceScratch;
      const litBuf = this.lightOutputScratch!;
      rawBuf.clear();

      for (let li = 0; li < frame.layers.length; li++) {
        const layer = frame.layers[li]!;
        if (!layer.visible || layer.opacity <= 0) continue;
        const isTargetLayer = layer.id === activeLayerId;
        if (isTargetLayer && this.previewBuffer && this.previewReplacesActiveLayer) {
          compositeOverlayBuffer(rawBuf.data, this.previewBuffer.data, layer.opacity);
        } else {
          compositeOverlayBuffer(rawBuf.data, layer.buffer.data, layer.opacity);
          if (isTargetLayer && this.previewBuffer) {
            compositeOverlayBuffer(rawBuf.data, this.previewBuffer.data, layer.opacity);
          }
        }
      }

      // Non-destructive lighting pass on composited frame buffer
      this.lightingPipeline.process(rawBuf, litBuf);
      compositeOverlayBuffer(out, litBuf.data, 1);
    } else {
      for (let li = 0; li < frame.layers.length; li++) {
        const layer = frame.layers[li]!;
        if (!layer.visible || layer.opacity <= 0) continue;

        const isTargetLayer = layer.id === activeLayerId;
        if (isTargetLayer && this.previewBuffer && this.previewReplacesActiveLayer) {
          compositeOverlayBuffer(out, this.previewBuffer.data, layer.opacity);
        } else {
          compositeOverlayBuffer(out, layer.buffer.data, layer.opacity);
          if (isTargetLayer && this.previewBuffer) {
            compositeOverlayBuffer(out, this.previewBuffer.data, layer.opacity);
          }
        }
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

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = "#1b1d24";
    ctx.fillRect(rx, ry, rw, rh);
    ctx.restore();

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

    // 1. Pixel Grid
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

    // 2. Selection Box Overlay (Crisp dual-dash outline)
    if (this.selection && this.selection.width > 0 && this.selection.height > 0) {
      const sx = Math.round(rect.x + this.selection.x * zoom) + 0.5;
      const sy = Math.round(rect.y + this.selection.y * zoom) + 0.5;
      const sw = Math.max(1, Math.round(this.selection.width * zoom) - 1);
      const sh = Math.max(1, Math.round(this.selection.height * zoom) - 1);

      ctx.save();
      ctx.fillStyle = "rgba(56, 189, 248, 0.08)";
      ctx.fillRect(sx, sy, sw, sh);

      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
      ctx.strokeRect(sx, sy, sw, sh);

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "#38bdf8";
      ctx.strokeRect(sx, sy, sw, sh);
      ctx.restore();
    }

    // 3. Pixel-aligned Brush Cursor Preview
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

        ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);

        ctx.strokeStyle = isEraser ? "#fb7185" : "#fbbf24";
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
      }
    }

    // 4. Interactive Dynamic Light Source Gizmo (Directional Light Handle)
    const gizmoPos = this.getLightGizmoScreenPos();
    if (gizmoPos && this.lightGizmo) {
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      const lightCss = rgbaToCss({ ...this.lightGizmo.color, a: 255 });

      ctx.save();
      // Dashed directional light ray from gizmo toward sprite center
      ctx.beginPath();
      ctx.setLineDash([5, 4]);
      ctx.moveTo(gizmoPos.x, gizmoPos.y);
      ctx.lineTo(cx, cy);
      ctx.strokeStyle = "rgba(251, 191, 36, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // Soft outer glow halo
      const glowRadius = 18 + Math.min(8, this.lightGizmo.intensity * 5);
      const grad = ctx.createRadialGradient(
        gizmoPos.x,
        gizmoPos.y,
        3,
        gizmoPos.x,
        gizmoPos.y,
        glowRadius,
      );
      grad.addColorStop(0, rgbaToCss({ ...this.lightGizmo.color, a: 160 }));
      grad.addColorStop(1, "rgba(251, 191, 36, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(gizmoPos.x, gizmoPos.y, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Sun rays tick marks around handle
      ctx.strokeStyle = lightCss;
      ctx.lineWidth = 1.5;
      for (let a = 0; a < 8; a++) {
        const ang = (a * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(gizmoPos.x + Math.cos(ang) * 11, gizmoPos.y + Math.sin(ang) * 11);
        ctx.lineTo(gizmoPos.x + Math.cos(ang) * 15, gizmoPos.y + Math.sin(ang) * 15);
        ctx.stroke();
      }

      // Crisp dark border + glowing core handle
      ctx.beginPath();
      ctx.arc(gizmoPos.x, gizmoPos.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = lightCss;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#111318";
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(gizmoPos.x, gizmoPos.y, 9.5, 0, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }
}
