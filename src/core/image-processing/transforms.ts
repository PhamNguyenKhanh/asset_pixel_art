import type { ResizeAnchor, SelectionRect } from "@/types/editor";
import { PixelBuffer } from "@/core/document/PixelBuffer";
import type { Layer } from "@/core/document/Layer";
import { TRANSPARENT_PACKED } from "@/core/image-processing/color";

export function clampSelectionRect(
  rect: SelectionRect,
  width: number,
  height: number,
): SelectionRect | null {
  const minX = Math.max(0, Math.floor(rect.x));
  const minY = Math.max(0, Math.floor(rect.y));
  const maxX = Math.min(width, Math.floor(rect.x + rect.width));
  const maxY = Math.min(height, Math.floor(rect.y + rect.height));
  if (maxX <= minX || maxY <= minY) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function flipBufferHorizontal(
  source: PixelBuffer,
  region?: SelectionRect | null,
): PixelBuffer {
  const result = source.clone();
  const rect = region
    ? clampSelectionRect(region, source.width, source.height)
    : { x: 0, y: 0, width: source.width, height: source.height };
  if (!rect) return result;

  for (let row = 0; row < rect.height; row++) {
    const y = rect.y + row;
    for (let col = 0; col < rect.width; col++) {
      const srcX = rect.x + col;
      const dstX = rect.x + (rect.width - 1 - col);
      result.setPacked(dstX, y, source.getPacked(srcX, y));
    }
  }
  return result;
}

export function flipBufferVertical(
  source: PixelBuffer,
  region?: SelectionRect | null,
): PixelBuffer {
  const result = source.clone();
  const rect = region
    ? clampSelectionRect(region, source.width, source.height)
    : { x: 0, y: 0, width: source.width, height: source.height };
  if (!rect) return result;

  for (let row = 0; row < rect.height; row++) {
    const srcY = rect.y + row;
    const dstY = rect.y + (rect.height - 1 - row);
    for (let col = 0; col < rect.width; col++) {
      const x = rect.x + col;
      result.setPacked(x, dstY, source.getPacked(x, srcY));
    }
  }
  return result;
}

export function rotateBuffer90CW(source: PixelBuffer): PixelBuffer {
  const out = new PixelBuffer(source.height, source.width);
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      out.setPacked(source.height - 1 - y, x, source.getPacked(x, y));
    }
  }
  return out;
}

export function rotateBuffer90CCW(source: PixelBuffer): PixelBuffer {
  const out = new PixelBuffer(source.height, source.width);
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      out.setPacked(y, source.width - 1 - x, source.getPacked(x, y));
    }
  }
  return out;
}

export function translateBuffer(source: PixelBuffer, dx: number, dy: number): PixelBuffer {
  const out = new PixelBuffer(source.width, source.height);
  const ix = Math.round(dx);
  const iy = Math.round(dy);
  for (let y = 0; y < source.height; y++) {
    const ny = y + iy;
    if (ny < 0 || ny >= source.height) continue;
    for (let x = 0; x < source.width; x++) {
      const nx = x + ix;
      if (nx < 0 || nx >= source.width) continue;
      out.setPacked(nx, ny, source.getPacked(x, y));
    }
  }
  return out;
}

export function computeAnchorOffset(
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
  anchor: ResizeAnchor,
): { offsetX: number; offsetY: number } {
  const diffX = newWidth - oldWidth;
  const diffY = newHeight - oldHeight;

  let offsetX = 0;
  if (anchor.endsWith("right")) {
    offsetX = diffX;
  } else if (anchor === "top" || anchor === "center" || anchor === "bottom") {
    offsetX = Math.floor(diffX / 2);
  }

  let offsetY = 0;
  if (anchor.startsWith("bottom")) {
    offsetY = diffY;
  } else if (anchor === "left" || anchor === "center" || anchor === "right") {
    offsetY = Math.floor(diffY / 2);
  }

  return { offsetX, offsetY };
}

export function resizeBufferCanvas(
  source: PixelBuffer,
  newWidth: number,
  newHeight: number,
  anchor: ResizeAnchor = "center",
): PixelBuffer {
  const out = new PixelBuffer(newWidth, newHeight);
  const { offsetX, offsetY } = computeAnchorOffset(
    source.width,
    source.height,
    newWidth,
    newHeight,
    anchor,
  );

  for (let y = 0; y < source.height; y++) {
    const dy = y + offsetY;
    if (dy < 0 || dy >= newHeight) continue;
    for (let x = 0; x < source.width; x++) {
      const dx = x + offsetX;
      if (dx < 0 || dx >= newWidth) continue;
      out.setPacked(dx, dy, source.getPacked(x, y));
    }
  }
  return out;
}

export function scaleBufferNearestNeighbor(
  source: PixelBuffer,
  newWidth: number,
  newHeight: number,
): PixelBuffer {
  const out = new PixelBuffer(newWidth, newHeight);
  for (let y = 0; y < newHeight; y++) {
    const srcY = Math.min(source.height - 1, Math.floor((y * source.height) / newHeight));
    for (let x = 0; x < newWidth; x++) {
      const srcX = Math.min(source.width - 1, Math.floor((x * source.width) / newWidth));
      out.setPacked(x, y, source.getPacked(srcX, srcY));
    }
  }
  return out;
}

export function cropBuffer(source: PixelBuffer, region: SelectionRect): PixelBuffer {
  const rect = clampSelectionRect(region, source.width, source.height);
  if (!rect) {
    throw new RangeError("Crop region is empty or outside canvas bounds");
  }
  const out = new PixelBuffer(rect.width, rect.height);
  for (let row = 0; row < rect.height; row++) {
    for (let col = 0; col < rect.width; col++) {
      out.setPacked(col, row, source.getPacked(rect.x + col, rect.y + row));
    }
  }
  return out;
}

export function findContentBounds(buffer: PixelBuffer): SelectionRect | null {
  let minX = buffer.width;
  let minY = buffer.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < buffer.height; y++) {
    for (let x = 0; x < buffer.width; x++) {
      const packed = buffer.getPacked(x, y);
      if (packed !== TRANSPARENT_PACKED) {
        const alpha = buffer.data[(y * buffer.width + x) * 4 + 3]!;
        if (alpha > 0) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * Pure Porter-Duff source-over compositing of visible layers into a single PixelBuffer.
 * Shared across RenderingEngine, Thumbnails, PNG/GIF/SpriteSheet Export, and Layer Merge.
 */
export function compositeLayers(
  layers: readonly Layer[],
  width: number,
  height: number,
  target?: PixelBuffer,
): PixelBuffer {
  const outBuf = target ?? new PixelBuffer(width, height);
  const out = outBuf.data;
  const visibleLayers = layers.filter((l) => l.visible && l.opacity > 0);

  if (visibleLayers.length === 0) {
    out.fill(0);
    return outBuf;
  }

  if (visibleLayers.length === 1 && visibleLayers[0]!.opacity >= 1) {
    out.set(visibleLayers[0]!.buffer.data);
    return outBuf;
  }

  out.fill(0);
  const pixelCount = width * height;

  for (let li = 0; li < visibleLayers.length; li++) {
    const layer = visibleLayers[li]!;
    const src = layer.buffer.data;
    const layerOpacity = layer.opacity;
    for (let i = 0; i < pixelCount; i++) {
      const off = i * 4;
      const sa = (src[off + 3]! / 255) * layerOpacity;
      if (sa <= 0) continue;

      const da = out[off + 3]! / 255;
      const outA = sa + da * (1 - sa);
      if (outA <= 0) continue;

      out[off] = Math.round((src[off]! * sa + out[off]! * da * (1 - sa)) / outA);
      out[off + 1] = Math.round((src[off + 1]! * sa + out[off + 1]! * da * (1 - sa)) / outA);
      out[off + 2] = Math.round((src[off + 2]! * sa + out[off + 2]! * da * (1 - sa)) / outA);
      out[off + 3] = Math.round(outA * 255);
    }
  }

  return outBuf;
}

/**
 * Composites a transient overlay buffer (e.g. shape preview or floating selection) on top of target.
 */
export function compositeOverlayBuffer(
  base: Uint8ClampedArray,
  overlay: Uint8ClampedArray,
  opacity = 1,
): void {
  const pixelCount = base.length / 4;
  for (let i = 0; i < pixelCount; i++) {
    const off = i * 4;
    const sa = (overlay[off + 3]! / 255) * opacity;
    if (sa <= 0) continue;
    const da = base[off + 3]! / 255;
    const outA = sa + da * (1 - sa);
    if (outA <= 0) continue;
    base[off] = Math.round((overlay[off]! * sa + base[off]! * da * (1 - sa)) / outA);
    base[off + 1] = Math.round((overlay[off + 1]! * sa + base[off + 1]! * da * (1 - sa)) / outA);
    base[off + 2] = Math.round((overlay[off + 2]! * sa + base[off + 2]! * da * (1 - sa)) / outA);
    base[off + 3] = Math.round(outA * 255);
  }
}
