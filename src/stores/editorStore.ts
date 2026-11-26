import { create } from "zustand";
import {
  CANVAS_LIMITS,
  DEFAULT_FPS,
  MAX_BRUSH_SIZE,
  MIN_BRUSH_SIZE,
  type CustomPalette,
  type DocumentMetadataSnapshot,
  type Point,
  type RGBA,
  type ShapeFillMode,
  type ToolId,
} from "@/types/editor";
import { colorsEqual, hexToRgba } from "@/core/image-processing/color";
import {
  addColorToPalette,
  createCustomPalette,
  removeColorFromPalette,
  saveCustomPalettes,
} from "@/modules/color-management/PaletteManager";

const MAX_RECENT_COLORS = 12;

export type InspectorTab = "colors" | "layers" | "context";

export interface EditorUIState {
  activeTool: ToolId;
  brushSize: number;
  shapeFillMode: ShapeFillMode;
  primaryColor: RGBA;
  secondaryColor: RGBA;
  recentColors: RGBA[];
  customPalettes: CustomPalette[];
  zoom: number;
  showGrid: boolean;
  cursorPixel: Point | null;
  rightPanelOpen: boolean;
  inspectorTab: InspectorTab;
  timelineOpen: boolean;
  isPlaying: boolean;
  lastSavedAt: string | null;
  documentMeta: DocumentMetadataSnapshot;

  setActiveTool: (tool: ToolId) => void;
  setBrushSize: (size: number) => void;
  setShapeFillMode: (mode: ShapeFillMode) => void;
  setPrimaryColor: (color: RGBA) => void;
  setSecondaryColor: (color: RGBA) => void;
  swapColors: () => void;
  recordRecentColor: (color: RGBA) => void;
  setCustomPalettes: (palettes: CustomPalette[]) => void;
  addCustomPalette: (name: string) => void;
  importNamedPalette: (name: string, hexColors: readonly string[]) => void;
  deleteCustomPalette: (id: string) => void;
  addColorToCustomPalette: (paletteId: string, color: RGBA) => void;
  removeColorFromCustomPalette: (paletteId: string, index: number) => void;
  setZoom: (zoom: number) => void;
  setShowGrid: (show: boolean) => void;
  setCursorPixel: (pixel: Point | null) => void;
  setRightPanelOpen: (open: boolean) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  setTimelineOpen: (open: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
  setLastSavedAt: (iso: string | null) => void;
  setDocumentMeta: (meta: DocumentMetadataSnapshot) => void;
}

const initialPrimary: RGBA = { r: 245, g: 166, b: 35, a: 255 };
const initialSecondary: RGBA = { r: 20, g: 22, b: 29, a: 255 };

export const useEditorStore = create<EditorUIState>((set) => ({
  activeTool: "pencil",
  brushSize: 1,
  shapeFillMode: "outline",
  primaryColor: initialPrimary,
  secondaryColor: initialSecondary,
  recentColors: [initialPrimary, initialSecondary],
  customPalettes: [],
  zoom: 12,
  showGrid: true,
  cursorPixel: null,
  rightPanelOpen: true,
  inspectorTab: "colors",
  timelineOpen: true,
  isPlaying: false,
  lastSavedAt: null,
  documentMeta: {
    documentId: "doc-0",
    name: "Untitled Sprite",
    width: CANVAS_LIMITS.DEFAULT_SIZE,
    height: CANVAS_LIMITS.DEFAULT_SIZE,
    activeFrameIndex: 0,
    activeLayerId: "layer-0",
    frameCount: 1,
    layerCount: 1,
    layers: [{ id: "layer-0", name: "Layer 1", visible: true, locked: false, opacity: 1 }],
    frames: [{ id: "frame-0", index: 0, durationMs: Math.round(1000 / DEFAULT_FPS) }],
    fps: DEFAULT_FPS,
    onionSkin: { enabled: false, prevFrames: 1, nextFrames: 1, opacity: 0.3 },
    selection: null,
    assetContext: { assetTypeId: "custom", preferredMaterialId: "wood" },
    canUndo: false,
    canRedo: false,
    undoCount: 0,
    redoCount: 0,
    revision: 0,
  },

  setActiveTool: (activeTool) => set({ activeTool }),
  setBrushSize: (size) =>
    set({
      brushSize: Math.max(MIN_BRUSH_SIZE, Math.min(MAX_BRUSH_SIZE, Math.round(size))),
    }),
  setShapeFillMode: (shapeFillMode) => set({ shapeFillMode }),
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
  setCustomPalettes: (customPalettes) => set({ customPalettes }),
  addCustomPalette: (name) =>
    set((state) => {
      const next = [...state.customPalettes, createCustomPalette(name, [state.primaryColor])];
      saveCustomPalettes(next);
      return { customPalettes: next };
    }),
  importNamedPalette: (name, hexColors) =>
    set((state) => {
      const parsed = hexColors
        .map((hex) => hexToRgba(hex))
        .filter((c): c is RGBA => c !== null);
      if (parsed.length === 0) return state;
      const next = [...state.customPalettes, createCustomPalette(name, parsed)];
      saveCustomPalettes(next);
      return { customPalettes: next };
    }),
  deleteCustomPalette: (id) =>
    set((state) => {
      const next = state.customPalettes.filter((p) => p.id !== id);
      saveCustomPalettes(next);
      return { customPalettes: next };
    }),
  addColorToCustomPalette: (paletteId, color) =>
    set((state) => {
      const next = state.customPalettes.map((p) =>
        p.id === paletteId ? addColorToPalette(p, color) : p,
      );
      saveCustomPalettes(next);
      return { customPalettes: next };
    }),
  removeColorFromCustomPalette: (paletteId, index) =>
    set((state) => {
      const next = state.customPalettes.map((p) =>
        p.id === paletteId ? removeColorFromPalette(p, index) : p,
      );
      saveCustomPalettes(next);
      return { customPalettes: next };
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
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  setTimelineOpen: (timelineOpen) => set({ timelineOpen }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setLastSavedAt: (lastSavedAt) => set({ lastSavedAt }),
  setDocumentMeta: (documentMeta) => set({ documentMeta }),
}));
