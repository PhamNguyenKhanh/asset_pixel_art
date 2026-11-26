"use client";

import React from "react";
import type { ToolId } from "@/types/editor";
import { useEditorStore } from "@/stores/editorStore";

const TOOL_LABELS: Record<ToolId, string> = {
  pencil: "Bút chì",
  eraser: "Tẩy",
  bucket: "Đổ màu",
  eyedropper: "Hút màu",
  line: "Đường thẳng",
  rectangle: "Hình chữ nhật",
  ellipse: "Hình elip",
  select: "Chọn vùng",
  move: "Di chuyển",
};

export function StatusBar() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const brushSize = useEditorStore((s) => s.brushSize);
  const cursorPixel = useEditorStore((s) => s.cursorPixel);
  const zoom = useEditorStore((s) => s.zoom);
  const docMeta = useEditorStore((s) => s.documentMeta);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);

  const activeLayer = docMeta.layers.find((l) => l.id === docMeta.activeLayerId);

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-white/8 bg-[#14171e] px-3 text-[11px] text-zinc-400 select-none">
      <div className="flex items-center gap-2.5">
        <span className="font-medium text-zinc-200">
          {TOOL_LABELS[activeTool]}
          {(activeTool === "pencil" || activeTool === "eraser" || activeTool === "line") && (
            <span className="ml-1 font-mono text-zinc-400">({brushSize}px)</span>
          )}
        </span>

        <span className="h-3 w-px bg-white/10" />

        <span data-testid="cursor-coords" className="min-w-[88px] font-mono text-zinc-300">
          {cursorPixel ? `X: ${cursorPixel.x}, Y: ${cursorPixel.y}` : "X: —, Y: —"}
        </span>

        {docMeta.selection && (
          <>
            <span className="h-3 w-px bg-white/10" />
            <span data-testid="selection-status" className="font-mono text-sky-300">
              Chọn: {docMeta.selection.width}×{docMeta.selection.height}
            </span>
          </>
        )}
      </div>

      <div className="hidden items-center gap-2 text-zinc-500 lg:flex">
        <span>Space + Kéo: Di chuyển</span>
        <span>&bull;</span>
        <span>Cuộn: Thu phóng</span>
        <span>&bull;</span>
        <span>, / . : Chuyển khung</span>
        {lastSavedAt && (
          <>
            <span>&bull;</span>
            <span className="text-emerald-400/80">Đã lưu cục bộ</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2.5 font-mono">
        <span className="hidden text-zinc-400 sm:inline">
          K{docMeta.activeFrameIndex + 1}/{docMeta.frameCount}
        </span>
        <span className="hidden h-3 w-px bg-white/10 sm:inline" />
        <span className="hidden max-w-[100px] truncate font-sans text-zinc-400 md:inline">
          {activeLayer?.name ?? "Layer 1"}
        </span>
        <span className="hidden h-3 w-px bg-white/10 md:inline" />
        <span>
          {docMeta.width}×{docMeta.height}
        </span>
        <span className="h-3 w-px bg-white/10" />
        <span>{Math.round(zoom * 100)}%</span>
      </div>
    </footer>
  );
}
