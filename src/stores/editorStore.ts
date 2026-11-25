import { create } from "zustand";
import {
  CANVAS_LIMITS,
  MAX_BRUSH_SIZE,
  MIN_BRUSH_SIZE,
  type DocumentMetadataSnapshot,
  type Point,
  type RGBA,
  type ToolId,
} from "@/types/editor";
import { colorsEqual } from "@/core/image-processing/color";

const MAX_RECENT_COLORS = 12;

export interface EditorUIState {
  activeTool: ToolId;
  brushSize: number;
  primaryColor: RGBA;
  secondaryColor: RGBA;
  recentColors: RGBA[];
  zoom: number;
  showGrid: boolean;
  cursorPixel: Point | null;
  rightPanelOpen: boolean;
  documentMeta: DocumentMetadataSnapshot;

  setActiveTool: (tool: ToolId) => void;
  setBrushSize: (size: number) => void;
  setPrimaryColor: (color: RGBA) => void;
  setSecondaryColor: (color: RGBA) => void;
  swapColors: () => void;
  recordRecentColor: (color: RGBA) => void;
  setZoom: (zoom: number) => void;
  setShowGrid: (show: boolean) => void;
  setCursorPixel: (pixel: Point | null) => void;
  setRightPanelOpen: (open: boolean) => void;
  setDocumentMeta: (meta: DocumentMetadataSnapshot) => void;
}

const initialPrimary: RGBA = { r: 245, g: 166, b: 35, a: 255 };
const initialSecondary: RGBA = { r: 20, g: 22, b: 29, a: 255 };

export const useEditorStore = create<EditorUIState>((set) => ({
  activeTool: "pencil",
  brushSize: 1,
  primaryColor: initialPrimary,
  secondaryColor: initialSecondary,
  recentColors: [initialPrimary, initialSecondary],
  zoom: 12,
  showGrid: true,
  cursorPixel: null,
  rightPanelOpen: true,
  documentMeta: {
    documentId: "doc-0",
    name: "Untitled Sprite",
    width: CANVAS_LIMITS.DEFAULT_SIZE,
    height: CANVAS_LIMITS.DEFAULT_SIZE,
    activeFrameIndex: 0,
    activeLayerId: "layer-0",
    frameCount: 1,
    layerCount: 1,
    canUndo: false,
    canRedo: false,
    undoCount: 0,
    redoCount: 0,
  },

  setActiveTool: (activeTool) => set({ activeTool }),
  setBrushSize: (size) =>
    set({
      brushSize: Math.max(MIN_BRUSH_SIZE, Math.min(MAX_BRUSH_SIZE, Math.round(size))),
    }),
  setPrimaryColor: (primaryColor) => set({ primaryColor: { ...primaryColor } }),
  setSecondaryColor: (secondaryColor) => set({ secondaryColor: { ...secondaryColor } }),
  swapColors: () =>
    set((state) => ({
      primaryColor: state.secondaryColor,
      secondaryColor: state.primaryColor,
    })),
  recordRecentColor: (color) =>
    set((state) => {
      if (color.a === 0) return state;
      const filtered = state.recentColors.filter((c) => !colorsEqual(c, color));
      return {
        recentColors: [{ ...color }, ...filtered].slice(0, MAX_RECENT_COLORS),
      };
    }),
  setZoom: (zoom) => set({ zoom }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setCursorPixel: (cursorPixel) =>
    set((state) => {
      if (
        state.cursorPixel?.x === cursorPixel?.x &&
        state.cursorPixel?.y === cursorPixel?.y
      ) {
        return state;
      }
      return { cursorPixel };
    }),
  setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
  setDocumentMeta: (documentMeta) => set({ documentMeta }),
}));
