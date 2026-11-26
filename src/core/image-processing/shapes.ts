import type { Point } from "@/types/editor";
import { bresenhamLine } from "@/core/image-processing/bresenham";

/**
 * Computes line pixels with optional Shift constraint to 0 / 45 / 90 degree angles.
 */
export function getLinePoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  constrainAngle = false,
): Point[] {
  const sx = Math.floor(x0);
  const sy = Math.floor(y0);
  let ex = Math.floor(x1);
  let ey = Math.floor(y1);

  if (constrainAngle) {
    const dx = ex - sx;
    const dy = ey - sy;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx > absDy * 2) {
      ey = sy;
    } else if (absDy > absDx * 2) {
      ex = sx;
    } else {
      const dist = Math.max(absDx, absDy);
      ex = sx + (dx >= 0 ? dist : -dist);
      ey = sy + (dy >= 0 ? dist : -dist);
    }
  }

  return bresenhamLine(sx, sy, ex, ey);
}

export function normalizeBoxCoords(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  constrainSquare = false,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const sx = Math.floor(x0);
  const sy = Math.floor(y0);
  let ex = Math.floor(x1);
  let ey = Math.floor(y1);

  if (constrainSquare) {
    const dx = ex - sx;
    const dy = ey - sy;
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    ex = sx + (dx >= 0 ? side : -side);
    ey = sy + (dy >= 0 ? side : -side);
  }

  return {
    minX: Math.min(sx, ex),
    minY: Math.min(sy, ey),
    maxX: Math.max(sx, ex),
    maxY: Math.max(sy, ey),
  };
}

/**
 * Computes crisp pixel coordinates for an axis-aligned rectangle (outline or filled).
 */
export function getRectanglePoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  filled: boolean,
  constrainSquare = false,
): Point[] {
  const { minX, minY, maxX, maxY } = normalizeBoxCoords(x0, y0, x1, y1, constrainSquare);
  const points: Point[] = [];

  if (filled || maxX - minX <= 1 || maxY - minY <= 1) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        points.push({ x, y });
      }
    }
    return points;
  }

  // Top & bottom edges
  for (let x = minX; x <= maxX; x++) {
    points.push({ x, y: minY });
    points.push({ x, y: maxY });
  }
  // Left & right edges (excluding corners)
  for (let y = minY + 1; y < maxY; y++) {
    points.push({ x: minX, y });
    points.push({ x: maxX, y });
  }

  return points;
}

/**
 * Crisp integer Midpoint / Bresenham Ellipse bounded cleanly inside [minX..maxX, minY..maxY].
 * Works identically for even and odd pixel widths/heights without symmetry glitches.
 */
export function getEllipsePoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  filled: boolean,
  constrainCircle = false,
): Point[] {
  const { minX, minY, maxX, maxY } = normalizeBoxCoords(x0, y0, x1, y1, constrainCircle);

  if (minX === maxX && minY === maxY) {
    return [{ x: minX, y: minY }];
  }
  if (maxX - minX <= 1 || maxY - minY <= 1) {
    return getRectanglePoints(minX, minY, maxX, maxY, true);
  }

  let lx = minX;
  let rx = maxX;
  let ty = minY;
  let by = maxY;

  const a = rx - lx;
  const b = by - ty;
  let b1 = b & 1;

  let dx = 4 * (1 - a) * b * b;
  let dy = 4 * (b1 + 1) * a * a;
  let err = dx + dy + b1 * a * a;

  // Track left/right spans per row for clean filling without gaps
  const rowBounds = new Map<number, { min: number; max: number }>();
  const outlineSet = new Set<string>();
  const outlinePoints: Point[] = [];

  const recordPoint = (px: number, py: number) => {
    const key = `${px},${py}`;
    if (!outlineSet.has(key)) {
      outlineSet.add(key);
      outlinePoints.push({ x: px, y: py });
    }
    const existing = rowBounds.get(py);
    if (!existing) {
      rowBounds.set(py, { min: px, max: px });
    } else {
      if (px < existing.min) existing.min = px;
      if (px > existing.max) existing.max = px;
    }
  };

  ty += Math.floor((b + 1) / 2);
  by = ty - b1;
  const a8 = 8 * a * a;
  b1 = 8 * b * b;

  do {
    recordPoint(rx, ty);
    recordPoint(lx, ty);
    recordPoint(lx, by);
    recordPoint(rx, by);

    const e2 = 2 * err;
    if (e2 <= dy) {
      ty++;
      by--;
      dy += a8;
      err += dy;
    }
    if (e2 >= dx || 2 * err > dy) {
      lx++;
      rx--;
      dx += b1;
      err += dx;
    }
  } while (lx <= rx);

  while (ty - by <= b) {
    recordPoint(lx - 1, ty);
    recordPoint(rx + 1, ty);
    recordPoint(lx - 1, by);
    recordPoint(rx + 1, by);
    ty++;
    by--;
  }

  if (!filled) {
    return outlinePoints;
  }

  const filledPoints: Point[] = [];
  for (const [py, bounds] of rowBounds.entries()) {
    for (let px = bounds.min; px <= bounds.max; px++) {
      filledPoints.push({ x: px, y: py });
    }
  }
  return filledPoints;
}
