import type { ColorDistributionMode, MaterialPresetId } from "@/types/assetContext";
import type { DirtyRect, RGBA } from "@/types/editor";

export type FillMode = "solid" | "smart" | "material";

export interface SmartFillConfig {
  mode: FillMode;
  materialId: MaterialPresetId;
  useMaterialBasePalette: boolean;
  colorVariation: number; // 0..1
  brightnessVariation: number; // 0..1
  saturationVariation: number; // 0..1
  contrast: number; // 0..1
  textureIntensity: number; // 0..1
  distribution: ColorDistributionMode;
  preserveOutlines: boolean;
  preserveTransparency: boolean;
  tolerance: number; // 0..64 color match tolerance for region detection
  seed: number;
}

export interface SmartFillPreviewSummary {
  active: boolean;
  seedX: number;
  seedY: number;
  pixelCount: number;
  bounds: DirtyRect | null;
  mode: FillMode;
}

export const DEFAULT_SMART_FILL_CONFIG: SmartFillConfig = {
  mode: "solid",
  materialId: "wood",
  useMaterialBasePalette: false,
  colorVariation: 0.28,
  brightnessVariation: 0.32,
  saturationVariation: 0.2,
  contrast: 0.45,
  textureIntensity: 0.5,
  distribution: "organic-cluster",
  preserveOutlines: true,
  preserveTransparency: true,
  tolerance: 0,
  seed: 1337,
};

export interface SmartFillComputeInput {
  baseColor: RGBA;
  config: SmartFillConfig;
  seedX: number;
  seedY: number;
}
