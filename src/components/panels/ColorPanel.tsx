"use client";

import React, { useEffect, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";

type ColorModeTab = "rgb" | "hsv";

export function ColorPanel() {
  const service = useEditorService();
  const primaryColor = useEditorStore((s) => s.primaryColor);
  const recentColors = useEditorStore((s) => s.recentColors);
  const rightPanelOpen = useEditorStore((s) => s.rightPanelOpen);

  const [mode, setMode] = useState<ColorModeTab>("rgb");
  const [hexDraft, setHexDraft] = useState<string>(() => rgbaToHex(primaryColor));
  // Preserve hue when saturation/value drops to 0 so dragging SV plane never jumps hue
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

  if (!rightPanelOpen) {
    return null;
  }

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

  const pureHueCss = `hsl(${effectiveHue}, 100%, 50%)`;
  const opaquePrimaryCss = `rgb(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b})`;
  const alphaPercent = Math.round((primaryColor.a / 255) * 100);

  return (
    <aside
      data-testid="color-panel"
      className="flex w-[276px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-white/8 bg-[#181b22] p-3.5 select-none"
    >
      {/* Color Picker Section */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Color Picker
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
          className="relative h-36 w-full cursor-crosshair overflow-hidden rounded-md border border-white/12"
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
        <div className="flex flex-col gap-1">
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
        </div>

        {/* Alpha / Transparency Bar */}
        <div className="flex flex-col gap-1">
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

      {/* Recent Colors */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Recent Colors
          </h2>
          <span className="text-[10px] text-zinc-500">L / R click</span>
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

      {/* Default Studio Palette */}
      <section className="flex flex-col gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Studio Palette
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

      {/* Compact Keyboard Shortcuts Reference */}
      <section className="rounded-md border border-white/6 bg-[#13151b] p-2.5">
        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Quick Shortcuts
        </h3>
        <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
          <div className="flex items-center justify-between">
            <dt className="text-zinc-500">Tools</dt>
            <dd className="font-mono text-zinc-300">P E B I</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-zinc-500">Size</dt>
            <dd className="font-mono text-zinc-300">[ / ]</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-zinc-500">Swap</dt>
            <dd className="font-mono text-zinc-300">X</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-zinc-500">Grid</dt>
            <dd className="font-mono text-zinc-300">G</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-zinc-500">Pan</dt>
            <dd className="font-mono text-zinc-300">Space</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-zinc-500">Fit</dt>
            <dd className="font-mono text-zinc-300">0</dd>
          </div>
        </dl>
      </section>
    </aside>
  );
}
