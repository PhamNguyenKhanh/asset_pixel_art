import type { AssetContextProfile } from "@/types/assetContext";
import type { LightingConfig } from "@/types/lighting";
import type { PixelBuffer } from "@/core/document/PixelBuffer";
import type { SurfaceMaps } from "@/core/document/Layer";
import type { ILightingPipeline } from "@/core/contracts";
import { clampByte, hsvToRgb, rgbToHsv } from "@/core/image-processing/color";
import { bayerThreshold4x4 } from "@/core/image-processing/noise";
import { estimateSurfaceData } from "@/modules/lighting/surfaceEstimator";
import { computeShadowMap } from "@/modules/lighting/shadowSolver";

export function computeLightDirectionVector(config: LightingConfig): {
  lx: number;
  ly: number;
  lz: number;
} {
  const dx = config.lightX;
  const dy = config.lightY;
  const dz = Math.max(0.15, Math.min(1.5, config.lightElevation));
  const len = Math.hypot(dx, dy, dz) || 1;
  return {
    lx: dx / len,
    ly: dy / len,
    lz: dz / len,
  };
}

function shiftHue(hue: number, targetHue: number, amountDeg: number): number {
  let diff = ((targetHue - hue + 540) % 360) - 180;
  if (Math.abs(diff) > Math.abs(amountDeg)) {
    diff = Math.sign(diff) * Math.abs(amountDeg);
  }
  return ((hue + diff) % 360 + 360) % 360;
}

/**
 * Pure Non-Destructive Dynamic Lighting & Shadow Pipeline.
 * Never mutates `source` — writes transformed lit pixels into `target`.
 */
export function applyDynamicLightingToBuffer(
  source: PixelBuffer,
  target: PixelBuffer,
  config: LightingConfig,
  contextProfile?: AssetContextProfile,
  userMaps?: SurfaceMaps,
): void {
  if (!config.enabled) {
    target.data.set(source.data);
    return;
  }

  const w = source.width;
  const h = source.height;
  const src = source.data;
  const out = target.data;

  const surfaceModel = contextProfile?.lightingHints.surfaceModel ?? "flat-balanced";
  const surface = estimateSurfaceData(source, surfaceModel, userMaps);
  const { lx, ly, lz } = computeLightDirectionVector(config);

  // Diagnostic inspection modes (Normals / Height)
  if (config.previewMode === "normals") {
    for (let i = 0; i < w * h; i++) {
      const off = i * 4;
      const a = src[off + 3]!;
      if (a === 0) {
        out[off] = out[off + 1] = out[off + 2] = out[off + 3] = 0;
        continue;
      }
      out[off] = clampByte((surface.normalX[i]! * 0.5 + 0.5) * 255);
      out[off + 1] = clampByte((surface.normalY[i]! * 0.5 + 0.5) * 255);
      out[off + 2] = clampByte((surface.normalZ[i]! * 0.5 + 0.5) * 255);
      out[off + 3] = a;
    }
    return;
  }

  if (config.previewMode === "height") {
    for (let i = 0; i < w * h; i++) {
      const off = i * 4;
      const a = src[off + 3]!;
      if (a === 0) {
        out[off] = out[off + 1] = out[off + 2] = out[off + 3] = 0;
        continue;
      }
      const v = clampByte(surface.heightMap[i]! * 255);
      out[off] = v;
      out[off + 1] = v;
      out[off + 2] = v;
      out[off + 3] = a;
    }
    return;
  }

  const shadowMap = computeShadowMap(surface, src, {
    lightDirX: lx,
    lightDirY: ly,
    lightDirZ: lz,
    shadowLength: config.shadowLength,
    shadowSoftness: config.shadowSoftness,
  });

  if (config.previewMode === "shadows") {
    for (let i = 0; i < w * h; i++) {
      const off = i * 4;
      const a = src[off + 3]!;
      if (a === 0) {
        out[off] = out[off + 1] = out[off + 2] = out[off + 3] = 0;
        continue;
      }
      const lit = clampByte((1 - shadowMap[i]! * config.shadowIntensity) * 255);
      out[off] = lit;
      out[off + 1] = lit;
      out[off + 2] = clampByte(lit + 18);
      out[off + 3] = a;
    }
    return;
  }

  // Main Lit Render Pass
  const lightR = config.lightColor.r / 255;
  const lightG = config.lightColor.g / 255;
  const lightB = config.lightColor.b / 255;
  const lightHsv = rgbToHsv(config.lightColor.r, config.lightColor.g, config.lightColor.b);
  const steps = Math.max(0, Math.min(8, Math.round(config.shadingSteps)));
  const isMetallic = surfaceModel === "metallic-hard";

  // Half-vector for crisp metallic specular highlight (view vector = (0, 0, 1))
  const hx = lx;
  const hy = ly;
  const hz = lz + 1;
  const hLen = Math.hypot(hx, hy, hz) || 1;
  const nhx = hx / hLen;
  const nhy = hy / hLen;
  const nhz = hz / hLen;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const off = i * 4;
      const a = src[off + 3]!;
      if (a === 0) {
        out[off] = 0;
        out[off + 1] = 0;
        out[off + 2] = 0;
        out[off + 3] = 0;
        continue;
      }

      const r = src[off]!;
      const g = src[off + 1]!;
      const b = src[off + 2]!;
      const origLum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      // Protect crisp dark ink outlines from washing out under strong light
      if (origLum < 0.1) {
        out[off] = r;
        out[off + 1] = g;
        out[off + 2] = b;
        out[off + 3] = a;
        continue;
      }

      const nx = surface.normalX[i]!;
      const ny = surface.normalY[i]!;
      const nz = surface.normalZ[i]!;

      // Directional Lambertian lighting + subtle wrap for natural 2D sprite readability
      const rawDot = nx * lx + ny * ly + nz * lz;
      const diffuse = Math.max(0, (rawDot + 0.18) / 1.18);

      // Spatial directional gradient bias so even flat faces clearly shift brightness when light moves
      const u = w > 1 ? (x / (w - 1)) * 2 - 1 : 0;
      const v = h > 1 ? (y / (h - 1)) * 2 - 1 : 0;
      const planeBias = Math.max(-0.22, Math.min(0.22, (u * lx + v * ly) * 0.24));

      // Specular highlight for hard/metallic surfaces
      let specular = 0;
      if (isMetallic) {
        const ndoth = Math.max(0, nx * nhx + ny * nhy + nz * nhz);
        specular = Math.pow(ndoth, 14) * 0.45 * config.intensity;
      }

      const shadowAtten = 1 - shadowMap[i]! * config.shadowIntensity;
      let illum =
        config.ambientLight +
        Math.max(0, diffuse + planeBias) * config.intensity * shadowAtten +
        specular * shadowAtten;

      // Stepped pixel-art cel shading quantization (with subtle ordered dither if shadowSoftness > 0)
      if (steps >= 2) {
        const clampedIllum = Math.max(0, Math.min(1.6, illum));
        const normalized = clampedIllum / 1.6;
        const scaled = normalized * (steps - 1);
        const baseBand = Math.floor(scaled);
        const frac = scaled - baseBand;
        const gate = config.shadowSoftness > 0.1 ? bayerThreshold4x4(x, y) : 0.5;
        const quantBand = Math.min(steps - 1, baseBand + (frac > gate ? 1 : 0));
        // Blend 75% stepped + 25% continuous to preserve subtle original pixel texture (e.g., Smart Fill wood grain!)
        const steppedIllum = (quantBand / (steps - 1)) * 1.45 + 0.15;
        illum = steppedIllum * 0.72 + clampedIllum * 0.28;
      }

      // Convert illumination into balanced multiplier centered around ~1.0 (preserving original color character)
      const factor = Math.max(0.18, Math.min(1.65, illum));

      // Apply light color tinting (weighted toward lit pixels; shadows shift slightly cool)
      const tintStrength = Math.min(0.45, Math.max(0, (factor - 0.6) * 0.42));
      let outR = r * factor * (1 - tintStrength + tintStrength * lightR);
      let outG = g * factor * (1 - tintStrength + tintStrength * lightG);
      let outB = b * factor * (1 - tintStrength + tintStrength * lightB);

      // Classic Pixel-Art Hue Shifting (warmer highlights, cooler indigo shadows)
      if (config.hueShiftStrength > 0.02) {
        const hsv = rgbToHsv(clampByte(outR), clampByte(outG), clampByte(outB));
        if (hsv.s > 8) {
          const deviation = factor - 1.0; // >0 lit, <0 shadow
          if (Math.abs(deviation) > 0.06) {
            const targetHue = deviation > 0 ? lightHsv.h : 242;
            const shiftDeg = Math.min(20, Math.abs(deviation) * 28 * config.hueShiftStrength);
            const nextH = shiftHue(hsv.h, targetHue, shiftDeg);
            const nextS = Math.max(
              0,
              Math.min(100, hsv.s + (deviation < 0 ? 10 : -4) * config.hueShiftStrength),
            );
            const shifted = hsvToRgb(nextH, nextS, hsv.v);
            outR = shifted.r;
            outG = shifted.g;
            outB = shifted.b;
          }
        }
      }

      out[off] = clampByte(outR);
      out[off + 1] = clampByte(outG);
      out[off + 2] = clampByte(outB);
      out[off + 3] = a;
    }
  }
}

/**
 * Class wrapper implementing ILightingPipeline contract for RenderingEngine integration.
 */
export class DynamicLightingPipeline implements ILightingPipeline {
  private config: LightingConfig;
  private getContextProfile?: () => AssetContextProfile;
  private getSurfaceMaps?: () => SurfaceMaps | undefined;

  constructor(
    config: LightingConfig,
    getContextProfile?: () => AssetContextProfile,
    getSurfaceMaps?: () => SurfaceMaps | undefined,
  ) {
    this.config = config;
    this.getContextProfile = getContextProfile;
    this.getSurfaceMaps = getSurfaceMaps;
  }

  get enabled(): boolean {
    return this.config.enabled;
  }

  getConfig(): LightingConfig {
    return this.config;
  }

  setConfig(next: LightingConfig): void {
    this.config = next;
  }

  process(
    source: PixelBuffer,
    target: PixelBuffer,
    contextProfile?: AssetContextProfile,
  ): void {
    applyDynamicLightingToBuffer(
      source,
      target,
      this.config,
      contextProfile ?? this.getContextProfile?.(),
      this.getSurfaceMaps?.(),
    );
  }
}
