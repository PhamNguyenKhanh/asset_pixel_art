import type { DirtyRect } from "@/types/editor";
import type { PixelBuffer } from "@/core/document/PixelBuffer";
import { createEmptyDirtyRect, expandDirtyRect, getDirtyRectSize } from "@/core/canvas/dirtyRect";
import { unpackRGBA } from "@/core/image-processing/color";

export interface AnalyzedRegion {
  bounds: DirtyRect;
  width: number;
  height: number;
  /** Mask over [0..width*height-1] relative to bounds (1 = inside region, 0 = outside) */
  mask: Uint8Array;
  /** Approximate pixel distance from each interior pixel to nearest region boundary */
  edgeDistance: Uint16Array;
  maxEdgeDistance: number;
  pixelCount: number;
  seedX: number;
  seedY: number;
  seedAlpha: number;
  targetPacked: number;
}

export interface RegionAnalyzeOptions {
  tolerance?: number;
  preserveOutlines?: boolean;
  preserveTransparency?: boolean;
}

function pixelLuminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Iterative scanline region detector + 2-pass Chamfer/Manhattan distance transform.
 * Respects color tolerance, outline barriers, and transparency barriers without recursion.
 */
export function analyzeFillRegion(
  buffer: PixelBuffer,
  startX: number,
  startY: number,
  options: RegionAnalyzeOptions = {},
): AnalyzedRegion | null {
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  if (!buffer.isInBounds(sx, sy)) return null;

  const bufW = buffer.width;
  const bufH = buffer.height;
  const view = buffer.view32;
  const tolerance = Math.max(0, Math.min(128, Math.round(options.tolerance ?? 0)));
  const preserveOutlines = options.preserveOutlines ?? true;
  const preserveTransparency = options.preserveTransparency ?? true;

  const targetPacked = view[sy * bufW + sx]!;
  const targetRgba = unpackRGBA(targetPacked);
  const seedAlpha = targetRgba.a;
  const seedLum = pixelLuminance(targetRgba.r, targetRgba.g, targetRgba.b);

  const matchesPixel = (idx: number): boolean => {
    const packed = view[idx]!;
    if (packed === targetPacked) return true;
    if (tolerance === 0) return false;

    const rgba = unpackRGBA(packed);
    // Strict transparency boundary when preserveTransparency is enabled
    if (preserveTransparency) {
      if (seedAlpha > 0 && rgba.a === 0) return false;
      if (seedAlpha === 0 && rgba.a > 0) return false;
    }

    // Outline protection: never bleed across dark crisp outline strokes when seed isn't dark
    if (preserveOutlines && rgba.a > 128 && seedAlpha > 0) {
      const lum = pixelLuminance(rgba.r, rgba.g, rgba.b);
      if (lum < 0.18 && seedLum > 0.32) {
        return false;
      }
    }

    const diff =
      Math.max(
        Math.abs(rgba.r - targetRgba.r),
        Math.abs(rgba.g - targetRgba.g),
        Math.abs(rgba.b - targetRgba.b),
        Math.abs(rgba.a - targetRgba.a),
      );
    return diff <= tolerance;
  };

  const visited = new Uint8Array(bufW * bufH);
  const matchedIndices: number[] = [];
  const bounds = createEmptyDirtyRect();

  const stackX: number[] = [sx];
  const stackY: number[] = [sy];

  while (stackX.length > 0) {
    const seedCol = stackX.pop()!;
    const y = stackY.pop()!;
    const rowOffset = y * bufW;

    if (visited[rowOffset + seedCol] || !matchesPixel(rowOffset + seedCol)) {
      continue;
    }

    let left = seedCol;
    while (left > 0 && !visited[rowOffset + left - 1] && matchesPixel(rowOffset + left - 1)) {
      left--;
    }

    let right = seedCol;
    while (
      right < bufW - 1 &&
      !visited[rowOffset + right + 1] &&
      matchesPixel(rowOffset + right + 1)
    ) {
      right++;
    }

    for (let x = left; x <= right; x++) {
      const idx = rowOffset + x;
      visited[idx] = 1;
      matchedIndices.push(idx);
    }
    expandDirtyRect(bounds, left, y);
    expandDirtyRect(bounds, right, y);

    if (y > 0) {
      const aboveOffset = (y - 1) * bufW;
      let inSpan = false;
      for (let x = left; x <= right; x++) {
        const idx = aboveOffset + x;
        if (!visited[idx] && matchesPixel(idx)) {
          if (!inSpan) {
            stackX.push(x);
            stackY.push(y - 1);
            inSpan = true;
          }
        } else {
          inSpan = false;
        }
      }
    }

    if (y < bufH - 1) {
      const belowOffset = (y + 1) * bufW;
      let inSpan = false;
      for (let x = left; x <= right; x++) {
        const idx = belowOffset + x;
        if (!visited[idx] && matchesPixel(idx)) {
          if (!inSpan) {
            stackX.push(x);
            stackY.push(y + 1);
            inSpan = true;
          }
        } else {
          inSpan = false;
        }
      }
    }
  }

  if (matchedIndices.length === 0) return null;

  const { width, height } = getDirtyRectSize(bounds);
  const mask = new Uint8Array(width * height);

  for (let i = 0; i < matchedIndices.length; i++) {
    const idx = matchedIndices[i]!;
    const gx = idx % bufW;
    const gy = (idx - gx) / bufW;
    const lx = gx - bounds.minX;
    const ly = gy - bounds.minY;
    mask[ly * width + lx] = 1;
  }

  // 2-pass Manhattan distance transform from region boundary inward
  const INF = 65535;
  const edgeDistance = new Uint16Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (mask[i] === 0) {
        edgeDistance[i] = 0;
        continue;
      }
      // Touching outer canvas/bounding box boundary starts at distance 1
      const isBorder =
        x === 0 ||
        y === 0 ||
        x === width - 1 ||
        y === height - 1 ||
        mask[i - 1] === 0 ||
        mask[i + 1] === 0 ||
        mask[i - width] === 0 ||
        mask[i + width] === 0;
      edgeDistance[i] = isBorder ? 1 : INF;
    }
  }

  // Forward pass (top-left -> bottom-right)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (mask[i] === 0 || edgeDistance[i] === 1) continue;
      let best = edgeDistance[i]!;
      if (x > 0) best = Math.min(best, edgeDistance[i - 1]! + 1);
      if (y > 0) best = Math.min(best, edgeDistance[i - width]! + 1);
      edgeDistance[i] = best;
    }
  }

  // Backward pass (bottom-right -> top-left)
  let maxEdgeDistance = 1;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (mask[i] === 0) continue;
      let best = edgeDistance[i]!;
      if (x < width - 1) best = Math.min(best, edgeDistance[i + 1]! + 1);
      if (y < height - 1) best = Math.min(best, edgeDistance[i + width]! + 1);
      edgeDistance[i] = best;
      if (best > maxEdgeDistance) {
        maxEdgeDistance = best;
      }
    }
  }

  return {
    bounds,
    width,
    height,
    mask,
    edgeDistance,
    maxEdgeDistance,
    pixelCount: matchedIndices.length,
    seedX: sx,
    seedY: sy,
    seedAlpha,
    targetPacked,
  };
}
