import type { Point } from "@/types/editor";

/**
 * Integer Bresenham line algorithm.
 * Guarantees connected, gap-free pixel paths for fast pointer movement.
 */
export function bresenhamLine(x0: number, y0: number, x1: number, y1: number): Point[] {
  let cx = Math.floor(x0);
  let cy = Math.floor(y0);
  const tx = Math.floor(x1);
  const ty = Math.floor(y1);

  const points: Point[] = [];
  const dx = Math.abs(tx - cx);
  const dy = Math.abs(ty - cy);
  const sx = cx < tx ? 1 : -1;
  const sy = cy < ty ? 1 : -1;
  let err = dx - dy;

  while (true) {
    points.push({ x: cx, y: cy });
    if (cx === tx && cy === ty) {
      break;
    }
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }

  return points;
}

/**
 * Computes pixel offsets for a square pixel-art brush of given size (1..N).
 * Size 1 -> [(0,0)], Size 2 -> [0..1, 0..1], Size 3 -> [-1..1, -1..1], etc.
 */
export function getSquareBrushOffsets(size: number): Point[] {
  const clamped = Math.max(1, Math.floor(size));
  const start = -Math.floor((clamped - 1) / 2);
  const offsets: Point[] = [];
  for (let dy = 0; dy < clamped; dy++) {
    for (let dx = 0; dx < clamped; dx++) {
      offsets.push({ x: start + dx, y: start + dy });
    }
  }
  return offsets;
}
