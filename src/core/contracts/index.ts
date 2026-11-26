import type { DirtyRect, RGBA, SelectionRect, ShapeFillMode, ToolId } from "@/types/editor";
import type { SmartFillConfig } from "@/types/smartFill";
import type {
  AssetContextProfile,
  AssetContextState,
  AssetTypeId,
  MaterialPreset,
  MaterialPresetId,
} from "@/types/assetContext";
import type { PixelDocument } from "@/core/document/PixelDocument";
import type { PixelBuffer } from "@/core/document/PixelBuffer";
import type { HistoryManager } from "@/core/history/HistoryManager";

export interface ICommand {
  readonly name: string;
  readonly byteSize: number;
  execute(): void;
  undo(): void;
}

export interface PointerInputEvent {
  pixelX: number;
  pixelY: number;
  prevPixelX: number | null;
  prevPixelY: number | null;
  button: number;
  buttons: number;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export interface IToolContext {
  readonly document: PixelDocument;
  readonly history: HistoryManager;
  getPrimaryColor(): RGBA;
  getSecondaryColor(): RGBA;
  getBrushSize(): number;
  getShapeFillMode(): ShapeFillMode;
  setPrimaryColor(color: RGBA): void;
  setSecondaryColor(color: RGBA): void;
  recordRecentColor(color: RGBA): void;
  getSelection(): SelectionRect | null;
  setSelection(rect: SelectionRect | null): void;
  setPreviewBuffer(buffer: PixelBuffer | null, replaceActiveLayer?: boolean): void;
  markDirty(rect?: DirtyRect): void;
  notifyDocumentChanged(): void;
  getAssetContext(): AssetContextProfile;
  getSmartFillConfig(): SmartFillConfig;
  startSmartFillPreview(seedX: number, seedY: number, baseColor: RGBA): boolean;
  cancelSmartFillPreview(): void;
}

export interface ITool {
  readonly id: ToolId;
  readonly label: string;
  readonly shortcut: string;
  readonly cursor: string;
  onPointerDown(event: PointerInputEvent, ctx: IToolContext): void;
  onPointerMove(event: PointerInputEvent, ctx: IToolContext): void;
  onPointerUp(event: PointerInputEvent, ctx: IToolContext): void;
  onCancel?(ctx: IToolContext): void;
}

/** Shared read-only contract for Dynamic Asset Context consumed by Smart Fill, Lighting, and Color tools */
export interface IAssetContextProvider {
  getState(): AssetContextState;
  getActiveProfile(): AssetContextProfile;
  getProfile(id: AssetTypeId): AssetContextProfile | undefined;
  listProfiles(): readonly AssetContextProfile[];
  getMaterialPreset(id: MaterialPresetId): MaterialPreset | undefined;
  getRecommendedMaterials(): readonly MaterialPreset[];
}

/** Forward-compatible contract for Phase 5 Non-destructive Lighting */
export interface ILightingPipeline {
  readonly enabled: boolean;
  process(
    source: PixelBuffer,
    target: PixelBuffer,
    contextProfile?: AssetContextProfile,
  ): void;
}
