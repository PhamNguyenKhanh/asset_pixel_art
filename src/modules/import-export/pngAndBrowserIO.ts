import { PixelBuffer } from "@/core/document/PixelBuffer";
import { scaleBufferNearestNeighbor } from "@/core/image-processing/transforms";

/**
 * Renders a PixelBuffer to a PNG Blob using crisp nearest-neighbor integer scaling.
 */
export async function pixelBufferToPngBlob(
  buffer: PixelBuffer,
  scale = 1,
): Promise<Blob> {
  const safeScale = Math.max(1, Math.min(16, Math.round(scale)));
  const finalBuf =
    safeScale === 1
      ? buffer
      : scaleBufferNearestNeighbor(
          buffer,
          buffer.width * safeScale,
          buffer.height * safeScale,
        );

  const canvas = document.createElement("canvas");
  canvas.width = finalBuf.width;
  canvas.height = finalBuf.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not initialize 2D canvas context for PNG export.");
  }

  const imageData = ctx.createImageData(finalBuf.width, finalBuf.height);
  imageData.data.set(finalBuf.data);
  ctx.putImageData(imageData, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to encode PNG image."));
      }
    }, "image/png");
  });
}

export interface LoadedImageHandle {
  img: HTMLImageElement;
  width: number;
  height: number;
  revoke: () => void;
}

/**
 * Loads an image File at full natural resolution without premature downscaling.
 */
export async function loadHtmlImageFromFile(file: File): Promise<LoadedImageHandle> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Không thể giải mã ảnh "${file.name}".`));
      el.src = url;
    });
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (width <= 0 || height <= 0) {
      URL.revokeObjectURL(url);
      throw new Error("Ảnh nhập vào có kích thước không hợp lệ.");
    }
    return {
      img,
      width,
      height,
      revoke: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/**
 * Renders an HTMLImageElement into a PixelBuffer at the requested target dimensions.
 */
export function renderImageToPixelBuffer(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  smoothResize = false,
): PixelBuffer {
  const w = Math.max(1, Math.round(targetWidth));
  const h = Math.max(1, Math.round(targetHeight));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Không thể khởi tạo ngữ cảnh Canvas 2D.");
  }
  ctx.imageSmoothingEnabled = smoothResize;
  if (smoothResize) {
    ctx.imageSmoothingQuality = "high";
  }
  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  return new PixelBuffer(w, h, new Uint8ClampedArray(imgData.data));
}

/**
 * Slices a full-resolution HTMLImageElement directly into individual frame PixelBuffers
 * without downscaling the entire sheet first (handles large sheets like 4608x768 cleanly).
 */
export function sliceHtmlImageToFrames(
  img: HTMLImageElement,
  options: {
    frameWidth: number;
    frameHeight: number;
    offsetX: number;
    offsetY: number;
    maxFrames?: number;
  },
): { frames: PixelBuffer[]; cols: number; rows: number } {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const fw = Math.floor(options.frameWidth);
  const fh = Math.floor(options.frameHeight);
  const ox = Math.max(0, Math.floor(options.offsetX));
  const oy = Math.max(0, Math.floor(options.offsetY));
  const maxFrames = Math.max(1, Math.floor(options.maxFrames ?? 256));

  if (fw <= 0 || fh <= 0 || ox >= srcW || oy >= srcH) {
    return { frames: [], cols: 0, rows: 0 };
  }

  const cols = Math.floor((srcW - ox) / fw);
  const rows = Math.floor((srcH - oy) / fh);
  if (cols <= 0 || rows <= 0) {
    return { frames: [], cols: 0, rows: 0 };
  }

  const total = Math.min(cols * rows, maxFrames);
  const canvas = document.createElement("canvas");
  canvas.width = fw;
  canvas.height = fh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Không thể khởi tạo ngữ cảnh Canvas 2D.");
  }
  ctx.imageSmoothingEnabled = false;

  const frames: PixelBuffer[] = [];
  for (let i = 0; i < total; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const sx = ox + col * fw;
    const sy = oy + row * fh;
    ctx.clearRect(0, 0, fw, fh);
    ctx.drawImage(img, sx, sy, fw, fh, 0, 0, fw, fh);
    const data = ctx.getImageData(0, 0, fw, fh).data;
    frames.push(new PixelBuffer(fw, fh, new Uint8ClampedArray(data)));
  }

  return { frames, cols, rows };
}

/**
 * Decodes a browser image File (PNG, JPG/JPEG, WebP) into a PixelBuffer.
 * If the image exceeds maxDimension, downscales with nearest-neighbor to keep pixel edges sharp.
 */
export async function decodeImageFileToPixelBuffer(
  file: File,
  maxDimension = 1024,
): Promise<PixelBuffer> {
  const loaded = await loadHtmlImageFromFile(file);
  try {
    let targetW = loaded.width;
    let targetH = loaded.height;
    if (targetW > maxDimension || targetH > maxDimension) {
      const ratio = Math.min(maxDimension / targetW, maxDimension / targetH);
      targetW = Math.max(1, Math.round(targetW * ratio));
      targetH = Math.max(1, Math.round(targetH * ratio));
    }
    return renderImageToPixelBuffer(loaded.img, targetW, targetH, false);
  } finally {
    loaded.revoke();
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(
  content: string,
  filename: string,
  mimeType = "application/json",
): void {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}
