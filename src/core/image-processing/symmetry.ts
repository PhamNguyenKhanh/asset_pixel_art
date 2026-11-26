import type { Point, SymmetryConfig } from "@/types/editor";

/**
 * Positive modulo wrap for Seamless Tile Mode.
 */
export function wrapCoord(value: number, size: number): number {
  if (size <= 0) return 0;
  return ((value % size) + size) % size;
}

/**
 * Normalizes a pixel coordinate according to Tile Mode, then expands it
 * across active X (left-right) and/or Y (top-bottom) symmetry axes.
 * Deduplicates coincident points (e.g. on center pixel of odd-width canvases).
 */
export function expandSymmetryPoints(
  x: number,
  y: number,
  width: number,
  height: number,
  symmetry: SymmetryConfig,
  tileMode = false,
): Point[] {
  const bx = tileMode ? wrapCoord(x, width) : x;
  const by = tileMode ? wrapCoord(y, height) : y;

  const points: Point[] = [{ x: bx, y: by }];

  const addUnique = (px: number, py: number) => {
    for (let i = 0; i < points.length; i++) {
      if (points[i]!.x === px && points[i]!.y === py) return;
    }
    points.push({ x: px, y: py });
  };

  const mx = width - 1 - bx;
  const my = height - 1 - by;

  if (symmetry.x) {
    addUnique(mx, by);
  }
  if (symmetry.y) {
    addUnique(bx, my);
  }
  if (symmetry.x && symmetry.y) {
    addUnique(mx, my);
  }

  return points;
}

/**
 * Checks whether point `b` forms an unwanted L-shaped 90-degree corner between `a` and `c`:
 * `a` and `c` are diagonally adjacent (|dx| === 1, |dy| === 1) and `b` shares an edge with both.
 */
export function isPixelPerfectCorner(a: Point, b: Point, c: Point): boolean {
  const dxAC = Math.abs(c.x - a.x);
  const dyAC = Math.abs(c.y - a.y);
  if (dxAC !== 1 || dyAC !== 1) return false;

  const distAB = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
  const distBC = Math.abs(c.x - b.x) + Math.abs(c.y - b.y);
  return distAB === 1 && distBC === 1;
}

/**
 * Aseprite-style Pixel-Perfect filter for a freehand 1px stroke sequence.
 * Removes redundant L-corner pixels while preserving diagonal continuity.
 */
export function filterPixelPerfectStroke(points: readonly Point[]): Point[] {
  const kept: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const pt = points[i]!;
    const prev = kept[kept.length - 1];
    if (prev && prev.x === pt.x && prev.y === pt.y) {
      continue;
    }
    if (kept.length >= 2) {
      const a = kept[kept.length - 2]!;
      const b = kept[kept.length - 1]!;
      if (isPixelPerfectCorner(a, b, pt)) {
        kept.pop();
      }
    }
    kept.push({ x: pt.x, y: pt.y });
  }
  return kept;
}
