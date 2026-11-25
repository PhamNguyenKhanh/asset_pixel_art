"use client";

import React from "react";
import { ArrowLeftRight, Eraser, PaintBucket, Pencil, Pipette } from "lucide-react";
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
];

const BRUSH_SIZES = [1, 2, 3, 4] as const;

export function ToolRail() {
  const service = useEditorService();
  const activeTool = useEditorStore((s) => s.activeTool);
  const brushSize = useEditorStore((s) => s.brushSize);
  const primaryColor = useEditorStore((s) => s.primaryColor);
  const secondaryColor = useEditorStore((s) => s.secondaryColor);

  return (
    <aside className="flex w-14 shrink-0 flex-col items-center justify-between border-r border-white/8 bg-[#181b22] py-2.5 select-none">
      {/* Top: Drawing Tools + Brush Size */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex flex-col items-center gap-1">
          {TOOL_ITEMS.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;
            return (
              <Tooltip key={tool.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant="tool"
                    size="tool"
                    data-active={isActive}
                    data-testid={`tool-${tool.id}`}
                    aria-label={`${tool.label} (${tool.shortcut})`}
                    onClick={() => service.setTool(tool.id)}
                    className="relative"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="absolute bottom-0.5 right-1 font-mono text-[9px] opacity-60">
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

        <div className="h-px w-8 bg-white/10" />

        {/* Brush Size Selector (Piskel-style square footprints) */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
            Size
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
                      className="flex h-5 w-5 items-center justify-center rounded border border-transparent bg-[#12141a] transition-colors hover:border-white/20 data-[active=true]:border-amber-400 data-[active=true]:bg-amber-500/20 cursor-pointer"
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
      </div>

      {/* Bottom: Primary / Secondary Color Swatches + Swap */}
      <div className="flex flex-col items-center gap-2">
        <div className="relative h-11 w-11">
          {/* Secondary Color (Back-right) */}
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

          {/* Primary Color (Front-left) */}
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
