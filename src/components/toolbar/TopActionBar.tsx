"use client";

import React from "react";
import {
  FilePlus2,
  Grid3x3,
  Maximize2,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEditorService } from "@/hooks/EditorContext";
import { useEditorStore } from "@/stores/editorStore";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TopActionBarProps {
  onOpenNewCanvas: () => void;
}

export function TopActionBar({ onOpenNewCanvas }: TopActionBarProps) {
  const service = useEditorService();
  const docMeta = useEditorStore((s) => s.documentMeta);
  const zoom = useEditorStore((s) => s.zoom);
  const showGrid = useEditorStore((s) => s.showGrid);
  const rightPanelOpen = useEditorStore((s) => s.rightPanelOpen);
  const setRightPanelOpen = useEditorStore((s) => s.setRightPanelOpen);

  const zoomPercent = Math.round(zoom * 100);

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-white/8 bg-[#181b22] px-3 select-none">
      {/* Left: Brand + Document Info + New Canvas */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div
            aria-hidden="true"
            className="grid h-6 w-6 grid-cols-2 gap-[2px] rounded bg-amber-500/15 p-1 ring-1 ring-amber-400/40"
          >
            <span className="rounded-[1px] bg-amber-400" />
            <span className="rounded-[1px] bg-amber-300/40" />
            <span className="rounded-[1px] bg-amber-300/40" />
            <span className="rounded-[1px] bg-amber-400" />
          </div>
          <span className="text-xs font-semibold tracking-wide text-zinc-100">
            PIXEL ART STUDIO
          </span>
        </div>

        <div className="h-4 w-px bg-white/10" />

        <div className="flex items-center gap-2">
          <span className="max-w-[160px] truncate text-xs font-medium text-zinc-300">
            {docMeta.name}
          </span>
          <span
            data-testid="canvas-size-badge"
            className="rounded border border-white/10 bg-[#111318] px-1.5 py-0.5 font-mono text-[11px] text-zinc-400"
          >
            {docMeta.width}×{docMeta.height}
          </span>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenNewCanvas}
              data-testid="new-canvas-btn"
            >
              <FilePlus2 className="h-3.5 w-3.5 text-amber-400" />
              <span>New</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Create New Canvas</TooltipContent>
        </Tooltip>
      </div>

      {/* Center: Undo / Redo + Zoom + Grid */}
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-0.5 rounded-md border border-white/8 bg-[#12141a] p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={!docMeta.canUndo}
                onClick={() => service.undo()}
                aria-label="Undo"
                data-testid="undo-btn"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={!docMeta.canRedo}
                onClick={() => service.redo()}
                aria-label="Redo"
                data-testid="redo-btn"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Shift+Z / Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>

        <div className="mx-1.5 h-4 w-px bg-white/10" />

        <div className="flex items-center gap-0.5 rounded-md border border-white/8 bg-[#12141a] p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => service.zoomOut()}
                aria-label="Zoom Out"
                data-testid="zoom-out-btn"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom Out (-)</TooltipContent>
          </Tooltip>

          <span
            data-testid="zoom-readout"
            className="min-w-[52px] text-center font-mono text-[11px] text-zinc-300"
          >
            {zoomPercent}%
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => service.zoomIn()}
                aria-label="Zoom In"
                data-testid="zoom-in-btn"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom In (+)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => service.fitViewport()}
                aria-label="Fit Canvas to Viewport"
                data-testid="zoom-fit-btn"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit Canvas (0)</TooltipContent>
          </Tooltip>
        </div>

        <div className="mx-1.5 h-4 w-px bg-white/10" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="tool"
              size="sm"
              data-active={showGrid}
              onClick={() => service.toggleGrid()}
              aria-label="Toggle Pixel Grid"
              data-testid="grid-toggle-btn"
              className="h-8 px-2.5"
            >
              <Grid3x3 className="h-3.5 w-3.5" />
              <span>Grid</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle Pixel Grid (G)</TooltipContent>
        </Tooltip>
      </div>

      {/* Right: Panel Collapse Toggle */}
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              aria-label={rightPanelOpen ? "Hide Color Panel" : "Show Color Panel"}
              data-testid="toggle-right-panel-btn"
            >
              {rightPanelOpen ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {rightPanelOpen ? "Hide Color Panel" : "Show Color Panel"}
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
