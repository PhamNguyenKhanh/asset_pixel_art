import {
  CANVAS_LIMITS,
  MAX_BRUSH_SIZE,
  MIN_BRUSH_SIZE,
  type DirtyRect,
  type DocumentMetadataSnapshot,
  type Point,
  type RGBA,
  type ToolId,
} from "@/types/editor";
import type { ITool, IToolContext, PointerInputEvent } from "@/core/contracts";
import { PixelDocument } from "@/core/document/PixelDocument";
import { ViewportTransform } from "@/core/canvas/ViewportTransform";
import { HistoryManager } from "@/core/history/HistoryManager";
import { RenderingEngine } from "@/core/rendering/RenderingEngine";
import { InputController } from "@/core/input/InputController";
import { ShortcutManager } from "@/core/input/ShortcutManager";
import { createDefaultTools } from "@/modules/drawing-tools/createDefaultTools";

export interface EditorServiceCallbacks {
  onActiveToolChange?: (tool: ToolId) => void;
  onBrushSizeChange?: (size: number) => void;
  onPrimaryColorChange?: (color: RGBA) => void;
  onSecondaryColorChange?: (color: RGBA) => void;
  onRecentColorRecorded?: (color: RGBA) => void;
  onZoomChange?: (zoom: number) => void;
  onShowGridChange?: (show: boolean) => void;
  onCursorPixelChange?: (pixel: Point | null) => void;
  onDocumentMetaChange?: (meta: DocumentMetadataSnapshot) => void;
}

/**
 * Application Service (Facade) bridging React UI/Zustand stores
 * with the React-free Core Engine and Feature Modules.
 * Pixel data lives strictly inside PixelDocument/PixelBuffer and is never mirrored into React state.
 */
export class EditorApplicationService {
  readonly document: PixelDocument;
  readonly viewport: ViewportTransform;
  readonly history: HistoryManager;
  readonly renderer: RenderingEngine;

  private readonly tools: Record<ToolId, ITool>;
  private readonly input: InputController;
  private readonly shortcuts: ShortcutManager;
  private readonly callbacks: EditorServiceCallbacks;

  private activeToolId: ToolId = "pencil";
  private brushSize = 1;
  private primaryColor: RGBA = { r: 245, g: 166, b: 35, a: 255 };
  private secondaryColor: RGBA = { r: 20, g: 22, b: 29, a: 255 };
  private showGrid = true;
  private hoverPixel: Point | null = null;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private unsubscribeHistory: (() => void) | null = null;

  constructor(
    callbacks: EditorServiceCallbacks = {},
    initialWidth: number = CANVAS_LIMITS.DEFAULT_SIZE,
    initialHeight: number = CANVAS_LIMITS.DEFAULT_SIZE,
  ) {
    this.callbacks = callbacks;
    this.document = new PixelDocument(initialWidth, initialHeight);
    this.viewport = new ViewportTransform();
    this.history = new HistoryManager();
    this.renderer = new RenderingEngine(this.document, this.viewport);
    this.tools = createDefaultTools();

    this.input = new InputController(this.viewport, {
      onToolPointerDown: (event) => this.handleToolPointerDown(event),
      onToolPointerMove: (event) => this.handleToolPointerMove(event),
      onToolPointerUp: (event) => this.handleToolPointerUp(event),
      onHoverPixelChange: (pixel) => this.handleHoverPixelChange(pixel),
      onViewportChanged: () => this.handleViewportChanged(),
    });

    this.shortcuts = new ShortcutManager();
    this.registerDefaultShortcuts();

    this.unsubscribeHistory = this.history.subscribe(() => {
      this.emitDocumentMeta();
    });
  }

  getActiveTool(): ITool {
    return this.tools[this.activeToolId];
  }

  getActiveToolId(): ToolId {
    return this.activeToolId;
  }

  getBrushSize(): number {
    return this.brushSize;
  }

  getPrimaryColor(): RGBA {
    return { ...this.primaryColor };
  }

  getSecondaryColor(): RGBA {
    return { ...this.secondaryColor };
  }

  getShowGrid(): boolean {
    return this.showGrid;
  }

  getDocumentMeta(): DocumentMetadataSnapshot {
    const activeFrame = this.document.getActiveFrame();
    return {
      documentId: this.document.id,
      name: this.document.name,
      width: this.document.width,
      height: this.document.height,
      activeFrameIndex: this.document.activeFrameIndex,
      activeLayerId: this.document.activeLayerId,
      frameCount: this.document.frames.length,
      layerCount: activeFrame.layers.length,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      undoCount: this.history.undoCount,
      redoCount: this.history.redoCount,
    };
  }

  attachViewport(
    container: HTMLElement,
    displayCanvas: HTMLCanvasElement,
    overlayCanvas: HTMLCanvasElement,
  ): void {
    this.renderer.attach(displayCanvas, overlayCanvas);
    this.renderer.setShowGrid(this.showGrid);
    this.input.attach(container);
    this.shortcuts.attach();

    const rect = container.getBoundingClientRect();
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    this.viewportWidth = rect.width;
    this.viewportHeight = rect.height;
    this.renderer.resizeViewport(rect.width, rect.height, dpr);
    this.fitViewport();
    this.emitAllState();
  }

  detachViewport(): void {
    this.input.detach();
    this.shortcuts.detach();
    this.renderer.detach();
  }

  dispose(): void {
    this.detachViewport();
    this.unsubscribeHistory?.();
    this.unsubscribeHistory = null;
  }

  resizeViewport(width: number, height: number, dpr = 1): void {
    const wasUninitialized = this.viewportWidth === 0 || this.viewportHeight === 0;
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.renderer.resizeViewport(width, height, dpr);
    if (wasUninitialized && width > 0 && height > 0) {
      this.fitViewport();
    }
  }

  setTool(toolId: ToolId): void {
    if (this.activeToolId === toolId) return;
    this.getActiveTool().onCancel?.(this.createToolContext());
    this.activeToolId = toolId;
    this.syncCursorOverlay();
    this.callbacks.onActiveToolChange?.(toolId);
  }

  setBrushSize(size: number): void {
    const clamped = Math.max(MIN_BRUSH_SIZE, Math.min(MAX_BRUSH_SIZE, Math.round(size)));
    if (clamped === this.brushSize) return;
    this.brushSize = clamped;
    this.syncCursorOverlay();
    this.callbacks.onBrushSizeChange?.(clamped);
  }

  setPrimaryColor(color: RGBA): void {
    this.primaryColor = { ...color };
    this.syncCursorOverlay();
    this.callbacks.onPrimaryColorChange?.(this.getPrimaryColor());
  }

  setSecondaryColor(color: RGBA): void {
    this.secondaryColor = { ...color };
    this.callbacks.onSecondaryColorChange?.(this.getSecondaryColor());
  }

  swapColors(): void {
    const prevPrimary = this.primaryColor;
    this.primaryColor = this.secondaryColor;
    this.secondaryColor = prevPrimary;
    this.syncCursorOverlay();
    this.callbacks.onPrimaryColorChange?.(this.getPrimaryColor());
    this.callbacks.onSecondaryColorChange?.(this.getSecondaryColor());
  }

  setShowGrid(show: boolean): void {
    if (this.showGrid === show) return;
    this.showGrid = show;
    this.renderer.setShowGrid(show);
    this.callbacks.onShowGridChange?.(show);
  }

  toggleGrid(): void {
    this.setShowGrid(!this.showGrid);
  }

  zoomIn(): void {
    const anchorX = this.viewportWidth > 0 ? this.viewportWidth / 2 : undefined;
    const anchorY = this.viewportHeight > 0 ? this.viewportHeight / 2 : undefined;
    const next = this.viewport.zoom < 2 ? this.viewport.zoom * 2 : Math.round(this.viewport.zoom * 1.35);
    this.viewport.setZoom(Math.max(this.viewport.zoom + 1, next), anchorX, anchorY);
    this.handleViewportChanged();
  }

  zoomOut(): void {
    const anchorX = this.viewportWidth > 0 ? this.viewportWidth / 2 : undefined;
    const anchorY = this.viewportHeight > 0 ? this.viewportHeight / 2 : undefined;
    const next = this.viewport.zoom <= 2 ? this.viewport.zoom / 2 : Math.floor(this.viewport.zoom / 1.35);
    this.viewport.setZoom(Math.min(this.viewport.zoom - 0.5, next), anchorX, anchorY);
    this.handleViewportChanged();
  }

  fitViewport(): void {
    if (this.viewportWidth <= 0 || this.viewportHeight <= 0) return;
    this.viewport.fitToViewport(
      this.document.width,
      this.document.height,
      this.viewportWidth,
      this.viewportHeight,
    );
    this.handleViewportChanged();
  }

  createNewCanvas(width: number, height: number, name?: string): void {
    this.getActiveTool().onCancel?.(this.createToolContext());
    this.document.reset(width, height, name ?? "Untitled Sprite");
    this.history.clear();
    this.renderer.setDocument(this.document);
    this.fitViewport();
    this.emitDocumentMeta();
  }

  undo(): boolean {
    const undone = this.history.undo();
    if (!undone) return false;
    this.renderer.markPixelsDirty();
    this.emitDocumentMeta();
    return true;
  }

  redo(): boolean {
    const redone = this.history.redo();
    if (!redone) return false;
    this.renderer.markPixelsDirty();
    this.emitDocumentMeta();
    return true;
  }

  /** Programmatic pointer dispatch for headless integration tests */
  dispatchToolPointer(
    phase: "down" | "move" | "up",
    event: PointerInputEvent,
  ): void {
    if (phase === "down") {
      this.handleToolPointerDown(event);
    } else if (phase === "move") {
      this.handleToolPointerMove(event);
    } else {
      this.handleToolPointerUp(event);
    }
  }

  private createToolContext(): IToolContext {
    return {
      document: this.document,
      history: this.history,
      getPrimaryColor: () => this.getPrimaryColor(),
      getSecondaryColor: () => this.getSecondaryColor(),
      getBrushSize: () => this.brushSize,
      setPrimaryColor: (color) => this.setPrimaryColor(color),
      setSecondaryColor: (color) => this.setSecondaryColor(color),
      recordRecentColor: (color) => this.callbacks.onRecentColorRecorded?.({ ...color }),
      markDirty: (rect?: DirtyRect) => this.renderer.markPixelsDirty(rect),
      notifyDocumentChanged: () => this.emitDocumentMeta(),
    };
  }

  private handleToolPointerDown(event: PointerInputEvent): void {
    this.getActiveTool().onPointerDown(event, this.createToolContext());
  }

  private handleToolPointerMove(event: PointerInputEvent): void {
    this.getActiveTool().onPointerMove(event, this.createToolContext());
  }

  private handleToolPointerUp(event: PointerInputEvent): void {
    this.getActiveTool().onPointerUp(event, this.createToolContext());
  }

  private handleHoverPixelChange(pixel: Point | null): void {
    const inBounds =
      pixel !== null &&
      pixel.x >= 0 &&
      pixel.y >= 0 &&
      pixel.x < this.document.width &&
      pixel.y < this.document.height;

    const next = inBounds ? pixel : null;
    const changed =
      this.hoverPixel?.x !== next?.x || this.hoverPixel?.y !== next?.y;

    this.hoverPixel = next;
    this.syncCursorOverlay();

    if (changed) {
      this.callbacks.onCursorPixelChange?.(next);
    }
  }

  private handleViewportChanged(): void {
    this.renderer.markViewportDirty();
    this.callbacks.onZoomChange?.(this.viewport.zoom);
  }

  private syncCursorOverlay(): void {
    const usesBrushFootprint =
      this.activeToolId === "pencil" || this.activeToolId === "eraser";
    this.renderer.setCursorOverlay({
      pixel: this.hoverPixel,
      brushSize: usesBrushFootprint ? this.brushSize : 1,
      color: this.activeToolId === "pencil" ? this.primaryColor : null,
      isEraser: this.activeToolId === "eraser",
    });
  }

  private emitDocumentMeta(): void {
    this.callbacks.onDocumentMetaChange?.(this.getDocumentMeta());
  }

  private emitAllState(): void {
    this.callbacks.onActiveToolChange?.(this.activeToolId);
    this.callbacks.onBrushSizeChange?.(this.brushSize);
    this.callbacks.onPrimaryColorChange?.(this.getPrimaryColor());
    this.callbacks.onSecondaryColorChange?.(this.getSecondaryColor());
    this.callbacks.onZoomChange?.(this.viewport.zoom);
    this.callbacks.onShowGridChange?.(this.showGrid);
    this.emitDocumentMeta();
  }

  private registerDefaultShortcuts(): void {
    this.shortcuts.registerMany([
      {
        key: "p",
        action: () => this.setTool("pencil"),
        description: "Pencil Tool",
      },
      {
        key: "e",
        action: () => this.setTool("eraser"),
        description: "Eraser Tool",
      },
      {
        key: "b",
        action: () => this.setTool("bucket"),
        description: "Bucket Fill Tool",
      },
      {
        key: "i",
        action: () => this.setTool("eyedropper"),
        description: "Color Picker Tool",
      },
      {
        key: "x",
        action: () => this.swapColors(),
        description: "Swap Primary/Secondary Colors",
      },
      {
        key: "g",
        action: () => this.toggleGrid(),
        description: "Toggle Pixel Grid",
      },
      {
        key: "[",
        action: () => this.setBrushSize(this.brushSize - 1),
        description: "Decrease Brush Size",
      },
      {
        key: "]",
        action: () => this.setBrushSize(this.brushSize + 1),
        description: "Increase Brush Size",
      },
      {
        key: "=",
        action: () => this.zoomIn(),
        description: "Zoom In",
      },
      {
        key: "+",
        action: () => this.zoomIn(),
        description: "Zoom In",
      },
      {
        key: "-",
        action: () => this.zoomOut(),
        description: "Zoom Out",
      },
      {
        key: "0",
        action: () => this.fitViewport(),
        description: "Fit Canvas to Viewport",
      },
      {
        key: "z",
        ctrlOrMeta: true,
        action: () => this.undo(),
        description: "Undo",
      },
      {
        key: "z",
        ctrlOrMeta: true,
        shift: true,
        action: () => this.redo(),
        description: "Redo",
      },
      {
        key: "y",
        ctrlOrMeta: true,
        action: () => this.redo(),
        description: "Redo",
      },
    ]);
  }
}
