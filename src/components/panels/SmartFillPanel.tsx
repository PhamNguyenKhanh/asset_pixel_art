"use client";

import React from "react";
import {
  Check,
  Compass,
  Dices,
  PaintBucket,
  Sparkles,
  SwatchBook,
  X,
} from "lucide-react";
import type { ColorDistributionMode } from "@/types/assetContext";
import type { FillMode } from "@/types/smartFill";
import { useEditorService } from "@/hooks/EditorContext";
import { useEditorStore } from "@/stores/editorStore";
import { rgbaToCss } from "@/core/image-processing/color";
import { BUILTIN_MATERIAL_PRESETS } from "@/modules/asset-context/materialPresets";
import { buildMaterialRamp, generateControlledColorRamp } from "@/modules/smart-fill/colorRamp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DISTRIBUTION_OPTIONS: readonly { id: ColorDistributionMode; label: string }[] = [
  { id: "organic-cluster", label: "Organic Cluster" },
  { id: "grain-linear", label: "Linear Grain" },
  { id: "dithered-speckle", label: "Dithered Speckle" },
  { id: "directional-band", label: "Directional Band" },
  { id: "soft-gradient", label: "Soft Gradient" },
];

export function SmartFillPanel() {
  const service = useEditorService();
  const activeTool = useEditorStore((s) => s.activeTool);
  const primaryColor = useEditorStore((s) => s.primaryColor);
  const config = useEditorStore((s) => s.smartFillConfig);
  const preview = useEditorStore((s) => s.smartFillPreview);
  // Subscribe to asset context changes so recommendations re-render cleanly
  useEditorStore((s) => s.documentMeta.assetContext);

  const activeProfile = service.getAssetContextProfile();
  const allMaterials = service.listAllMaterials();
  const recommendedIds = new Set(activeProfile.fillHints.preferredMaterials);
  const sortedMaterials = [...allMaterials].sort((a, b) => {
    const aRec = recommendedIds.has(a.id) ? 0 : 1;
    const bRec = recommendedIds.has(b.id) ? 0 : 1;
    return aRec - bRec;
  });

  const activeMaterial = BUILTIN_MATERIAL_PRESETS[config.materialId];

  const previewRamp =
    config.mode === "solid"
      ? [primaryColor]
      : config.mode === "material" && activeMaterial
        ? buildMaterialRamp(
            activeMaterial.sampleColors,
            primaryColor,
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
            baseColor: primaryColor,
            colorVariation: config.colorVariation,
            brightnessVariation: config.brightnessVariation,
            saturationVariation: config.saturationVariation,
            contrast: config.contrast,
            steps: 5,
          });

  const handleSelectMode = (mode: FillMode) => {
    service.setSmartFillConfig({ mode });
    if (activeTool !== "bucket") {
      service.setTool("bucket");
    }
  };

  return (
    <div data-testid="smart-fill-panel" className="flex flex-col gap-3.5">
      {/* Header + 3-Mode Selector */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Intelligent Fill
            </h2>
          </div>
          {activeTool !== "bucket" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => service.setTool("bucket")}
              className="h-6 px-2 text-[10px] text-amber-300"
            >
              <PaintBucket className="h-3 w-3" />
              <span>Use Bucket (B)</span>
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-md border border-white/10 bg-[#12141a] p-1">
          {(
            [
              ["solid", "Solid"],
              ["smart", "Smart Fill"],
              ["material", "Material"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              data-testid={`fill-mode-${id}`}
              data-active={config.mode === id}
              onClick={() => handleSelectMode(id)}
              className={`rounded py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                config.mode === id
                  ? "bg-amber-500/20 text-amber-300 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Live Color Ramp Strip */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] text-zinc-500">
            <span>Generated Ramp</span>
            <span>{config.mode === "solid" ? "1 solid color" : `${previewRamp.length} tones`}</span>
          </div>
          <div
            data-testid="smart-fill-ramp-preview"
            className="checkerboard-swatch flex h-5 w-full overflow-hidden rounded border border-white/15"
          >
            {previewRamp.map((c, idx) => (
              <div
                key={idx}
                className="h-full flex-1"
                style={{ backgroundColor: rgbaToCss(c) }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Active Live Preview Action Card */}
      {preview.active && (
        <section
          data-testid="smart-fill-panel-preview-actions"
          className="flex flex-col gap-2 rounded-md border border-amber-400/40 bg-amber-500/10 p-2.5"
        >
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-amber-300">Live Preview Active</span>
            <span className="font-mono text-zinc-300">{preview.pixelCount} px</span>
          </div>
          <p className="text-[10px] text-zinc-300">
            Adjust sliders or seed below to refine live before committing.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="panel-cancel-fill-btn"
              onClick={() => service.cancelSmartFillPreview()}
            >
              <X className="h-3.5 w-3.5" />
              <span>Cancel</span>
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              data-testid="panel-apply-fill-btn"
              onClick={() => service.applySmartFillPreview()}
            >
              <Check className="h-3.5 w-3.5" />
              <span>Apply</span>
            </Button>
          </div>
        </section>
      )}

      {config.mode === "solid" ? (
        <div className="rounded-md border border-white/8 bg-[#12141a] p-3 text-xs leading-relaxed text-zinc-400">
          Classic single-color Bucket Fill. Switch to{" "}
          <strong className="text-zinc-200">Smart Fill</strong> or{" "}
          <strong className="text-zinc-200">Material</strong> for spatially structured pixel-art
          color variations with non-destructive live preview.
        </div>
      ) : (
        <>
          {/* Context Integration Banner */}
          <div className="flex items-center justify-between gap-2 rounded-md border border-white/8 bg-[#12141a] px-2.5 py-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Compass className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <div className="min-w-0">
                <div className="truncate text-[11px] font-medium text-zinc-200">
                  {activeProfile.label} Hints
                </div>
                <div className="truncate text-[10px] text-zinc-500">
                  {activeProfile.fillHints.distribution}
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="sync-context-fill-btn"
              onClick={() => service.syncSmartFillFromAssetContext()}
              className="h-6 px-2 text-[10px]"
            >
              Sync
            </Button>
          </div>

          {/* Material Preset Picker (Material Mode) */}
          {config.mode === "material" && (
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <SwatchBook className="h-3 w-3 text-zinc-400" />
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    Material Preset
                  </h3>
                </div>
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.useMaterialBasePalette}
                    onChange={(e) =>
                      service.setSmartFillConfig({
                        useMaterialBasePalette: e.target.checked,
                      })
                    }
                    className="accent-amber-400"
                  />
                  <span>Preset Colors</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {sortedMaterials.map((mat) => {
                  const isActive = config.materialId === mat.id;
                  const isRecommended = recommendedIds.has(mat.id);
                  return (
                    <button
                      key={mat.id}
                      type="button"
                      data-testid={`material-preset-${mat.id}`}
                      data-active={isActive}
                      onClick={() => service.applyMaterialPresetToSmartFill(mat.id)}
                      className={`flex flex-col gap-1 rounded-md border p-1.5 text-left transition-colors cursor-pointer ${
                        isActive
                          ? "border-amber-400 bg-amber-500/15"
                          : "border-white/8 bg-[#12141a] hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-zinc-200">
                          {mat.label}
                        </span>
                        {isRecommended && (
                          <span className="rounded bg-amber-500/20 px-1 text-[9px] text-amber-300">
                            Fit
                          </span>
                        )}
                      </div>
                      <div className="flex h-2 w-full overflow-hidden rounded-sm">
                        {mat.sampleColors.map((hex) => (
                          <span
                            key={hex}
                            className="h-full flex-1"
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Spatial Distribution Pattern */}
          <section className="flex flex-col gap-1.5">
            <label
              htmlFor="fill-distribution-select"
              className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
            >
              Color Distribution
            </label>
            <select
              id="fill-distribution-select"
              data-testid="fill-distribution-select"
              value={config.distribution}
              onChange={(e) =>
                service.setSmartFillConfig({
                  distribution: e.target.value as ColorDistributionMode,
                })
              }
              className="h-8 w-full rounded-md border border-white/12 bg-[#12141a] px-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-400"
            >
              {DISTRIBUTION_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </section>

          {/* Precision Variation Sliders */}
          <section className="flex flex-col gap-2.5">
            {(
              [
                ["Color Variation", "colorVariation", config.colorVariation],
                ["Brightness Variation", "brightnessVariation", config.brightnessVariation],
                ["Saturation Variation", "saturationVariation", config.saturationVariation],
                ["Contrast", "contrast", config.contrast],
                ["Texture Intensity", "textureIntensity", config.textureIntensity],
              ] as const
            ).map(([label, key, value]) => (
              <div key={key} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">{label}</span>
                  <span className="font-mono text-zinc-200">{Math.round(value * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(value * 100)}
                  aria-label={label}
                  data-testid={`slider-${key}`}
                  onChange={(e) =>
                    service.setSmartFillConfig({ [key]: Number(e.target.value) / 100 })
                  }
                  className="h-1.5 w-full cursor-pointer accent-amber-400"
                />
              </div>
            ))}

            {/* Color Match Tolerance */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">Region Tolerance</span>
                <span className="font-mono text-zinc-200">{config.tolerance}</span>
              </div>
              <input
                type="range"
                min={0}
                max={64}
                value={config.tolerance}
                aria-label="Region Tolerance"
                data-testid="slider-tolerance"
                onChange={(e) =>
                  service.setSmartFillConfig({ tolerance: Number(e.target.value) })
                }
                className="h-1.5 w-full cursor-pointer accent-amber-400"
              />
            </div>
          </section>

          {/* Preservation Toggles + Seed */}
          <section className="flex flex-col gap-2 border-t border-white/8 pt-2.5">
            <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer">
              <span>Preserve Outlines</span>
              <input
                type="checkbox"
                data-testid="toggle-preserve-outlines"
                checked={config.preserveOutlines}
                onChange={(e) =>
                  service.setSmartFillConfig({ preserveOutlines: e.target.checked })
                }
                className="accent-amber-400"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer">
              <span>Preserve Transparency</span>
              <input
                type="checkbox"
                data-testid="toggle-preserve-transparency"
                checked={config.preserveTransparency}
                onChange={(e) =>
                  service.setSmartFillConfig({ preserveTransparency: e.target.checked })
                }
                className="accent-amber-400"
              />
            </label>

            <div className="flex items-center justify-between gap-2 pt-1">
              <label htmlFor="smart-fill-seed-input" className="text-xs text-zinc-400">
                Seed
              </label>
              <div className="flex items-center gap-1">
                <Input
                  id="smart-fill-seed-input"
                  data-testid="smart-fill-seed-input"
                  type="number"
                  min={0}
                  value={config.seed}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isNaN(n) && n >= 0) {
                      service.setSmartFillConfig({ seed: Math.floor(n) });
                    }
                  }}
                  className="h-7 w-24 text-right"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7"
                  data-testid="randomize-seed-btn"
                  aria-label="Randomize Seed"
                  title="Randomize Seed"
                  onClick={() => service.randomizeSmartFillSeed()}
                >
                  <Dices className="h-3.5 w-3.5 text-amber-400" />
                </Button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
