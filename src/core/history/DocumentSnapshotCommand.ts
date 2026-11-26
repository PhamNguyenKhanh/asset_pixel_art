import type { ICommand } from "@/core/contracts";
import type { PixelDocument } from "@/core/document/PixelDocument";
import { Frame } from "@/core/document/Frame";
import { Layer } from "@/core/document/Layer";

export interface DocumentStateSnapshot {
  width: number;
  height: number;
  name: string;
  fps: number;
  activeFrameIndex: number;
  activeLayerId: string;
  frames: Frame[];
}

export function captureDocumentSnapshot(doc: PixelDocument): DocumentStateSnapshot {
  const frames = doc.frames.map((frame) => {
    const clonedFrame = new Frame(doc.width, doc.height, {
      id: frame.id,
      durationMs: frame.durationMs,
    });
    clonedFrame.layers = frame.layers.map((layer) => {
      const clonedLayer = new Layer(doc.width, doc.height, {
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        opacity: layer.opacity,
      });
      clonedLayer.buffer.data.set(layer.buffer.data);
      return clonedLayer;
    });
    return clonedFrame;
  });

  return {
    width: doc.width,
    height: doc.height,
    name: doc.name,
    fps: doc.fps,
    activeFrameIndex: doc.activeFrameIndex,
    activeLayerId: doc.activeLayerId,
    frames,
  };
}

export function applyDocumentSnapshot(
  doc: PixelDocument,
  snapshot: DocumentStateSnapshot,
): void {
  const cloned = captureDocumentSnapshot({
    ...doc,
    width: snapshot.width,
    height: snapshot.height,
    name: snapshot.name,
    fps: snapshot.fps,
    activeFrameIndex: snapshot.activeFrameIndex,
    activeLayerId: snapshot.activeLayerId,
    frames: snapshot.frames,
  } as PixelDocument);

  doc.width = cloned.width;
  doc.height = cloned.height;
  doc.name = cloned.name;
  doc.fps = cloned.fps;
  doc.frames = cloned.frames;
  doc.activeFrameIndex = Math.max(0, Math.min(cloned.frames.length - 1, cloned.activeFrameIndex));
  doc.activeLayerId = cloned.activeLayerId;
}

function estimateSnapshotBytes(snapshot: DocumentStateSnapshot): number {
  let bytes = 0;
  for (const frame of snapshot.frames) {
    for (const layer of frame.layers) {
      bytes += layer.buffer.byteLength;
    }
  }
  return bytes;
}

export class DocumentSnapshotCommand implements ICommand {
  readonly name: string;
  readonly byteSize: number;

  private readonly document: PixelDocument;
  private readonly before: DocumentStateSnapshot;
  private readonly after: DocumentStateSnapshot;
  private readonly onApplied?: () => void;

  constructor(params: {
    name: string;
    document: PixelDocument;
    before: DocumentStateSnapshot;
    after: DocumentStateSnapshot;
    onApplied?: () => void;
  }) {
    this.name = params.name;
    this.document = params.document;
    this.before = params.before;
    this.after = params.after;
    this.onApplied = params.onApplied;
    this.byteSize = estimateSnapshotBytes(params.before) + estimateSnapshotBytes(params.after);
  }

  execute(): void {
    applyDocumentSnapshot(this.document, this.after);
    this.onApplied?.();
  }

  undo(): void {
    applyDocumentSnapshot(this.document, this.before);
    this.onApplied?.();
  }
}
