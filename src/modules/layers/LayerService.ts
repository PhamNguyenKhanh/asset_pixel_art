import { Layer } from "@/core/document/Layer";
import { nextLayerId, type PixelDocument } from "@/core/document/PixelDocument";
import { compositeLayers } from "@/core/image-processing/transforms";

/**
 * Synchronized Layer operations across all frames of a PixelDocument.
 * Layer index 0 is the bottom layer; layers[length - 1] is the top layer.
 */
export function addLayer(doc: PixelDocument, name?: string): Layer {
  const activeFrame = doc.getActiveFrame();
  const activeIdx = activeFrame.layers.findIndex((l) => l.id === doc.activeLayerId);
  const insertIndex = activeIdx >= 0 ? activeIdx + 1 : activeFrame.layers.length;
  const newId = nextLayerId();
  const layerName = name?.trim() || `Layer ${activeFrame.layers.length + 1}`;

  let createdInActiveFrame: Layer | null = null;

  for (let fi = 0; fi < doc.frames.length; fi++) {
    const frame = doc.frames[fi]!;
    const layer = new Layer(doc.width, doc.height, {
      id: newId,
      name: layerName,
      visible: true,
      locked: false,
      opacity: 1,
    });
    const safeIndex = Math.min(insertIndex, frame.layers.length);
    frame.layers.splice(safeIndex, 0, layer);
    if (fi === doc.activeFrameIndex) {
      createdInActiveFrame = layer;
    }
  }

  doc.activeLayerId = newId;
  return createdInActiveFrame!;
}

export function deleteLayer(doc: PixelDocument, layerId: string): boolean {
  const activeFrame = doc.getActiveFrame();
  if (activeFrame.layers.length <= 1) {
    return false;
  }

  const targetIdx = activeFrame.layers.findIndex((l) => l.id === layerId);
  if (targetIdx < 0) return false;

  for (const frame of doc.frames) {
    const idx = frame.layers.findIndex((l) => l.id === layerId);
    if (idx >= 0 && frame.layers.length > 1) {
      frame.layers.splice(idx, 1);
    }
  }

  if (doc.activeLayerId === layerId) {
    const updatedFrame = doc.getActiveFrame();
    const fallbackIdx = Math.max(0, Math.min(targetIdx - 1, updatedFrame.layers.length - 1));
    doc.activeLayerId = updatedFrame.layers[fallbackIdx]!.id;
  }
  return true;
}

export function renameLayer(doc: PixelDocument, layerId: string, newName: string): boolean {
  const trimmed = newName.trim();
  if (!trimmed) return false;
  let updated = false;
  for (const frame of doc.frames) {
    const layer = frame.getLayerById(layerId);
    if (layer) {
      layer.name = trimmed;
      updated = true;
    }
  }
  return updated;
}

export function reorderLayer(doc: PixelDocument, fromIndex: number, toIndex: number): boolean {
  const count = doc.getActiveFrame().layers.length;
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= count ||
    toIndex >= count ||
    fromIndex === toIndex
  ) {
    return false;
  }

  for (const frame of doc.frames) {
    if (fromIndex >= frame.layers.length || toIndex >= frame.layers.length) continue;
    const [moved] = frame.layers.splice(fromIndex, 1);
    if (moved) {
      frame.layers.splice(toIndex, 0, moved);
    }
  }
  return true;
}

export function setLayerVisibility(doc: PixelDocument, layerId: string, visible: boolean): boolean {
  let updated = false;
  for (const frame of doc.frames) {
    const layer = frame.getLayerById(layerId);
    if (layer && layer.visible !== visible) {
      layer.visible = visible;
      updated = true;
    }
  }
  return updated;
}

export function setLayerOpacity(doc: PixelDocument, layerId: string, opacity: number): boolean {
  const clamped = Math.max(0, Math.min(1, opacity));
  let updated = false;
  for (const frame of doc.frames) {
    const layer = frame.getLayerById(layerId);
    if (layer && layer.opacity !== clamped) {
      layer.opacity = clamped;
      updated = true;
    }
  }
  return updated;
}

export function setLayerLocked(doc: PixelDocument, layerId: string, locked: boolean): boolean {
  let updated = false;
  for (const frame of doc.frames) {
    const layer = frame.getLayerById(layerId);
    if (layer && layer.locked !== locked) {
      layer.locked = locked;
      updated = true;
    }
  }
  return updated;
}

/**
 * Merges the specified layer into the layer directly beneath it across all frames.
 */
export function mergeLayerDown(doc: PixelDocument, layerId: string): boolean {
  const activeFrame = doc.getActiveFrame();
  const idx = activeFrame.layers.findIndex((l) => l.id === layerId);
  if (idx <= 0) return false;

  const lowerId = activeFrame.layers[idx - 1]!.id;

  for (const frame of doc.frames) {
    const topIdx = frame.layers.findIndex((l) => l.id === layerId);
    if (topIdx <= 0) continue;
    const lower = frame.layers[topIdx - 1]!;
    const upper = frame.layers[topIdx]!;

    // Composite lower + upper honoring their opacity; force visible during explicit merge
    const tempLower = lower.clone();
    const tempUpper = upper.clone();
    tempLower.visible = true;
    tempUpper.visible = true;
    const merged = compositeLayers([tempLower, tempUpper], doc.width, doc.height);

    lower.buffer.data.set(merged.data);
    lower.opacity = 1;
    frame.layers.splice(topIdx, 1);
  }

  doc.activeLayerId = lowerId;
  return true;
}

/**
 * Flattens all visible layers into a single merged layer across all frames.
 */
export function mergeVisibleLayers(doc: PixelDocument): boolean {
  const activeFrame = doc.getActiveFrame();
  const visibleCount = activeFrame.layers.filter((l) => l.visible).length;
  if (visibleCount <= 1) return false;

  const mergedId = nextLayerId();
  const firstVisibleIndex = activeFrame.layers.findIndex((l) => l.visible);

  for (const frame of doc.frames) {
    const visibleLayers = frame.layers.filter((l) => l.visible);
    const hiddenLayers = frame.layers.filter((l) => !l.visible);
    const composited = compositeLayers(visibleLayers, doc.width, doc.height);

    const mergedLayer = new Layer(doc.width, doc.height, {
      id: mergedId,
      name: "Merged Layer",
      visible: true,
      locked: false,
      opacity: 1,
    });
    mergedLayer.buffer.data.set(composited.data);

    const insertPos = Math.min(firstVisibleIndex, hiddenLayers.length);
    hiddenLayers.splice(insertPos, 0, mergedLayer);
    frame.layers = hiddenLayers;
  }

  doc.activeLayerId = mergedId;
  return true;
}
