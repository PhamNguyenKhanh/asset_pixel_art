export type BuiltInAssetTypeId =
  | "custom"
  | "character"
  | "animal"
  | "tree"
  | "plant"
  | "building"
  | "environment"
  | "weapon"
  | "item"
  | "furniture"
  | "vehicle";

/** Open string union so custom asset types can be registered without modifying core code */
export type AssetTypeId = BuiltInAssetTypeId | (string & {});

export type MaterialPresetId =
  | "wood"
  | "stone"
  | "grass"
  | "metal"
  | "fabric"
  | "foliage"
  | "skin";

export type ColorDistributionMode =
  | "organic-cluster"
  | "directional-band"
  | "grain-linear"
  | "dithered-speckle"
  | "soft-gradient";

export type SurfaceShadingModel =
  | "organic-rounded"
  | "foliage-cluster"
  | "planar-architectural"
  | "metallic-hard"
  | "flat-balanced";

export interface NamedPalettePreset {
  readonly id: string;
  readonly name: string;
  readonly colors: readonly string[]; // Hex strings
}

export interface MaterialPreset {
  readonly id: MaterialPresetId;
  readonly label: string;
  readonly description: string;
  readonly sampleColors: readonly string[];
  readonly colorVariation: number; // 0..1
  readonly brightnessVariation: number; // 0..1
  readonly saturationVariation: number; // 0..1
  readonly contrast: number; // 0..1
  readonly textureIntensity: number; // 0..1
  readonly distribution: ColorDistributionMode;
}

export interface SmartFillContextHints {
  readonly preferredMaterials: readonly MaterialPresetId[];
  readonly colorVariation: number; // 0..1
  readonly brightnessVariation: number; // 0..1
  readonly saturationVariation: number; // 0..1
  readonly textureIntensity: number; // 0..1
  readonly distribution: ColorDistributionMode;
  readonly preserveOutlines: boolean;
}

export interface LightingContextHints {
  readonly surfaceModel: SurfaceShadingModel;
  readonly surfaceLabel: string;
  readonly defaultLightAngleDeg: number; // 0..360 (top-left ~315)
  readonly defaultIntensity: number; // 0..1.5
  readonly defaultAmbient: number; // 0..1
  readonly defaultShadowIntensity: number; // 0..1
  readonly shadingSteps: number; // 2..6 pixel-art ramp bands
  readonly hueShiftStrength: number; // 0..1
}

export interface AnimationPresetHint {
  readonly id: string;
  readonly name: string;
  readonly frameCount: number;
  readonly fps: number;
  readonly description: string;
}

export interface AssetContextProfile {
  readonly id: AssetTypeId;
  readonly label: string;
  readonly description: string;
  readonly recommendedSizes: readonly number[];
  readonly suggestedPalettes: readonly NamedPalettePreset[];
  readonly fillHints: SmartFillContextHints;
  readonly lightingHints: LightingContextHints;
  readonly animationHints: readonly AnimationPresetHint[];
}

export interface AssetContextState {
  assetTypeId: AssetTypeId;
  preferredMaterialId: MaterialPresetId | null;
}
