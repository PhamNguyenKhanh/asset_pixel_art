"use client";

import React, { useEffect, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { RGBA } from "@/types/editor";
import { useEditorService } from "@/hooks/EditorContext";
import { useEditorStore } from "@/stores/editorStore";
import {
  clampByte,
  hexToRgba,
  hsvToRgb,
  rgbaToCss,
  rgbaToHex,
  rgbToHsv,
} from "@/core/image-processing/color";
import { DEFAULT_STUDIO_PALETTE } from "@/modules/color-management/defaultPalettes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ColorModeTab = "rgb" | "hsv";

export function ColorPanel() {
  const service = useEditorService();
  const primaryColor = useEditorStore((s) => s.primaryColor);
  const recentColors = useEditorStore((s) => s.recentColors);
  const customPalettes = useEditorStore((s) => s.customPalettes);
  const assetTypeId = useEditorStore((s) => s.documentMeta.assetContext.assetTypeId);
  const activeContextProfile = service.getAssetContextProfile();
  const addCustomPalette = useEditorStore((s) => s.addCustomPalette);
  const deleteCustomPalette = useEditorStore((s) => s.deleteCustomPalette);
  const addColorToCustomPalette = useEditorStore((s) => s.addColorToCustomPalette);
  const removeColorFromCustomPalette = useEditorStore((s) => s.removeColorFromCustomPalette);

  const [mode, setMode] = useState<ColorModeTab>("rgb");
  const [hexDraft, setHexDraft] = useState<string>(() => rgbaToHex(primaryColor));
  const [newPaletteName, setNewPaletteName] = useState("");
  const [showNewPaletteInput, setShowNewPaletteInput] = useState(false);

  const [preservedHue, setPreservedHue] = useState<number>(() => {
    return rgbToHsv(primaryColor.r, primaryColor.g, primaryColor.b).h;
  });

  const svRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);
  const alphaRef = useRef<HTMLDivElement | null>(null);

  const computedHsv = rgbToHsv(primaryColor.r, primaryColor.g, primaryColor.b);
  const effectiveHue = computedHsv.s === 0 || computedHsv.v === 0 ? preservedHue : computedHsv.h;

  useEffect(() => {
    setHexDraft(rgbaToHex(primaryColor, primaryColor.a < 255));
    const hsv = rgbToHsv(primaryColor.r, primaryColor.g, primaryColor.b);
    if (hsv.s > 0 && hsv.v > 0) {
      setPreservedHue(hsv.h);
    }
  }, [primaryColor]);

  const updateFromHsv = (h: number, s: number, v: number, a = primaryColor.a) => {
    const normalizedH = ((Math.round(h) % 360) + 360) % 360;
    setPreservedHue(normalizedH);
    const rgb = hsvToRgb(normalizedH, s, v);
    service.setPrimaryColor({ ...rgb, a: clampByte(a) });
  };

  const handleSvPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = svRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 100;
    const v = (1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))) * 100;
    updateFromHsv(effectiveHue, s, v);
  };

  const handleHuePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    updateFromHsv(ratio * 359, computedHsv.s, computedHsv.v);
  };

  const handleAlphaPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = alphaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    service.setPrimaryColor({ ...primaryColor, a: clampByte(ratio * 255) });
  };

  const commitHex = () => {
    const parsed = hexToRgba(hexDraft);
    if (parsed) {
      service.setPrimaryColor(parsed);
    } else {
      setHexDraft(rgbaToHex(primaryColor, primaryColor.a < 255));
    }
  };

  const handleChannelRgb = (channel: "r" | "g" | "b" | "a", raw: string) => {
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    service.setPrimaryColor({ ...primaryColor, [channel]: clampByte(num) });
  };

  const handleChannelHsv = (channel: "h" | "s" | "v", raw: string) => {
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    if (channel === "h") {
      updateFromHsv(Math.max(0, Math.min(359, num)), computedHsv.s, computedHsv.v);
    } else if (channel === "s") {
      updateFromHsv(effectiveHue, Math.max(0, Math.min(100, num)), computedHsv.v);
    } else {
      updateFromHsv(effectiveHue, computedHsv.s, Math.max(0, Math.min(100, num)));
    }
  };

  const applySwatch = (color: RGBA, isSecondary: boolean) => {
    if (isSecondary) {
      service.setSecondaryColor(color);
    } else {
      service.setPrimaryColor(color);
    }
  };

  const handleCreatePalette = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPaletteName.trim();
    if (!trimmed) return;
    addCustomPalette(trimmed);
    setNewPaletteName("");
    setShowNewPaletteInput(false);
  };

  const pureHueCss = `hsl(${effectiveHue}, 100%, 50%)`;
  const opaquePrimaryCss = `rgb(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b})`;
  const alphaPercent = Math.round((primaryColor.a / 255) * 100);

  return (
    <div data-testid="color-panel" className="flex flex-col gap-3.5">
      {/* Chọn màu */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Bảng chọn màu
          </h2>
          <div className="flex items-center gap-1.5">
            <div className="checkerboard-swatch h-4 w-7 overflow-hidden rounded border border-white/20">
              <div
                className="h-full w-full"
                style={{ backgroundColor: rgbaToCss(primaryColor) }}
              />
            </div>
            <span className="font-mono text-[10px] text-zinc-400">{alphaPercent}%</span>
          </div>
        </div>

        {/* Saturation / Value 2D Picker */}
        <div
          ref={svRef}
          data-testid="sv-picker"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            handleSvPointer(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) handleSvPointer(e);
          }}
          className="relative h-32 w-full cursor-crosshair overflow-hidden rounded-md border border-white/12"
          style={{
            backgroundColor: pureHueCss,
            backgroundImage:
              "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
          }}
        >
          <div
            className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.8)]"
            style={{
              left: `${computedHsv.s}%`,
              top: `${100 - computedHsv.v}%`,
            }}
          />
        </div>

        {/* Hue Bar */}
        <div
          ref={hueRef}
          data-testid="hue-slider"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            handleHuePointer(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) handleHuePointer(e);
          }}
          className="relative h-3 w-full cursor-ew-resize rounded-full border border-white/15"
          style={{
            background:
              "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute top-1/2 h-4 w-2 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-black/80 bg-white shadow"
            style={{ left: `${(effectiveHue / 360) * 100}%` }}
          />
        </div>

        {/* Alpha Bar */}
        <div
          ref={alphaRef}
          data-testid="alpha-slider"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            handleAlphaPointer(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) handleAlphaPointer(e);
          }}
          className="checkerboard-swatch relative h-3 w-full cursor-ew-resize overflow-hidden rounded-full border border-white/15"
        >
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to right, transparent, ${opaquePrimaryCss})`,
            }}
          />
          <div
            className="pointer-events-none absolute top-1/2 h-4 w-2 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-black/80 bg-white shadow"
            style={{ left: `${(primaryColor.a / 255) * 100}%` }}
          />
        </div>

        {/* Hex + Mode Tabs */}
        <div className="flex items-center gap-2 pt-0.5">
          <div className="flex flex-1 items-center gap-1.5">
            <label htmlFor="hex-color-input" className="text-[10px] font-medium text-zinc-500">
              HEX
            </label>
            <Input
              id="hex-color-input"
              data-testid="hex-color-input"
              value={hexDraft}
              onChange={(e) => setHexDraft(e.target.value)}
              onBlur={commitHex}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitHex();
              }}
              className="h-7 uppercase"
            />
          </div>

          <div className="flex rounded border border-white/10 bg-[#12141a] p-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => setMode("rgb")}
              className={`rounded px-1.5 py-0.5 font-medium cursor-pointer ${
                mode === "rgb"
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              RGB
            </button>
            <button
              type="button"
              onClick={() => setMode("hsv")}
              className={`rounded px-1.5 py-0.5 font-medium cursor-pointer ${
                mode === "hsv"
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              HSV
            </button>
          </div>
        </div>

        {/* Numeric Channels */}
        {mode === "rgb" ? (
          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                ["R", "r", primaryColor.r],
                ["G", "g", primaryColor.g],
                ["B", "b", primaryColor.b],
                ["A", "a", primaryColor.a],
              ] as const
            ).map(([label, key, val]) => (
              <label key={key} className="flex flex-col gap-0.5">
                <span className="text-[10px] text-zinc-500">{label}</span>
                <Input
                  type="number"
                  min={0}
                  max={255}
                  value={val}
                  onChange={(e) => handleChannelRgb(key, e.target.value)}
                  className="h-7 px-1.5 text-center"
                />
              </label>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                ["H", "h", effectiveHue, 359],
                ["S", "s", computedHsv.s, 100],
                ["V", "v", computedHsv.v, 100],
              ] as const
            ).map(([label, key, val, max]) => (
              <label key={key} className="flex flex-col gap-0.5">
                <span className="text-[10px] text-zinc-500">{label}</span>
                <Input
                  type="number"
                  min={0}
                  max={max}
                  value={val}
                  onChange={(e) => handleChannelHsv(key, e.target.value)}
                  className="h-7 px-1.5 text-center"
                />
              </label>
            ))}
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-500">A</span>
              <Input
                type="number"
                min={0}
                max={255}
                value={primaryColor.a}
                onChange={(e) => handleChannelRgb("a", e.target.value)}
                className="h-7 px-1.5 text-center"
              />
            </label>
          </div>
        )}
      </section>

      <div className="h-px bg-white/8" />

      {/* Màu gần đây */}
      <section className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Màu gần đây
          </h2>
          <span className="text-[10px] text-zinc-500">Trái / Phải</span>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {recentColors.map((color, idx) => (
            <button
              key={`${rgbaToHex(color, true)}-${idx}`}
              type="button"
              aria-label={`Recent color ${rgbaToHex(color)}`}
              onClick={() => applySwatch(color, false)}
              onContextMenu={(e) => {
                e.preventDefault();
                applySwatch(color, true);
              }}
              className="checkerboard-swatch h-6 w-full overflow-hidden rounded border border-white/15 transition-transform hover:scale-105 hover:border-amber-400 cursor-pointer"
            >
              <span
                className="block h-full w-full"
                style={{ backgroundColor: rgbaToCss(color) }}
              />
            </button>
          ))}
        </div>
      </section>

      <div className="h-px bg-white/8" />

      {/* Context-Aware Suggested Colors (shown whenever a specific Asset Context is active) */}
      {assetTypeId !== "custom" && activeContextProfile.suggestedPalettes[0] && (
        <>
          <section className="flex flex-col gap-1.5" data-testid="color-panel-context-suggestions">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                Gợi ý {activeContextProfile.label}
              </h2>
              <span className="text-[10px] text-zinc-500">
                {activeContextProfile.suggestedPalettes[0].name}
              </span>
            </div>
            <div className="grid grid-cols-8 gap-1">
              {activeContextProfile.suggestedPalettes[0].colors.map((hex) => {
                const parsed = hexToRgba(hex);
                if (!parsed) return null;
                return (
                  <button
                    key={hex}
                    type="button"
                    title={`${hex} (${activeContextProfile.label} preset)`}
                    onClick={() => applySwatch(parsed, false)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      applySwatch(parsed, true);
                    }}
                    className="h-5 w-full rounded border border-amber-400/30 transition-transform hover:scale-110 hover:border-amber-300 cursor-pointer"
                    style={{ backgroundColor: hex }}
                  />
                );
              })}
            </div>
          </section>
          <div className="h-px bg-white/8" />
        </>
      )}

      {/* Bảng màu chuẩn */}
      <section className="flex flex-col gap-1.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Bảng màu chuẩn
        </h2>
        <div className="grid grid-cols-6 gap-1.5" data-testid="studio-palette">
          {DEFAULT_STUDIO_PALETTE.map((color) => {
            const hex = rgbaToHex(color);
            return (
              <button
                key={hex}
                type="button"
                aria-label={`Select color ${hex}`}
                title={`${hex} (Left: Primary, Right: Secondary)`}
                onClick={() => applySwatch(color, false)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  applySwatch(color, true);
                }}
                className="h-6 w-full rounded border border-white/12 transition-transform hover:scale-105 hover:border-amber-400 cursor-pointer"
                style={{ backgroundColor: hex }}
              />
            );
          })}
        </div>
      </section>

      <div className="h-px bg-white/8" />

      {/* Bảng màu riêng */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Bảng màu riêng
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            onClick={() => setShowNewPaletteInput(!showNewPaletteInput)}
            data-testid="new-palette-btn"
          >
            <Plus className="h-3 w-3 text-amber-400" />
            <span>Mới</span>
          </Button>
        </div>

        {showNewPaletteInput && (
          <form onSubmit={handleCreatePalette} className="flex items-center gap-1.5">
            <Input
              autoFocus
              value={newPaletteName}
              onChange={(e) => setNewPaletteName(e.target.value)}
              placeholder="Tên bảng màu..."
              className="h-7 font-sans text-xs"
            />
            <Button type="submit" size="sm" className="h-7 px-2">
              Thêm
            </Button>
          </form>
        )}

        {customPalettes.length === 0 ? (
          <p className="text-[11px] text-zinc-500">
            Tạo bảng màu riêng để lưu các dải màu của bạn ngay trên trình duyệt.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {customPalettes.map((palette) => (
              <div
                key={palette.id}
                className="rounded-md border border-white/8 bg-[#12141a] p-2"
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="truncate text-[11px] font-medium text-zinc-300">
                    {palette.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Add current primary color"
                      onClick={() => addColorToCustomPalette(palette.id, primaryColor)}
                      className="rounded p-0.5 text-zinc-400 hover:bg-white/10 hover:text-amber-300 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      title="Delete palette"
                      onClick={() => deleteCustomPalette(palette.id)}
                      className="rounded p-0.5 text-zinc-500 hover:bg-white/10 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {palette.colors.map((color, idx) => (
                    <div key={`${rgbaToHex(color, true)}-${idx}`} className="group relative">
                      <button
                        type="button"
                        onClick={() => applySwatch(color, false)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          applySwatch(color, true);
                        }}
                        className="checkerboard-swatch h-5 w-full overflow-hidden rounded border border-white/15 hover:border-amber-400 cursor-pointer"
                      >
                        <span
                          className="block h-full w-full"
                          style={{ backgroundColor: rgbaToCss(color) }}
                        />
                      </button>
                      <button
                        type="button"
                        aria-label="Remove color"
                        onClick={() => removeColorFromCustomPalette(palette.id, idx)}
                        className="absolute -right-1 -top-1 hidden h-3.5 w-3.5 items-center justify-center rounded-full bg-zinc-900 text-zinc-300 ring-1 ring-white/20 hover:text-rose-400 group-hover:flex cursor-pointer"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
