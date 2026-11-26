import {
  CANVAS_LIMITS,
  MAX_BRUSH_SIZE,
  MIN_BRUSH_SIZE,
  type CustomPalette,
  type DirtyRect,
  type DocumentMetadataSnapshot,
  type OnionSkinConfig,
  type Point,
  type ResizeAnchor,
  type ResizeMode,
  type RGBA,
  type SelectionRect,
  type ShapeFillMode,
  type ToolId,
} from "@/types/editor";
import type {
  AssetContextProfile,
  AssetTypeId,
  MaterialPreset,
  MaterialPresetId,
} from "@/types/assetContext";
import type { ITool, IToolContext, PointerInputEvent } from "@/core/contracts";
import { PixelBuffer } from "@/core/document/PixelBuffer";
import { Frame } from "@/core/document/Frame";
import { Layer } from "@/core/document/Layer";
import { PixelDocument, validateCanvasDimensions } from "@/core/document/PixelDocument";
import { ViewportTransform } from "@/core/canvas/ViewportTransform";
import { HistoryManager } from "@/core/history/HistoryManager";
import { PixelPatchCommand } from "@/core/history/PixelPatchCommand";
import {
  captureDocumentSnapshot,
  DocumentSnapshotCommand,
  type DocumentStateSnapshot,
} from "@/core/history/DocumentSnapshotCommand";
import { RenderingEngine } from "@/core/rendering/RenderingEngine";
import { InputController } from "@/core/input/InputController";
import { ShortcutManager } from "@/core/input/ShortcutManager";
import { TRANSPARENT_PACKED } from "@/core/image-processing/color";
import {
  clampSelectionRect,
  compositeLayers,
  cropBuffer,
  findContentBounds,
  flipBufferHorizontal,
  flipBufferVertical,
  resizeBufferCanvas,
  rotateBuffer90CCW,
  rotateBuffer90CW,
  scaleBufferNearestNeighbor,
} from "@/core/image-processing/transforms";
import { createDefaultTools } from "@/modules/drawing-tools/createDefaultTools";
import * as LayerService from "@/modules/layers/LayerService";
import * as FrameService from "@/modules/animation/FrameService";
import { AssetContextManager } from "@/modules/asset-context/AssetContextManager";
import {
  deserializeProject,
  serializeProject,
  type SerializedProject,
} from "@/modules/import-export/projectCodec";

export interface EditorServiceCallbacks {
  onActiveToolChange?: (tool: ToolId) => void;
  onBrushSizeChange?: (size: number) => void;
  onShapeFillModeChange?: (mode: ShapeFillMode) => void;
  onPrimaryColorChange?: (color: RGBA) => void;
  onSecondaryColorChange?: (color: RGBA) => void;
  onRecentColorRecorded?: (color: RGBA) => void;
  onZoomChange?: (zoom: number) => void;
  onShowGridChange?: (show: boolean) => void;
  onCursorPixelChange?: (pixel: Point | null) => void;
  onDocumentMetaChange?: (meta: DocumentMetadataSnapshot) => void;
  onCustomPalettesLoaded?: (palettes: CustomPalette[]) => void;
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
  readonly assetContext: AssetContextManager;

  private readonly tools: Record<ToolId, ITool>;
  private readonly input: InputController;
  private readonly shortcuts: ShortcutManager;
  private readonly callbacks: EditorServiceCallbacks;

  private activeToolId: ToolId = "pencil";
  private brushSize = 1;
  private shapeFillMode: ShapeFillMode = "outline";
  private primaryColor: RGBA = { r: 245, g: 166, b: 35, a: 255 };
  private secondaryColor: RGBA = { r: 20, g: 22, b: 29, a: 255 };
  private showGrid = true;
  private hoverPixel: Point | null = null;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private revision = 0;
  private clipboard: PixelBuffer | null = null;
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
    this.assetContext = new AssetContextManager();
    this.document.assetContext = this.assetContext.getState();
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

  getShapeFillMode(): ShapeFillMode {
    return this.shapeFillMode;
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

  getSelection(): SelectionRect | null {
    return this.document.selection ? { ...this.document.selection } : null;
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
      layers: activeFrame.layers.map((l) => ({
        id: l.id,
        name: l.name,
        visible: l.visible,
        locked: l.locked,
        opacity: l.opacity,
      })),
      frames: this.document.frames.map((f, index) => ({
        id: f.id,
        index,
        durationMs: f.durationMs,
      })),
      fps: this.document.fps,
      onionSkin: { ...this.document.onionSkin },
      selection: this.getSelection(),
      assetContext: this.assetContext.getState(),
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      undoCount: this.history.undoCount,
      redoCount: this.history.redoCount,
      revision: this.revision,
    };
  }

  getCompositedFrameBuffer(frameIndex: number): PixelBuffer | null {
    const frame = this.document.frames[frameIndex];
    if (!frame) return null;
    return compositeLayers(frame.layers, this.document.width, this.document.height);
  }

  attachViewport(
    container: HTMLElement,
    displayCanvas: HTMLCanvasElement,
    overlayCanvas: HTMLCanvasElement,
  ): void {
    this.renderer.attach(displayCanvas, overlayCanvas);
    this.renderer.setShowGrid(this.showGrid);
    this.renderer.setSelection(this.document.selection);
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

  setShapeFillMode(mode: ShapeFillMode): void {
    if (this.shapeFillMode === mode) return;
    this.shapeFillMode = mode;
    this.callbacks.onShapeFillModeChange?.(mode);
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
    const next =
      this.viewport.zoom < 2
        ? this.viewport.zoom * 2
        : Math.round(this.viewport.zoom * 1.35);
    this.viewport.setZoom(Math.max(this.viewport.zoom + 1, next), anchorX, anchorY);
    this.handleViewportChanged();
  }

  zoomOut(): void {
    const anchorX = this.viewportWidth > 0 ? this.viewportWidth / 2 : undefined;
    const anchorY = this.viewportHeight > 0 ? this.viewportHeight / 2 : undefined;
    const next =
      this.viewport.zoom <= 2
        ? this.viewport.zoom / 2
        : Math.floor(this.viewport.zoom / 1.35);
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

  setDocumentName(name: string): void {
    const trimmed = name.trim();
    if (!trimmed || trimmed === this.document.name) return;
    this.document.name = trimmed;
    this.bumpRevisionAndEmit();
  }

  createNewCanvas(
    width: number,
    height: number,
    name?: string,
    assetTypeId?: AssetTypeId,
  ): void {
    this.getActiveTool().onCancel?.(this.createToolContext());
    this.document.reset(width, height, name ?? "Untitled Sprite");
    this.assetContext.setAssetType(assetTypeId ?? "custom");
    this.document.assetContext = this.assetContext.getState();
    this.history.clear();
    this.renderer.setDocument(this.document);
    this.fitViewport();
    this.bumpRevisionAndEmit();
  }

  // ---- Dynamic Asset Context ----

  getAssetContextProfile(): AssetContextProfile {
    return this.assetContext.getActiveProfile();
  }

  listAssetContextProfiles(): readonly AssetContextProfile[] {
    return this.assetContext.listProfiles();
  }

  getRecommendedMaterials(): readonly MaterialPreset[] {
    return this.assetContext.getRecommendedMaterials();
  }

  listAllMaterials(): readonly MaterialPreset[] {
    return this.assetContext.listMaterials();
  }

  setAssetType(assetTypeId: AssetTypeId): AssetContextProfile {
    const profile = this.assetContext.setAssetType(assetTypeId);
    this.document.assetContext = this.assetContext.getState();
    this.bumpRevisionAndEmit();
    return profile;
  }

  setPreferredMaterial(materialId: MaterialPresetId | null): void {
    this.assetContext.setPreferredMaterial(materialId);
    this.document.assetContext = this.assetContext.getState();
    this.bumpRevisionAndEmit();
  }

  /**
   * Non-destructive animation helper: sets recommended FPS and appends empty frames
   * only if the sprite currently has fewer frames than the preset suggests.
   */
  applyAnimationPreset(presetId: string): boolean {
    const profile = this.assetContext.getActiveProfile();
    const preset = profile.animationHints.find((h) => h.id === presetId);
    if (!preset) return false;

    return this.runStructuralMutation(`Apply Animation Preset (${preset.name})`, () => {
      FrameService.setDocumentFps(this.document, preset.fps, true);
      while (this.document.frames.length < preset.frameCount) {
        FrameService.addFrame(this.document, this.document.frames.length - 1);
      }
      this.document.setActiveFrameIndex(0);
      return true;
    });
  }

  // ---- Selection & Clipboard ----

  setSelection(rect: SelectionRect | null): void {
    this.document.selection = rect
      ? clampSelectionRect(rect, this.document.width, this.document.height)
      : null;
    this.renderer.setSelection(this.document.selection);
    this.emitDocumentMeta();
  }

  selectAll(): void {
    this.setSelection({
      x: 0,
      y: 0,
      width: this.document.width,
      height: this.document.height,
    });
  }

  clearSelection(): void {
    this.setSelection(null);
  }

  deleteSelection(): boolean {
    const sel = this.document.selection;
    if (!sel) return false;
    const layer = this.document.getActiveLayer();
    if (layer.locked || !layer.visible) return false;

    const next = layer.buffer.clone();
    for (let row = 0; row < sel.height; row++) {
      for (let col = 0; col < sel.width; col++) {
        next.setPacked(sel.x + col, sel.y + row, TRANSPARENT_PACKED);
      }
    }
    return this.commitLayerBufferChange("Clear Selection", next);
  }

  copySelection(): boolean {
    const layer = this.document.getActiveLayer();
    const sel = this.document.selection ?? {
      x: 0,
      y: 0,
      width: this.document.width,
      height: this.document.height,
    };
    const clamped = clampSelectionRect(sel, this.document.width, this.document.height);
    if (!clamped) return false;

    const clip = new PixelBuffer(clamped.width, clamped.height);
    for (let row = 0; row < clamped.height; row++) {
      for (let col = 0; col < clamped.width; col++) {
        clip.setPacked(col, row, layer.buffer.getPacked(clamped.x + col, clamped.y + row));
      }
    }
    this.clipboard = clip;
    return true;
  }

  cutSelection(): boolean {
    if (!this.document.selection) return false;
    if (!this.copySelection()) return false;
    return this.deleteSelection();
  }

  pasteClipboard(): boolean {
    if (!this.clipboard) return false;
    const layer = this.document.getActiveLayer();
    if (layer.locked || !layer.visible) return false;

    const destX = this.document.selection ? this.document.selection.x : 0;
    const destY = this.document.selection ? this.document.selection.y : 0;
    const next = layer.buffer.clone();

    for (let row = 0; row < this.clipboard.height; row++) {
      for (let col = 0; col < this.clipboard.width; col++) {
        const packed = this.clipboard.getPacked(col, row);
        if (packed !== TRANSPARENT_PACKED) {
          next.setPacked(destX + col, destY + row, packed);
        }
      }
    }

    const changed = this.commitLayerBufferChange("Paste", next);
    this.setSelection({
      x: destX,
      y: destY,
      width: this.clipboard.width,
      height: this.clipboard.height,
    });
    return changed;
  }

  // ---- Transform & Canvas Resize / Crop ----

  flipHorizontal(): boolean {
    const layer = this.document.getActiveLayer();
    if (layer.locked || !layer.visible) return false;
    const flipped = flipBufferHorizontal(layer.buffer, this.document.selection);
    return this.commitLayerBufferChange("Flip Horizontal", flipped);
  }

  flipVertical(): boolean {
    const layer = this.document.getActiveLayer();
    if (layer.locked || !layer.visible) return false;
    const flipped = flipBufferVertical(layer.buffer, this.document.selection);
    return this.commitLayerBufferChange("Flip Vertical", flipped);
  }

  rotate90(direction: "cw" | "ccw"): boolean {
    const rotateFn = direction === "cw" ? rotateBuffer90CW : rotateBuffer90CCW;
    return this.runStructuralMutation(
      direction === "cw" ? "Rotate 90° CW" : "Rotate 90° CCW",
      () => {
        const nextW = this.document.height;
        const nextH = this.document.width;
        for (const frame of this.document.frames) {
          frame.layers = frame.layers.map((layer) => {
            const rotatedBuf = rotateFn(layer.buffer);
            const nextLayer = new Layer(nextW, nextH, {
              id: layer.id,
              name: layer.name,
              visible: layer.visible,
              locked: layer.locked,
              opacity: layer.opacity,
            });
            nextLayer.buffer.data.set(rotatedBuf.data);
            return nextLayer;
          });
        }
        this.document.width = nextW;
        this.document.height = nextH;
        this.document.selection = null;
        return true;
      },
      true,
    );
  }

  resizeCanvas(
    newWidth: number,
    newHeight: number,
    mode: ResizeMode = "canvas",
    anchor: ResizeAnchor = "center",
  ): boolean {
    const check = validateCanvasDimensions(newWidth, newHeight);
    if (!check.valid) {
      throw new RangeError(check.error ?? "Invalid resize dimensions");
    }
    if (newWidth === this.document.width && newHeight === this.document.height) {
      return false;
    }

    return this.runStructuralMutation(
      mode === "scale" ? "Scale Canvas" : "Resize Canvas",
      () => {
        for (const frame of this.document.frames) {
          frame.layers = frame.layers.map((layer) => {
            const transformed =
              mode === "scale"
                ? scaleBufferNearestNeighbor(layer.buffer, newWidth, newHeight)
                : resizeBufferCanvas(layer.buffer, newWidth, newHeight, anchor);
            const nextLayer = new Layer(newWidth, newHeight, {
              id: layer.id,
              name: layer.name,
              visible: layer.visible,
              locked: layer.locked,
              opacity: layer.opacity,
            });
            nextLayer.buffer.data.set(transformed.data);
            return nextLayer;
          });
        }
        this.document.width = newWidth;
        this.document.height = newHeight;
        this.document.selection = null;
        return true;
      },
      true,
    );
  }

  cropCanvas(region?: SelectionRect): boolean {
    const target = region ?? this.document.selection;
    if (!target) return false;
    const clamped = clampSelectionRect(target, this.document.width, this.document.height);
    if (!clamped) return false;
    if (
      clamped.x === 0 &&
      clamped.y === 0 &&
      clamped.width === this.document.width &&
      clamped.height === this.document.height
    ) {
      return false;
    }

    return this.runStructuralMutation(
      "Crop Canvas",
      () => {
        for (const frame of this.document.frames) {
          frame.layers = frame.layers.map((layer) => {
            const cropped = cropBuffer(layer.buffer, clamped);
            const nextLayer = new Layer(clamped.width, clamped.height, {
              id: layer.id,
              name: layer.name,
              visible: layer.visible,
              locked: layer.locked,
              opacity: layer.opacity,
            });
            nextLayer.buffer.data.set(cropped.data);
            return nextLayer;
          });
        }
        this.document.width = clamped.width;
        this.document.height = clamped.height;
        this.document.selection = null;
        return true;
      },
      true,
    );
  }

  trimTransparentBounds(): boolean {
    // Compute union of non-transparent bounds across all frames/layers
    let minX = this.document.width;
    let minY = this.document.height;
    let maxX = -1;
    let maxY = -1;

    for (const frame of this.document.frames) {
      for (const layer of frame.layers) {
        const bounds = findContentBounds(layer.buffer);
        if (!bounds) continue;
        minX = Math.min(minX, bounds.x);
        minY = Math.min(minY, bounds.y);
        maxX = Math.max(maxX, bounds.x + bounds.width - 1);
        maxY = Math.max(maxY, bounds.y + bounds.height - 1);
      }
    }

    if (maxX < minX || maxY < minY) return false;
    return this.cropCanvas({
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    });
  }

  // ---- Layer Management ----

  selectLayer(layerId: string): void {
    this.document.setActiveLayerId(layerId);
    this.emitDocumentMeta();
  }

  addLayer(name?: string): void {
    this.runStructuralMutation("Add Layer", () => {
      LayerService.addLayer(this.document, name);
      return true;
    });
  }

  deleteLayer(layerId: string): boolean {
    return this.runStructuralMutation("Delete Layer", () =>
      LayerService.deleteLayer(this.document, layerId),
    );
  }

  renameLayer(layerId: string, name: string): boolean {
    const changed = LayerService.renameLayer(this.document, layerId, name);
    if (changed) {
      this.bumpRevisionAndEmit();
    }
    return changed;
  }

  reorderLayer(fromIndex: number, toIndex: number): boolean {
    return this.runStructuralMutation("Reorder Layer", () =>
      LayerService.reorderLayer(this.document, fromIndex, toIndex),
    );
  }

  setLayerVisibility(layerId: string, visible: boolean): boolean {
    const changed = LayerService.setLayerVisibility(this.document, layerId, visible);
    if (changed) {
      this.renderer.markAllDirty();
      this.bumpRevisionAndEmit();
    }
    return changed;
  }

  setLayerOpacity(layerId: string, opacity: number): boolean {
    const changed = LayerService.setLayerOpacity(this.document, layerId, opacity);
    if (changed) {
      this.renderer.markAllDirty();
      this.bumpRevisionAndEmit();
    }
    return changed;
  }

  setLayerLocked(layerId: string, locked: boolean): boolean {
    const changed = LayerService.setLayerLocked(this.document, layerId, locked);
    if (changed) {
      this.emitDocumentMeta();
    }
    return changed;
  }

  mergeLayerDown(layerId: string): boolean {
    return this.runStructuralMutation("Merge Layer Down", () =>
      LayerService.mergeLayerDown(this.document, layerId),
    );
  }

  mergeVisibleLayers(): boolean {
    return this.runStructuralMutation("Merge Visible Layers", () =>
      LayerService.mergeVisibleLayers(this.document),
    );
  }

  // ---- Animation & Frames ----

  selectFrame(index: number): void {
    if (index < 0 || index >= this.document.frames.length) return;
    if (index === this.document.activeFrameIndex) return;
    this.getActiveTool().onCancel?.(this.createToolContext());
    this.document.setActiveFrameIndex(index);
    this.renderer.markAllDirty();
    this.emitDocumentMeta();
  }

  addFrame(): void {
    this.runStructuralMutation("Add Frame", () => {
      FrameService.addFrame(this.document);
      return true;
    });
  }

  duplicateFrame(index: number): boolean {
    return this.runStructuralMutation("Duplicate Frame", () => {
      return FrameService.duplicateFrame(this.document, index) !== null;
    });
  }

  deleteFrame(index: number): boolean {
    return this.runStructuralMutation("Delete Frame", () =>
      FrameService.deleteFrame(this.document, index),
    );
  }

  reorderFrame(fromIndex: number, toIndex: number): boolean {
    return this.runStructuralMutation("Reorder Frame", () =>
      FrameService.reorderFrame(this.document, fromIndex, toIndex),
    );
  }

  setFrameDuration(index: number, durationMs: number): boolean {
    const changed = FrameService.setFrameDuration(this.document, index, durationMs);
    if (changed) {
      this.bumpRevisionAndEmit();
    }
    return changed;
  }

  setFps(fps: number, syncFrameDurations = true): void {
    FrameService.setDocumentFps(this.document, fps, syncFrameDurations);
    this.bumpRevisionAndEmit();
  }

  setOnionSkin(partial: Partial<OnionSkinConfig>): void {
    FrameService.updateOnionSkin(this.document, partial);
    this.renderer.markAllDirty();
    this.emitDocumentMeta();
  }

  // ---- Import / Local Project Persistence ----

  importImageBuffer(
    buffer: PixelBuffer,
    mode: "new-canvas" | "current-layer" = "new-canvas",
    name?: string,
  ): void {
    if (mode === "new-canvas") {
      const check = validateCanvasDimensions(buffer.width, buffer.height);
      const target = check.valid
        ? buffer
        : scaleBufferNearestNeighbor(
            buffer,
            Math.min(CANVAS_LIMITS.HARD_MAX, buffer.width),
            Math.min(CANVAS_LIMITS.HARD_MAX, buffer.height),
          );

      this.runStructuralMutation(
        "Import Image",
        () => {
          this.document.width = target.width;
          this.document.height = target.height;
          if (name) this.document.name = name;
          const frame = new Frame(target.width, target.height, {
            durationMs: Math.round(1000 / this.document.fps),
          });
          frame.layers[0]!.buffer.data.set(target.data);
          this.document.frames = [frame];
          this.document.activeFrameIndex = 0;
          this.document.activeLayerId = frame.layers[0]!.id;
          this.document.selection = null;
          return true;
        },
        true,
      );
      return;
    }

    // Paste onto active layer (centered or fitted)
    const layer = this.document.getActiveLayer();
    if (layer.locked) return;
    const fitted =
      buffer.width === this.document.width && buffer.height === this.document.height
        ? buffer
        : resizeBufferCanvas(buffer, this.document.width, this.document.height, "center");
    this.commitLayerBufferChange("Import Image to Layer", fitted);
  }

  importAnimatedFrames(
    width: number,
    height: number,
    frames: Array<{ buffer: PixelBuffer; durationMs: number }>,
    name?: string,
  ): void {
    if (frames.length === 0) return;
    const safeW = Math.max(1, Math.min(CANVAS_LIMITS.HARD_MAX, width));
    const safeH = Math.max(1, Math.min(CANVAS_LIMITS.HARD_MAX, height));

    this.runStructuralMutation(
      "Import Animated GIF",
      () => {
        this.document.width = safeW;
        this.document.height = safeH;
        if (name) this.document.name = name;
        const sharedLayerId = "layer-1";
        this.document.frames = frames.map((item) => {
          const buf =
            item.buffer.width === safeW && item.buffer.height === safeH
              ? item.buffer
              : scaleBufferNearestNeighbor(item.buffer, safeW, safeH);
          const frame = new Frame(safeW, safeH, { durationMs: item.durationMs });
          frame.layers = [
            new Layer(safeW, safeH, { id: sharedLayerId, name: "Layer 1" }),
          ];
          frame.layers[0]!.buffer.data.set(buf.data);
          return frame;
        });
        this.document.activeFrameIndex = 0;
        this.document.activeLayerId = sharedLayerId;
        this.document.selection = null;
        return true;
      },
      true,
    );
  }

  exportSerializedProject(customPalettes?: CustomPalette[]): SerializedProject {
    return serializeProject(this.document, customPalettes);
  }

  loadSerializedProject(raw: unknown): void {
    const { document: loaded, customPalettes } = deserializeProject(raw);
    this.getActiveTool().onCancel?.(this.createToolContext());
    this.document.id = loaded.id;
    this.document.name = loaded.name;
    this.document.width = loaded.width;
    this.document.height = loaded.height;
    this.document.fps = loaded.fps;
    this.document.onionSkin = { ...loaded.onionSkin };
    this.assetContext.restoreState(loaded.assetContext);
    this.document.assetContext = this.assetContext.getState();
    this.document.frames = loaded.frames;
    this.document.activeFrameIndex = loaded.activeFrameIndex;
    this.document.activeLayerId = loaded.activeLayerId;
    this.document.selection = null;
    this.history.clear();
    this.renderer.setDocument(this.document);
    this.fitViewport();
    if (customPalettes) {
      this.callbacks.onCustomPalettesLoaded?.(customPalettes);
    }
    this.bumpRevisionAndEmit();
  }

  // ---- Undo / Redo ----

  undo(): boolean {
    const undone = this.history.undo();
    if (!undone) return false;
    this.renderer.setDocument(this.document);
    this.bumpRevisionAndEmit();
    return true;
  }

  redo(): boolean {
    const redone = this.history.redo();
    if (!redone) return false;
    this.renderer.setDocument(this.document);
    this.bumpRevisionAndEmit();
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

  // ---- Internal helpers ----

  private commitLayerBufferChange(name: string, nextBuffer: PixelBuffer): boolean {
    const frame = this.document.getActiveFrame();
    const layer = this.document.getActiveLayer();
    const diffRect = layer.buffer.computeDiffRect(nextBuffer);
    if (!diffRect) return false;

    const beforePixels = layer.buffer.extractRect(diffRect);
    const afterPixels = nextBuffer.extractRect(diffRect);
    layer.buffer.writeRect(diffRect, afterPixels);

    this.history.pushExecuted(
      new PixelPatchCommand({
        name,
        document: this.document,
        frameId: frame.id,
        layerId: layer.id,
        rect: diffRect,
        beforePixels,
        afterPixels,
        onApplied: (rect) => {
          this.renderer.markPixelsDirty(rect);
          this.bumpRevisionAndEmit();
        },
      }),
    );
    this.renderer.markPixelsDirty(diffRect);
    this.bumpRevisionAndEmit();
    return true;
  }

  private runStructuralMutation(
    name: string,
    mutate: () => boolean,
    refitViewport = false,
  ): boolean {
    const before: DocumentStateSnapshot = captureDocumentSnapshot(this.document);
    const changed = mutate();
    if (!changed) return false;
    const after: DocumentStateSnapshot = captureDocumentSnapshot(this.document);

    this.history.pushExecuted(
      new DocumentSnapshotCommand({
        name,
        document: this.document,
        before,
        after,
        onApplied: () => {
          this.renderer.setDocument(this.document);
          if (refitViewport) {
            this.fitViewport();
          }
          this.bumpRevisionAndEmit();
        },
      }),
    );

    this.renderer.setDocument(this.document);
    if (refitViewport) {
      this.fitViewport();
    }
    this.bumpRevisionAndEmit();
    return true;
  }

  private createToolContext(): IToolContext {
    return {
      document: this.document,
      history: this.history,
      getPrimaryColor: () => this.getPrimaryColor(),
      getSecondaryColor: () => this.getSecondaryColor(),
      getBrushSize: () => this.brushSize,
      getShapeFillMode: () => this.shapeFillMode,
      setPrimaryColor: (color) => this.setPrimaryColor(color),
      setSecondaryColor: (color) => this.setSecondaryColor(color),
      recordRecentColor: (color) => this.callbacks.onRecentColorRecorded?.({ ...color }),
      getSelection: () => this.getSelection(),
      setSelection: (rect) => this.setSelection(rect),
      setPreviewBuffer: (buffer, replaceActiveLayer) =>
        this.renderer.setPreviewBuffer(buffer, replaceActiveLayer),
      markDirty: (rect?: DirtyRect) => this.renderer.markPixelsDirty(rect),
      notifyDocumentChanged: () => this.bumpRevisionAndEmit(),
      getAssetContext: () => this.assetContext.getActiveProfile(),
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
      this.activeToolId === "pencil" ||
      this.activeToolId === "eraser" ||
      this.activeToolId === "line" ||
      ((this.activeToolId === "rectangle" || this.activeToolId === "ellipse") &&
        this.shapeFillMode === "outline");
    const hidePixelCursor =
      this.activeToolId === "move" || this.activeToolId === "select";

    this.renderer.setCursorOverlay({
      pixel: hidePixelCursor ? null : this.hoverPixel,
      brushSize: usesBrushFootprint ? this.brushSize : 1,
      color:
        this.activeToolId === "pencil" ||
        this.activeToolId === "line" ||
        this.activeToolId === "rectangle" ||
        this.activeToolId === "ellipse"
          ? this.primaryColor
          : null,
      isEraser: this.activeToolId === "eraser",
    });
  }

  private bumpRevisionAndEmit(): void {
    this.revision += 1;
    this.emitDocumentMeta();
  }

  private emitDocumentMeta(): void {
    this.callbacks.onDocumentMetaChange?.(this.getDocumentMeta());
  }

  private emitAllState(): void {
    this.callbacks.onActiveToolChange?.(this.activeToolId);
    this.callbacks.onBrushSizeChange?.(this.brushSize);
    this.callbacks.onShapeFillModeChange?.(this.shapeFillMode);
    this.callbacks.onPrimaryColorChange?.(this.getPrimaryColor());
    this.callbacks.onSecondaryColorChange?.(this.getSecondaryColor());
    this.callbacks.onZoomChange?.(this.viewport.zoom);
    this.callbacks.onShowGridChange?.(this.showGrid);
    this.emitDocumentMeta();
  }

  private registerDefaultShortcuts(): void {
    this.shortcuts.registerMany([
      { key: "p", action: () => this.setTool("pencil"), description: "Pencil Tool" },
      { key: "e", action: () => this.setTool("eraser"), description: "Eraser Tool" },
      { key: "b", action: () => this.setTool("bucket"), description: "Bucket Fill Tool" },
      { key: "i", action: () => this.setTool("eyedropper"), description: "Color Picker Tool" },
      { key: "l", action: () => this.setTool("line"), description: "Line Tool" },
      { key: "u", action: () => this.setTool("rectangle"), description: "Rectangle Tool" },
      { key: "o", action: () => this.setTool("ellipse"), description: "Ellipse Tool" },
      { key: "m", action: () => this.setTool("select"), description: "Select Tool" },
      { key: "v", action: () => this.setTool("move"), description: "Move Tool" },
      { key: "x", action: () => this.swapColors(), description: "Swap Colors" },
      { key: "g", action: () => this.toggleGrid(), description: "Toggle Pixel Grid" },
      { key: "[", action: () => this.setBrushSize(this.brushSize - 1), description: "Decrease Brush Size" },
      { key: "]", action: () => this.setBrushSize(this.brushSize + 1), description: "Increase Brush Size" },
      { key: "=", action: () => this.zoomIn(), description: "Zoom In" },
      { key: "+", action: () => this.zoomIn(), description: "Zoom In" },
      { key: "-", action: () => this.zoomOut(), description: "Zoom Out" },
      { key: "0", action: () => this.fitViewport(), description: "Fit Canvas" },
      { key: "z", ctrlOrMeta: true, action: () => this.undo(), description: "Undo" },
      { key: "z", ctrlOrMeta: true, shift: true, action: () => this.redo(), description: "Redo" },
      { key: "y", ctrlOrMeta: true, action: () => this.redo(), description: "Redo" },
      { key: "a", ctrlOrMeta: true, action: () => this.selectAll(), description: "Select All" },
      { key: "d", ctrlOrMeta: true, action: () => this.clearSelection(), description: "Deselect" },
      { key: "Escape", action: () => this.clearSelection(), description: "Clear Selection" },
      { key: "Delete", action: () => this.deleteSelection(), description: "Delete Selection" },
      { key: "Backspace", action: () => this.deleteSelection(), description: "Delete Selection" },
      { key: "c", ctrlOrMeta: true, action: () => this.copySelection(), description: "Copy Selection" },
      { key: "x", ctrlOrMeta: true, action: () => this.cutSelection(), description: "Cut Selection" },
      { key: "v", ctrlOrMeta: true, action: () => this.pasteClipboard(), description: "Paste" },
      {
        key: ",",
        action: () =>
          this.selectFrame(
            (this.document.activeFrameIndex - 1 + this.document.frames.length) %
              this.document.frames.length,
          ),
        description: "Previous Frame",
      },
      {
        key: ".",
        action: () =>
          this.selectFrame((this.document.activeFrameIndex + 1) % this.document.frames.length),
        description: "Next Frame",
      },
    ]);
  }
}
