import type { AssetContextState } from "@/types/assetContext";

export type ToolId =
  | "pencil"
  | "eraser"
  | "bucket"
  | "eyedropper"
  | "line"
  | "rectangle"
  | "ellipse"
  | "select"
  | "move";

export type ShapeFillMode = "outline" | "filled";

export type ResizeAnchor =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

export type ResizeMode = "canvas" | "scale";

export interface SymmetryConfig {
  x: boolean;
  y: boolean;
}

export type AutoOutlineMode = "solid" | "sel-out";
export type AutoOutlineConnectivity = 4 | 8;
export type AutoOutlineScope = "current-layer" | "current-frame" | "all-frames";

export interface AutoOutlineOptions {
  mode: AutoOutlineMode;
  color: RGBA;
  darkenAmount: number; // 0.15..0.85
  hueShift: number; // 0..1
  connectivity: AutoOutlineConnectivity;
  scope: AutoOutlineScope;
  createSeparateLayer: boolean;
}

export type ColorReplaceScope = "current-layer" | "current-frame" | "all-frames";

export interface ColorReplaceOptions {
  sourceColor: RGBA;
  targetColor: RGBA;
  tolerance: number; // 0..128
  scope: ColorReplaceScope;
}

export interface PaletteColorUsage {
  color: RGBA;
  packed: number;
  count: number;
}

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

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayerSummary {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
}

export interface FrameSummary {
  id: string;
  index: number;
  durationMs: number;
  revision: number;
}

export interface OnionSkinConfig {
  enabled: boolean;
  prevFrames: number;
  nextFrames: number;
  opacity: number; // 0..1
}

export interface CustomPalette {
  id: string;
  name: string;
  colors: RGBA[];
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

export const DEFAULT_FPS = 8;
export const MIN_FPS = 1;
export const MAX_FPS = 60;

export interface DocumentMetadataSnapshot {
  documentId: string;
  name: string;
  width: number;
  height: number;
  activeFrameIndex: number;
  activeLayerId: string;
  frameCount: number;
  layerCount: number;
  layers: LayerSummary[];
  frames: FrameSummary[];
  fps: number;
  onionSkin: OnionSkinConfig;
  selection: SelectionRect | null;
  assetContext: AssetContextState;
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  revision: number;
  lightingRevision: number;
}
