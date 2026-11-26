import type { OnionSkinConfig } from "@/types/editor";
import { Frame } from "@/core/document/Frame";
import { Layer } from "@/core/document/Layer";
import type { PixelDocument } from "@/core/document/PixelDocument";

export function addFrame(doc: PixelDocument, afterIndex?: number): Frame {
  const insertAfter = afterIndex ?? doc.activeFrameIndex;
  const insertAt = Math.max(0, Math.min(doc.frames.length, insertAfter + 1));
  const frame = doc.createFrameMatchingLayers();
  doc.frames.splice(insertAt, 0, frame);
  doc.setActiveFrameIndex(insertAt);
  return frame;
}

export function duplicateFrame(doc: PixelDocument, index: number): Frame | null {
  const source = doc.frames[index];
  if (!source) return null;

  const copy = new Frame(doc.width, doc.height, {
    durationMs: source.durationMs,
  });
  copy.layers = source.layers.map((layer) => {
    const cloned = new Layer(doc.width, doc.height, {
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      opacity: layer.opacity,
    });
    cloned.buffer.data.set(layer.buffer.data);
    return cloned;
  });

  const insertAt = index + 1;
  doc.frames.splice(insertAt, 0, copy);
  doc.setActiveFrameIndex(insertAt);
  return copy;
}

export function deleteFrame(doc: PixelDocument, index: number): boolean {
  if (doc.frames.length <= 1) return false;
  if (index < 0 || index >= doc.frames.length) return false;

  doc.frames.splice(index, 1);
  const nextIdx = Math.max(0, Math.min(doc.activeFrameIndex, doc.frames.length - 1));
  doc.setActiveFrameIndex(nextIdx);
  return true;
}

export function reorderFrame(doc: PixelDocument, fromIndex: number, toIndex: number): boolean {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= doc.frames.length ||
    toIndex >= doc.frames.length ||
    fromIndex === toIndex
  ) {
    return false;
  }

  const [moved] = doc.frames.splice(fromIndex, 1);
  if (!moved) return false;
  doc.frames.splice(toIndex, 0, moved);

  if (doc.activeFrameIndex === fromIndex) {
    doc.activeFrameIndex = toIndex;
  } else if (fromIndex < doc.activeFrameIndex && toIndex >= doc.activeFrameIndex) {
    doc.activeFrameIndex -= 1;
  } else if (fromIndex > doc.activeFrameIndex && toIndex <= doc.activeFrameIndex) {
    doc.activeFrameIndex += 1;
  }
  return true;
}

export function setFrameDuration(doc: PixelDocument, index: number, durationMs: number): boolean {
  const frame = doc.frames[index];
  if (!frame) return false;
  frame.durationMs = Math.max(16, Math.min(10000, Math.round(durationMs)));
  return true;
}

export function setDocumentFps(doc: PixelDocument, fps: number, syncFrameDurations = true): void {
  doc.setFps(fps);
  if (syncFrameDurations) {
    const ms = Math.max(16, Math.round(1000 / doc.fps));
    for (const frame of doc.frames) {
      frame.durationMs = ms;
    }
  }
}

export function updateOnionSkin(doc: PixelDocument, partial: Partial<OnionSkinConfig>): void {
  doc.onionSkin = {
    enabled: partial.enabled ?? doc.onionSkin.enabled,
    prevFrames: Math.max(0, Math.min(3, Math.round(partial.prevFrames ?? doc.onionSkin.prevFrames))),
    nextFrames: Math.max(0, Math.min(3, Math.round(partial.nextFrames ?? doc.onionSkin.nextFrames))),
    opacity: Math.max(0.05, Math.min(0.85, partial.opacity ?? doc.onionSkin.opacity)),
  };
}
