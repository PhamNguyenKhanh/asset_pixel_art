import type { Point } from "@/types/editor";
import type { PointerInputEvent } from "@/core/contracts";
import type { ViewportTransform } from "@/core/canvas/ViewportTransform";

export interface InputCallbacks {
  onToolPointerDown(event: PointerInputEvent): void;
  onToolPointerMove(event: PointerInputEvent): void;
  onToolPointerUp(event: PointerInputEvent): void;
  onHoverPixelChange(pixel: Point | null): void;
  onViewportChanged(): void;
}

/**
 * Unifies mouse/stylus pointer events, wheel cursor-anchored zoom,
 * Space/Middle-click panning, and screen-to-pixel coordinate conversion.
 */
export class InputController {
  private element: HTMLElement | null = null;
  private viewport: ViewportTransform;
  private callbacks: InputCallbacks;

  private isPanning = false;
  private isSpacePressed = false;
  private isToolActive = false;
  private activeButton = 0;
  private lastPanX = 0;
  private lastPanY = 0;
  private prevPixel: Point | null = null;

  constructor(viewport: ViewportTransform, callbacks: InputCallbacks) {
    this.viewport = viewport;
    this.callbacks = callbacks;
  }

  get panning(): boolean {
    return this.isPanning || this.isSpacePressed;
  }

  attach(element: HTMLElement): void {
    this.detach();
    this.element = element;
    element.addEventListener("pointerdown", this.handlePointerDown);
    element.addEventListener("pointermove", this.handlePointerMove);
    element.addEventListener("pointerup", this.handlePointerUp);
    element.addEventListener("pointercancel", this.handlePointerCancel);
    element.addEventListener("pointerleave", this.handlePointerLeave);
    element.addEventListener("wheel", this.handleWheel, { passive: false });
    element.addEventListener("contextmenu", this.handleContextMenu);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  detach(): void {
    if (this.element) {
      this.element.removeEventListener("pointerdown", this.handlePointerDown);
      this.element.removeEventListener("pointermove", this.handlePointerMove);
      this.element.removeEventListener("pointerup", this.handlePointerUp);
      this.element.removeEventListener("pointercancel", this.handlePointerCancel);
      this.element.removeEventListener("pointerleave", this.handlePointerLeave);
      this.element.removeEventListener("wheel", this.handleWheel);
      this.element.removeEventListener("contextmenu", this.handleContextMenu);
      this.element = null;
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", this.handleKeyDown);
      window.removeEventListener("keyup", this.handleKeyUp);
    }
  }

  private getLocalPoint(e: PointerEvent | WheelEvent): Point {
    if (!this.element) return { x: 0, y: 0 };
    const rect = this.element.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private buildInputEvent(e: PointerEvent, pixel: Point): PointerInputEvent {
    return {
      pixelX: pixel.x,
      pixelY: pixel.y,
      prevPixelX: this.prevPixel ? this.prevPixel.x : null,
      prevPixelY: this.prevPixel ? this.prevPixel.y : null,
      button: this.isToolActive ? this.activeButton : e.button,
      buttons: e.buttons,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
    };
  }

  private handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "Space" && !this.isInputFocused(e.target)) {
      if (!this.isSpacePressed) {
        this.isSpacePressed = true;
        if (this.element) {
          this.element.style.cursor = "grab";
        }
      }
      e.preventDefault();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    if (e.code === "Space") {
      this.isSpacePressed = false;
      if (!this.isPanning && this.element) {
        this.element.style.cursor = "";
      }
    }
  };

  private isInputFocused(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
  }

  private handlePointerDown = (e: PointerEvent): void => {
    if (!this.element) return;
    this.element.setPointerCapture(e.pointerId);

    const local = this.getLocalPoint(e);

    // Middle click or Space + Left click initiates viewport pan
    if (e.button === 1 || (this.isSpacePressed && e.button === 0)) {
      this.isPanning = true;
      this.lastPanX = local.x;
      this.lastPanY = local.y;
      this.element.style.cursor = "grabbing";
      return;
    }

    // Left click (0) or Right click (2) invokes active drawing tool
    if (e.button === 0 || e.button === 2) {
      const pixel = this.viewport.screenToPixel(local.x, local.y);
      this.isToolActive = true;
      this.activeButton = e.button;
      this.prevPixel = null;
      const inputEvent = this.buildInputEvent(e, pixel);
      this.callbacks.onToolPointerDown(inputEvent);
      this.prevPixel = pixel;
      this.callbacks.onHoverPixelChange(pixel);
    }
  };

  private handlePointerMove = (e: PointerEvent): void => {
    const local = this.getLocalPoint(e);

    if (this.isPanning) {
      const dx = local.x - this.lastPanX;
      const dy = local.y - this.lastPanY;
      this.lastPanX = local.x;
      this.lastPanY = local.y;
      this.viewport.panBy(dx, dy);
      this.callbacks.onViewportChanged();
      return;
    }

    const pixel = this.viewport.screenToPixel(local.x, local.y);
    this.callbacks.onHoverPixelChange(pixel);

    if (this.isToolActive) {
      const inputEvent = this.buildInputEvent(e, pixel);
      this.callbacks.onToolPointerMove(inputEvent);
      this.prevPixel = pixel;
    }
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (this.element && this.element.hasPointerCapture(e.pointerId)) {
      this.element.releasePointerCapture(e.pointerId);
    }

    if (this.isPanning) {
      this.isPanning = false;
      if (this.element) {
        this.element.style.cursor = this.isSpacePressed ? "grab" : "";
      }
      return;
    }

    if (this.isToolActive) {
      const local = this.getLocalPoint(e);
      const pixel = this.viewport.screenToPixel(local.x, local.y);
      const inputEvent = this.buildInputEvent(e, pixel);
      this.isToolActive = false;
      this.callbacks.onToolPointerUp(inputEvent);
      this.prevPixel = null;
    }
  };

  private handlePointerCancel = (e: PointerEvent): void => {
    this.handlePointerUp(e);
  };

  private handlePointerLeave = (): void => {
    if (!this.isToolActive) {
      this.callbacks.onHoverPixelChange(null);
    }
  };

  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const local = this.getLocalPoint(e);
    const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
    this.viewport.zoomByFactor(factor, local.x, local.y);
    this.callbacks.onViewportChanged();
  };
}
