import { applyPalette, GIFEncoder, quantize, type PaletteColor } from "gifenc";
import { GifReader } from "omggif";
import type { PixelDocument } from "@/core/document/PixelDocument";
import { PixelBuffer } from "@/core/document/PixelBuffer";
import {
  compositeLayers,
  scaleBufferNearestNeighbor,
} from "@/core/image-processing/transforms";

export interface GifExportOptions {
  scale?: number;
  repeat?: number; // 0 = loop forever, -1 = play once
  postProcessFrame?: (buffer: PixelBuffer, frameIndex: number) => PixelBuffer;
}

export interface DecodedGifFrame {
  buffer: PixelBuffer;
  durationMs: number;
}

export interface DecodedGifResult {
  width: number;
  height: number;
  frames: DecodedGifFrame[];
}

/**
 * Attempts lossless exact palette extraction for pixel art (<= 255 opaque colors + 1 transparent slot).
 * Falls back to gifenc's perceptual quantizer when a frame exceeds 255 unique opaque colors.
 */
function buildFramePaletteAndIndices(data: Uint8ClampedArray): {
  palette: PaletteColor[];
  indices: Uint8Array;
  hasTransparency: boolean;
  transparentIndex: number;
} {
  const pixelCount = data.length / 4;
  const colorMap = new Map<number, number>();
  let hasTransparency = false;
  let exceededExact = false;

  // Reserve slot 0 for transparent if needed
  const exactColors: [number, number, number][] = [];

  for (let i = 0; i < pixelCount; i++) {
    const off = i * 4;
    const a = data[off + 3]!;
    if (a < 128) {
      hasTransparency = true;
      continue;
    }
    const r = data[off]!;
    const g = data[off + 1]!;
    const b = data[off + 2]!;
    const key = (r << 16) | (g << 8) | b;
    if (!colorMap.has(key)) {
      if (exactColors.length >= 255) {
        exceededExact = true;
        break;
      }
      colorMap.set(key, exactColors.length);
      exactColors.push([r, g, b]);
    }
  }

  if (!exceededExact) {
    const palette: PaletteColor[] = [];
    const transparentIndex = 0;
    const offset = hasTransparency ? 1 : 0;

    if (hasTransparency) {
      palette.push([0, 0, 0]);
    }
    for (const rgb of exactColors) {
      palette.push(rgb);
    }
    // GIF requires at least 2 colors in color table
    while (palette.length < 2) {
      palette.push([0, 0, 0]);
    }

    const indices = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      const off = i * 4;
      if (data[off + 3]! < 128) {
        indices[i] = transparentIndex;
      } else {
        const key = (data[off]! << 16) | (data[off + 1]! << 8) | data[off + 2]!;
        indices[i] = (colorMap.get(key) ?? 0) + offset;
      }
    }

    return {
      palette,
      indices,
      hasTransparency,
      transparentIndex,
    };
  }

  // Fallback for rich sprites (> 255 unique colors): quantize with 1-bit alpha
  const palette = quantize(data, 256, {
    format: "rgba4444",
    oneBitAlpha: true,
  });
  let transparentIndex = palette.findIndex(
    (entry) => entry.length === 4 && entry[3] === 0,
  );
  if (hasTransparency && transparentIndex < 0) {
    transparentIndex = 0;
  }
  const indices = applyPalette(data, palette, "rgba4444");
  if (hasTransparency && transparentIndex >= 0) {
    for (let i = 0; i < pixelCount; i++) {
      if (data[i * 4 + 3]! < 128) {
        indices[i] = transparentIndex;
      }
    }
  }

  return {
    palette: palette.length >= 2 ? palette : [[0, 0, 0], [255, 255, 255]],
    indices,
    hasTransparency,
    transparentIndex: hasTransparency ? Math.max(0, transparentIndex) : -1,
  };
}

/**
 * Encodes a PixelDocument animation into an animated GIF89a Uint8Array.
 * Preserves crisp nearest-neighbor scaling, per-frame duration, and alpha transparency.
 */
export function encodeGif(
  doc: PixelDocument,
  options: GifExportOptions = {},
): Uint8Array {
  const scale = Math.max(1, Math.min(16, Math.round(options.scale ?? 1)));
  const repeat = options.repeat ?? 0;
  const outW = doc.width * scale;
  const outH = doc.height * scale;

  const encoder = GIFEncoder();

  for (let fi = 0; fi < doc.frames.length; fi++) {
    const frame = doc.frames[fi]!;
    const rawComposited = compositeLayers(frame.layers, doc.width, doc.height);
    const composited = options.postProcessFrame
      ? options.postProcessFrame(rawComposited, fi)
      : rawComposited;
    const scaled =
      scale === 1
        ? composited
        : scaleBufferNearestNeighbor(composited, outW, outH);

    const { palette, indices, hasTransparency, transparentIndex } =
      buildFramePaletteAndIndices(scaled.data);

    encoder.writeFrame(indices, outW, outH, {
      palette,
      delay: Math.max(20, frame.durationMs),
      repeat,
      transparent: hasTransparency,
      transparentIndex: hasTransparency ? transparentIndex : 0,
      dispose: hasTransparency ? 2 : 0,
    });
  }

  encoder.finish();
  return encoder.bytes();
}

/**
 * Decodes an animated or static GIF byte buffer into individual composited PixelBuffers
 * honoring GIF disposal methods (keep, restore background, restore previous).
 */
export function decodeGif(bytes: Uint8Array): DecodedGifResult {
  const reader = new GifReader(bytes);
  const width = reader.width;
  const height = reader.height;
  const frameCount = reader.numFrames();

  if (width <= 0 || height <= 0 || frameCount <= 0) {
    throw new Error("GIF file contains no valid frames.");
  }

  const canvas = new Uint8ClampedArray(width * height * 4);
  const patch = new Uint8ClampedArray(width * height * 4);
  const frames: DecodedGifFrame[] = [];

  for (let i = 0; i < frameCount; i++) {
    const info = reader.frameInfo(i);
    const prevCanvas =
      info.disposal === 3 ? new Uint8ClampedArray(canvas) : null;

    patch.fill(0);
    reader.decodeAndBlitFrameRGBA(i, patch);

    // Blit non-transparent patch pixels onto persistent canvas
    const pixelCount = width * height;
    for (let p = 0; p < pixelCount; p++) {
      const off = p * 4;
      if (patch[off + 3]! > 0) {
        canvas[off] = patch[off]!;
        canvas[off + 1] = patch[off + 1]!;
        canvas[off + 2] = patch[off + 2]!;
        canvas[off + 3] = patch[off + 3]!;
      }
    }

    const frameBuffer = new PixelBuffer(width, height);
    frameBuffer.data.set(canvas);
    const durationMs = Math.max(20, (info.delay || 10) * 10);
    frames.push({ buffer: frameBuffer, durationMs });

    // Apply GIF disposal method for the next frame
    if (info.disposal === 2) {
      for (let y = info.y; y < info.y + info.height; y++) {
        for (let x = info.x; x < info.x + info.width; x++) {
          if (x >= 0 && y >= 0 && x < width && y < height) {
            const off = (y * width + x) * 4;
            canvas[off] = 0;
            canvas[off + 1] = 0;
            canvas[off + 2] = 0;
            canvas[off + 3] = 0;
          }
        }
      }
    } else if (info.disposal === 3 && prevCanvas) {
      canvas.set(prevCanvas);
    }
  }

  return { width, height, frames };
}
