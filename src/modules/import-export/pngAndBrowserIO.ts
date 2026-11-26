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

/**
 * Decodes a browser image File (PNG, JPG/JPEG, WebP) into a PixelBuffer.
 * If the image exceeds maxDimension, downscales with nearest-neighbor to keep pixel edges sharp.
 */
export async function decodeImageFileToPixelBuffer(
  file: File,
  maxDimension = 1024,
): Promise<PixelBuffer> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Unable to decode image "${file.name}".`));
      el.src = url;
    });

    let targetW = img.naturalWidth || img.width;
    let targetH = img.naturalHeight || img.height;
    if (targetW <= 0 || targetH <= 0) {
      throw new Error("Imported image has invalid dimensions.");
    }

    if (targetW > maxDimension || targetH > maxDimension) {
      const ratio = Math.min(maxDimension / targetW, maxDimension / targetH);
      targetW = Math.max(1, Math.round(targetW * ratio));
      targetH = Math.max(1, Math.round(targetH * ratio));
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not initialize 2D canvas context for image import.");
    }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, targetW, targetH);
    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    return new PixelBuffer(targetW, targetH, new Uint8ClampedArray(imgData.data));
  } finally {
    URL.revokeObjectURL(url);
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
