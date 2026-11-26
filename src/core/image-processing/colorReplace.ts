import type { DirtyRect, PaletteColorUsage, RGBA } from "@/types/editor";
import { PixelBuffer } from "@/core/document/PixelBuffer";
import { createEmptyDirtyRect, expandDirtyRect, isValidDirtyRect } from "@/core/canvas/dirtyRect";
import { packColor, unpackRGBA } from "@/core/image-processing/color";

export function colorMatchesWithTolerance(
  pixelPacked: number,
  sourcePacked: number,
  sourceColor: RGBA,
  tolerance: number,
): boolean {
  if (tolerance <= 0) {
    return pixelPacked === sourcePacked;
  }
  const px = unpackRGBA(pixelPacked);
  if (px.a === 0 && sourceColor.a === 0) return true;
  if (px.a === 0 || sourceColor.a === 0) return false;

  const dr = Math.abs(px.r - sourceColor.r);
  const dg = Math.abs(px.g - sourceColor.g);
  const db = Math.abs(px.b - sourceColor.b);
  const da = Math.abs(px.a - sourceColor.a);
  return Math.max(dr, dg, db, da) <= tolerance;
}

/**
 * Extracts unique non-transparent colors from one or more PixelBuffers,
 * sorted by descending pixel count.
 */
export function extractPaletteColors(
  buffers: readonly PixelBuffer[],
  maxColors = 64,
): PaletteColorUsage[] {
  const counts = new Map<number, number>();
  for (let b = 0; b < buffers.length; b++) {
    const view = buffers[b]!.view32;
    for (let i = 0; i < view.length; i++) {
      const packed = view[i]!;
      if ((packed >>> 24) === 0) continue; // skip fully transparent
      counts.set(packed, (counts.get(packed) ?? 0) + 1);
    }
  }

  const list: PaletteColorUsage[] = [];
  for (const [packed, count] of counts.entries()) {
    list.push({
      packed,
      color: unpackRGBA(packed),
      count,
    });
  }

  list.sort((a, b) => b.count - a.count);
  return list.slice(0, maxColors);
}

/**
 * Counts how many pixels across the given buffers match `sourceColor` within `tolerance`.
 */
export function countMatchingPixels(
  buffers: readonly PixelBuffer[],
  sourceColor: RGBA,
  tolerance = 0,
): number {
  const sourcePacked = packColor(sourceColor);
  let total = 0;
  for (let b = 0; b < buffers.length; b++) {
    const view = buffers[b]!.view32;
    for (let i = 0; i < view.length; i++) {
      if (colorMatchesWithTolerance(view[i]!, sourcePacked, sourceColor, tolerance)) {
        total++;
      }
    }
  }
  return total;
}

export interface ColorReplaceBufferResult {
  nextBuffer: PixelBuffer;
  replacedCount: number;
  dirtyRect: DirtyRect | null;
}

/**
 * Replaces all pixels in `source` matching `sourceColor` (within `tolerance`) with `targetColor`.
 * Returns a new PixelBuffer, count of replaced pixels, and minimal DirtyRect.
 */
export function replaceColorInBuffer(
  source: PixelBuffer,
  sourceColor: RGBA,
  targetColor: RGBA,
  tolerance = 0,
): ColorReplaceBufferResult {
  const sourcePacked = packColor(sourceColor);
  const targetPacked = packColor(targetColor);

  const nextBuffer = source.clone();
  if (sourcePacked === targetPacked && tolerance <= 0) {
    return { nextBuffer, replacedCount: 0, dirtyRect: null };
  }

  const { width, height } = source;
  const srcView = source.view32;
  const dstView = nextBuffer.view32;
  const dirty = createEmptyDirtyRect();
  let replacedCount = 0;

  for (let y = 0; y < height; y++) {
    const rowOff = y * width;
    for (let x = 0; x < width; x++) {
      const idx = rowOff + x;
      const cur = srcView[idx]!;
      if (!colorMatchesWithTolerance(cur, sourcePacked, sourceColor, tolerance)) {
        continue;
      }
      if (cur === targetPacked) continue;
      dstView[idx] = targetPacked;
      expandDirtyRect(dirty, x, y);
      replacedCount++;
    }
  }

  return {
    nextBuffer,
    replacedCount,
    dirtyRect: isValidDirtyRect(dirty) ? dirty : null,
  };
}
