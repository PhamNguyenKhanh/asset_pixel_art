import type { DirtyRect, RGBA } from "@/types/editor";
import {
  clampDirtyRect,
  createEmptyDirtyRect,
  expandDirtyRect,
  getDirtyRectSize,
} from "@/core/canvas/dirtyRect";
import {
  packColor,
  TRANSPARENT_PACKED,
  unpackRGBA,
} from "@/core/image-processing/color";
import { getSquareBrushOffsets } from "@/core/image-processing/bresenham";

export class PixelBuffer {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
  readonly view32: Uint32Array;

  constructor(width: number, height: number, existingData?: Uint8ClampedArray) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      throw new RangeError(`Invalid PixelBuffer dimensions: ${width}x${height}`);
    }
    this.width = width;
    this.height = height;
    const expectedLength = width * height * 4;
    if (existingData) {
      if (existingData.length !== expectedLength) {
        throw new RangeError(
          `Existing buffer length ${existingData.length} does not match expected ${expectedLength}`,
        );
      }
      this.data = existingData;
    } else {
      this.data = new Uint8ClampedArray(expectedLength);
    }
    this.view32 = new Uint32Array(
      this.data.buffer,
      this.data.byteOffset,
      width * height,
    );
  }

  get byteLength(): number {
    return this.data.byteLength;
  }

  isInBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  getIndex(x: number, y: number): number {
    return y * this.width + x;
  }

  getPacked(x: number, y: number): number {
    if (!this.isInBounds(x, y)) return TRANSPARENT_PACKED;
    return this.view32[y * this.width + x]!;
  }

  setPacked(x: number, y: number, packedColor: number): boolean {
    if (!this.isInBounds(x, y)) return false;
    const idx = y * this.width + x;
    const next = packedColor >>> 0;
    if (this.view32[idx] === next) return false;
    this.view32[idx] = next;
    return true;
  }

  getPixel(x: number, y: number): RGBA {
    return unpackRGBA(this.getPacked(x, y));
  }

  setPixel(x: number, y: number, color: RGBA): boolean {
    return this.setPacked(x, y, packColor(color));
  }

  stampSquareBrush(
    cx: number,
    cy: number,
    brushSize: number,
    packedColor: number,
    dirtyRect?: DirtyRect,
  ): boolean {
    const offsets = getSquareBrushOffsets(brushSize);
    let mutated = false;
    for (let i = 0; i < offsets.length; i++) {
      const offset = offsets[i]!;
      const px = cx + offset.x;
      const py = cy + offset.y;
      if (this.setPacked(px, py, packedColor)) {
        mutated = true;
        if (dirtyRect) {
          expandDirtyRect(dirtyRect, px, py);
        }
      }
    }
    return mutated;
  }

  clear(): void {
    this.view32.fill(TRANSPARENT_PACKED);
  }

  fill(packedColor: number): void {
    this.view32.fill(packedColor >>> 0);
  }

  extractRect(rect: DirtyRect): Uint8ClampedArray {
    const clamped = clampDirtyRect(rect, this.width, this.height);
    if (!clamped) {
      return new Uint8ClampedArray(0);
    }
    const { width: rw, height: rh } = getDirtyRectSize(clamped);
    const out = new Uint8ClampedArray(rw * rh * 4);
    const rowBytes = rw * 4;
    for (let row = 0; row < rh; row++) {
      const srcOffset = ((clamped.minY + row) * this.width + clamped.minX) * 4;
      const dstOffset = row * rowBytes;
      out.set(this.data.subarray(srcOffset, srcOffset + rowBytes), dstOffset);
    }
    return out;
  }

  writeRect(rect: DirtyRect, pixels: Uint8ClampedArray): void {
    const clamped = clampDirtyRect(rect, this.width, this.height);
    if (!clamped) return;
    const { width: rw, height: rh } = getDirtyRectSize(clamped);
    const expected = rw * rh * 4;
    if (pixels.length !== expected) {
      throw new RangeError(
        `Pixel patch size mismatch: received ${pixels.length}, expected ${expected}`,
      );
    }
    const rowBytes = rw * 4;
    for (let row = 0; row < rh; row++) {
      const srcOffset = row * rowBytes;
      const dstOffset = ((clamped.minY + row) * this.width + clamped.minX) * 4;
      this.data.set(pixels.subarray(srcOffset, srcOffset + rowBytes), dstOffset);
    }
  }

  clone(): PixelBuffer {
    const copy = new Uint8ClampedArray(this.data.length);
    copy.set(this.data);
    return new PixelBuffer(this.width, this.height, copy);
  }

  computeDiffRect(other: PixelBuffer): DirtyRect | null {
    if (other.width !== this.width || other.height !== this.height) {
      throw new RangeError("Cannot diff buffers with different dimensions");
    }
    const rect = createEmptyDirtyRect();
    let changed = false;
    const len = this.view32.length;
    for (let i = 0; i < len; i++) {
      if (this.view32[i] !== other.view32[i]) {
        const x = i % this.width;
        const y = (i - x) / this.width;
        expandDirtyRect(rect, x, y);
        changed = true;
      }
    }
    return changed ? rect : null;
  }
}
