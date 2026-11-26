import { describe, expect, it } from "vitest";
import { AssetContextManager } from "@/modules/asset-context/AssetContextManager";
import { hexToRgba } from "@/core/image-processing/color";

describe("AssetContextManager & Registry", () => {
  it("loads all 11 built-in asset contexts with valid palettes and defaults", () => {
    const manager = new AssetContextManager();
    const profiles = manager.listProfiles();
    const ids = profiles.map((p) => p.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        "custom",
        "character",
        "animal",
        "tree",
        "plant",
        "building",
        "environment",
        "weapon",
        "item",
        "furniture",
        "vehicle",
      ]),
    );

    for (const profile of profiles) {
      expect(profile.suggestedPalettes.length).toBeGreaterThan(0);
      for (const palette of profile.suggestedPalettes) {
        for (const hex of palette.colors) {
          expect(hexToRgba(hex)).not.toBeNull();
        }
      }
      expect(profile.fillHints.preferredMaterials.length).toBeGreaterThan(0);
      expect(profile.lightingHints.shadingSteps).toBeGreaterThanOrEqual(2);
    }
  });

  it("defaults to custom and falls back safely for unknown categories", () => {
    const manager = new AssetContextManager();
    expect(manager.getActiveProfile().id).toBe("custom");

    const tree = manager.setAssetType("tree");
    expect(tree.id).toBe("tree");
    expect(tree.lightingHints.surfaceModel).toBe("foliage-cluster");
    expect(manager.getRecommendedMaterials().map((m) => m.id)).toEqual([
      "foliage",
      "wood",
      "grass",
    ]);

    const fallback = manager.setAssetType("non-existent-type");
    expect(fallback.id).toBe("custom");
  });

  it("supports registering custom extensible asset profiles without modifying core code", () => {
    const manager = new AssetContextManager();
    manager.registerProfile({
      id: "mecha",
      label: "Mecha",
      description: "Giant robotic units",
      recommendedSizes: [64, 128],
      suggestedPalettes: [
        { id: "mecha-1", name: "Titanium", colors: ["#1B2230", "#6B7C99", "#D7E1F2", "#E63946"] },
      ],
      fillHints: {
        preferredMaterials: ["metal", "stone"],
        colorVariation: 0.15,
        brightnessVariation: 0.5,
        saturationVariation: 0.15,
        textureIntensity: 0.3,
        distribution: "directional-band",
        preserveOutlines: true,
      },
      lightingHints: {
        surfaceModel: "metallic-hard",
        surfaceLabel: "Mecha Armor Plates",
        defaultLightAngleDeg: 315,
        defaultIntensity: 1.3,
        defaultAmbient: 0.25,
        defaultShadowIntensity: 0.6,
        shadingSteps: 5,
        hueShiftStrength: 0.2,
      },
      animationHints: [],
    });

    const active = manager.setAssetType("mecha");
    expect(active.id).toBe("mecha");
    expect(active.label).toBe("Mecha");
    expect(manager.getState().preferredMaterialId).toBe("metal");
  });
});
