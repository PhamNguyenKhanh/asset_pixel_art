import type { SurfaceShadingModel } from "@/types/assetContext";
import type { PixelBuffer } from "@/core/document/PixelBuffer";
import type { SurfaceMaps } from "@/core/document/Layer";
import { fbm2D } from "@/core/image-processing/noise";

export interface EstimatedSurface {
  width: number;
  height: number;
  /** Normalized surface elevation [0..1] per pixel (0 for transparent) */
  heightMap: Float32Array;
  /** Unit normal X component [-1..1] per pixel */
  normalX: Float32Array;
  /** Unit normal Y component [-1..1] per pixel */
  normalY: Float32Array;
  /** Unit normal Z component [0..1] per pixel */
  normalZ: Float32Array;
  /** Explicit user occlusion strength [0..1] per pixel */
  occlusionMap: Float32Array;
}

/**
 * Estimates a 2.5D height field and surface normals from a 2D pixel sprite,
 * modulated by the active Asset Context surface model and optional user-painted surface masks.
 */
export function estimateSurfaceData(
  source: PixelBuffer,
  surfaceModel: SurfaceShadingModel = "flat-balanced",
  userMaps?: SurfaceMaps,
): EstimatedSurface {
  const w = source.width;
  const h = source.height;
  const len = w * h;
  const data = source.data;

  // 1. Alpha silhouette 2-pass distance transform (inward from transparent edges)
  const dist = new Float32Array(len);
  const INF = 1e6;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const alpha = data[i * 4 + 3]!;
      if (alpha === 0) {
        dist[i] = 0;
        continue;
      }
      const touchesEdge =
        x === 0 ||
        y === 0 ||
        x === w - 1 ||
        y === h - 1 ||
        data[(i - 1) * 4 + 3]! === 0 ||
        data[(i + 1) * 4 + 3]! === 0 ||
        data[(i - w) * 4 + 3]! === 0 ||
        data[(i + w) * 4 + 3]! === 0;
      dist[i] = touchesEdge ? 1 : INF;
    }
  }

  // Forward pass (Chamfer 1 / 1.414)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (dist[i]! === 0 || dist[i]! === 1) continue;
      let best = dist[i]!;
      if (x > 0) best = Math.min(best, dist[i - 1]! + 1);
      if (y > 0) best = Math.min(best, dist[i - w]! + 1);
      if (x > 0 && y > 0) best = Math.min(best, dist[i - w - 1]! + 1.414);
      if (x < w - 1 && y > 0) best = Math.min(best, dist[i - w + 1]! + 1.414);
      dist[i] = best;
    }
  }

  // Backward pass
  let maxDist = 1;
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (dist[i]! === 0) continue;
      let best = dist[i]!;
      if (x < w - 1) best = Math.min(best, dist[i + 1]! + 1);
      if (y < h - 1) best = Math.min(best, dist[i + w]! + 1);
      if (x < w - 1 && y < h - 1) best = Math.min(best, dist[i + w + 1]! + 1.414);
      if (x > 0 && y < h - 1) best = Math.min(best, dist[i + w - 1]! + 1.414);
      dist[i] = best;
      if (best > maxDist) maxDist = best;
    }
  }

  // 2. Construct 2.5D Height Field shaped by surfaceModel + painted luminance + optional user masks
  const heightMap = new Float32Array(len);
  const occlusionMap = new Float32Array(len);
  const userHeight = userMaps?.heightMap;
  const userOcc = userMaps?.occlusionMask;

  // Bevel radius scales adaptively with sprite thickness
  const bevelCap =
    surfaceModel === "planar-architectural"
      ? Math.max(2, Math.min(4, maxDist * 0.35))
      : surfaceModel === "metallic-hard"
        ? Math.max(2, Math.min(5, maxDist * 0.45))
        : Math.max(2, Math.min(10, maxDist));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const off = i * 4;
      if (data[off + 3]! === 0) {
        heightMap[i] = 0;
        continue;
      }

      const dNorm = Math.min(1, dist[i]! / bevelCap);
      const lum = (0.299 * data[off]! + 0.587 * data[off + 1]! + 0.114 * data[off + 2]!) / 255;

      let baseH = 0;
      switch (surfaceModel) {
        case "organic-rounded": {
          // Smooth spherical dome profile: sqrt(1 - (1 - d)^2)
          const dome = Math.sqrt(Math.max(0, 1 - (1 - dNorm) * (1 - dNorm)));
          baseH = dome * 0.78 + lum * 0.22;
          break;
        }
        case "foliage-cluster": {
          // Clustered leafy canopy domes so light sweeps across distinct leaf groups
          const dome = Math.sqrt(Math.max(0, 1 - (1 - dNorm) * (1 - dNorm)));
          const clumpFreq = w < 24 ? 0.42 : 0.24;
          const clump = fbm2D(x * clumpFreq, y * clumpFreq, 773, 2);
          baseH = dome * 0.5 + clump * 0.35 + lum * 0.15;
          break;
        }
        case "planar-architectural": {
          // Crisp beveled border rising to a clean flat architectural/tabletop face
          const plateau = dNorm >= 1 ? 0.8 : 0.25 + dNorm * 0.55;
          baseH = plateau * 0.8 + lum * 0.2;
          break;
        }
        case "metallic-hard": {
          // Sharp linear chisel bevel with heightened specular relief
          const bevel = Math.min(1, dNorm * 1.15);
          baseH = bevel * 0.68 + lum * 0.32;
          break;
        }
        case "flat-balanced":
        default: {
          const smooth = dNorm * (2 - dNorm);
          baseH = smooth * 0.72 + lum * 0.28;
          break;
        }
      }

      // Blend optional user-painted height offset (128 = neutral, 255 = +0.55 raised, 0 = -0.55 recessed)
      if (userHeight && i < userHeight.length) {
        const delta = (userHeight[i]! - 128) / 128;
        baseH += delta * 0.55;
      }

      if (userOcc && i < userOcc.length) {
        occlusionMap[i] = userOcc[i]! / 255;
      }

      heightMap[i] = Math.max(0.02, Math.min(1, baseH));
    }
  }

  // 3. Derive 3D Surface Normals from Sobel gradient of heightMap
  const normalX = new Float32Array(len);
  const normalY = new Float32Array(len);
  const normalZ = new Float32Array(len);

  const reliefStrength =
    surfaceModel === "metallic-hard"
      ? 3.4
      : surfaceModel === "foliage-cluster"
        ? 3.0
        : surfaceModel === "planar-architectural"
          ? 2.2
          : 2.6;

  const sampleH = (sx: number, sy: number): number => {
    const cx = Math.max(0, Math.min(w - 1, sx));
    const cy = Math.max(0, Math.min(h - 1, sy));
    return heightMap[cy * w + cx]!;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (data[i * 4 + 3]! === 0) {
        normalX[i] = 0;
        normalY[i] = 0;
        normalZ[i] = 1;
        continue;
      }

      // 3x3 Sobel kernel for clean noise-resistant normals
      const tl = sampleH(x - 1, y - 1);
      const t = sampleH(x, y - 1);
      const tr = sampleH(x + 1, y - 1);
      const l = sampleH(x - 1, y);
      const r = sampleH(x + 1, y);
      const bl = sampleH(x - 1, y + 1);
      const b = sampleH(x, y + 1);
      const br = sampleH(x + 1, y + 1);

      const gx = tr + 2 * r + br - (tl + 2 * l + bl);
      const gy = bl + 2 * b + br - (tl + 2 * t + tr);

      const nx = -gx * reliefStrength;
      const ny = -gy * reliefStrength;
      const nz = 1.0;
      const invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);

      normalX[i] = nx * invLen;
      normalY[i] = ny * invLen;
      normalZ[i] = nz * invLen;
    }
  }

  return {
    width: w,
    height: h,
    heightMap,
    normalX,
    normalY,
    normalZ,
    occlusionMap,
  };
}
