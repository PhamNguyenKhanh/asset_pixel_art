"use client";

import React, { useRef, useState } from "react";
import {
  Check,
  Compass,
  Eraser,
  Eye,
  Mountain,
  RotateCcw,
  Sun,
} from "lucide-react";
import type {
  LightingBakeScope,
  LightingPreviewMode,
  SurfaceMaskPaintMode,
} from "@/types/lighting";
import { useEditorService } from "@/hooks/EditorContext";
import { useEditorStore } from "@/stores/editorStore";
import { hexToRgba, rgbaToCss, rgbaToHex } from "@/core/image-processing/color";
import { Button } from "@/components/ui/button";

const LIGHT_COLOR_PRESETS = [
  { label: "Nắng", hex: "#FFF4D6" },
  { label: "Trắng", hex: "#FFFFFF" },
  { label: "Trăng", hex: "#A8D4FF" },
  { label: "Đuốc", hex: "#FFAA5E" },
] as const;

const DIRECTION_PRESETS = [
  { id: "tl", label: "Trên-T", x: -0.8, y: -0.8 },
  { id: "top", label: "Trên", x: 0, y: -1.0 },
  { id: "tr", label: "Trên-P", x: 0.8, y: -0.8 },
  { id: "bl", label: "Dưới-T", x: -0.8, y: 0.8 },
] as const;

export function LightingPanel() {
  const service = useEditorService();
  const config = useEditorStore((s) => s.lightingConfig);
  const maskMode = useEditorStore((s) => s.surfaceMaskMode);
  const frameCount = useEditorStore((s) => s.documentMeta.frameCount);
  useEditorStore((s) => s.documentMeta.assetContext);

  const [bakeScope, setBakeScope] = useState<LightingBakeScope>("current-frame");
  const padRef = useRef<HTMLDivElement | null>(null);

  const activeProfile = service.getAssetContextProfile();

  const updateLightPad = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    const clampedX = Math.max(-1.4, Math.min(1.4, Math.round(nx * 1.4 * 100) / 100));
    const clampedY = Math.max(-1.4, Math.min(1.4, Math.round(ny * 1.4 * 100) / 100));
    service.setLightingConfig({ enabled: true, lightX: clampedX, lightY: clampedY });
  };

  const padDotLeftPct = Math.max(4, Math.min(96, ((config.lightX / 1.4) * 0.5 + 0.5) * 100));
  const padDotTopPct = Math.max(4, Math.min(96, ((config.lightY / 1.4) * 0.5 + 0.5) * 100));

  return (
    <div data-testid="lighting-panel" className="flex flex-col gap-3.5">
      {/* Header + Master Enable Switch */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sun className={`h-4 w-4 ${config.enabled ? "text-amber-400" : "text-zinc-500"}`} />
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
              Phòng Ánh sáng
            </h2>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={config.enabled}
            data-testid="lighting-enable-toggle"
            onClick={() => service.setLightingConfig({ enabled: !config.enabled })}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
              config.enabled ? "bg-amber-500" : "bg-zinc-700"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-zinc-950 transition-transform ${
                config.enabled ? "translate-x-4.5" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <p className="text-[10px] leading-relaxed text-zinc-400">
          Ánh sáng định hướng &amp; bóng đổ không phá hủy pixel gốc. Kéo trực tiếp biểu tượng nguồn
          sáng trên khung vẽ hoặc dùng la bàn bên dưới.
        </p>

        {/* Đồng bộ bề mặt theo ngữ cảnh */}
        <div className="flex items-center justify-between gap-2 rounded-md border border-white/8 bg-[#12141a] px-2.5 py-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Compass className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <div className="min-w-0">
              <div className="truncate text-[11px] font-medium text-zinc-200">
                Bề mặt {activeProfile.label}
              </div>
              <div className="truncate text-[10px] text-zinc-500">
                {activeProfile.lightingHints.surfaceLabel}
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="sync-context-lighting-btn"
            onClick={() => service.syncLightingFromAssetContext()}
            className="h-6 px-2 text-[10px]"
          >
            Đồng bộ
          </Button>
        </div>
      </section>

      {/* Vị trí nguồn sáng */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Vị trí nguồn sáng
          </span>
          <span className="font-mono text-[10px] text-zinc-400">
            X:{config.lightX.toFixed(2)} Y:{config.lightY.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Circular 2D Directional Compass Pad */}
          <div
            ref={padRef}
            data-testid="light-direction-pad"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              updateLightPad(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1) updateLightPad(e);
            }}
            className="relative h-24 w-24 shrink-0 cursor-crosshair overflow-hidden rounded-full border border-white/15 bg-[#101218] shadow-inner"
          >
            {/* Crosshair axes */}
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white/8" />
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-white/8" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/12 bg-white/4" />

            {/* Light Handle Dot */}
            <div
              className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-zinc-950 shadow-[0_0_10px_rgba(251,191,36,0.9)]"
              style={{
                left: `${padDotLeftPct}%`,
                top: `${padDotTopPct}%`,
                backgroundColor: rgbaToCss({ ...config.lightColor, a: 255 }),
              }}
            />
          </div>

          {/* Quick Directions + Elevation + Gizmo Toggle */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="grid grid-cols-2 gap-1">
              {DIRECTION_PRESETS.map((dir) => (
                <button
                  key={dir.id}
                  type="button"
                  data-testid={`light-dir-${dir.id}`}
                  onClick={() =>
                    service.setLightingConfig({
                      enabled: true,
                      lightX: dir.x,
                      lightY: dir.y,
                    })
                  }
                  className="rounded border border-white/10 bg-[#12141a] py-1 text-[10px] font-medium text-zinc-300 hover:border-amber-400/50 hover:text-amber-300 cursor-pointer"
                >
                  {dir.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-zinc-500">Độ cao</span>
                <span className="font-mono text-zinc-300">
                  {Math.round(config.lightElevation * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={15}
                max={100}
                value={Math.round(config.lightElevation * 100)}
                aria-label="Độ cao nguồn sáng"
                onChange={(e) =>
                  service.setLightingConfig({ lightElevation: Number(e.target.value) / 100 })
                }
                className="h-1.5 w-full cursor-pointer accent-amber-400"
              />
            </div>

            <label className="flex items-center justify-between text-[10px] text-zinc-400 cursor-pointer">
              <span>Hiện nguồn sáng</span>
              <input
                type="checkbox"
                checked={config.showLightGizmo}
                onChange={(e) =>
                  service.setLightingConfig({ showLightGizmo: e.target.checked })
                }
                className="accent-amber-400"
              />
            </label>
          </div>
        </div>
      </section>

      <div className="h-px bg-white/8" />

      {/* Light Color */}
      <section className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Màu ánh sáng
          </span>
          <span className="font-mono text-[10px] text-zinc-400">
            {rgbaToHex(config.lightColor)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {LIGHT_COLOR_PRESETS.map((preset) => {
            const parsed = hexToRgba(preset.hex)!;
            const active = rgbaToHex(config.lightColor) === preset.hex;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => service.setLightingConfig({ lightColor: parsed })}
                className={`flex flex-1 items-center justify-center gap-1 rounded border py-1 text-[10px] cursor-pointer ${
                  active
                    ? "border-amber-400 bg-amber-500/15 text-amber-200"
                    : "border-white/10 bg-[#12141a] text-zinc-400 hover:border-white/25"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full border border-black/40"
                  style={{ backgroundColor: preset.hex }}
                />
                <span>{preset.label}</span>
              </button>
            );
          })}
          <input
            type="color"
            aria-label="Custom light color"
            value={rgbaToHex(config.lightColor)}
            onChange={(e) => {
              const parsed = hexToRgba(e.target.value);
              if (parsed) service.setLightingConfig({ lightColor: parsed });
            }}
            className="h-6 w-7 cursor-pointer rounded border border-white/15 bg-transparent p-0"
          />
        </div>
      </section>

      {/* Core Lighting & Shadow Sliders */}
      <section className="flex flex-col gap-2">
        {(
          [
            ["Cường độ sáng", "intensity", config.intensity, 0, 180],
            ["Ánh sáng môi trường", "ambientLight", config.ambientLight, 0, 100],
            ["Độ đậm bóng đổ", "shadowIntensity", config.shadowIntensity, 0, 100],
            ["Độ mềm bóng (Dither)", "shadowSoftness", config.shadowSoftness, 0, 100],
            ["Chiều dài bóng đổ", "shadowLength", config.shadowLength, 0, 100],
            ["Dịch sắc độ", "hueShiftStrength", config.hueShiftStrength, 0, 100],
          ] as const
        ).map(([label, key, value, min, max]) => (
          <div key={key} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">{label}</span>
              <span className="font-mono text-zinc-200">{Math.round(value * 100)}%</span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              value={Math.round(value * 100)}
              aria-label={label}
              data-testid={`lighting-slider-${key}`}
              onChange={(e) =>
                service.setLightingConfig({ [key]: Number(e.target.value) / 100 })
              }
              className="h-1.5 w-full cursor-pointer accent-amber-400"
            />
          </div>
        ))}

        {/* Dải sáng tối */}
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[11px] text-zinc-400">Số dải sáng tối</span>
          <div className="flex gap-1">
            {[0, 3, 4, 5, 6].map((steps) => (
              <button
                key={steps}
                type="button"
                onClick={() => service.setLightingConfig({ shadingSteps: steps })}
                className={`rounded border px-1.5 py-0.5 font-mono text-[10px] cursor-pointer ${
                  config.shadingSteps === steps
                    ? "border-amber-400 bg-amber-500/20 text-amber-300"
                    : "border-white/10 bg-[#12141a] text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {steps === 0 ? "∞" : steps}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px bg-white/8" />

      {/* Kênh xem trước */}
      <section className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          <Eye className="h-3 w-3 text-zinc-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Kênh xem trước
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1 rounded-md border border-white/10 bg-[#12141a] p-1">
          {(
            [
              ["lit", "Sáng"],
              ["normals", "Pháp tuyến"],
              ["height", "Độ cao"],
              ["shadows", "Bóng"],
            ] as readonly [LightingPreviewMode, string][]
          ).map(([modeId, label]) => (
            <button
              key={modeId}
              type="button"
              data-testid={`lighting-preview-${modeId}`}
              onClick={() => service.setLightingConfig({ enabled: true, previewMode: modeId })}
              className={`rounded py-1 text-[10px] font-medium cursor-pointer ${
                config.previewMode === modeId
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Cọ mặt nạ bề mặt */}
      <section className="flex flex-col gap-1.5 rounded-md border border-white/8 bg-[#12141a] p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Mountain className="h-3 w-3 text-amber-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
              Cọ mặt nạ bề mặt
            </span>
          </div>
          <button
            type="button"
            onClick={() => service.clearActiveLayerSurfaceMasks()}
            className="text-[10px] text-zinc-500 hover:text-rose-400 cursor-pointer"
          >
            Xóa hết
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1">
          {(
            [
              ["none", "Tắt"],
              ["raise", "Nâng +"],
              ["lower", "Hạ -"],
              ["occlude", "Che bóng"],
              ["erase-mask", "Tẩy"],
            ] as readonly [SurfaceMaskPaintMode, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              data-testid={`mask-brush-${id}`}
              data-active={maskMode === id}
              onClick={() => {
                if (id !== "none" && !config.enabled) {
                  service.setLightingConfig({ enabled: true });
                }
                service.setSurfaceMaskMode(id);
              }}
              className={`flex items-center justify-center gap-1 rounded border py-1 text-[10px] cursor-pointer ${
                maskMode === id
                  ? "border-amber-400 bg-amber-500/20 text-amber-300"
                  : "border-white/8 bg-[#181b22] text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {id === "erase-mask" && <Eraser className="h-2.5 w-2.5" />}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="h-px bg-white/8" />

      {/* Áp dụng (Bake) & Đặt lại */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400">Phạm vi áp dụng</span>
          <select
            value={bakeScope}
            data-testid="bake-scope-select"
            onChange={(e) => setBakeScope(e.target.value as LightingBakeScope)}
            className="h-6 rounded border border-white/12 bg-[#12141a] px-1.5 text-[11px] text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-400"
          >
            <option value="current-layer">Lớp hiện tại</option>
            <option value="current-frame">Khung hiện tại</option>
            <option value="all-frames">Tất cả khung ({frameCount})</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="reset-lighting-btn"
            onClick={() => service.resetLighting()}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Đặt lại</span>
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={!config.enabled}
            data-testid="bake-lighting-btn"
            onClick={() => service.applyLightingBake(bakeScope)}
          >
            <Check className="h-3.5 w-3.5" />
            <span>Áp dụng (Bake)</span>
          </Button>
        </div>
      </section>
    </div>
  );
}
