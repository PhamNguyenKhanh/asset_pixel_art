import type { ColorDistributionMode } from "@/types/assetContext";
import type { DirtyRect, RGBA } from "@/types/editor";
import type { SmartFillConfig } from "@/types/smartFill";
import { PixelBuffer } from "@/core/document/PixelBuffer";
import { clampByte, hsvToRgb, packRGBA, rgbToHsv } from "@/core/image-processing/color";
import { bayerThreshold4x4, fbm2D, hash2D, valueNoise2D } from "@/core/image-processing/noise";
import { BUILTIN_MATERIAL_PRESETS } from "@/modules/asset-context/materialPresets";
import { analyzeFillRegion, type AnalyzedRegion } from "@/modules/smart-fill/regionAnalyzer";
import { buildMaterialRamp, generateControlledColorRamp } from "@/modules/smart-fill/colorRamp";

export interface SmartFillOutput {
  changed: boolean;
  region: AnalyzedRegion | null;
  previewBuffer: PixelBuffer | null;
  dirtyRect: DirtyRect | null;
}

interface SpatialSample {
  /** Normalized tonal score in [0, 1]: 0 = darkest shadow, 0.5 = midtone, 1 = brightest highlight */
  tone: number;
  /** Subtle warm/cool hue nudge in [-1, 1] */
  hueNudge: number;
}

/**
 * Evaluates a spatially coherent pixel-art tonal field inside a detected region.
 * Adapts pattern frequency to region size so small shapes stay crisp and large surfaces look rich.
 */
function evaluateSpatialField(
  lx: number,
  ly: number,
  gx: number,
  gy: number,
  region: AnalyzedRegion,
  distribution: ColorDistributionMode,
  textureIntensity: number,
  seed: number,
): SpatialSample {
  const w = Math.max(1, region.width);
  const h = Math.max(1, region.height);
  const u = w > 1 ? lx / (w - 1) : 0.5;
  const v = h > 1 ? ly / (h - 1) : 0.5;

  // Soft directional light gradient from top-left (brighter) to bottom-right (darker)
  const dirLight = (1 - (u * 0.42 + v * 0.58)) * 2 - 1; // [-1, 1]

  // Normalized interior distance: 0 at perimeter edge, 1 deep inside
  const dist = region.edgeDistance[ly * w + lx]!;
  const edgeFactor = Math.min(1, dist / Math.max(2, Math.min(6, region.maxEdgeDistance)));

  // Scale pattern smoothly for small vs large sprites
  const minDim = Math.min(w, h);
  const scaleFactor = minDim < 10 ? 0.55 : minDim < 24 ? 0.35 : 0.22;
  const tex = Math.max(0, Math.min(1, textureIntensity));

  let rawTone = 0.5;
  let hueNudge = 0;

  switch (distribution) {
    case "grain-linear": {
      // Wood planks / linear fibers: stretched horizontally with wavy grain lines
      const wave = valueNoise2D(gx * scaleFactor * 0.45, gy * scaleFactor * 0.45, seed + 17) * 1.8;
      const grain = fbm2D(gx * scaleFactor * 0.35, (gy + wave) * scaleFactor * 1.65, seed, 2);
      // Subtle board bevel near perimeter
      const bevel = (edgeFactor - 0.5) * 0.25;
      const microKnot = valueNoise2D(gx * scaleFactor * 0.9, gy * scaleFactor * 0.9, seed + 71);
      const knotDip = microKnot < 0.16 ? -0.22 * tex : 0;
      rawTone = 0.5 + dirLight * 0.22 + bevel + (grain - 0.5) * 0.85 * tex + knotDip;
      hueNudge = (grain - 0.5) * 0.9;
      break;
    }

    case "organic-cluster": {
      // Foliage / grass clumps: rounded multi-pixel leafy clusters with bright crowns
      const cluster = fbm2D(gx * scaleFactor * 0.85, gy * scaleFactor * 0.85, seed, 2);
      const secondary = valueNoise2D(gx * scaleFactor * 1.5, gy * scaleFactor * 1.5, seed + 31);
      const crownBias = (1 - v) * 0.38 - 0.19;
      const edgeAO = (edgeFactor - 0.45) * 0.28;
      rawTone =
        0.5 +
        crownBias +
        dirLight * 0.14 +
        edgeAO +
        (cluster - 0.5) * 0.72 * tex +
        (secondary - 0.5) * 0.26 * tex;
      hueNudge = (cluster - 0.5) * 1.1;
      break;
    }

    case "dithered-speckle": {
      // Stone / rock / brick: broad rocky facets + crisp pixel-art ordered dithering + sparse crevices
      const facet = fbm2D(gx * scaleFactor * 0.7, gy * scaleFactor * 0.7, seed, 2);
      const bayer = bayerThreshold4x4(gx, gy) - 0.5;
      const speck = hash2D(gx, gy, seed + 97);
      const mineral = speck > 0.94 ? 0.22 * tex : speck < 0.06 ? -0.22 * tex : 0;
      const rim = (edgeFactor - 0.5) * 0.3;
      rawTone =
        0.5 +
        dirLight * 0.24 +
        rim +
        (facet - 0.5) * 0.65 * tex +
        bayer * 0.18 * tex +
        mineral;
      hueNudge = (facet - 0.5) * 0.6;
      break;
    }

    case "directional-band": {
      // Forged metal / armor / hulls: crisp diagonal specular sheen bands
      const diagCoord = u * 0.72 + v * 0.68;
      const shimmer = valueNoise2D(gx * scaleFactor * 0.5, gy * scaleFactor * 0.5, seed + 43);
      const bandPhase = (diagCoord + (shimmer - 0.5) * 0.18 * tex) * Math.PI * 2.1;
      const sheen = Math.sin(bandPhase) * 0.36;
      const specPeak = Math.pow(Math.max(0, Math.sin(bandPhase + 0.5)), 4) * 0.35;
      rawTone = 0.46 + sheen + specPeak + (edgeFactor - 0.5) * 0.18;
      hueNudge = (sheen + specPeak) * 0.7;
      break;
    }

    case "soft-gradient":
    default: {
      // Fabric / skin / smooth items: clean form shading + gentle low-freq texture weave
      const fold = fbm2D(gx * scaleFactor * 0.6, gy * scaleFactor * 0.6, seed, 2);
      const formVolume = (edgeFactor - 0.4) * 0.26;
      rawTone = 0.5 + dirLight * 0.32 + formVolume + (fold - 0.5) * 0.45 * tex;
      hueNudge = (fold - 0.5) * 0.55;
      break;
    }
  }

  // Softly dampen extreme perimeter noise when preserveOutlines keeps boundaries tidy
  const tone = Math.max(0, Math.min(1, rawTone));
  return { tone, hueNudge: Math.max(-1, Math.min(1, hueNudge)) };
}

/**
 * Renders a pre-analyzed region with Smart Color Fill or Material Fill onto a PixelBuffer.
 * Never mutates the source buffer — writes into a fresh preview PixelBuffer for non-destructive preview.
 */
export function renderSmartFillRegion(
  sourceBuffer: PixelBuffer,
  region: AnalyzedRegion,
  baseColor: RGBA,
  config: SmartFillConfig,
): PixelBuffer {
  const preview = new PixelBuffer(sourceBuffer.width, sourceBuffer.height);

  // Determine effective color ramp and spatial distribution
  const isMaterial = config.mode === "material";
  const materialPreset = isMaterial
    ? BUILTIN_MATERIAL_PRESETS[config.materialId]
    : undefined;

  const effectiveDistribution = isMaterial && materialPreset
    ? config.distribution || materialPreset.distribution
    : config.distribution;

  const ramp =
    isMaterial && materialPreset
      ? buildMaterialRamp(
          materialPreset.sampleColors,
          baseColor,
          config.useMaterialBasePalette,
          {
            colorVariation: config.colorVariation,
            brightnessVariation: config.brightnessVariation,
            saturationVariation: config.saturationVariation,
            contrast: config.contrast,
            steps: 5,
          },
        )
      : generateControlledColorRamp({
          baseColor,
          colorVariation: config.colorVariation,
          brightnessVariation: config.brightnessVariation,
          saturationVariation: config.saturationVariation,
          contrast: config.contrast,
          steps: 5,
        });

  const rampMaxIdx = ramp.length - 1;
  const contrastGain = 0.65 + config.contrast * 0.75;
  const subtleHueRange = config.colorVariation * 10;

  for (let ly = 0; ly < region.height; ly++) {
    const gy = region.bounds.minY + ly;
    for (let lx = 0; lx < region.width; lx++) {
      if (region.mask[ly * region.width + lx] === 0) continue;

      const gx = region.bounds.minX + lx;
      const srcOffset = (gy * sourceBuffer.width + gx) * 4;
      const origAlpha = sourceBuffer.data[srcOffset + 3]!;

      // Respect transparency preservation: if filling an opaque pixel, keep its original alpha
      const finalAlpha =
        config.preserveTransparency && region.seedAlpha > 0
          ? origAlpha
          : baseColor.a;

      const sample = evaluateSpatialField(
        lx,
        ly,
        gx,
        gy,
        region,
        effectiveDistribution,
        config.textureIntensity,
        config.seed,
      );

      // Apply contrast curve centered around midtone 0.5
      const contrasted = Math.max(0, Math.min(1, 0.5 + (sample.tone - 0.5) * contrastGain));

      // Quantize cleanly onto ramp with subtle Bayer ordered transition so adjacent pixels form crisp clusters
      const scaledPos = contrasted * rampMaxIdx;
      const baseIdx = Math.floor(scaledPos);
      const frac = scaledPos - baseIdx;
      const ditherGate =
        config.textureIntensity > 0.15
          ? bayerThreshold4x4(gx, gy)
          : 0.5;
      const rampIdx = Math.min(rampMaxIdx, baseIdx + (frac > ditherGate ? 1 : 0));
      let chosen = ramp[rampIdx]!;

      // Apply gentle secondary hue nudge (warm/cool organic variation) without leaving base color family
      if (subtleHueRange > 0.5 && Math.abs(sample.hueNudge) > 0.15) {
        const hsv = rgbToHsv(chosen.r, chosen.g, chosen.b);
        if (hsv.s > 8) {
          const nudgedHue = (hsv.h + sample.hueNudge * subtleHueRange + 360) % 360;
          const rgb = hsvToRgb(nudgedHue, hsv.s, hsv.v);
          chosen = { r: rgb.r, g: rgb.g, b: rgb.b, a: finalAlpha };
        }
      }

      preview.setPacked(
        gx,
        gy,
        packRGBA(
          clampByte(chosen.r),
          clampByte(chosen.g),
          clampByte(chosen.b),
          clampByte(finalAlpha),
        ),
      );
    }
  }

  return preview;
}

/**
 * Full single-call helper: analyzes connected region at (seedX, seedY) and generates
 * a non-destructive Smart Fill preview buffer.
 */
export function computeSmartFill(
  sourceBuffer: PixelBuffer,
  seedX: number,
  seedY: number,
  baseColor: RGBA,
  config: SmartFillConfig,
): SmartFillOutput {
  const region = analyzeFillRegion(sourceBuffer, seedX, seedY, {
    tolerance: config.tolerance,
    preserveOutlines: config.preserveOutlines,
    preserveTransparency: config.preserveTransparency,
  });

  if (!region) {
    return { changed: false, region: null, previewBuffer: null, dirtyRect: null };
  }

  const previewBuffer = renderSmartFillRegion(sourceBuffer, region, baseColor, config);
  return {
    changed: true,
    region,
    previewBuffer,
    dirtyRect: region.bounds,
  };
}
