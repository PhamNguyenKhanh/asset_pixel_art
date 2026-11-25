export type ToolId = "pencil" | "eraser" | "bucket" | "eyedropper";

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface HSV {
  h: number; // 0..360
  s: number; // 0..100
  v: number; // 0..100
}

export interface Point {
  x: number;
  y: number;
}

export interface DirtyRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const CANVAS_PRESETS = [16, 32, 64, 128, 256] as const;

export const CANVAS_LIMITS = {
  MIN_SIZE: 1,
  DEFAULT_SIZE: 32,
  RECOMMENDED_MAX: 512,
  HARD_MAX: 1024,
} as const;

export const MIN_BRUSH_SIZE = 1;
export const MAX_BRUSH_SIZE = 8;

export interface DocumentMetadataSnapshot {
  documentId: string;
  name: string;
  width: number;
  height: number;
  activeFrameIndex: number;
  activeLayerId: string;
  frameCount: number;
  layerCount: number;
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
}
