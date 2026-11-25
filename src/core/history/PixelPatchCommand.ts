import type { DirtyRect } from "@/types/editor";
import type { ICommand } from "@/core/contracts";
import type { PixelDocument } from "@/core/document/PixelDocument";

export interface PixelPatchCommandParams {
  name: string;
  document: PixelDocument;
  frameId: string;
  layerId: string;
  rect: DirtyRect;
  beforePixels: Uint8ClampedArray;
  afterPixels: Uint8ClampedArray;
  onApplied?: (rect: DirtyRect) => void;
}

/**
 * Patch-based pixel diff command.
 * Stores only the minimal dirty rectangle before/after bytes instead of cloning the whole canvas.
 */
export class PixelPatchCommand implements ICommand {
  readonly name: string;
  readonly byteSize: number;

  private readonly document: PixelDocument;
  private readonly frameId: string;
  private readonly layerId: string;
  private readonly rect: DirtyRect;
  private readonly beforePixels: Uint8ClampedArray;
  private readonly afterPixels: Uint8ClampedArray;
  private readonly onApplied?: (rect: DirtyRect) => void;

  constructor(params: PixelPatchCommandParams) {
    this.name = params.name;
    this.document = params.document;
    this.frameId = params.frameId;
    this.layerId = params.layerId;
    this.rect = { ...params.rect };
    this.beforePixels = params.beforePixels;
    this.afterPixels = params.afterPixels;
    this.onApplied = params.onApplied;
    this.byteSize = this.beforePixels.byteLength + this.afterPixels.byteLength;
  }

  execute(): void {
    const layer = this.document.getLayer(this.frameId, this.layerId);
    if (!layer) return;
    layer.buffer.writeRect(this.rect, this.afterPixels);
    this.onApplied?.(this.rect);
  }

  undo(): void {
    const layer = this.document.getLayer(this.frameId, this.layerId);
    if (!layer) return;
    layer.buffer.writeRect(this.rect, this.beforePixels);
    this.onApplied?.(this.rect);
  }
}
