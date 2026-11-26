import type { CustomPalette, OnionSkinConfig } from "@/types/editor";
import type { AssetContextState } from "@/types/assetContext";
import { createDefaultLightingConfig, type LightingConfig } from "@/types/lighting";
import { Frame } from "@/core/document/Frame";
import { Layer } from "@/core/document/Layer";
import { PixelDocument, validateCanvasDimensions } from "@/core/document/PixelDocument";

export const PROJECT_FILE_VERSION = 1;

export interface SerializedLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  pixelsBase64: string;
}

export interface SerializedFrame {
  id: string;
  durationMs: number;
  layers: SerializedLayer[];
}

export interface SerializedProject {
  format: "pixel-art-studio-project";
  version: number;
  name: string;
  width: number;
  height: number;
  fps: number;
  activeFrameIndex: number;
  activeLayerId: string;
  onionSkin: OnionSkinConfig;
  assetContext?: AssetContextState;
  lighting?: LightingConfig;
  frames: SerializedFrame[];
  customPalettes?: CustomPalette[];
  savedAt: string;
}

function bytesToBase64(bytes: Uint8ClampedArray): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
  }
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8ClampedArray {
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(b64, "base64");
    const out = new Uint8ClampedArray(buf.length);
    out.set(buf);
    return out;
  }
  const binary = atob(b64);
  const out = new Uint8ClampedArray(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function serializeProject(
  doc: PixelDocument,
  customPalettes?: CustomPalette[],
): SerializedProject {
  return {
    format: "pixel-art-studio-project",
    version: PROJECT_FILE_VERSION,
    name: doc.name,
    width: doc.width,
    height: doc.height,
    fps: doc.fps,
    activeFrameIndex: doc.activeFrameIndex,
    activeLayerId: doc.activeLayerId,
    onionSkin: { ...doc.onionSkin },
    assetContext: { ...doc.assetContext },
    lighting: {
      ...doc.lighting,
      lightColor: { ...doc.lighting.lightColor },
    },
    frames: doc.frames.map((frame) => ({
      id: frame.id,
      durationMs: frame.durationMs,
      layers: frame.layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        opacity: layer.opacity,
        pixelsBase64: bytesToBase64(layer.buffer.data),
      })),
    })),
    customPalettes,
    savedAt: new Date().toISOString(),
  };
}

export function deserializeProject(raw: unknown): {
  document: PixelDocument;
  customPalettes?: CustomPalette[];
} {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid project file: expected JSON object.");
  }
  const data = raw as Partial<SerializedProject>;
  if (data.format !== "pixel-art-studio-project") {
    throw new Error("Unrecognized project file format.");
  }
  if (typeof data.width !== "number" || typeof data.height !== "number") {
    throw new Error("Project file is missing canvas dimensions.");
  }
  const dimCheck = validateCanvasDimensions(data.width, data.height);
  if (!dimCheck.valid) {
    throw new Error(dimCheck.error ?? "Invalid project canvas dimensions.");
  }
  if (!Array.isArray(data.frames) || data.frames.length === 0) {
    throw new Error("Project file contains no frames.");
  }

  const doc = new PixelDocument(data.width, data.height, data.name || "Untitled Sprite");
  if (typeof data.fps === "number") {
    doc.setFps(data.fps);
  }
  if (data.onionSkin) {
    doc.onionSkin = {
      enabled: Boolean(data.onionSkin.enabled),
      prevFrames: data.onionSkin.prevFrames ?? 1,
      nextFrames: data.onionSkin.nextFrames ?? 1,
      opacity: data.onionSkin.opacity ?? 0.3,
    };
  }
  if (data.assetContext && typeof data.assetContext.assetTypeId === "string") {
    doc.assetContext = {
      assetTypeId: data.assetContext.assetTypeId,
      preferredMaterialId: data.assetContext.preferredMaterialId ?? null,
    };
  }
  if (data.lighting && typeof data.lighting === "object") {
    const defaults = createDefaultLightingConfig();
    doc.lighting = {
      ...defaults,
      ...data.lighting,
      lightColor: data.lighting.lightColor
        ? { ...defaults.lightColor, ...data.lighting.lightColor }
        : defaults.lightColor,
    };
  }

  const expectedByteLen = data.width * data.height * 4;
  doc.frames = data.frames.map((sf) => {
    const frame = new Frame(data.width!, data.height!, {
      id: sf.id,
      durationMs: sf.durationMs,
    });
    if (Array.isArray(sf.layers) && sf.layers.length > 0) {
      frame.layers = sf.layers.map((sl) => {
        const layer = new Layer(data.width!, data.height!, {
          id: sl.id,
          name: sl.name,
          visible: sl.visible,
          locked: sl.locked,
          opacity: sl.opacity,
        });
        const decoded = base64ToBytes(sl.pixelsBase64);
        if (decoded.length !== expectedByteLen) {
          throw new Error(`Corrupted pixel buffer in layer "${sl.name}".`);
        }
        layer.buffer.data.set(decoded);
        return layer;
      });
    }
    return frame;
  });

  const activeIdx =
    typeof data.activeFrameIndex === "number"
      ? Math.max(0, Math.min(doc.frames.length - 1, data.activeFrameIndex))
      : 0;
  doc.setActiveFrameIndex(activeIdx);
  if (typeof data.activeLayerId === "string") {
    doc.setActiveLayerId(data.activeLayerId);
  }

  return {
    document: doc,
    customPalettes: Array.isArray(data.customPalettes) ? data.customPalettes : undefined,
  };
}
