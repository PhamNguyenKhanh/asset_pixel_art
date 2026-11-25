import { PixelBuffer } from "@/core/document/PixelBuffer";

export interface SurfaceMaps {
  heightMap?: Uint8Array;
  occlusionMask?: Uint8Array;
}

export interface LayerOptions {
  id?: string;
  name?: string;
  visible?: boolean;
  locked?: boolean;
  opacity?: number;
}

let layerCounter = 1;

export class Layer {
  readonly id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  readonly buffer: PixelBuffer;
  surfaceMaps?: SurfaceMaps;

  constructor(width: number, height: number, options: LayerOptions = {}) {
    this.id = options.id ?? `layer-${layerCounter++}`;
    this.name = options.name ?? "Layer 1";
    this.visible = options.visible ?? true;
    this.locked = options.locked ?? false;
    this.opacity = Math.max(0, Math.min(1, options.opacity ?? 1));
    this.buffer = new PixelBuffer(width, height);
  }

  clone(): Layer {
    const copy = new Layer(this.buffer.width, this.buffer.height, {
      name: this.name,
      visible: this.visible,
      locked: this.locked,
      opacity: this.opacity,
    });
    copy.buffer.data.set(this.buffer.data);
    return copy;
  }
}
