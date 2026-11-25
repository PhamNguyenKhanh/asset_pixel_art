import { CANVAS_LIMITS } from "@/types/editor";
import { Frame } from "@/core/document/Frame";
import type { Layer } from "@/core/document/Layer";

let documentCounter = 1;

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
    const initialFrame = new Frame(width, height);
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

  reset(width: number, height: number, name?: string): void {
    const check = validateCanvasDimensions(width, height);
    if (!check.valid) {
      throw new RangeError(check.error ?? "Invalid canvas dimensions");
    }
    this.id = `doc-${documentCounter++}`;
    this.name = name ?? this.name;
    this.width = width;
    this.height = height;
    const initialFrame = new Frame(width, height);
    this.frames = [initialFrame];
    this.activeFrameIndex = 0;
    this.activeLayerId = initialFrame.layers[0]!.id;
  }
}
