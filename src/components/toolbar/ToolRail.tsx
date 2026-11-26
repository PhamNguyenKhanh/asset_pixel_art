"use client";

import React from "react";
import {
  ArrowLeftRight,
  BoxSelect,
  Circle,
  Crop,
  Eraser,
  Minus,
  Move,
  PaintBucket,
  Pencil,
  Pipette,
  Square,
  Trash2,
} from "lucide-react";
import type { ToolId } from "@/types/editor";
import { useEditorService } from "@/hooks/EditorContext";
import { useEditorStore } from "@/stores/editorStore";
import { rgbaToCss, rgbaToHex } from "@/core/image-processing/color";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ToolItem {
  id: ToolId;
  label: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TOOL_ITEMS: readonly ToolItem[] = [
  { id: "pencil", label: "Pencil", shortcut: "P", icon: Pencil },
  { id: "eraser", label: "Eraser", shortcut: "E", icon: Eraser },
  { id: "bucket", label: "Bucket Fill", shortcut: "B", icon: PaintBucket },
  { id: "eyedropper", label: "Color Picker", shortcut: "I", icon: Pipette },
  { id: "line", label: "Line (Shift: 45°)", shortcut: "L", icon: Minus },
  { id: "rectangle", label: "Rectangle (Shift: Square)", shortcut: "U", icon: Square },
  { id: "ellipse", label: "Ellipse (Shift: Circle)", shortcut: "O", icon: Circle },
  { id: "select", label: "Rectangular Select", shortcut: "M", icon: BoxSelect },
  { id: "move", label: "Move Layer / Selection", shortcut: "V", icon: Move },
];

const BRUSH_SIZES = [1, 2, 3, 4] as const;

export function ToolRail() {
  const service = useEditorService();
  const activeTool = useEditorStore((s) => s.activeTool);
  const brushSize = useEditorStore((s) => s.brushSize);
  const shapeFillMode = useEditorStore((s) => s.shapeFillMode);
  const fillMode = useEditorStore((s) => s.smartFillConfig.mode);
  const setRightPanelOpen = useEditorStore((s) => s.setRightPanelOpen);
  const setInspectorTab = useEditorStore((s) => s.setInspectorTab);
  const primaryColor = useEditorStore((s) => s.primaryColor);
  const secondaryColor = useEditorStore((s) => s.secondaryColor);
  const selection = useEditorStore((s) => s.documentMeta.selection);

  const showShapeOptions = activeTool === "rectangle" || activeTool === "ellipse";
  const showFillOptions = activeTool === "bucket";

  return (
    <aside className="flex w-[86px] shrink-0 flex-col items-center justify-between border-r border-white/8 bg-[#181b22] px-1.5 py-2.5 select-none">
      {/* Top: Piskel-style 2-column Tool Grid + Contextual Options */}
      <div className="flex w-full flex-col items-center gap-3">
        <div className="grid grid-cols-2 gap-1">
          {TOOL_ITEMS.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;
            return (
              <Tooltip key={tool.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant="tool"
                    size="icon"
                    data-active={isActive}
                    data-testid={`tool-${tool.id}`}
                    aria-label={`${tool.label} (${tool.shortcut})`}
                    onClick={() => service.setTool(tool.id)}
                    className="relative h-9 w-9"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="absolute bottom-0.5 right-1 font-mono text-[8px] opacity-55">
                      {tool.shortcut}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {tool.label} ({tool.shortcut})
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <div className="h-px w-full bg-white/8" />

        {/* Brush Size Selector */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
            Brush
          </span>
          <div className="grid grid-cols-2 gap-1">
            {BRUSH_SIZES.map((size) => {
              const isActive = brushSize === size;
              const boxPx = 4 + size * 2;
              return (
                <Tooltip key={size}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      data-active={isActive}
                      data-testid={`brush-size-${size}`}
                      aria-label={`Brush size ${size}px`}
                      onClick={() => service.setBrushSize(size)}
                      className="flex h-6 w-6 items-center justify-center rounded border border-transparent bg-[#12141a] transition-colors hover:border-white/20 data-[active=true]:border-amber-400 data-[active=true]:bg-amber-500/20 cursor-pointer"
                    >
                      <span
                        className="block rounded-[1px] bg-zinc-200"
                        style={{ width: boxPx, height: boxPx }}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Brush Size: {size}px ([ / ])
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Bucket Fill Mode Quick Toggle (Solid / Smart / Material) */}
        {showFillOptions && (
          <div className="flex w-full flex-col items-center gap-1">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
              Fill
            </span>
            <div className="flex w-full flex-col gap-1">
              {(
                [
                  ["solid", "Solid"],
                  ["smart", "Smart"],
                  ["material", "Mat"],
                ] as const
              ).map(([modeId, label]) => (
                <button
                  key={modeId}
                  type="button"
                  data-testid={`rail-fill-mode-${modeId}`}
                  data-active={fillMode === modeId}
                  onClick={() => {
                    service.setSmartFillConfig({ mode: modeId });
                    if (modeId !== "solid") {
                      setRightPanelOpen(true);
                      setInspectorTab("fill");
                    }
                  }}
                  className="rounded border border-white/10 bg-[#12141a] py-1 text-[10px] font-medium text-zinc-400 data-[active=true]:border-amber-400 data-[active=true]:bg-amber-500/20 data-[active=true]:text-amber-300 cursor-pointer"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Shape Fill Mode (Outline vs Filled) */}
        {showShapeOptions && (
          <div className="flex w-full flex-col items-center gap-1">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
              Shape
            </span>
            <div className="grid w-full grid-cols-2 gap-1">
              <button
                type="button"
                data-testid="shape-mode-outline"
                data-active={shapeFillMode === "outline"}
                onClick={() => service.setShapeFillMode("outline")}
                className="rounded border border-white/10 bg-[#12141a] py-1 text-[10px] text-zinc-400 data-[active=true]:border-amber-400 data-[active=true]:bg-amber-500/20 data-[active=true]:text-amber-300 cursor-pointer"
              >
                Line
              </button>
              <button
                type="button"
                data-testid="shape-mode-filled"
                data-active={shapeFillMode === "filled"}
                onClick={() => service.setShapeFillMode("filled")}
                className="rounded border border-white/10 bg-[#12141a] py-1 text-[10px] text-zinc-400 data-[active=true]:border-amber-400 data-[active=true]:bg-amber-500/20 data-[active=true]:text-amber-300 cursor-pointer"
              >
                Fill
              </button>
            </div>
          </div>
        )}

        {/* Active Selection Quick Controls */}
        {selection && (
          <div className="flex w-full flex-col items-center gap-1 rounded border border-sky-400/25 bg-sky-500/8 p-1">
            <span className="font-mono text-[9px] text-sky-300">
              {selection.width}×{selection.height}
            </span>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => service.cropCanvas()}
                    aria-label="Crop to Selection"
                  >
                    <Crop className="h-3 w-3 text-sky-300" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Crop to Selection</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => service.deleteSelection()}
                    aria-label="Delete Selected Pixels"
                  >
                    <Trash2 className="h-3 w-3 text-rose-400" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Clear Selected Pixels (Del)</TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}
      </div>

      {/* Bottom: Primary / Secondary Color Swatches + Swap */}
      <div className="flex flex-col items-center gap-2">
        <div className="relative h-11 w-11">
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                data-testid="secondary-color-swatch"
                title={`Secondary (Right-click): ${rgbaToHex(secondaryColor)}`}
                className="checkerboard-swatch absolute bottom-0 right-0 h-7 w-7 overflow-hidden rounded border border-white/25 shadow"
              >
                <div
                  className="h-full w-full"
                  style={{ backgroundColor: rgbaToCss(secondaryColor) }}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              Secondary (Right-click): {rgbaToHex(secondaryColor, true)}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div
                data-testid="primary-color-swatch"
                title={`Primary (Left-click): ${rgbaToHex(primaryColor)}`}
                className="checkerboard-swatch absolute left-0 top-0 h-7 w-7 overflow-hidden rounded border-2 border-zinc-100 shadow-md"
              >
                <div
                  className="h-full w-full"
                  style={{ backgroundColor: rgbaToCss(primaryColor) }}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              Primary (Left-click): {rgbaToHex(primaryColor, true)}
            </TooltipContent>
          </Tooltip>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => service.swapColors()}
              aria-label="Swap Primary and Secondary Colors"
              data-testid="swap-colors-btn"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Swap Colors (X)</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
