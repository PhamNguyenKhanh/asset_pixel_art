import { Layer } from "@/core/document/Layer";

let frameCounter = 1;

export interface FrameOptions {
  id?: string;
  durationMs?: number;
}

export class Frame {
  readonly id: string;
  durationMs: number;
  layers: Layer[];

  constructor(width: number, height: number, options: FrameOptions = {}) {
    this.id = options.id ?? `frame-${frameCounter++}`;
    this.durationMs = Math.max(16, Math.round(options.durationMs ?? 100));
    this.layers = [new Layer(width, height, { name: "Layer 1" })];
  }

  getLayerById(layerId: string): Layer | undefined {
    return this.layers.find((layer) => layer.id === layerId);
  }
}
