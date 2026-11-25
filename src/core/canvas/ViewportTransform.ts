import type { Point } from "@/types/editor";

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 64;

export interface ViewportRect {
  width: number;
  height: number;
}

export class ViewportTransform {
  zoom = 12;
  panX = 0;
  panY = 0;

  setZoom(nextZoom: number, anchorScreenX?: number, anchorScreenY?: number): number {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
    if (clamped === this.zoom) {
      return this.zoom;
    }

    if (anchorScreenX !== undefined && anchorScreenY !== undefined) {
      const worldX = (anchorScreenX - this.panX) / this.zoom;
      const worldY = (anchorScreenY - this.panY) / this.zoom;
      this.zoom = clamped;
      this.panX = anchorScreenX - worldX * this.zoom;
      this.panY = anchorScreenY - worldY * this.zoom;
    } else {
      this.zoom = clamped;
    }

    return this.zoom;
  }

  zoomByFactor(factor: number, anchorScreenX?: number, anchorScreenY?: number): number {
    return this.setZoom(this.zoom * factor, anchorScreenX, anchorScreenY);
  }

  panBy(deltaX: number, deltaY: number): void {
    this.panX += deltaX;
    this.panY += deltaY;
  }

  fitToViewport(
    canvasWidth: number,
    canvasHeight: number,
    viewportWidth: number,
    viewportHeight: number,
    padding = 48,
  ): void {
    if (viewportWidth <= 0 || viewportHeight <= 0 || canvasWidth <= 0 || canvasHeight <= 0) {
      return;
    }
    const availW = Math.max(32, viewportWidth - padding * 2);
    const availH = Math.max(32, viewportHeight - padding * 2);
    const rawZoom = Math.min(availW / canvasWidth, availH / canvasHeight);
    const snappedZoom =
      rawZoom >= 1 ? Math.floor(rawZoom) : Math.max(MIN_ZOOM, Math.round(rawZoom * 4) / 4);
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, snappedZoom));
    this.panX = Math.floor((viewportWidth - canvasWidth * this.zoom) / 2);
    this.panY = Math.floor((viewportHeight - canvasHeight * this.zoom) / 2);
  }

  screenToPixel(screenX: number, screenY: number): Point {
    return {
      x: Math.floor((screenX - this.panX) / this.zoom),
      y: Math.floor((screenY - this.panY) / this.zoom),
    };
  }

  pixelToScreen(pixelX: number, pixelY: number): Point {
    return {
      x: this.panX + pixelX * this.zoom,
      y: this.panY + pixelY * this.zoom,
    };
  }

  getCanvasScreenRect(canvasWidth: number, canvasHeight: number): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    return {
      x: this.panX,
      y: this.panY,
      width: canvasWidth * this.zoom,
      height: canvasHeight * this.zoom,
    };
  }
}
