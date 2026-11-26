import {
  CANVAS_LIMITS,
  DEFAULT_FPS,
  MAX_FPS,
  MIN_FPS,
  type OnionSkinConfig,
  type SelectionRect,
} from "@/types/editor";
import type { AssetContextState } from "@/types/assetContext";
import { Frame } from "@/core/document/Frame";
import { Layer } from "@/core/document/Layer";

let documentCounter = 1;
let layerIdCounter = 100;

export function nextLayerId(): string {
  return `layer-${layerIdCounter++}`;
}

export function validateCanvasDimensions(
  width: number,
  height: number,
): { valid: boolean; warning?: string; error?: string } {
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    return { valid: false, error: "Canvas width and height must be whole numbers." };
  }
  if (width < CANVAS_LIMITS.MIN_SIZE || height < CANVAS_LIMITS.MIN_SIZE) {
    return {
      valid: false,
      error: `Canvas size must be at least ${CANVAS_LIMITS.MIN_SIZE}x${CANVAS_LIMITS.MIN_SIZE}.`,
    };
  }
  if (width > CANVAS_LIMITS.HARD_MAX || height > CANVAS_LIMITS.HARD_MAX) {
    return {
      valid: false,
      error: `Maximum supported canvas size is ${CANVAS_LIMITS.HARD_MAX}x${CANVAS_LIMITS.HARD_MAX}.`,
    };
  }
  if (width > CANVAS_LIMITS.RECOMMENDED_MAX || height > CANVAS_LIMITS.RECOMMENDED_MAX) {
    return {
      valid: true,
      warning: `Sizes above ${CANVAS_LIMITS.RECOMMENDED_MAX}x${CANVAS_LIMITS.RECOMMENDED_MAX} may reduce interactive performance.`,
    };
  }
  return { valid: true };
}

export class PixelDocument {
  id: string;
  name: string;
  width: number;
  height: number;
  frames: Frame[];
  activeFrameIndex: number;
  activeLayerId: string;
  fps: number;
  onionSkin: OnionSkinConfig;
  selection: SelectionRect | null;
  assetContext: AssetContextState;

  constructor(
    width: number = CANVAS_LIMITS.DEFAULT_SIZE,
    height: number = CANVAS_LIMITS.DEFAULT_SIZE,
    name = "Untitled Sprite",
  ) {
    const check = validateCanvasDimensions(width, height);
    if (!check.valid) {
      throw new RangeError(check.error ?? "Invalid canvas dimensions");
    }
    this.id = `doc-${documentCounter++}`;
    this.name = name;
    this.width = width;
    this.height = height;
    this.fps = DEFAULT_FPS;
    this.onionSkin = {
      enabled: false,
      prevFrames: 1,
      nextFrames: 1,
      opacity: 0.3,
    };
    this.selection = null;
    this.assetContext = {
      assetTypeId: "custom",
      preferredMaterialId: "wood",
    };
    const initialFrame = new Frame(width, height, {
      durationMs: Math.round(1000 / DEFAULT_FPS),
    });
    this.frames = [initialFrame];
    this.activeFrameIndex = 0;
    this.activeLayerId = initialFrame.layers[0]!.id;
  }

  getActiveFrame(): Frame {
    const frame = this.frames[this.activeFrameIndex];
    if (!frame) {
      throw new Error(`Active frame index ${this.activeFrameIndex} is out of range`);
    }
    return frame;
  }

  getActiveLayer(): Layer {
    const frame = this.getActiveFrame();
    const layer = frame.getLayerById(this.activeLayerId) ?? frame.layers[0];
    if (!layer) {
      throw new Error("Active frame contains no layers");
    }
    this.activeLayerId = layer.id;
    return layer;
  }

  getLayer(frameId: string, layerId: string): Layer | undefined {
    const frame = this.frames.find((f) => f.id === frameId);
    return frame?.getLayerById(layerId);
  }

  setFps(nextFps: number): void {
    this.fps = Math.max(MIN_FPS, Math.min(MAX_FPS, Math.round(nextFps)));
  }

  setActiveFrameIndex(index: number): void {
    if (index < 0 || index >= this.frames.length) return;
    this.activeFrameIndex = index;
    const frame = this.frames[index]!;
    if (!frame.getLayerById(this.activeLayerId) && frame.layers[0]) {
      this.activeLayerId = frame.layers[0].id;
    }
  }

  setActiveLayerId(layerId: string): void {
    const frame = this.getActiveFrame();
    if (frame.getLayerById(layerId)) {
      this.activeLayerId = layerId;
    }
  }

  /**
   * Creates an empty Frame matching the exact synchronized layer stack (ids/names/visibility/opacity)
   * of the current document so multi-layer animation stays consistent across frames.
   */
  createFrameMatchingLayers(durationMs?: number): Frame {
    const templateLayers = this.getActiveFrame().layers;
    const frame = new Frame(this.width, this.height, {
      durationMs: durationMs ?? Math.round(1000 / this.fps),
    });
    frame.layers = templateLayers.map(
      (tmpl) =>
        new Layer(this.width, this.height, {
          id: tmpl.id,
          name: tmpl.name,
          visible: tmpl.visible,
          locked: tmpl.locked,
          opacity: tmpl.opacity,
        }),
    );
    return frame;
  }

  reset(width: number, height: number, name?: string): void {
    const check = validateCanvasDimensions(width, height);
    if (!check.valid) {
      throw new RangeError(check.error ?? "Invalid canvas dimensions");
    }
    this.id = `doc-${documentCounter++}`;
    this.name = name ?? this.name;
    this.width = width;
    this.height = height;
    this.selection = null;
    this.assetContext = {
      assetTypeId: "custom",
      preferredMaterialId: "wood",
    };
    const initialFrame = new Frame(width, height, {
      durationMs: Math.round(1000 / this.fps),
    });
    this.frames = [initialFrame];
    this.activeFrameIndex = 0;
    this.activeLayerId = initialFrame.layers[0]!.id;
  }
}
