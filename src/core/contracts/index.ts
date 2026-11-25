import type { DirtyRect, RGBA, ToolId } from "@/types/editor";
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
  setPrimaryColor(color: RGBA): void;
  setSecondaryColor(color: RGBA): void;
  recordRecentColor(color: RGBA): void;
  markDirty(rect?: DirtyRect): void;
  notifyDocumentChanged(): void;
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

/** Forward-compatible contract for Phase 3 Dynamic Asset Context */
export interface IAssetContextProfile {
  readonly id: string;
  readonly label: string;
  readonly suggestedPalettes: readonly string[][];
}

export interface IAssetContextProvider {
  getActiveProfile(): IAssetContextProfile;
}

/** Forward-compatible contract for Phase 5 Non-destructive Lighting */
export interface ILightingPipeline {
  readonly enabled: boolean;
  process(source: PixelBuffer, target: PixelBuffer): void;
}
