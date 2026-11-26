import type {
  AssetContextProfile,
  AssetContextState,
  AssetTypeId,
  MaterialPreset,
  MaterialPresetId,
} from "@/types/assetContext";
import type { IAssetContextProvider } from "@/core/contracts";
import {
  BUILTIN_ASSET_CONTEXT_PROFILES,
  DEFAULT_ASSET_TYPE_ID,
} from "@/modules/asset-context/categoryPresets";
import { BUILTIN_MATERIAL_PRESETS } from "@/modules/asset-context/materialPresets";

/**
 * Extensible Asset Context Registry & Manager.
 * Downstream tools read structured hints via IAssetContextProvider rather than
 * hardcoding asset category names. Switching context never mutates pixel buffers.
 */
export class AssetContextManager implements IAssetContextProvider {
  private readonly profiles = new Map<AssetTypeId, AssetContextProfile>();
  private readonly materials = new Map<MaterialPresetId, MaterialPreset>();
  private state: AssetContextState;

  constructor(initialTypeId: AssetTypeId = DEFAULT_ASSET_TYPE_ID) {
    for (const profile of BUILTIN_ASSET_CONTEXT_PROFILES) {
      this.profiles.set(profile.id, profile);
    }
    for (const preset of Object.values(BUILTIN_MATERIAL_PRESETS)) {
      this.materials.set(preset.id, preset);
    }
    const resolvedId = this.profiles.has(initialTypeId)
      ? initialTypeId
      : DEFAULT_ASSET_TYPE_ID;
    this.state = {
      assetTypeId: resolvedId,
      preferredMaterialId: this.getDefaultMaterialFor(resolvedId),
    };
  }

  registerProfile(profile: AssetContextProfile): void {
    this.profiles.set(profile.id, profile);
  }

  registerMaterial(preset: MaterialPreset): void {
    this.materials.set(preset.id, preset);
  }

  getState(): AssetContextState {
    return { ...this.state };
  }

  getActiveProfile(): AssetContextProfile {
    return (
      this.profiles.get(this.state.assetTypeId) ??
      this.profiles.get(DEFAULT_ASSET_TYPE_ID)!
    );
  }

  getProfile(id: AssetTypeId): AssetContextProfile | undefined {
    return this.profiles.get(id);
  }

  listProfiles(): readonly AssetContextProfile[] {
    return Array.from(this.profiles.values());
  }

  getMaterialPreset(id: MaterialPresetId): MaterialPreset | undefined {
    return this.materials.get(id);
  }

  listMaterials(): readonly MaterialPreset[] {
    return Array.from(this.materials.values());
  }

  getRecommendedMaterials(): readonly MaterialPreset[] {
    const profile = this.getActiveProfile();
    const list: MaterialPreset[] = [];
    for (const matId of profile.fillHints.preferredMaterials) {
      const mat = this.materials.get(matId);
      if (mat) list.push(mat);
    }
    return list;
  }

  setAssetType(id: AssetTypeId): AssetContextProfile {
    const resolvedId = this.profiles.has(id) ? id : DEFAULT_ASSET_TYPE_ID;
    this.state = {
      assetTypeId: resolvedId,
      preferredMaterialId: this.getDefaultMaterialFor(resolvedId),
    };
    return this.getActiveProfile();
  }

  setPreferredMaterial(id: MaterialPresetId | null): void {
    if (id !== null && !this.materials.has(id)) return;
    this.state = {
      ...this.state,
      preferredMaterialId: id,
    };
  }

  restoreState(next: Partial<AssetContextState> | undefined): void {
    if (!next) {
      this.setAssetType(DEFAULT_ASSET_TYPE_ID);
      return;
    }
    const resolvedId =
      next.assetTypeId && this.profiles.has(next.assetTypeId)
        ? next.assetTypeId
        : DEFAULT_ASSET_TYPE_ID;
    const resolvedMat =
      next.preferredMaterialId && this.materials.has(next.preferredMaterialId)
        ? next.preferredMaterialId
        : this.getDefaultMaterialFor(resolvedId);
    this.state = {
      assetTypeId: resolvedId,
      preferredMaterialId: resolvedMat,
    };
  }

  private getDefaultMaterialFor(id: AssetTypeId): MaterialPresetId | null {
    const profile = this.profiles.get(id);
    return profile?.fillHints.preferredMaterials[0] ?? null;
  }
}
