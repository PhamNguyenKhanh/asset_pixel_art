"use client";

import React from "react";
import { useEditorStore } from "@/stores/editorStore";

const TOOL_LABELS = {
  pencil: "Pencil",
  eraser: "Eraser",
  bucket: "Bucket Fill",
  eyedropper: "Color Picker",
} as const;

export function StatusBar() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const brushSize = useEditorStore((s) => s.brushSize);
  const cursorPixel = useEditorStore((s) => s.cursorPixel);
  const zoom = useEditorStore((s) => s.zoom);
  const docMeta = useEditorStore((s) => s.documentMeta);

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-white/8 bg-[#15181f] px-3 text-[11px] text-zinc-400 select-none">
      <div className="flex items-center gap-3">
        <span className="font-medium text-zinc-200">
          {TOOL_LABELS[activeTool]}
          {(activeTool === "pencil" || activeTool === "eraser") && (
            <span className="ml-1 font-mono text-zinc-400">({brushSize}px)</span>
          )}
        </span>

        <span className="h-3 w-px bg-white/10" />

        <span data-testid="cursor-coords" className="min-w-[92px] font-mono text-zinc-300">
          {cursorPixel ? `X: ${cursorPixel.x}, Y: ${cursorPixel.y}` : "X: —, Y: —"}
        </span>
      </div>

      <div className="hidden text-zinc-500 md:block">
        Space + Drag to pan &bull; Scroll wheel to zoom &bull; Right-click for secondary color
      </div>

      <div className="flex items-center gap-3 font-mono">
        <span>
          {docMeta.width}×{docMeta.height}
        </span>
        <span className="h-3 w-px bg-white/10" />
        <span>{Math.round(zoom * 100)}%</span>
      </div>
    </footer>
  );
}
