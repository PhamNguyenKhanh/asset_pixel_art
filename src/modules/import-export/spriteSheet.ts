import type { PixelDocument } from "@/core/document/PixelDocument";
import { PixelBuffer } from "@/core/document/PixelBuffer";
import {
  compositeLayers,
  scaleBufferNearestNeighbor,
} from "@/core/image-processing/transforms";

export type SpriteSheetLayout = "horizontal" | "vertical" | "grid";

export interface SpriteSheetOptions {
  layout: SpriteSheetLayout;
  columns?: number;
  padding?: number;
  scale?: number;
  postProcessFrame?: (buffer: PixelBuffer, frameIndex: number) => PixelBuffer;
}

export interface SpriteSheetFrameEntry {
  filename: string;
  frame: { x: number; y: number; w: number; h: number };
  rotated: false;
  trimmed: false;
  spriteSourceSize: { x: 0; y: 0; w: number; h: number };
  sourceSize: { w: number; h: number };
  duration: number;
}

export interface SpriteSheetMetadata {
  frames: SpriteSheetFrameEntry[];
  meta: {
    app: string;
    version: string;
    image: string;
    format: "RGBA8888";
    size: { w: number; h: number };
    scale: string;
    fps: number;
    frameCount: number;
  };
}

export interface SpriteSheetBuildResult {
  buffer: PixelBuffer;
  metadata: SpriteSheetMetadata;
}

/**
 * Generates a crisp nearest-neighbor sprite sheet buffer and Aseprite/Unity-compatible JSON metadata.
 */
export function buildSpriteSheet(
  doc: PixelDocument,
  options: SpriteSheetOptions,
): SpriteSheetBuildResult {
  const scale = Math.max(1, Math.min(16, Math.round(options.scale ?? 1)));
  const padding = Math.max(0, Math.min(32, Math.round(options.padding ?? 0)));
  const frameCount = doc.frames.length;

  let cols = frameCount;
  let rows = 1;
  if (options.layout === "vertical") {
    cols = 1;
    rows = frameCount;
  } else if (options.layout === "grid") {
    const requestedCols = options.columns ?? Math.ceil(Math.sqrt(frameCount));
    cols = Math.max(1, Math.min(frameCount, Math.round(requestedCols)));
    rows = Math.ceil(frameCount / cols);
  }

  const cellW = doc.width * scale;
  const cellH = doc.height * scale;
  const sheetW = cols * cellW + Math.max(0, cols - 1) * padding;
  const sheetH = rows * cellH + Math.max(0, rows - 1) * padding;

  const sheetBuffer = new PixelBuffer(sheetW, sheetH);
  const frameEntries: SpriteSheetFrameEntry[] = [];
  const safeBaseName = doc.name.replace(/[^a-zA-Z0-9_-]+/g, "_").toLowerCase() || "sprite";

  for (let fi = 0; fi < frameCount; fi++) {
    const frame = doc.frames[fi]!;
    const rawComposited = compositeLayers(frame.layers, doc.width, doc.height);
    const composited = options.postProcessFrame
      ? options.postProcessFrame(rawComposited, fi)
      : rawComposited;
    const frameBuf =
      scale === 1 ? composited : scaleBufferNearestNeighbor(composited, cellW, cellH);

    const col = fi % cols;
    const row = Math.floor(fi / cols);
    const destX = col * (cellW + padding);
    const destY = row * (cellH + padding);

    for (let y = 0; y < cellH; y++) {
      const srcOffset = y * cellW * 4;
      const dstOffset = ((destY + y) * sheetW + destX) * 4;
      sheetBuffer.data.set(
        frameBuf.data.subarray(srcOffset, srcOffset + cellW * 4),
        dstOffset,
      );
    }

    frameEntries.push({
      filename: `${safeBaseName}_${String(fi).padStart(3, "0")}.png`,
      frame: { x: destX, y: destY, w: cellW, h: cellH },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: cellW, h: cellH },
      sourceSize: { w: cellW, h: cellH },
      duration: frame.durationMs,
    });
  }

  const metadata: SpriteSheetMetadata = {
    frames: frameEntries,
    meta: {
      app: "Pixel Art Studio",
      version: "0.2.0",
      image: `${safeBaseName}_sheet.png`,
      format: "RGBA8888",
      size: { w: sheetW, h: sheetH },
      scale: String(scale),
      fps: doc.fps,
      frameCount,
    },
  };

  return { buffer: sheetBuffer, metadata };
}
