import type { DirtyRect } from "@/types/editor";
import { createEmptyDirtyRect, expandDirtyRect } from "@/core/canvas/dirtyRect";
import type { PixelBuffer } from "@/core/document/PixelBuffer";

export interface FloodFillSpan {
  y: number;
  left: number;
  right: number;
}

export interface FloodFillResult {
  changed: boolean;
  filledCount: number;
  targetColor: number;
  dirtyRect: DirtyRect | null;
  spans: FloodFillSpan[];
}

/**
 * Iterative 4-way Scanline Flood Fill operating directly on Uint32Array.
 * Safe for large canvases (no recursion / stack overflow) and records filled spans
 * so patch-based Undo commands never need to clone the entire buffer.
 */
export function scanlineFloodFill(
  buffer: PixelBuffer,
  startX: number,
  startY: number,
  fillPackedColor: number,
  wrap = false,
): FloodFillResult {
  const width = buffer.width;
  const height = buffer.height;
  const sx = wrap ? (((Math.floor(startX) % width) + width) % width) : Math.floor(startX);
  const sy = wrap ? (((Math.floor(startY) % height) + height) % height) : Math.floor(startY);

  if (!buffer.isInBounds(sx, sy)) {
    return { changed: false, filledCount: 0, targetColor: 0, dirtyRect: null, spans: [] };
  }

  const view = buffer.view32;
  const targetColor = view[sy * width + sx]!;
  const replacement = fillPackedColor >>> 0;

  if (targetColor === replacement) {
    return { changed: false, filledCount: 0, targetColor, dirtyRect: null, spans: [] };
  }

  const dirtyRect = createEmptyDirtyRect();
  const spans: FloodFillSpan[] = [];
  let filledCount = 0;

  const stackX: number[] = [sx];
  const stackY: number[] = [sy];

  while (stackX.length > 0) {
    const seedX = stackX.pop()!;
    const y = stackY.pop()!;
    const rowOffset = y * width;

    if (view[rowOffset + seedX] !== targetColor) {
      continue;
    }

    let left = seedX;
    while (left > 0 && view[rowOffset + left - 1] === targetColor) {
      left--;
    }

    let right = seedX;
    while (right < width - 1 && view[rowOffset + right + 1] === targetColor) {
      right++;
    }

    for (let x = left; x <= right; x++) {
      view[rowOffset + x] = replacement;
    }
    spans.push({ y, left, right });
    filledCount += right - left + 1;
    expandDirtyRect(dirtyRect, left, y);
    expandDirtyRect(dirtyRect, right, y);

    if (wrap) {
      if (left === 0 && view[rowOffset + width - 1] === targetColor) {
        stackX.push(width - 1);
        stackY.push(y);
      }
      if (right === width - 1 && view[rowOffset] === targetColor) {
        stackX.push(0);
        stackY.push(y);
      }
    }

    const pushRowSeeds = (ny: number) => {
      const nOffset = ny * width;
      let inSpan = false;
      for (let x = left; x <= right; x++) {
        if (view[nOffset + x] === targetColor) {
          if (!inSpan) {
            stackX.push(x);
            stackY.push(ny);
            inSpan = true;
          }
        } else {
          inSpan = false;
        }
      }
    };

    if (y > 0) {
      pushRowSeeds(y - 1);
    } else if (wrap && height > 1) {
      pushRowSeeds(height - 1);
    }

    if (y < height - 1) {
      pushRowSeeds(y + 1);
    } else if (wrap && height > 1) {
      pushRowSeeds(0);
    }
  }

  return {
    changed: filledCount > 0,
    filledCount,
    targetColor,
    dirtyRect: filledCount > 0 ? dirtyRect : null,
    spans,
  };
}
