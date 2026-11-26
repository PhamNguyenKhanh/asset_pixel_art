"use client";

import React from "react";
import {
  BookmarkPlus,
  Building2,
  Car,
  Check,
  Compass,
  Film,
  Flower2,
  Gem,
  Lamp,
  LayoutGrid,
  Mountain,
  PawPrint,
  Sliders,
  Sparkles,
  SplitSquareHorizontal,
  SplitSquareVertical,
  Sun,
  Sword,
  Trees,
  User,
} from "lucide-react";
import type { AssetTypeId } from "@/types/assetContext";
import { useEditorService } from "@/hooks/EditorContext";
import { useEditorStore } from "@/stores/editorStore";
import { hexToRgba } from "@/core/image-processing/color";
import { Button } from "@/components/ui/button";

const ASSET_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  custom: Sliders,
  character: User,
  animal: PawPrint,
  tree: Trees,
  plant: Flower2,
  building: Building2,
  environment: Mountain,
  weapon: Sword,
  item: Gem,
  furniture: Lamp,
  vehicle: Car,
};

export function ContextPanel() {
  const service = useEditorService();
  const assetContextState = useEditorStore((s) => s.documentMeta.assetContext);
  const tileMode = useEditorStore((s) => s.tileMode);
  const symmetry = useEditorStore((s) => s.symmetry);
  const importNamedPalette = useEditorStore((s) => s.importNamedPalette);

  const profiles = service.listAssetContextProfiles();
  const activeProfile = service.getAssetContextProfile();
  const recommendedMaterials = service.getRecommendedMaterials();
  const isTileContext =
    assetContextState.assetTypeId === "environment" ||
    assetContextState.assetTypeId === "building";
  const isSymmetryContext =
    assetContextState.assetTypeId === "character" ||
    assetContextState.assetTypeId === "weapon" ||
    assetContextState.assetTypeId === "item" ||
    assetContextState.assetTypeId === "vehicle";

  const applyHexColor = (hex: string, secondary: boolean) => {
    const rgba = hexToRgba(hex);
    if (!rgba) return;
    if (secondary) {
      service.setSecondaryColor(rgba);
    } else {
      service.setPrimaryColor(rgba);
    }
  };

  return (
    <div data-testid="context-panel" className="flex flex-col gap-3.5">
      {/* Asset Type Selector Grid */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Compass className="h-3.5 w-3.5 text-amber-400" />
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Ngữ cảnh Asset
            </h2>
          </div>
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
            {activeProfile.label}
          </span>
        </div>

        <p className="text-[11px] leading-relaxed text-zinc-400">
          {activeProfile.description}
        </p>

        <div className="grid grid-cols-3 gap-1" data-testid="asset-type-grid">
          {profiles.map((profile) => {
            const Icon = ASSET_ICONS[profile.id] ?? Sparkles;
            const isActive = assetContextState.assetTypeId === profile.id;
            return (
              <button
                key={profile.id}
                type="button"
                data-testid={`asset-type-${profile.id}`}
                data-active={isActive}
                onClick={() => service.setAssetType(profile.id as AssetTypeId)}
                className={`flex flex-col items-center justify-center gap-1 rounded-md border px-1.5 py-2 text-[10px] font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "border-amber-400 bg-amber-500/18 text-amber-300"
                    : "border-white/8 bg-[#12141a] text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="truncate max-w-full">{profile.label}</span>
              </button>
            );
          })}
        </div>

        <p className="text-[10px] text-zinc-500">
          Tùy chọn &amp; không phá hủy — đổi ngữ cảnh không bao giờ làm thay đổi pixel đã vẽ.
        </p>

        {/* Gợi ý nhanh chế độ Tile liền mạch 3x3 cho Environment / Building */}
        {isTileContext && (
          <div
            data-testid="context-seamless-tile-card"
            className="flex items-center justify-between gap-2 rounded-md border border-emerald-400/35 bg-emerald-500/10 p-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <LayoutGrid className="h-4 w-4 shrink-0 text-emerald-300" />
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-emerald-200">
                  Lặp gạch liền mạch 3×3
                </div>
                <div className="text-[10px] text-emerald-300/75">
                  Xem trước 3×3 &amp; vẽ tràn biên cho tilemap
                </div>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant={tileMode ? "default" : "secondary"}
              data-testid="context-toggle-tile-btn"
              onClick={() => service.toggleTileMode()}
              className="h-6 shrink-0 px-2 text-[10px]"
            >
              {tileMode ? "Đang bật" : "Bật 3×3"}
            </Button>
          </div>
        )}

        {/* Gợi ý nhanh Đối xứng X/Y cho Character / Weapon / Item / Vehicle */}
        {isSymmetryContext && (
          <div
            data-testid="context-symmetry-card"
            className="flex items-center justify-between gap-2 rounded-md border border-sky-400/25 bg-sky-500/8 p-2"
          >
            <span className="text-[11px] font-medium text-sky-200">
              Vẽ đối xứng nhanh
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant={symmetry.x ? "default" : "secondary"}
                onClick={() => service.toggleSymmetryX()}
                className="h-6 gap-1 px-2 text-[10px]"
              >
                <SplitSquareHorizontal className="h-3 w-3" />
                <span>X</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant={symmetry.y ? "default" : "secondary"}
                onClick={() => service.toggleSymmetryY()}
                className="h-6 gap-1 px-2 text-[10px]"
              >
                <SplitSquareVertical className="h-3 w-3" />
                <span>Y</span>
              </Button>
            </div>
          </div>
        )}
      </section>

      <div className="h-px bg-white/8" />

      {/* Bảng màu gợi ý */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Bảng màu gợi ý
          </h3>
          <span className="text-[10px] text-zinc-500">Trái / Phải</span>
        </div>

        <div className="flex flex-col gap-2">
          {activeProfile.suggestedPalettes.map((palette) => (
            <div
              key={palette.id}
              data-testid={`context-palette-${palette.id}`}
              className="rounded-md border border-white/8 bg-[#12141a] p-2"
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-medium text-zinc-200">
                  {palette.name}
                </span>
                <button
                  type="button"
                  title="Save to Custom Palettes"
                  onClick={() =>
                    importNamedPalette(`${activeProfile.label}: ${palette.name}`, palette.colors)
                  }
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-white/8 hover:text-amber-300 cursor-pointer"
                >
                  <BookmarkPlus className="h-3 w-3" />
                  <span>Lưu</span>
                </button>
              </div>
              <div className="grid grid-cols-8 gap-1">
                {palette.colors.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    title={`${hex} (Left: Primary, Right: Secondary)`}
                    aria-label={`Context swatch ${hex}`}
                    onClick={() => applyHexColor(hex, false)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      applyHexColor(hex, true);
                    }}
                    className="h-5 w-full rounded border border-white/15 transition-transform hover:scale-110 hover:border-amber-400 cursor-pointer"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="h-px bg-white/8" />

      {/* Vật liệu gợi ý */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Vật liệu gợi ý
          </h3>
          <span className="text-[10px] text-zinc-500">Tô thông minh</span>
        </div>

        <div className="flex flex-col gap-1.5">
          {recommendedMaterials.map((mat) => {
            const isSelected = assetContextState.preferredMaterialId === mat.id;
            return (
              <button
                key={mat.id}
                type="button"
                data-testid={`context-material-${mat.id}`}
                data-active={isSelected}
                onClick={() => service.setPreferredMaterial(mat.id)}
                className={`flex items-center justify-between rounded-md border px-2 py-1.5 text-left transition-colors cursor-pointer ${
                  isSelected
                    ? "border-amber-400/60 bg-amber-500/12"
                    : "border-white/8 bg-[#12141a] hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex overflow-hidden rounded border border-white/15">
                    {mat.sampleColors.slice(0, 4).map((hex) => (
                      <span
                        key={hex}
                        className="h-4 w-2.5"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-zinc-200">
                      {mat.label}
                    </div>
                    <div className="truncate text-[10px] text-zinc-500">
                      {mat.distribution}
                    </div>
                  </div>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
              </button>
            );
          })}
        </div>
      </section>

      <div className="h-px bg-white/8" />

      {/* Lighting & Shading Profile Summary (feeds Phase 5 Dynamic Lighting) */}
      <section className="rounded-md border border-white/8 bg-[#12141a] p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sun className="h-3.5 w-3.5 text-amber-400" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Cấu hình đổ bóng
            </h3>
          </div>
          <span className="text-[10px] text-zinc-500">Ánh sáng</span>
        </div>
        <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
          <dt className="text-zinc-500">Bề mặt</dt>
          <dd className="text-right text-zinc-200">
            {activeProfile.lightingHints.surfaceLabel}
          </dd>
          <dt className="text-zinc-500">Số dải sáng</dt>
          <dd className="text-right font-mono text-zinc-200">
            {activeProfile.lightingHints.shadingSteps} dải
          </dd>
          <dt className="text-zinc-500">Độ đậm bóng</dt>
          <dd className="text-right font-mono text-zinc-200">
            {Math.round(activeProfile.lightingHints.defaultShadowIntensity * 100)}%
          </dd>
          <dt className="text-zinc-500">Dịch sắc độ</dt>
          <dd className="text-right font-mono text-zinc-200">
            {Math.round(activeProfile.lightingHints.hueShiftStrength * 100)}%
          </dd>
        </dl>
      </section>

      {/* Mẫu chuyển động */}
      {activeProfile.animationHints.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Film className="h-3.5 w-3.5 text-zinc-400" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Mẫu hoạt ảnh
            </h3>
          </div>
          <div className="flex flex-col gap-1.5">
            {activeProfile.animationHints.map((hint) => (
              <div
                key={hint.id}
                className="flex items-center justify-between gap-2 rounded-md border border-white/8 bg-[#12141a] px-2 py-1.5"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-zinc-200">
                    {hint.name}
                  </div>
                  <div className="truncate text-[10px] text-zinc-500">
                    {hint.frameCount} khung &bull; {hint.fps} FPS
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  data-testid={`apply-anim-preset-${hint.id}`}
                  onClick={() => service.applyAnimationPreset(hint.id)}
                  className="h-6 px-2 text-[10px]"
                >
                  Áp dụng
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
