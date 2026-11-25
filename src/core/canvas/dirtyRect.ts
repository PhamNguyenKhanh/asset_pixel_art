import type { DirtyRect } from "@/types/editor";

export function createEmptyDirtyRect(): DirtyRect {
  return {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
}

export function createFullDirtyRect(width: number, height: number): DirtyRect {
  if (width <= 0 || height <= 0) {
    return createEmptyDirtyRect();
  }
  return {
    minX: 0,
    minY: 0,
    maxX: width - 1,
    maxY: height - 1,
  };
}

export function isValidDirtyRect(rect: DirtyRect | null | undefined): rect is DirtyRect {
  if (!rect) return false;
  return (
    Number.isFinite(rect.minX) &&
    Number.isFinite(rect.minY) &&
    Number.isFinite(rect.maxX) &&
    Number.isFinite(rect.maxY) &&
    rect.minX <= rect.maxX &&
    rect.minY <= rect.maxY
  );
}

export function expandDirtyRect(rect: DirtyRect, x: number, y: number): DirtyRect {
  if (x < rect.minX) rect.minX = x;
  if (y < rect.minY) rect.minY = y;
  if (x > rect.maxX) rect.maxX = x;
  if (y > rect.maxY) rect.maxY = y;
  return rect;
}

export function mergeDirtyRects(a: DirtyRect | null, b: DirtyRect | null): DirtyRect | null {
  const validA = isValidDirtyRect(a);
  const validB = isValidDirtyRect(b);
  if (!validA && !validB) return null;
  if (!validA) return { ...b! };
  if (!validB) return { ...a! };
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

export function clampDirtyRect(rect: DirtyRect, width: number, height: number): DirtyRect | null {
  if (!isValidDirtyRect(rect) || width <= 0 || height <= 0) {
    return null;
  }
  const minX = Math.max(0, Math.floor(rect.minX));
  const minY = Math.max(0, Math.floor(rect.minY));
  const maxX = Math.min(width - 1, Math.floor(rect.maxX));
  const maxY = Math.min(height - 1, Math.floor(rect.maxY));
  if (minX > maxX || minY > maxY) {
    return null;
  }
  return { minX, minY, maxX, maxY };
}

export function getDirtyRectSize(rect: DirtyRect): { width: number; height: number } {
  if (!isValidDirtyRect(rect)) {
    return { width: 0, height: 0 };
  }
  return {
    width: rect.maxX - rect.minX + 1,
    height: rect.maxY - rect.minY + 1,
  };
}
